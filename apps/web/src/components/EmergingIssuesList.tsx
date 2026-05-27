// Vertical list of EmergingIssue cards grouped into High / Medium / Low
// severity tiers. Each tier renders a labelled section header only when it
// contains at least one issue. Within a tier, issues are sorted by
// evidence_count descending.

import {
  PRODUCT_LABELS,
  type EmergingIssue,
  type ProductId,
} from '@grain/types';
import { AlertTriangle } from 'lucide-react';

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

type Severity = 'high' | 'medium' | 'low';

const SEVERITY_TIERS: {
  severity: Severity;
  label: string;
  badgeClass: string;
  dotClass: string;
  iconClass: string;
  cardBorderClass: string;
}[] = [
  {
    severity: 'high',
    label: 'High',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    dotClass: 'bg-red-500',
    iconClass: 'text-red-500',
    cardBorderClass: 'border-l-[3px] border-l-red-400',
  },
  {
    severity: 'medium',
    label: 'Medium',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    dotClass: 'bg-amber-500',
    iconClass: 'text-amber-500',
    cardBorderClass: 'border-l-[3px] border-l-amber-400',
  },
  {
    severity: 'low',
    label: 'Low',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200',
    dotClass: 'bg-blue-500',
    iconClass: 'text-blue-500',
    cardBorderClass: 'border-l-[3px] border-l-blue-400',
  },
];

function IssueCard({
  issue,
  iconClass,
  cardBorderClass,
}: {
  issue: EmergingIssue;
  iconClass: string;
  cardBorderClass: string;
}) {
  return (
    <li className={`bg-bg border border-border rounded-md p-4 flex gap-3 overflow-hidden ${cardBorderClass}`}>
      <div className={`shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true">
        <AlertTriangle size={18} />
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="font-medium text-fg leading-snug">{issue.title}</h4>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted shrink-0">
            {productLabel(issue.product)}
          </span>
        </div>
        <p className="text-sm text-muted leading-relaxed">{issue.summary}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle pt-1">
          <span>
            First seen{' '}
            <span className="text-fg">{formatFirstSeen(issue.firstSeen)}</span>
          </span>
          <span>·</span>
          <span>
            <span className="text-fg font-mono">{issue.evidence_count}</span>{' '}
            evidence item{issue.evidence_count === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </li>
  );
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
    <div className="space-y-6">
      {SEVERITY_TIERS.map(({ severity, label, badgeClass, dotClass, iconClass, cardBorderClass }) => {
        const tierIssues = issues
          .filter((i) => i.severity === severity)
          .sort((a, b) => b.evidence_count - a.evidence_count);

        if (tierIssues.length === 0) return null;

        const count = tierIssues.length;
        const countLabel = `${count} issue${count === 1 ? '' : 's'}`;

        return (
          <section key={severity} aria-label={`${label} severity issues`}>
            <h3 className="flex items-center gap-2 text-sm font-medium text-fg mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold ${badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
                {label}
              </span>
              <span className="text-subtle">· {countLabel}</span>
            </h3>
            <ul className="space-y-3">
              {tierIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} iconClass={iconClass} cardBorderClass={cardBorderClass} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
