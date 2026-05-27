import { ShieldCheck, FileStack, Clock } from 'lucide-react';
import type { Claim, TrustTier } from '@grain/types';

const TIER_LABEL: Record<TrustTier, string> = {
  T1: 'T1 · Research interviews (highest trust)',
  T2: 'T2 · Sales calls / product analytics',
  T3: 'T3 · Internal chat / docs (lowest trust)',
};

// Slight tint shift on the recency badge: still grey-anchored but the
// numeric reads in the tier color so the eye picks it up faster.
const TIER_CLASSES: Record<TrustTier, string> = {
  T1: 'bg-tier-1-bg text-tier-1 border-tier-1/30',
  T2: 'bg-tier-2-bg text-tier-2 border-tier-2/30',
  T3: 'bg-tier-3-bg text-tier-3 border-tier-3/40',
};

// Parse the ISO once and derive both the label and the recency color from
// the same day count. Avoids drift between the two bucketings.
function describeRecency(iso: string): { label: string; className: string } {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return { label: '—', className: 'text-muted' };
  const days = Math.max(
    0,
    Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)),
  );

  let label: string;
  if (days < 7) label = `${days}d ago`;
  else if (days < 30) label = `${Math.floor(days / 7)}w ago`;
  else if (days < 365) label = `${Math.floor(days / 30)}mo ago`;
  else label = `${Math.floor(days / 365)}y ago`;

  let className: string;
  if (days < 30) className = 'text-recency-fresh';
  else if (days < 180) className = 'text-recency-medium';
  else className = 'text-recency-stale';

  return { label, className };
}

type Props = { claim: Claim };

export function TrustBadgeRow({ claim }: Props) {
  const tier = claim.trust_tier;
  const { label: rel, className: recClass } = describeRecency(
    claim.most_recent_evidence_at,
  );

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        title={TIER_LABEL[tier]}
        className={`inline-flex items-center gap-1 h-[22px] px-1.5 rounded-full border text-[10px] font-semibold tracking-tight ${TIER_CLASSES[tier]}`}
      >
        <ShieldCheck size={11} aria-hidden="true" strokeWidth={2.4} />
        {tier}
      </span>

      <span
        title={`${claim.evidence_count} evidence ${claim.evidence_count === 1 ? 'item' : 'items'}`}
        className="inline-flex items-center gap-1 h-[22px] px-1.5 rounded-full border border-border bg-surface/80 text-[10px] font-medium text-muted"
      >
        <FileStack size={11} aria-hidden="true" />
        <span className="text-fg font-semibold">{claim.evidence_count}</span>
      </span>

      <span
        title={`Most recent evidence: ${new Date(claim.most_recent_evidence_at).toLocaleDateString()}`}
        className={`inline-flex items-center gap-1 h-[22px] px-1.5 rounded-full border border-border bg-surface/80 text-[10px] font-semibold ${recClass}`}
      >
        <Clock size={11} aria-hidden="true" />
        {rel}
      </span>
    </div>
  );
}
