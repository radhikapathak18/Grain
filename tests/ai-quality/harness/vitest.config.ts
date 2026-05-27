// Vitest config for the AI-quality eval harness.
//
// The harness spins up the Grain API in-process (Hono `app.request()`)
// and POSTs eval questions at /api/chat/stream. The Claude subprocess
// is replaced with a richer-than-e2e mock shim by default so the suite
// is deterministic, fast, and free.
//
// Real Claude CLI calls are only made when `RUN_AI_EVALS=1` is set; the
// harness then points `CLAUDE_BIN` at the real binary on PATH.
// See `tests/ai-quality/README.md` for the token-budget warning.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // `root` makes `include` paths resolve from the suite root (tests/ai-quality)
  // regardless of where vitest is invoked from, which matters for monorepo
  // recursive runs (`pnpm -r test`).
  root: resolve(__dirname, '..'),
  test: {
    environment: 'node',
    include: [
      'harness/*.test.ts',
      'judges/*.test.ts',
      'baselines/*.test.ts',
    ],
    // Eval streams can be slow (the route inserts two 250ms status
    // beats per request; mocked Claude adds a tiny delay per chunk).
    // A 15-question dataset comfortably finishes inside 90s.
    testTimeout: 90_000,
    hookTimeout: 30_000,
    // Single worker — the in-process Hono app uses a module-level rate
    // limiter; parallel workers would collide on shared IP buckets.
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Eval output is the deliverable; keep it readable.
    reporters: ['default'],
  },
});
