import type { SourceDocument } from './gong-001.ts';

export const PENDO_001: SourceDocument = {
  id: 'pendo-export-2026-03-15-p4v-feature-usage',
  type: 'pendo',
  title: 'P4V — feature usage and friction signals (Q1 2026 export)',
  date: '2026-03-15',
  body: `# Pendo export — P4V feature usage, Q1 2026

**Date range:** 2026-01-01 → 2026-03-14 · **Sample:** 8,412 active users across 34 customer accounts · **Exported by:** Product Analytics, 2026-03-15

This export summarizes the friction signals Pendo captured in P4V during Q1. "Friction" here means: rage-clicks, repeated-failed-actions, or sessions where the user opened a help link within 30s of starting an action.

## Top friction events by frequency

| Rank | Event | Sessions affected | % of MAU | Trend vs Q4 2025 |
|------|-------|-------------------|----------|------------------|
| 1 | Workspace creation wizard abandoned before completion | 1,847 | 22% | ↑ 4pp |
| 2 | Repeated retry of "Reconcile Offline Work" | 1,402 | 17% | ↑ 2pp |
| 3 | Resolve dialog opened > 8 times in one session | 1,184 | 14% | ↑ 6pp |
| 4 | Help link clicked from Protections view | 941 | 11% | flat |
| 5 | Submit changelist rejected (>2 times in session) | 822 | 10% | ↓ 1pp |
| 6 | View Files panel filter applied > 5 times | 718 | 9% | ↑ 3pp |
| 7 | Stream switcher opened then cancelled | 612 | 7% | flat |
| 8 | Right-click menu opened > 12 times on same file | 587 | 7% | ↑ 2pp |

## Notable cohort breakdowns

**Workspace creation wizard abandonment (rank 1).** Highest among first-session users: 41% of users in their first P4V session who reach the wizard abandon before completing it. The abandonment cluster is at step 3 of 5 — "Configure view lines" — where the user is presented with a free-text editor and a "validate" button. 71% of abandoners click "validate" at least once before quitting; 38% see at least one validation error.

**Resolve dialog repeated opens (rank 3).** Strongly correlated with merge changelists > 50 files. Median time in resolve dialog per file is 14 seconds; long-tail users spend > 90 seconds per file. The "auto-resolve safe" button is clicked in only 23% of resolve sessions despite being the documented happy path. Users either don't know it's there or don't trust it.

**Submit changelist rejected (rank 5).** Rejection reasons captured via the error toast:
- 44% — file out of date (sync required first)
- 27% — file locked by another user
- 19% — protection denied
- 10% — other (changelist description required, file types misconfigured, etc.)

The "file out of date" rejections suggest users are not running sync before submit. P4V does not run an auto-sync-on-submit; users have to know to do it. New users especially get caught.

**Right-click menu repeated opens (rank 8).** Heuristic for "user is looking for an action they can't find." Top three files where this happens: changelist pending list, depot tree view, workspace tree view. Suggests the discoverability of actions like "Resolve…", "Move to Changelist…", and "Revert Unchanged" is low.

## Persona overlay

Pendo joins to our identity provider so we can segment by job title (self-reported). Caveats: ~30% of users have no title set, and titles are free-text so the bucketing is imperfect.

| Persona (approx) | Top friction event |
|------------------|--------------------|
| Build engineer / DevOps | Workspace creation wizard abandoned (28% of cohort) |
| Tech lead | Resolve dialog opened > 8 times (24%) |
| Developer | Submit changelist rejected (19%) |
| Release manager | Stream switcher opened then cancelled (31%) |
| Artist / IC (non-engineering) | Workspace creation wizard abandoned (47%) |

The artist cohort's wizard abandonment is the standout. We see the same pattern in P4V telemetry for film and games customers specifically.

## Customer-level outliers

These accounts have friction rates more than 1.5x the median across at least 3 of the top-8 events:

- **Stellar Forge Games** — wizard abandonment 53%, resolve repeats 28%
- **Hexagon Pictures** — resolve repeats 31%, right-click repeats 19%
- **Apex Aeronautics** — submit rejections 18%, help clicks from Protections 22%
- **Lumen Foundry** — wizard abandonment 49%, resolve repeats 26%

These four accounts have all opened multiple support tickets this quarter on related themes.

## Caveats

Pendo can only see what it instruments. CLI usage ('p4' commands) is invisible to this dataset. So a power user who lives in the CLI looks like a "low-engagement P4V user" to Pendo. The friction events here are *P4V GUI* events specifically. They do not necessarily reflect overall product friction.

Also: rage-clicks and repeated retries are *correlates* of friction, not friction itself. A user might repeat-click the resolve button because the dialog is slow, not because they're frustrated. Treat as signal, not ground truth.`,
  excerpts: [
    {
      passage:
        '41% of users in their first P4V session who reach the wizard abandon before completing it. The abandonment cluster is at step 3 of 5 — "Configure view lines" — where the user is presented with a free-text editor and a "validate" button.',
      offset_hint: 'Notable cohort breakdowns / Workspace creation wizard',
    },
    {
      passage:
        'The "auto-resolve safe" button is clicked in only 23% of resolve sessions despite being the documented happy path. Users either don\'t know it\'s there or don\'t trust it.',
      offset_hint: 'Notable cohort breakdowns / Resolve dialog',
    },
    {
      passage:
        'Stellar Forge Games — wizard abandonment 53%, resolve repeats 28%. Hexagon Pictures — resolve repeats 31%, right-click repeats 19%. Lumen Foundry — wizard abandonment 49%, resolve repeats 26%.',
      offset_hint: 'Customer-level outliers',
    },
  ],
};
