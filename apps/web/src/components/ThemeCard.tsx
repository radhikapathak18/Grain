// One block card for a ReportTheme. Renders:
//   - title row with trend arrow
//   - short summary
//   - stacked per-product frequency bar + colored-dot legend
//   - footer of top-claim citation pills that open the EvidencePanel on click

import { PRODUCT_LABELS, type ProductId, type ReportTheme } from '@grain/types';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEvidencePanelStore } from '../state/evidencePanel';

function productLabel(id: ProductId): string {
  return PRODUCT_LABELS[id] ?? id;
}

// Per-product colors used by both the stacked bar segments and the legend
// dots. Tones picked to read as a coherent indigo → violet → cyan aurora,
// matching the StatTile palette on /report.
const PRODUCT_COLOR: Record<ProductId, string> = {
  'helix-core': 'bg-violet-500',
  p4v: 'bg-indigo-500',
  'helix-swarm': 'bg-cyan-500',
};

// Minimum visual width for a non-zero theme so the lowest-frequency cards
// don't render an invisible bar. 8% reads as "present but small."
const MIN_BAR_PCT = 8;

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
  const navigate = useNavigate();

  // Outer bar fill: this theme's share of the dataset's max. Cards stay
  // visually comparable — the top theme is always near-full width.
  const denom = Math.max(1, maxFrequency);
  const overallPct =
    theme.frequency > 0
      ? Math.max(MIN_BAR_PCT, (theme.frequency / denom) * 100)
      : 0;

  // Within the fill, segment per product, proportional to its share of THIS
  // theme's total (not the dataset's max).
  const themeTotal = Math.max(1, theme.frequency);
  const productSummary = theme.byProduct
    .map((bp) => `${productLabel(bp.product)} ${bp.count}`)
    .join(', ');

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/report/themes/${theme.id}`);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/report/themes/${theme.id}`)}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer bg-bg border border-border rounded-xl p-5 space-y-4 grain-shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:[box-shadow:var(--shadow-elevated)] focus:outline-none focus:ring-4 focus:ring-accent/15"
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-fg leading-snug">{theme.title}</h3>
        <TrendIcon trend={theme.trend} />
      </header>

      <p className="text-sm text-muted leading-relaxed">{theme.summary}</p>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted uppercase tracking-wider font-semibold">
            Mentions
          </span>
          <span className="font-mono text-sm font-semibold text-fg tabular-nums">
            {theme.frequency}
          </span>
        </div>

        <div
          role="img"
          aria-label={`${theme.frequency} mentions: ${productSummary}`}
          className="relative h-2 w-full rounded-full bg-surface overflow-hidden"
        >
          <div
            className="flex h-full transition-[width] duration-300 ease-out"
            style={{ width: `${overallPct}%` }}
          >
            {theme.byProduct.map((bp) => (
              <div
                key={bp.product}
                className={PRODUCT_COLOR[bp.product] ?? 'bg-accent'}
                style={{ width: `${(bp.count / themeTotal) * 100}%` }}
                title={`${productLabel(bp.product)}: ${bp.count}`}
              />
            ))}
          </div>
        </div>

        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {theme.byProduct.map((bp) => (
            <li
              key={bp.product}
              className="inline-flex items-center gap-1.5"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  PRODUCT_COLOR[bp.product] ?? 'bg-accent'
                }`}
                aria-hidden="true"
              />
              <span className="text-fg">{productLabel(bp.product)}</span>
              <span className="font-mono text-muted tabular-nums">
                {bp.count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {theme.topClaimIds.length > 0 && (
        <footer className="pt-2 border-t border-border space-y-1.5">
          <div className="text-xs text-muted uppercase tracking-wider font-semibold">
            Top claims
          </div>
          <div className="flex flex-wrap gap-1.5">
            {theme.topClaimIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={(e) => { e.stopPropagation(); openPanel(id); }}
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
