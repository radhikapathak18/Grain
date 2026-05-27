import { PRODUCT_LABELS } from '@grain/types';
import { useClaim } from '../hooks/useClaims';
import { useEvidencePanelStore } from '../state/evidencePanel';
import { TrustBadgeRow } from './TrustBadgeRow';

type Props = { claimId: string };

export function CitationCard({ claimId }: Props) {
  const { data: claim, isLoading } = useClaim(claimId);

  function handleClick() {
    useEvidencePanelStore.getState().openPanel(claimId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  if (isLoading || !claim) {
    return (
      <div
        className="p-3.5 rounded-xl border border-border bg-bg animate-pulse grain-shadow-soft"
        style={{ minHeight: 88 }}
        aria-busy="true"
      >
        <div className="h-3 w-20 bg-surface rounded mb-2" />
        <div className="h-3 w-full bg-surface rounded mb-1" />
        <div className="h-3 w-3/4 bg-surface rounded" />
      </div>
    );
  }

  const productLabel = PRODUCT_LABELS[claim.product] ?? claim.product;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group p-3.5 rounded-xl border border-border bg-bg hover:border-accent/40 hover:-translate-y-0.5 grain-shadow-soft hover:grain-shadow-card transition-all duration-200 cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-xs text-accent font-semibold tracking-tight">
          {claim.id}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted font-semibold truncate">
          {productLabel}
        </span>
      </div>

      <p className="text-sm text-fg leading-snug line-clamp-2 mb-3">
        {claim.text}
      </p>

      <TrustBadgeRow claim={claim} />
    </div>
  );
}
