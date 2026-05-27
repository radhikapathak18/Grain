// All-evidence report subpage.
//
// Fetches the full claims corpus and flattens each claim's evidence array
// into a unified list. Groups evidence by source_type in the canonical order:
// zoom → gong → pendo → confluence → slack.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  MessageSquare,
  Phone,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Evidence, SourceType } from '@grain/types';
import { AppHeader } from '../components/AppHeader';
import { EvidencePanel } from '../components/EvidencePanel';
import { fetchAllClaims } from '../lib/api';
import { useEvidencePanelStore } from '../state/evidencePanel';

// Source type display configuration — canonical display order enforced below.
const SOURCE_ICON: Record<SourceType, LucideIcon> = {
  zoom: Video,
  gong: Phone,
  pendo: BarChart3,
  confluence: FileText,
  slack: MessageSquare,
};

const SOURCE_LABEL: Record<SourceType, string> = {
  zoom: 'Zoom interview',
  gong: 'Gong call',
  pendo: 'Pendo signal',
  confluence: 'Confluence doc',
  slack: 'Slack thread',
};

const SOURCE_ORDER: SourceType[] = ['zoom', 'gong', 'pendo', 'confluence', 'slack'];

type EnrichedEvidence = Evidence & {
  claimId: string;
  claimText: string;
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

function EvidenceRow({ item }: { item: EnrichedEvidence }) {
  const Icon = SOURCE_ICON[item.source_type];

  function handleClaimChipClick() {
    useEvidencePanelStore.getState().openPanel(item.claimId);
  }

  return (
    <div className="bg-bg border border-border rounded-xl p-4 grain-shadow-card flex gap-3">
      {/* Source icon */}
      <div className="shrink-0 mt-0.5 text-muted">
        <Icon size={16} aria-hidden="true" />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-fg leading-relaxed line-clamp-3">
          {item.passage}
        </p>
        <div className="text-xs text-muted">
          {formatDate(item.source_date)}
          {item.customer ? ` · ${item.customer}` : ''}
        </div>
      </div>

      {/* Claim ID chip */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={handleClaimChipClick}
          className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-fg cursor-pointer hover:border-accent/40 transition-colors"
          title={`Open evidence for ${item.claimId}`}
        >
          {item.claimId}
        </button>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-40 bg-surface rounded animate-pulse" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-20 bg-surface rounded-xl animate-pulse border border-border"
        />
      ))}
    </div>
  );
}

export function ReportEvidenceView() {
  const { data: claims, isPending, error } = useQuery({
    queryKey: ['claims', 'all'],
    queryFn: fetchAllClaims,
    staleTime: 60_000,
  });

  // Flatten and enrich evidence across all claims.
  const allEvidence = useMemo<EnrichedEvidence[]>(() => {
    if (!claims) return [];
    return claims.flatMap((claim) =>
      claim.evidence.map((e) => ({
        ...e,
        claimId: claim.id,
        claimText: claim.text,
      })),
    );
  }, [claims]);

  // Group by source_type — only include types that have at least one item.
  const groupedEvidence = useMemo(() => {
    const map = new Map<SourceType, EnrichedEvidence[]>();
    for (const item of allEvidence) {
      const existing = map.get(item.source_type) ?? [];
      existing.push(item);
      map.set(item.source_type, existing);
    }
    return SOURCE_ORDER.filter((t) => (map.get(t)?.length ?? 0) > 0).map(
      (t) => ({ type: t, items: map.get(t)! }),
    );
  }, [allEvidence]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      <main id="main" className="max-w-4xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
        {/* Back button */}
        <Link
          to="/report"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Report
        </Link>

        {/* Page header */}
        <header className="flex items-center gap-3 grain-fade-up">
          <h1 className="grain-display text-3xl font-semibold text-fg">Evidence items</h1>
          {!isPending && !error && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-mono tabular-nums">
              {allEvidence.length}
            </span>
          )}
        </header>

        {/* Error state */}
        {error && (
          <div className="p-4 border border-border rounded-xl bg-surface text-sm text-muted">
            Could not load evidence:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {/* Loading skeleton */}
        {isPending && !error && (
          <div className="space-y-8">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        )}

        {/* Evidence groups */}
        {!isPending &&
          !error &&
          groupedEvidence.map(({ type, items }) => {
            const Icon = SOURCE_ICON[type];
            const label = SOURCE_LABEL[type];
            return (
              <section key={type} className="space-y-3">
                <header className="flex items-center gap-2">
                  <Icon size={16} className="text-muted" aria-hidden="true" />
                  <span className="text-sm font-semibold text-fg">{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-mono tabular-nums">
                    {items.length}
                  </span>
                </header>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <EvidenceRow key={`${item.claimId}-${item.source_id}-${idx}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
      </main>

      <EvidencePanel />
    </div>
  );
}
