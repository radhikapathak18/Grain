// Vertical list of EmergingIssue cards. Each item gets a small AlertTriangle
// icon, the issue title, a product chip, a formatted "first seen" date, and
// the evidence count.

import type { EmergingIssue, ProductId } from '@grain/types';
import { AlertTriangle } from 'lucide-react';

const PRODUCT_LABELS: Record<ProductId, string> = {
  'helix-core': 'Helix Core',
  p4v: 'P4V',
  'helix-swarm': 'Helix Swarm',
};

function productLabel(id: ProductId): string {
  return PRODUCT_LABELS[id] ?? id;
}

function formatFirstSeen(iso: string): string {
  // ISO date -> "Feb 18, 2026". Falls back to the input if Date.parse fails.
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function EmergingIssuesList({ issues }: { issues: EmergingIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-sm text-muted border border-dashed border-border rounded-md p-4">
        No emerging issues surfaced this period.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className="bg-bg border border-border rounded-md p-4 flex gap-3"
        >
          <div className="shrink-0 mt-0.5 text-accent" aria-hidden="true">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="font-medium text-fg leading-snug">
                {issue.title}
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted shrink-0">
                {productLabel(issue.product)}
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {issue.summary}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle pt-1">
              <span>
                First seen{' '}
                <span className="text-fg">
                  {formatFirstSeen(issue.firstSeen)}
                </span>
              </span>
              <span>·</span>
              <span>
                <span className="text-fg font-mono">
                  {issue.evidence_count}
                </span>{' '}
                evidence item{issue.evidence_count === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
