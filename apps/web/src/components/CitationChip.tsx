import { useClaim } from '../hooks/useClaims';
import { useEvidencePanelStore } from '../state/evidencePanel';

type Props = { claimId: string };

// Take the first N words from a claim's text — gives the audience a
// glimpse of what's behind a citation without opening the panel.
function firstWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return words.join(' ');
  return `${words.slice(0, n).join(' ')}…`;
}

export function CitationChip({ claimId }: Props) {
  const { data: claim } = useClaim(claimId);

  const snippet = claim?.text ? firstWords(claim.text, 5) : null;
  const tooltip = claim?.text
    ? claim.text.length > 140
      ? `${claim.text.slice(0, 140)}…`
      : claim.text
    : claimId;

  function handleClick() {
    useEvidencePanelStore.getState().openPanel(claimId);
  }

  // Lighter visual weight than a filled pill so clusters of chips
  // (e.g. "[CL-0002][CL-0030][CL-0026]") don't visually drown the prose.
  return (
    <button
      type="button"
      onClick={handleClick}
      title={tooltip}
      className="inline-flex items-baseline align-baseline mx-0.5 px-1.5 py-0 text-[11px] rounded border border-accent/30 bg-accent-subtle/50 hover:bg-accent-subtle hover:border-accent transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40 max-w-[24rem]"
    >
      <span className="font-mono text-accent">{claimId}</span>
      {snippet && (
        <span className="ml-1 text-fg/80 truncate">{snippet}</span>
      )}
    </button>
  );
}
