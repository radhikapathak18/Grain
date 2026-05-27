// Monthly research synthesis report. Fetches the fixture via fetchMonthlyReport
// and renders three sections: stats tiles, top themes grid, and emerging
// issues. EvidencePanel is mounted here so theme-card citation pills work the
// same as on /chat.

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  FileText,
  Layers,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { EmergingIssuesList } from '../components/EmergingIssuesList';
import { EvidencePanel } from '../components/EvidencePanel';
import { ThemeCard } from '../components/ThemeCard';
import { fetchMonthlyReport } from '../lib/api';

type StatTone = 'violet' | 'indigo' | 'cyan';

const TONE_STYLES: Record<
  StatTone,
  { badge: string; glow: string; ring: string }
> = {
  violet: {
    badge: 'bg-violet-500 text-white',
    glow: 'bg-violet-500/15',
    ring: 'group-hover:ring-violet-400/40',
  },
  indigo: {
    badge: 'bg-indigo-500 text-white',
    glow: 'bg-indigo-500/15',
    ring: 'group-hover:ring-indigo-400/40',
  },
  cyan: {
    badge: 'bg-cyan-500 text-white',
    glow: 'bg-cyan-500/15',
    ring: 'group-hover:ring-cyan-400/40',
  },
};

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  delayClass,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone: StatTone;
  delayClass?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div
      className={`group relative bg-bg border border-border rounded-xl p-5 overflow-hidden grain-shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:[box-shadow:var(--shadow-elevated)] grain-fade-up ${delayClass ?? ''}`}
    >
      {/* Decorative blurred blob — tone accent without overwhelming. */}
      <div
        className={`pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl ${t.glow}`}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3 mb-3">
        <span className="text-[11px] text-muted uppercase tracking-wider font-semibold">
          {label}
        </span>
        <div
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center grain-shadow-card transition-transform duration-200 group-hover:scale-[1.06] ${t.badge}`}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={2.6} />
        </div>
      </div>

      <div className="relative flex items-baseline gap-2">
        <span className="grain-headline text-3xl font-semibold text-fg font-mono tabular-nums leading-none">
          {value}
        </span>
        {hint && (
          <span className="text-xs text-muted leading-none mb-0.5">{hint}</span>
        )}
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
        <header className="space-y-2 grain-fade-up">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold text-accent bg-accent-subtle/70 border border-accent/20">
            <span
              className="w-1 h-1 rounded-full bg-accent"
              aria-hidden="true"
            />
            Monthly synthesis
          </span>
          <h1 className="grain-display text-3xl sm:text-4xl font-semibold text-fg max-w-3xl">
            What customers told us this period.
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
                  <StatTile
                    label="Claims"
                    value={data.totalClaims}
                    hint="synthesized"
                    icon={FileText}
                    tone="violet"
                    delayClass="grain-fade-up-delay-1"
                  />
                  <StatTile
                    label="Evidence items"
                    value={data.totalEvidence}
                    hint="across all claims"
                    icon={Quote}
                    tone="indigo"
                    delayClass="grain-fade-up-delay-2"
                  />
                  <StatTile
                    label="Themes"
                    value={data.themes.length}
                    hint="this period"
                    icon={Layers}
                    tone="cyan"
                    delayClass="grain-fade-up-delay-3"
                  />
                </section>

                <section className="space-y-3.5">
                  <h2 className="grain-headline text-xl font-semibold text-fg">Top themes</h2>
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

                <section className="space-y-3.5">
                  <h2 className="grain-headline text-xl font-semibold text-fg">
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
