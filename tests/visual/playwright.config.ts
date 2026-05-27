import { defineConfig } from '@playwright/test';

/**
 * Visual regression config for the Grain web app.
 *
 * - Single project: chromium. Cross-browser visual diffs are too noisy to
 *   keep stable; that surface is owned by the cross-browser-agent.
 * - Desktop viewport only (1440x900). Responsive baselines are owned by
 *   the responsive-agent.
 * - Baselines live next to specs under __screenshots__/ (Playwright default
 *   is `*-snapshots/` per file, but we override snapshotDir so all baselines
 *   land in one tree and are easy to review).
 *
 * Run from the repo root after installing chromium:
 *
 *   pnpm --filter @grain/tests-visual exec playwright install chromium
 *   pnpm --filter @grain/tests-visual test:update   # first-run baselines
 *   pnpm --filter @grain/tests-visual test          # diff against baselines
 *
 * The webServer launches the visual mock API on :4012 in parallel with the
 * Vite dev server on :5173. The Vite proxy is bypassed by setting
 * VITE_API_URL so the SPA hits the mock directly.
 */
export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.visual.spec.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      // Allow a small pixel-ratio drift; conservative defaults per brief.
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      // Animations should already be off via _helpers.waitForCalm. This is
      // a belt-and-suspenders guard.
      animations: 'disabled',
      caret: 'hide',
    },
  },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'findings/pw-report' }]],
  snapshotDir: './__screenshots__',
  // Playwright's default snapshot suffix injects platform + browser; we
  // pin chromium-only baselines and accept platform suffixing so a Linux
  // CI run won't try to match darwin baselines (it will create its own).
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Start the visual mock API on :3001 (the port apps/web/vite.config.ts
    // already proxies /api/* to) in parallel with the Vite dev server.
    command:
      'node ./scripts/api-mock.mjs & pnpm --filter @grain/web dev --port 5173',
    url: 'http://localhost:5173',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
