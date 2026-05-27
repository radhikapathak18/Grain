import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Grain end-to-end Playwright config.
 *
 * Strategy:
 *   - Start the Vite dev server on :5173 (`pnpm --filter @grain/web dev`).
 *   - Start the real Hono API on :3001 (`pnpm --filter @grain/api dev`),
 *     but with `CLAUDE_BIN` pointed at `scripts/mock-claude.mjs` so we
 *     never spawn the real Claude binary. The mock emits a tiny
 *     stream-json payload with deterministic `[CL-NNNN]` markers so the
 *     citation flow exercises the same code paths as production.
 *
 *   Both processes are launched together by `scripts/start-e2e.sh`. The
 *   webServer block waits for the web origin to be reachable.
 *
 * Prerequisites (NOT installed automatically — too heavy for the harness):
 *   - Run `pnpm --filter @grain/tests-e2e install:browsers` once before
 *     the first run. CI installs this in the e2e workflow job.
 *
 * Other agents (cross-browser, visual, responsive) own their own
 * configs — this one is chromium-only on a single desktop viewport.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: '**/*.e2e.spec.ts',
  fullyParallel: false, // Rate-limit + concurrency cap is global per-IP, so serialize.
  workers: 1,
  retries: isCI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(__dirname, 'findings/pw-report') }],
    ['json', { outputFile: path.join(__dirname, 'findings/results.json') }],
  ],
  outputDir: path.join(__dirname, 'findings/test-results'),
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `start-e2e.sh` launches both the API (with CLAUDE_BIN pointing at the
    // mock shim) and the Vite dev server. It exits when either child dies.
    command: 'bash ./scripts/start-e2e.sh',
    cwd: __dirname,
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
