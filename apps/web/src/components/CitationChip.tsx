import { useClaim } from '../hooks/useClaims';
import { useEvidencePanelStore } from '../state/evidencePanel';

type Props = { claimId: string };

export function CitationChip({ claimId }: Props) {
  const { data: claim } = useClaim(claimId);

  const snippet = claim?.text ? claim.text.slice(0, 100) : claimId;
  const title = claim?.text && claim.text.length > 100 ? `${snippet}…` : snippet;

  function handleClick() {
    useEvidencePanelStore.getState().openPanel(claimId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className="inline-flex items-baseline align-baseline mx-0.5 px-1.5 py-0.5 text-xs rounded-md font-mono bg-accent-subtle text-accent border border-accent/40 hover:border-accent hover:bg-accent/10 transition-colors cursor-pointer"
    >
      {claimId}
    </button>
  );
}
