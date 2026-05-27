// All-claims report subpage.
//
// Fetches the full claims corpus, exposes per-product chip filters, renders
// each claim as a CitationCard (which opens EvidencePanel on click), and
// sorts by evidence_count descending.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRODUCT_LABELS, type ProductId } from '@grain/types';
import { AppHeader } from '../components/AppHeader';
import { CitationCard } from '../components/CitationCard';
import { EvidencePanel } from '../components/EvidencePanel';
import { fetchAllClaims } from '../lib/api';

// Skeleton for the loading state — matches the CitationCard minimum height.
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

export function ReportClaimsView() {
  const { data: claims, isPending, error } = useQuery({
    queryKey: ['claims', 'all'],
    queryFn: fetchAllClaims,
    staleTime: 60_000,
  });

  const [activeProduct, setActiveProduct] = useState<ProductId | null>(null);

  // Derive the set of products present in the corpus — stable reference.
  const availableProducts = useMemo<ProductId[]>(() => {
    if (!claims) return [];
    const seen = new Set<ProductId>();
    for (const c of claims) seen.add(c.product);
    return [...seen].sort();
  }, [claims]);

  // Filter and sort.
  const visibleClaims = useMemo(() => {
    if (!claims) return [];
    const filtered = activeProduct
      ? claims.filter((c) => c.product === activeProduct)
      : claims;
    return [...filtered].sort((a, b) => b.evidence_count - a.evidence_count);
  }, [claims, activeProduct]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      <main id="main" className="max-w-4xl w-full mx-auto px-6 py-8 space-y-6 flex-1">
        {/* Back button */}
        <Link
          to="/report"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Report
        </Link>

        {/* Page header */}
        <header className="flex items-center gap-3 grain-fade-up">
          <h1 className="grain-display text-3xl font-semibold text-fg">Claims</h1>
          {claims && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-mono tabular-nums">
              {visibleClaims.length}
            </span>
          )}
        </header>

        {/* Product filter chips */}
        {availableProducts.length > 0 && (
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

        {/* Error state */}
        {error && (
          <div className="p-4 border border-border rounded-xl bg-surface text-sm text-muted">
            Could not load claims:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {/* Loading skeleton */}
        {isPending && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CitationCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Claims grid */}
        {!isPending && !error && visibleClaims.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleClaims.map((claim) => (
              <CitationCard key={claim.id} claimId={claim.id} />
            ))}
          </div>
        )}

        {/* Empty state after filtering */}
        {!isPending && !error && claims && visibleClaims.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted">
            No claims match this filter.
          </div>
        )}
      </main>

      <EvidencePanel />
    </div>
  );
}
