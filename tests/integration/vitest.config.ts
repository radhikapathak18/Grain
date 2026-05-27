// Vitest config dedicated to the root-level integration suite.
//
// Why this lives under `tests/integration/` (instead of a sibling at
// the repo root): the integration suite is its own concern, written by
// the integration-test-agent in the swarm, and owns ONLY this folder.
// We deliberately do not modify `apps/api/vitest.config.ts` (out of
// scope for this agent). Instead we run vitest with `--config
// tests/integration/vitest.config.ts` from inside `apps/api` so that
// hono / @grain/types / node_modules resolution Just Works (the api
// workspace already has every dependency the routes need).
//
// Tests in this folder import route + lib modules via relative paths
// like `../../apps/api/src/routes/auth.ts` to make the dependency
// direction explicit.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Root-level integration tests only — unit tests under
    // apps/api/tests/ are owned by the unit-test-agent.
    include: ['../../tests/integration/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    // Some SSE assertions wait for back-to-back rate-limit / concurrency
    // events plus the route's 250ms status `beat()` — keep a roomy
    // ceiling so flake on slow CI nodes is not a false-positive.
    testTimeout: 15_000,
  },
});
