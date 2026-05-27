import { useEffect, useMemo, type ReactNode } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Phone,
  Video,
  MessageSquare,
  BarChart3,
  FileText,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { fetchSource, type SourceDocument } from '../lib/api';

type SourceType = SourceDocument['type'];

const SOURCE_ICON: Record<SourceType, typeof Phone> = {
  gong: Phone,
  zoom: Video,
  slack: MessageSquare,
  pendo: BarChart3,
  confluence: FileText,
};

const SOURCE_LABEL: Record<SourceType, string> = {
  gong: 'Gong call',
  zoom: 'Zoom interview',
  slack: 'Slack message',
  pendo: 'Pendo signal',
  confluence: 'Confluence doc',
};

const BODY_HEADING: Record<SourceType, string> = {
  gong: 'Full transcript',
  zoom: 'Full transcript',
  slack: 'Full thread',
  pendo: 'Full document',
  confluence: 'Full document',
};

// Rendered in place of a transcript when the source document is a
// placeholder (no anonymized body on file — only the cited passages
// above are real). Keep these short and source-type specific so the
// reason for the absence reads at a glance.
const PLACEHOLDER_NOTICE: Record<SourceType, string> = {
  zoom: 'Research interview transcript (anonymized, internal)',
  slack: 'Slack thread summary (anonymized, internal)',
  pendo: 'Pendo analytics aggregation (internal)',
  gong: 'Customer call recording (anonymized, internal)',
  confluence: 'Internal Confluence document',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Collapse runs of whitespace + strip surrounding punctuation so two strings
// that differ only by spacing or trailing punctuation compare equal.
function normalizeForMatch(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\s.,;:!?—–-]+$/g, '').trim();
}

// Locate `passage` inside `body` after whitespace-normalizing both. Returns
// the start offset *into the original body* and the length of the matched
// span (which may differ slightly from passage.length due to spacing).
function findFuzzy(
  body: string,
  passage: string,
): { start: number; length: number } | null {
  const target = normalizeForMatch(passage);
  if (!target) return null;

  // Walk the body and build a parallel normalized string while remembering
  // each normalized character's origin offset in the body. This lets us map
  // a match in the normalized string back to body coordinates.
  const normChars: string[] = [];
  const origIdx: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (/\s/.test(c)) {
      if (prevSpace) continue;
      normChars.push(' ');
      origIdx.push(i);
      prevSpace = true;
    } else {
      normChars.push(c);
      origIdx.push(i);
      prevSpace = false;
    }
  }
  const norm = normChars.join('');
  const hit = norm.indexOf(target);
  if (hit === -1) return null;

  const startInBody = origIdx[hit] ?? 0;
  const endNorm = hit + target.length - 1;
  const endInBodyIdx = origIdx[endNorm];
  const endInBody = (endInBodyIdx ?? startInBody) + 1;
  return { start: startInBody, length: Math.max(1, endInBody - startInBody) };
}

/**
 * Walk the body text, replacing each excerpt passage with a marker, then split
 * and render text + <mark> segments.
 *
 * Tries an exact match first, then a whitespace-normalized fallback so passages
 * that differ from the body only by spacing or trailing punctuation still
 * highlight. Logs a console.warn if a passage cannot be located at all — that's
 * a demo signal worth seeing in DevTools.
 *
 * Sort passages by length (longest first) so a passage that contains another
 * doesn't get clobbered by the shorter one.
 */
function renderBodyWithHighlights(
  body: string,
  excerpts: SourceDocument['excerpts'],
  focusIdx: number,
): ReactNode[] {
  if (excerpts.length === 0) {
    return [body];
  }

  const ordered = excerpts
    .map((e, idx) => ({ idx, passage: e.passage }))
    .filter((e) => e.passage.length > 0)
    .sort((a, b) => b.passage.length - a.passage.length);

  let working = body;
  const placed: number[] = [];
  for (const { idx, passage } of ordered) {
    let pos = working.indexOf(passage);
    let matchLen = passage.length;
    if (pos === -1) {
      const fuzzy = findFuzzy(working, passage);
      if (fuzzy) {
        pos = fuzzy.start;
        matchLen = fuzzy.length;
      }
    }
    if (pos === -1) {
      console.warn(
        `[SourceView] passage not found in body (excerpt ${idx}): ${passage.slice(0, 80)}…`,
      );
      continue;
    }
    const marker = ` MARK${idx} `;
    working = working.slice(0, pos) + marker + working.slice(pos + matchLen);
    placed.push(idx);
  }

  if (placed.length === 0) {
    return [body];
  }

  const pattern = / MARK(\d+) /g;
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(working)) !== null) {
    if (match.index > lastIndex) {
      out.push(
        <span key={`t-${key++}`}>{working.slice(lastIndex, match.index)}</span>,
      );
    }
    const idx = Number(match[1]);
    const passage = excerpts[idx]?.passage ?? '';
    const isFocus = focusIdx >= 0 && idx === focusIdx;
    out.push(
      <mark
        key={`m-${idx}`}
        id={`excerpt-${idx}`}
        className={
          isFocus
            ? 'bg-tier-2-bg text-fg px-1 rounded ring-2 ring-tier-2'
            : 'bg-accent-subtle text-fg px-1 rounded'
        }
      >
        {passage}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < working.length) {
    out.push(<span key={`t-${key++}`}>{working.slice(lastIndex)}</span>);
  }
  return out;
}

export function SourceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const passageParam = searchParams.get('passage');

  const sourceId = id ?? '';

  const { data, isLoading, isError, error } = useQuery<SourceDocument, Error>({
    queryKey: ['source', sourceId],
    queryFn: () => fetchSource(sourceId),
    enabled: sourceId.length > 0,
  });

  // Resolve the focus excerpt by exact-then-fuzzy comparison so a deep link
  // built from a slightly-paraphrased passage still finds and scrolls to
  // the right highlight.
  const focusIdx = useMemo(() => {
    if (!passageParam || !data) return -1;
    const exact = data.excerpts.findIndex((e) => e.passage === passageParam);
    if (exact >= 0) return exact;
    const normTarget = normalizeForMatch(passageParam);
    if (!normTarget) return -1;
    return data.excerpts.findIndex(
      (e) => normalizeForMatch(e.passage) === normTarget,
    );
  }, [passageParam, data]);

  useEffect(() => {
    if (focusIdx < 0) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`excerpt-${focusIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [focusIdx]);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div
        id="main"
        className="max-w-3xl w-full mx-auto px-6 py-8 space-y-6"
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back
        </button>

        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            message={error?.message ?? 'Source not found'}
            onBack={() => navigate(-1)}
          />
        )}

        {data && <SourceContent doc={data} focusIdx={focusIdx} />}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="h-8 w-1/2 bg-surface rounded-md animate-pulse" />
      <div className="h-4 w-1/3 bg-surface rounded-md animate-pulse" />
      <div className="h-40 w-full bg-surface rounded-md animate-pulse" />
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="border border-border rounded-md bg-surface p-4 flex items-start gap-3">
      <div className="text-error shrink-0 mt-0.5">
        <AlertCircle size={18} aria-hidden="true" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-fg">Source not found</div>
        <div className="text-sm text-muted mt-1">{message}</div>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back
        </button>
      </div>
    </div>
  );
}

function SourceContent({
  doc,
  focusIdx,
}: {
  doc: SourceDocument;
  focusIdx: number;
}) {
  const Icon = SOURCE_ICON[doc.type];
  const typeLabel = SOURCE_LABEL[doc.type];
  const bodyHeading = BODY_HEADING[doc.type];
  const isPlaceholder = doc.placeholder === true;

  const subtitleParts = [typeLabel];
  if (doc.customer) subtitleParts.push(doc.customer);
  subtitleParts.push(formatDate(doc.date));
  if (isPlaceholder) subtitleParts.push(doc.id);

  return (
    <>
      <header className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-1 text-muted">
            <Icon size={28} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-fg leading-tight">
              {doc.title}
            </h1>
            <div className="text-sm text-muted mt-1">
              {subtitleParts.join(' · ')}
            </div>
            {doc.participants && doc.participants.length > 0 && (
              <div className="text-sm text-muted mt-1">
                Participants: {doc.participants.join(', ')}
              </div>
            )}
          </div>
        </div>
      </header>

      {doc.excerpts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-fg">
            {isPlaceholder
              ? `Cited passages (${doc.excerpts.length})`
              : `This claim was supported by ${doc.excerpts.length} excerpt${doc.excerpts.length === 1 ? '' : 's'}:`}
          </h2>
          <ul className="space-y-3">
            {doc.excerpts.map((excerpt, idx) => (
              <li key={`${idx}-${excerpt.offset_hint}-${idx}`}>
                <blockquote className="border-l-4 border-accent pl-3 italic text-sm text-fg leading-relaxed">
                  {excerpt.passage}
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isPlaceholder ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-fg">Source</h2>
          <div className="border border-border rounded-md bg-surface p-4 text-sm text-muted leading-relaxed">
            {PLACEHOLDER_NOTICE[doc.type]}. The full document is not bundled
            with this build — the cited passages above are the parts of the
            source captured in the claim corpus.
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-fg">{bodyHeading}:</h2>
          <div className="whitespace-pre-wrap text-fg leading-relaxed bg-surface p-4 rounded-md text-sm">
            {renderBodyWithHighlights(doc.body, doc.excerpts, focusIdx)}
          </div>
        </section>
      )}
    </>
  );
}
