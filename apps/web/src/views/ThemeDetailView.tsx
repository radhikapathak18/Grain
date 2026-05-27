// Detail subpage for a single ReportTheme.
//
// Route: /report/themes/:id
//
// Fetches the monthly report (shared cache with ReportThemesView — no extra
// network call when navigating from the themes list), finds the matching theme,
// then fetches its top claims. Renders a filterable CitationCard grid with the
// stacked product bar copied from ThemeCard.

import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { PRODUCT_LABELS, type ProductId, type ReportTheme } from '@grain/types';
import { AppHeader } from '../components/AppHeader';
import { CitationCard } from '../components/CitationCard';
import { EvidencePanel } from '../components/EvidencePanel';
import { fetchMonthlyReport, fetchClaims } from '../lib/api';

// ---------------------------------------------------------------------------
// Constants (mirrors ThemeCard — must stay in sync if ThemeCard changes)
// ---------------------------------------------------------------------------

const PRODUCT_COLOR: Record<ProductId, string> = {
  'helix-core': 'bg-violet-500',
  p4v: 'bg-indigo-500',
  'helix-swarm': 'bg-cyan-500',
};

const MIN_BAR_PCT = 8;

function productLabel(id: ProductId): string {
  return PRODUCT_LABELS[id] ?? id;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrendBadge({ trend }: { trend: ReportTheme['trend'] }) {
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

function CitationCardSkeleton() {
  return (
    <div
      className="p-3.5 rounded-xl border border-border bg-bg animate-pulse grain-shadow-card"
      style={{ minHeight: 88 }}
      aria-busy="true"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-14 bg-surface rounded" />
        <div className="h-3 w-20 bg-surface rounded" />
      </div>
      <div className="h-3 w-full bg-surface rounded mb-1" />
      <div className="h-3 w-3/4 bg-surface rounded" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked product bar (same markup as ThemeCard)
// ---------------------------------------------------------------------------

function ProductBar({ theme }: { theme: ReportTheme }) {
  const denom = Math.max(1, theme.frequency);
  const overallPct =
    theme.frequency > 0
      ? Math.max(MIN_BAR_PCT, (theme.frequency / denom) * 100)
      : 0;
  const themeTotal = Math.max(1, theme.frequency);
  const productSummary = theme.byProduct
    .map((bp) => `${productLabel(bp.product)} ${bp.count}`)
    .join(', ');

  return (
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
          <li key={bp.product} className="inline-flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                PRODUCT_COLOR[bp.product] ?? 'bg-accent'
              }`}
              aria-hidden="true"
            />
            <span className="text-fg">{productLabel(bp.product)}</span>
            <span className="font-mono text-muted tabular-nums">{bp.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function ThemeDetailView() {
  const { id } = useParams<{ id: string }>();

  // Shared cache with ReportThemesView — staleTime keeps it warm on navigation.
  const {
    data: report,
    isPending: reportPending,
    error: reportError,
  } = useQuery({
    queryKey: ['monthlyReport'],
    queryFn: fetchMonthlyReport,
    staleTime: 60_000,
  });

  const theme = report?.themes.find((t) => t.id === id) ?? null;

  // Fetch the theme's claims only once the theme is known.
  const {
    data: claims,
    isPending: claimsPending,
    error: claimsError,
  } = useQuery({
    queryKey: ['claims', theme?.topClaimIds ?? []],
    queryFn: () => fetchClaims(theme!.topClaimIds),
    enabled: !!theme,
    staleTime: 60_000,
  });

  const [activeProduct, setActiveProduct] = useState<ProductId | null>(null);

  // Derive filterable product list from byProduct entries on the theme.
  const availableProducts = useMemo<ProductId[]>(() => {
    if (!theme) return [];
    return theme.byProduct.map((bp) => bp.product);
  }, [theme]);

  // Filter claims client-side by product.
  const visibleClaimIds = useMemo<string[]>(() => {
    if (!claims) return [];
    if (!activeProduct) return claims.map((c) => c.id);
    return claims.filter((c) => c.product === activeProduct).map((c) => c.id);
  }, [claims, activeProduct]);

  const isPending = reportPending || (!!theme && claimsPending);

  // ---------------------------------------------------------------------------
  // Render: not-found guard (report loaded but theme id doesn't exist)
  // ---------------------------------------------------------------------------

  if (!reportPending && !reportError && report && !theme) {
    return (
      <div className="min-h-screen flex flex-col bg-bg">
        <AppHeader />
        <main id="main" className="max-w-4xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
          <Link
            to="/report/themes"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Themes
          </Link>
          <p className="text-sm text-muted">Theme not found.</p>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: main view
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      <main id="main" className="max-w-4xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
        {/* Back link */}
        <Link
          to="/report/themes"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Themes
        </Link>

        {/* Page header */}
        {theme && (
          <header className="space-y-3 grain-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="grain-display text-3xl font-semibold text-fg">
                  {theme.title}
                </h1>
                {claims !== undefined && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted tabular-nums">
                    {visibleClaimIds.length}
                  </span>
                )}
              </div>
              <TrendBadge trend={theme.trend} />
            </div>

            <p className="text-sm text-muted leading-relaxed">{theme.summary}</p>

            <ProductBar theme={theme} />
          </header>
        )}

        {/* Report error */}
        {reportError && (
          <div className="p-4 border border-border rounded-xl bg-surface text-sm text-muted">
            Could not load theme:{' '}
            {reportError instanceof Error ? reportError.message : 'Unknown error'}
          </div>
        )}

        {/* Claims error */}
        {claimsError && (
          <div className="p-4 border border-border rounded-xl bg-surface text-sm text-muted">
            Could not load claims:{' '}
            {claimsError instanceof Error ? claimsError.message : 'Unknown error'}
          </div>
        )}

        {/* Product filter chips */}
        {theme && availableProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 grain-fade-up grain-fade-up-delay-1">
            <button
              type="button"
              onClick={() => setActiveProduct(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeProduct === null
                  ? 'bg-accent-subtle text-accent border-accent/30'
                  : 'bg-surface text-muted border-border hover:border-border-strong hover:text-fg'
              }`}
            >
              All
            </button>
            {availableProducts.map((product) => (
              <button
                key={product}
                type="button"
                onClick={() =>
                  setActiveProduct(activeProduct === product ? null : product)
                }
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeProduct === product
                    ? 'bg-accent-subtle text-accent border-accent/30'
                    : 'bg-surface text-muted border-border hover:border-border-strong hover:text-fg'
                }`}
              >
                {PRODUCT_LABELS[product] ?? product}
              </button>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {isPending && !reportError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <CitationCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Claims grid */}
        {!isPending && !reportError && !claimsError && visibleClaimIds.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleClaimIds.map((claimId) => (
              <CitationCard key={claimId} claimId={claimId} />
            ))}
          </div>
        )}

        {/* Empty state after filtering */}
        {!isPending &&
          !reportError &&
          !claimsError &&
          claims !== undefined &&
          visibleClaimIds.length === 0 && (
            <div className="border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted">
              No claims match this filter.
            </div>
          )}
      </main>

      <EvidencePanel />
    </div>
  );
}
