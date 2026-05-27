import { ShieldCheck, FileStack, Clock } from 'lucide-react';
import type { Claim, TrustTier } from '@grain/types';

const TIER_LABEL: Record<TrustTier, string> = {
  T1: 'T1 · Research interviews (highest trust)',
  T2: 'T2 · Sales calls / product analytics',
  T3: 'T3 · Internal chat / docs (lowest trust)',
};

const TIER_CLASSES: Record<TrustTier, string> = {
  T1: 'bg-tier-1-bg text-tier-1 border-tier-1/30',
  T2: 'bg-tier-2-bg text-tier-2 border-tier-2/30',
  T3: 'bg-tier-3-bg text-tier-3 border-tier-3/30',
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function recencyClass(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'text-muted';
  const days = Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
  if (days < 30) return 'text-recency-fresh';
  if (days < 180) return 'text-recency-medium';
  return 'text-recency-stale';
}

type Props = { claim: Claim };

export function TrustBadgeRow({ claim }: Props) {
  const tier = claim.trust_tier;
  const rel = formatRelative(claim.most_recent_evidence_at);
  const recClass = recencyClass(claim.most_recent_evidence_at);

  return (
    <div className="inline-flex items-center gap-2">
      <span
        title={TIER_LABEL[tier]}
        className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[10px] font-medium ${TIER_CLASSES[tier]}`}
      >
        <ShieldCheck size={11} aria-hidden="true" />
        {tier}
      </span>

      <span
        title={`${claim.evidence_count} evidence ${claim.evidence_count === 1 ? 'item' : 'items'}`}
        className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md border border-border bg-surface text-[10px] font-medium text-fg"
      >
        <FileStack size={11} aria-hidden="true" />
        {claim.evidence_count}
      </span>

      <span
        title={`Most recent evidence: ${new Date(claim.most_recent_evidence_at).toLocaleDateString()}`}
        className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border border-border bg-surface text-[10px] font-medium ${recClass}`}
      >
        <Clock size={11} aria-hidden="true" />
        {rel}
      </span>
    </div>
  );
}
