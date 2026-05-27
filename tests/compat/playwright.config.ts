import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser smoke config for the Grain web app.
 *
 * Three Playwright projects (chromium, firefox, webkit) run the same smoke
 * spec plus one engine-specific spec per project. We do NOT install
 * browsers here — the CI agent must run:
 *
 *   pnpm --filter @grain/tests-compat exec playwright install --with-deps chromium firefox webkit
 *
 * Strategy: we boot the real Vite dev server for apps/web but intercept all
 * /api/* traffic with `page.route()` in a shared fixture (./playwright/mock-api.ts).
 * That keeps the surface deterministic across engines without requiring a
 * separate mock HTTP process. /api/chat/stream is intercepted with a real
 * streamed response so the SSE pipeline is exercised in each engine.
 *
 * Port 5174 keeps us off the a11y agent's 5173 so suites can run concurrently.
 */
export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.compat.spec.ts',
  // SSE + browser startup variance — give each spec headroom.
  timeout: 45_000,
  expect: { timeout: 7_500 },
  // No retries: a flaky cross-browser result is the finding we want to see.
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'findings/pw-report' }],
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    // Launch Vite dev on a non-default port. We bypass the Vite proxy by
    // intercepting /api/* inside each test via page.route(), so we don't
    // need the real Hono API or a parallel mock process.
    command: 'pnpm --filter @grain/web exec vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
