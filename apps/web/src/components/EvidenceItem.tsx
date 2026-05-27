import {
  Phone,
  Video,
  MessageSquare,
  BarChart3,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type { Evidence, SourceType } from '@grain/types';

type Props = {
  evidence: Evidence;
  onOpenSource: (sourceId: string, passage: string) => void;
};

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

// Descriptive caption rendered under the source label. Names the *kind*
// of evidence (verbatim quote, summary, metric) rather than the tool it
// came from, so the panel makes source-type diversity readable at a
// glance once the corpus mixes interviews, call summaries, and metrics.
const SOURCE_TYPE_TAG: Record<SourceType, string> = {
  zoom: 'Research interview',
  gong: 'Customer call',
  slack: 'Call summary via Slack',
  pendo: 'Pendo metric',
  confluence: 'Internal doc',
};

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const now = Date.now();
  const diffMs = now - then;
  const dayMs = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / dayMs);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function EvidenceItem({ evidence, onOpenSource }: Props) {
  const Icon = SOURCE_ICON[evidence.source_type];
  const label = SOURCE_LABEL[evidence.source_type];
  const typeTag = SOURCE_TYPE_TAG[evidence.source_type];

  const labelParts = [label];
  if (evidence.customer) labelParts.push(evidence.customer);
  labelParts.push(relativeDate(evidence.source_date));

  return (
    <div className="bg-surface border border-border rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5 text-muted">
          <Icon size={16} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0 leading-snug">
          <div className="text-xs text-muted">{labelParts.join(' · ')}</div>
          <div className="text-[11px] text-subtle mt-0.5">{typeTag}</div>
        </div>
      </div>

      <blockquote className="border-l-4 border-border-strong pl-3 italic text-sm text-fg leading-relaxed">
        {evidence.passage}
      </blockquote>

      <div>
        <button
          type="button"
          onClick={() => onOpenSource(evidence.source_id, evidence.passage)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-bg text-xs text-accent font-medium hover:border-accent hover:bg-accent-subtle transition-colors"
        >
          View full source
          <ExternalLink size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
