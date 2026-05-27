import { defineConfig } from '@playwright/test';

/**
 * Responsive viewport tests for the Grain web app.
 *
 * Lives under `tests/responsive/` so it does NOT collide with `tests/a11y/`
 * (page a11y scans) or `tests/compat/` (cross-browser smoke). To run:
 *
 *   pnpm --filter @grain/tests-responsive install:browsers   # one-time
 *   pnpm --filter @grain/tests-responsive test
 *
 * Three viewports are exercised against the same suite via projects:
 *
 *   mobile  → 375 x 667   (iPhone SE / 8). hasTouch=true → tap() works,
 *             pointer events are dispatched as touch.
 *   tablet  → 768 x 1024  (iPad portrait). hasTouch=true.
 *   desktop → 1440 x 900. hasTouch=false (mouse).
 *
 * We define plain viewport+hasTouch objects rather than reusing
 * `devices['iPhone SE']` because the device emulation also pins the userAgent
 * to mobile Safari, which then triggers chromium-specific quirks. We only
 * care about layout + touch handlers here, not the UA string. The DPR is
 * left at 1 so any toHaveScreenshot-style checks remain stable across
 * machines.
 *
 * The web server uses the same launch trick as `tests/a11y/`: bring up a
 * tiny mock API on :4011, then run the Vite dev server with
 * VITE_API_URL pointed at it. No Claude binary is required.
 */
export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.responsive.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'findings/pw-report' }],
    ['json', { outputFile: 'findings/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: false,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        hasTouch: false,
        isMobile: false,
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    // Launch the mock API and the Vite dev server in one command. We pin the
    // dev server to :5174 so we do not clash with `tests/a11y` (:5173) if a
    // dev forgets to shut one down. We use a unique API port (:4021) for the
    // same reason. The mock API is the same shape as the one used by the
    // a11y suite — see ./playwright/api-mock.mjs.
    command:
      'GRAIN_PW_API_PORT=4021 node ./playwright/api-mock.mjs & VITE_API_URL=http://localhost:4021 pnpm --filter @grain/web dev --port 5174 --strictPort',
    url: 'http://localhost:5174',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'pipe',
  },
});
