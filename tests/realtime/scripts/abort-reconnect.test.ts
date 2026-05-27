// Realtime invariant 4: abort + reconnect.
//
// apps/api/src/lib/rateLimit.ts caps CONCURRENT_MAX=1 per IP. The chat
// route's `finally` block calls `release()` whenever the stream
// terminates — cleanly OR via thrown exception. The route does NOT
// poll `stream.aborted`, so a consumer cancel does NOT short-circuit
// the synthesis loop; the slot is held until the upstream generator
// completes (or hono's silent write-failure eventually accumulates
// enough back-pressure to surface — see real-bug note below).
//
// REAL BEHAVIOUR FINDING (verified empirically by this suite):
//   Hono 4.12.23's `streamSSE` writer in `dist/utils/stream.js` wraps
//   every write in `try { await this.writer.write(...) } catch {}`.
//   When the consumer cancels, the write rejects silently and the
//   user's for-await loop continues. The route's `release()` is
//   therefore deferred until the streamClaude generator returns. In
//   production this is bounded by IDLE_TIMEOUT_MS=60s and
//   ABSOLUTE_TIMEOUT_MS=300s in claude.ts. In tests we observe it by
//   driving the generator to natural completion.
//
// What this file therefore actually tests:
//   - Sequential reconnect after a clean stream end (the common
//     happy path: user reads to `done`, sends again).
//   - Consumer cancel + generator completion releases the slot (the
//     "consumer hung up mid-stream" case, observed end-to-end).
//   - Many cycles of the above do not leak.
//
// NOTE: chaos-agent owns the SERVER-side process-tree assertion
// (verifying that streamClaude's generator's `finally` block kills the
// underlying child after the route's finally runs). This file owns
// CLIENT-side observation only.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';
import {
  loadApp,
  makeInit,
  resetMock,
  setMockEventsAsync,
} from '../lib/loadApp.ts';
import { collectSSE, readSSE } from '../lib/sseReader.ts';

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

/**
 * A short, slowly-emitting mock-Claude generator. Emits a delta every
 * `gapMs` for `maxChunks` chunks then naturally completes. Used to
 * model "a synthesis stream that was mid-flight when the consumer
 * cancelled" — the route keeps writing silently until the generator
 * finishes, at which point the route's `finally` runs and the slot
 * is released. Kept short so the test does not need to wait minutes.
 */
function slowGenerator(gapMs = 25, maxChunks = 8): AsyncGenerator<ClaudeStreamEvent> {
  return (async function* () {
    for (let i = 0; i < maxChunks; i += 1) {
      yield { kind: 'delta', text: `chunk-${i} ` } as ClaudeStreamEvent;
      await new Promise<void>((r) => setTimeout(r, gapMs));
    }
  })();
}

describe('abort + reconnect', () => {
  it('after a consumer cancels mid-stream AND the upstream generator completes, the concurrency slot is released so a reconnect from the same IP succeeds', async () => {
    // Under app.request(), an AbortController on the *request* does not
    // reach the route's streamSSE handler (Hono mounts the request and
    // returns the Response synchronously; the body stream is decoupled).
    // What the frontend's `controller.abort()` actually triggers in the
    // browser is a *body cancel* on the ReadableStream — and that DOES
    // propagate through hono/streaming, causing the writer's
    // `writeSSE` to reject, the for-await loop to terminate, and the
    // route's `finally` to run.
    //
    // So we model the frontend's abort by cancelling the response body
    // directly. End-to-end behaviour matches what apps/web does in
    // useChatStream.ts.
    const ip = '10.55.0.1';

    setMockEventsAsync(slowGenerator());
    const { app } = await loadApp();

    const res1 = await app.request(
      '/api/chat/stream',
      makeInit(undefined, { 'x-forwarded-for': ip }),
    );
    expect(res1.status).toBe(200);

    // Pull events until we have observed at least the synthesizing
    // status and one delta — proves the streaming has actually
    // started and the concurrency slot is held.
    const reader = res1.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawDelta = false;
    for (let i = 0; i < 50 && !sawDelta; i += 1) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('event: delta')) sawDelta = true;
    }
    expect(sawDelta).toBe(true);

    // Cancel the body — the frontend's effective abort signal. Note
    // that hono's writer swallows the resulting write error, so the
    // route's for-await loop continues until the slow generator
    // naturally completes (~8 chunks * 25ms = 200ms). Then the
    // route's `finally` runs and the slot releases.
    await reader.cancel();
    // Wait for the generator to drain + the route's `finally` to run.
    await new Promise((r) => setTimeout(r, 600));

    // Second stream from SAME IP: must NOT be 429'd with concurrency.
    resetMock();
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'delta', text: 'second-stream chunk' } as ClaudeStreamEvent;
      })(),
    );
    const res2 = await app.request(
      '/api/chat/stream',
      makeInit(undefined, { 'x-forwarded-for': ip }),
    );
    expect(res2.status).toBe(200);
    const events2 = await collectSSE(res2);
    expect(events2.find((e) => e.event === 'done')).toBeDefined();
  });

  it('a sequential reconnect after a fully drained stream also works (no slot leak on clean exit)', async () => {
    const ip = '10.55.0.2';
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'delta', text: 'first run' } as ClaudeStreamEvent;
      })(),
    );
    const { app } = await loadApp();

    const r1 = await app.request(
      '/api/chat/stream',
      makeInit(undefined, { 'x-forwarded-for': ip }),
    );
    expect(r1.status).toBe(200);
    await collectSSE(r1);

    // Reset mock for the second call.
    resetMock();
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'delta', text: 'second run' } as ClaudeStreamEvent;
      })(),
    );

    const r2 = await app.request(
      '/api/chat/stream',
      makeInit(undefined, { 'x-forwarded-for': ip }),
    );
    expect(r2.status).toBe(200);
    const events = await collectSSE(r2);
    expect(events.find((e) => e.event === 'done')).toBeDefined();
  });

  it('three back-to-back abort+reconnect cycles all succeed (no slow leak under churn)', async () => {
    const ip = '10.55.0.3';
    const { app } = await loadApp();

    for (let cycle = 0; cycle < 3; cycle += 1) {
      resetMock();
      setMockEventsAsync(slowGenerator());
      const res = await app.request(
        '/api/chat/stream',
        makeInit(undefined, { 'x-forwarded-for': ip }),
      );
      expect(res.status).toBe(200);

      // Pull until we've seen a delta (slot definitely held), then
      // cancel the body — same model as the primary abort test.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let sawDelta = false;
      for (let i = 0; i < 50 && !sawDelta; i += 1) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        if (buf.includes('event: delta')) sawDelta = true;
      }
      await reader.cancel();
      // Wait for the slow generator to drain + route's finally.
      await new Promise((r) => setTimeout(r, 600));
    }

    // Final assertion: a NEW stream after the churn still succeeds.
    resetMock();
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'delta', text: 'final' } as ClaudeStreamEvent;
      })(),
    );
    const final = await app.request(
      '/api/chat/stream',
      makeInit(undefined, { 'x-forwarded-for': ip }),
    );
    expect(final.status).toBe(200);
    await collectSSE(final);
  });
});
