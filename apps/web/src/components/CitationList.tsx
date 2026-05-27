import { useState } from 'react';
import { ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { CitationCard } from './CitationCard';

type Props = {
  citationIds: string[];
  defaultVisible?: number;
};

/**
 * Cited list — shows the top N CitationCards by default with a "Show all"
 * toggle. Prevents 13+ stacked cards from drowning the answer.
 */
export function CitationList({ citationIds, defaultVisible = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (citationIds.length === 0) return null;

  const hidden = Math.max(0, citationIds.length - defaultVisible);
  const showToggle = hidden > 0;
  const visible = expanded ? citationIds : citationIds.slice(0, defaultVisible);

  return (
    <section className="mt-3 w-full flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Quote size={12} aria-hidden="true" />
          Cited ({citationIds.length})
        </h3>
        {showToggle && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                Show top {defaultVisible}
                <ChevronUp size={12} />
              </>
            ) : (
              <>
                Show all {citationIds.length}
                <ChevronDown size={12} />
              </>
            )}
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((id) => (
          <CitationCard key={id} claimId={id} />
        ))}
      </div>

      {!expanded && showToggle && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-xs text-muted hover:text-fg transition-colors"
        >
          + {hidden} more
        </button>
      )}
    </section>
  );
}
