// All-themes report subpage.
//
// Reuses the same monthly report cache key as ReportView so TanStack Query
// returns the cached response on navigation — no extra network request.

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { EvidencePanel } from '../components/EvidencePanel';
import { ThemeCard } from '../components/ThemeCard';
import { fetchMonthlyReport } from '../lib/api';

// Matches the ThemeCardSkeleton in ReportView exactly.
function ThemeCardSkeleton() {
  return (
    <div className="bg-bg border border-border rounded-md p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-surface rounded w-3/4" />
      <div className="h-3 bg-surface rounded w-full" />
      <div className="h-3 bg-surface rounded w-5/6" />
      <div className="h-2 bg-surface rounded w-full" />
      <div className="h-3 bg-surface rounded w-2/3" />
    </div>
  );
}

export function ReportThemesView() {
  const { data, isPending, error } = useQuery({
    queryKey: ['monthlyReport'],
    queryFn: fetchMonthlyReport,
    staleTime: 60_000,
  });

  const maxFrequency = data
    ? data.themes.reduce((m, t) => Math.max(m, t.frequency), 0)
    : 0;

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
        <header className="space-y-2 grain-fade-up">
          <div className="flex items-center gap-3">
            <h1 className="grain-display text-3xl font-semibold text-fg">Themes</h1>
            {data && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-mono tabular-nums">
                {data.themes.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted">
            Research themes synthesised from claims this period.
          </p>
        </header>

        {/* Error state */}
        {error && (
          <div className="p-4 border border-border rounded-xl bg-surface text-sm text-muted">
            Could not load themes:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {/* Loading skeleton */}
        {isPending && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ThemeCardSkeleton />
            <ThemeCardSkeleton />
            <ThemeCardSkeleton />
            <ThemeCardSkeleton />
          </div>
        )}

        {/* Themes grid */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                maxFrequency={maxFrequency}
              />
            ))}
          </div>
        )}
      </main>

      <EvidencePanel />
    </div>
  );
}
