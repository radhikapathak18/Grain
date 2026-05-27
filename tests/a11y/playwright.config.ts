import { defineConfig } from '@playwright/test';

/**
 * Page-level a11y config for the Grain web app.
 *
 * Lives under `tests/a11y/` so it does NOT collide with the upcoming
 * root-level Playwright config the e2e-agent will add in Wave 2. To run:
 *
 *   pnpm --filter @grain/tests-a11y test:pw
 *
 * Prerequisite (NOT installed by this agent — too large for CI scratch):
 *   pnpm --filter @grain/tests-a11y exec playwright install chromium
 *
 * The webServer launches `pnpm dev:web` from the repo root. The web app
 * proxies /api requests via Vite; we set GRAIN_PW_MOCK=1 so the API calls
 * land on a small mock server (see playwright/api-mock.ts) instead of the
 * real backend.
 */
export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.a11y.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'findings/pw-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Start the web app and a fake API in parallel. The fake API lives at
    // ./playwright/api-mock.mjs and serves the canned responses the routes
    // need. We launch both via a tiny shell helper.
    command:
      'node ./playwright/api-mock.mjs & VITE_API_URL=http://localhost:4011 pnpm --filter @grain/web dev --port 5173',
    url: 'http://localhost:5173',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'pipe',
  },
});
