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
        className="p-3 rounded-md border border-border bg-bg animate-pulse"
        style={{ minHeight: 80 }}
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
      className="p-3 rounded-md border border-border bg-bg hover:border-border-strong hover:bg-surface/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-xs text-accent">{claim.id}</span>
        <span className="text-xs text-muted truncate">{productLabel}</span>
      </div>

      <p className="text-sm text-fg leading-snug line-clamp-2 mb-2.5">
        {claim.text}
      </p>

      <TrustBadgeRow claim={claim} />
    </div>
  );
}
