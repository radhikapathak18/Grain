// Shared app loader for the realtime suite.
//
// Why a helper:
//   - The chat route's rate-limit + concurrency-cap state lives in
//     module-level maps in `apps/api/src/lib/rateLimit.ts`. Without a
//     `vi.resetModules()` between tests every spec sees the previous
//     spec's IP buckets, which makes the abort/reconnect spec flake.
//   - The route depends on `streamClaude` from
//     `apps/api/src/lib/claude.ts`. Realtime tests need to script that
//     stream — sometimes synchronously (an array of events), sometimes
//     with a gated async generator that we control mid-stream. A single
//     `vi.doMock` wired here gives every test a uniform plug point.
//
// The helper returns the loaded Hono app PLUS a `setMockEvents` /
// `setMockEventsAsync` API so each spec can configure what the mocked
// `streamClaude` emits. Both setters are reset between tests via
// `resetMock()`.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { vi } from 'vitest';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';

// Resolve the chat route's `streamClaude` import target to an absolute
// path. Vitest's `doMock` key matches the resolved module id of the
// importer (chat.ts), so passing the absolute path of the same file
// guarantees the mock intercepts regardless of where this helper lives
// in the tree.
const HERE = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MODULE_ABS = resolve(
  HERE,
  '../../../apps/api/src/lib/claude.ts',
);

type MockState = {
  events: ClaudeStreamEvent[];
  asyncGen: AsyncGenerator<ClaudeStreamEvent> | null;
  /** If set, called once per yielded event; lets tests observe progress. */
  onYield?: (ev: ClaudeStreamEvent) => void;
};

// Single module-scoped state mutated by setters and consumed by the
// mocked generator. vi.doMock + vi.resetModules in `loadApp` is what
// guarantees the route always sees the freshest mock implementation.
const state: MockState = { events: [], asyncGen: null };

export function setMockEvents(events: ClaudeStreamEvent[]): void {
  state.events = events;
  state.asyncGen = null;
}

export function setMockEventsAsync(
  gen: AsyncGenerator<ClaudeStreamEvent>,
  onYield?: (ev: ClaudeStreamEvent) => void,
): void {
  state.asyncGen = gen;
  state.events = [];
  state.onYield = onYield;
}

export function resetMock(): void {
  state.events = [];
  state.asyncGen = null;
  state.onYield = undefined;
}

export type LoadedApp = {
  app: import('hono').Hono;
};

export async function loadApp(): Promise<LoadedApp> {
  vi.resetModules();
  vi.doMock(CLAUDE_MODULE_ABS, () => ({
    streamClaude: async function* mocked() {
      if (state.asyncGen) {
        for await (const ev of state.asyncGen) {
          state.onYield?.(ev);
          yield ev;
        }
        return;
      }
      for (const ev of state.events) {
        state.onYield?.(ev);
        yield ev;
      }
    },
  }));
  const { Hono } = await import('hono');
  const { chatRoutes } = await import('../../../apps/api/src/routes/chat.ts');
  const app = new Hono();
  app.route('/api/chat', chatRoutes);
  return { app };
}

export const VALID_BODY = {
  question: 'What are the top onboarding pain points across products?',
  role: 'pm' as const,
  shape: 'explore' as const,
  products: ['helix-core', 'p4v'] as const,
};

export function makeInit(
  body: unknown = VALID_BODY,
  headers: Record<string, string> = {},
  init: RequestInit = {},
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Default to a unique IP so unrelated tests do not collide on the
      // rate-limit / concurrency buckets. Tests that need to SHARE a
      // bucket (e.g. abort-reconnect, slow-consumer) override this.
      'x-forwarded-for': `127.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  };
}
