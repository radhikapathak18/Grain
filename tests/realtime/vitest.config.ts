import { defineConfig } from 'vitest/config';

// Vitest config for the realtime/SSE conformance suite.
//
// - environment is 'node' because the tests drive Hono's `app.request()`
//   and read response.body with the WHATWG ReadableStream API. There is
//   no DOM involved; the frontend's fetch-based SSE consumer is mirrored
//   by hand in `lib/sseReader.ts`.
// - `testTimeout` is generous (20s) because several tests deliberately
//   include the route's 250ms `beat()` calls between status events and
//   simulate slow consumers. Individual tests that need longer (e.g.
//   the absolute-timeout test, which fast-forwards via vi.useFakeTimers)
//   pass their own per-test timeout.
// - `restoreMocks` + `clearMocks` keep the shared streamClaude mock and
//   the rateLimit module state isolated between specs.

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
