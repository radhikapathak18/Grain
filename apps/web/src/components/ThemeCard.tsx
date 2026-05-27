// One block card for a ReportTheme. Renders:
//   - title row with trend arrow
//   - short summary
//   - a 20-block frequency bar (filled vs empty)
//   - per-product mini-counts
//   - footer of top-claim citation pills that open the EvidencePanel on click

import { PRODUCT_LABELS, type ProductId, type ReportTheme } from '@grain/types';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useEvidencePanelStore } from '../state/evidencePanel';

function productLabel(id: ProductId): string {
  return PRODUCT_LABELS[id] ?? id;
}

const FREQUENCY_BLOCKS = 20;

function TrendIcon({ trend }: { trend: ReportTheme['trend'] }) {
  if (trend === 'up') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-warning"
        title="Trending up — pain point growing"
      >
        <TrendingUp size={14} aria-hidden="true" />
        up
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted"
        title="Trending down"
      >
        <TrendingDown size={14} aria-hidden="true" />
        down
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted"
      title="Flat"
    >
      <Minus size={14} aria-hidden="true" />
      flat
    </span>
  );
}

export function ThemeCard({
  theme,
  maxFrequency,
}: {
  theme: ReportTheme;
  maxFrequency: number;
}) {
  const openPanel = useEvidencePanelStore((s) => s.openPanel);

  // Scale by the theme's frequency relative to the dataset's *max* so bars
  // communicate relative prominence (top theme always fills the bar).
  // Floor at 1 block so non-zero themes always show something.
  const denom = Math.max(1, maxFrequency);
  const filled = Math.min(
    FREQUENCY_BLOCKS,
    Math.max(1, Math.round((theme.frequency / denom) * FREQUENCY_BLOCKS)),
  );

  return (
    <article className="bg-bg border border-border rounded-md p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-fg leading-snug">{theme.title}</h3>
        <TrendIcon trend={theme.trend} />
      </header>

      <p className="text-sm text-muted leading-relaxed">{theme.summary}</p>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-subtle">
          <span>Frequency</span>
          <span className="font-mono">{theme.frequency}</span>
        </div>
        <div
          className="flex gap-[2px]"
          aria-label={`Frequency ${theme.frequency} of ${FREQUENCY_BLOCKS}`}
        >
          {Array.from({ length: FREQUENCY_BLOCKS }).map((_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-sm ${
                i < filled ? 'bg-accent' : 'bg-surface border border-border'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {theme.byProduct.map((bp, i) => (
          <span key={bp.product} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-subtle">·</span>}
            <span className="text-fg">{productLabel(bp.product)}</span>
            <span className="font-mono text-muted">{bp.count}</span>
          </span>
        ))}
      </div>

      {theme.topClaimIds.length > 0 && (
        <footer className="pt-2 border-t border-border space-y-1.5">
          <div className="text-xs text-subtle uppercase tracking-wide">
            Top claims
          </div>
          <div className="flex flex-wrap gap-1.5">
            {theme.topClaimIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => openPanel(id)}
                className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-fg hover:border-border-strong hover:bg-bg transition-colors"
              >
                {id}
              </button>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}
