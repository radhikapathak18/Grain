// Grain — Checkly synthetic monitoring config.
//
// STATUS: forward-looking. Grain has no production deploy today (see
// README.md: "No production deploy — local dev mode is the demo
// machine."). This file defines the probes that would run against
// a future production environment so they can be activated by
// pointing two env vars at it (`GRAIN_PROD_URL`, `GRAIN_PROD_API_URL`)
// and wiring a Checkly account.
//
// Why Checkly:
//   - Generous free tier (10K runs/mo covers our cadence with
//     room to spare — see README cost section).
//   - TypeScript-native config — same Playwright/`@playwright/test`
//     APIs the e2e-agent already uses, so the probe scripts in
//     `./checks/*.spec.ts` re-use Page Object selectors from
//     `tests/e2e/pages/` with minimal drift.
//   - Multi-region runners out of the box (us-east-1, eu-west-1).
//
// Vendor portability:
//   - The browser checks under `./checks/*.spec.ts` are pure
//     `@playwright/test` files — they can be lifted into Datadog
//     Synthetics (which also runs Playwright), GitHub Actions
//     scheduled workflows, or a homegrown cron-Playwright runner
//     with zero modification. Only this config file is
//     Checkly-specific.
//   - The API checks under `./checks/api-*.ts` use plain `fetch`
//     and Checkly's `ApiCheck` request shape; the same assertions
//     translate to Datadog Synthetic HTTP tests one-for-one.
//
// What is NOT in this file:
//   - Real production URLs (they don't exist yet).
//   - Real Slack webhook URLs / alert routing tokens.
//   - The user's email — kept env-driven so this repo can ship
//     without leaking PII.
//
// Local dev:
//   `pnpm dlx checkly test` will dry-run the probes against
//   whatever `GRAIN_PROD_URL` / `GRAIN_PROD_API_URL` point at
//   (e.g. `http://localhost:5173` / `http://localhost:3001` for a
//   local end-to-end shakedown). See README for details.

import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';

/**
 * Default check settings shared by all probes:
 *   - 5min frequency
 *   - 2 locations (cross-region failure detection)
 *   - alert after 2 consecutive failures (avoids single-flap noise)
 *   - 30s timeout (browser flow includes SSE wait)
 */
const DEFAULT_LOCATIONS = ['us-east-1', 'eu-west-1'] as const;

export default defineConfig({
  projectName: 'grain-synthetic',
  logicalId: 'grain-synthetic',
  repoUrl: 'https://github.com/your-org/grain', // set after first prod deploy
  checks: {
    // Where Checkly discovers `*.check.ts` (none today) and probe
    // scripts. The browser checks below explicitly reference the
    // spec files under ./checks/, which lets us keep one Playwright
    // file per critical journey.
    checkMatch: '**/__checks__/**/*.check.ts',
    frequency: Frequency.EVERY_5M,
    locations: [...DEFAULT_LOCATIONS],
    runtimeId: '2024.09',
    tags: ['grain', 'production', 'critical-path'],
    alertChannels: [],
    // Notify after 2 consecutive failures from a given location.
    // Single transient blips (one location, one run) are absorbed.
    alertEscalationPolicy: {
      escalationType: 'RUN_BASED',
      runBasedEscalation: { failedRunThreshold: 2 },
      reminders: { amount: 0 },
    },
    browserChecks: {
      // Pull spec files under ./checks/*.spec.ts as browser checks.
      testMatch: './checks/*.spec.ts',
      frequency: Frequency.EVERY_5M,
      locations: [...DEFAULT_LOCATIONS],
    },
  },
  cli: {
    runLocation: 'us-east-1',
    privateRunLocation: undefined,
    // Used by `checkly test`; safe defaults that don't depend on
    // an active account.
    reporters: ['list'],
  },
});

// ─── Production env-var contract ──────────────────────────────
//
// The probes import these via `process.env`. Set them in the
// Checkly project's "Environment variables" panel BEFORE enabling
// any check.
//
//   GRAIN_PROD_URL                e.g. https://grain.example.com
//   GRAIN_PROD_API_URL            e.g. https://api.grain.example.com
//   GRAIN_SYNTHETIC_USER_EMAIL    e.g. monitor@grain.example.com
//   GRAIN_SYNTHETIC_USER_ROLE     researcher | pm | designer | engineer
//   GRAIN_SYNTHETIC_SOURCE_ID     e.g. GONG-001  (a known seeded source)
//   GRAIN_ALERT_SLACK_WEBHOOK     full https://hooks.slack.com/services/...
//   GRAIN_ALERT_EMAIL             on-call rotation alias
//
// See ./README.md for the full setup guide.
