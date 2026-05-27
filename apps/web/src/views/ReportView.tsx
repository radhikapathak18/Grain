// Monthly research synthesis report. Fetches the fixture via fetchMonthlyReport
// and renders three sections: stats tiles, top themes grid, and emerging
// issues. EvidencePanel is mounted here so theme-card citation pills work the
// same as on /chat.

import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { EmergingIssuesList } from '../components/EmergingIssuesList';
import { EvidencePanel } from '../components/EvidencePanel';
import { ThemeCard } from '../components/ThemeCard';
import { fetchMonthlyReport } from '../lib/api';

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-bg border border-border rounded-md p-4">
      <div className="text-xs text-subtle uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-fg font-mono">
        {value}
      </div>
    </div>
  );
}

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

export function ReportView() {
  const { data, isPending, error } = useQuery({
    queryKey: ['monthlyReport'],
    queryFn: fetchMonthlyReport,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <AppHeader />

      <main
        id="main"
        className="max-w-4xl w-full mx-auto px-6 py-8 space-y-8 flex-1"
      >
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-fg">
            Monthly research synthesis
          </h1>
          <p className="text-sm text-muted">
            {data ? data.periodLabel : 'Loading period…'}
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-2 p-3 border border-error/40 rounded-md bg-error-bg text-fg">
            <AlertCircle
              size={18}
              className="text-error shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-sm">
              <div className="font-medium">Could not load the report.</div>
              <div className="text-muted">
                {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            </div>
          </div>
        )}

        {isPending && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-20 bg-surface rounded-md animate-pulse" />
              <div className="h-20 bg-surface rounded-md animate-pulse" />
              <div className="h-20 bg-surface rounded-md animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ThemeCardSkeleton />
              <ThemeCardSkeleton />
              <ThemeCardSkeleton />
              <ThemeCardSkeleton />
            </div>
          </>
        )}

        {data &&
          (() => {
            const maxFrequency = data.themes.reduce(
              (m, t) => Math.max(m, t.frequency),
              0,
            );
            return (
              <>
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatTile label="Claims" value={data.totalClaims} />
                  <StatTile
                    label="Evidence items"
                    value={data.totalEvidence}
                  />
                  <StatTile label="Themes" value={data.themes.length} />
                </section>

                <section className="space-y-3">
                  <h2 className="text-lg font-semibold text-fg">Top themes</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.themes.map((theme) => (
                      <ThemeCard
                        key={theme.id}
                        theme={theme}
                        maxFrequency={maxFrequency}
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-lg font-semibold text-fg">
                    Emerging issues this period
                  </h2>
                  <EmergingIssuesList issues={data.emerging} />
                </section>
              </>
            );
          })()}
      </main>

      <EvidencePanel />
    </div>
  );
}
