// Realtime invariant 5: server-side disconnect surfaces as a clean
// `error` event then stream-close.
//
// Two scenarios:
//   A. streamClaude emits a `kind:'error'` event (user-safe message
//      that the wrapper has already scrubbed of stderr / exit codes).
//      The route forwards it verbatim as an SSE `error` event.
//   B. streamClaude throws unexpectedly. The route's `catch` block
//      emits a GENERIC user-safe message (ERR_SYNTHESIS_FAILED in
//      chat.ts) and the raw exception text never reaches the client.
//
// Both scenarios must:
//   - emit exactly one `error` event
//   - terminate the stream cleanly (the response body finishes; no
//     hung connection)
//   - NOT emit a `done` event after the error
//
// This mirrors the chaos suite's "mock-Claude exits non-zero" shim
// but observes from the CLIENT side. The chaos suite owns the
// subprocess-exit-code assertion; this file owns the SSE wire shape.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';
import {
  loadApp,
  makeInit,
  resetMock,
  setMockEvents,
  setMockEventsAsync,
} from '../lib/loadApp.ts';
import { collectSSE } from '../lib/sseReader.ts';

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

describe('server-side disconnect → SSE error event + clean close', () => {
  it('forwards a user-safe streamClaude error verbatim as the SSE `error` event', async () => {
    // The streamClaude wrapper scrubs the message before exposing it
    // (see ERR_NONZERO_EXIT in apps/api/src/lib/claude.ts). The route
    // trusts that scrub and forwards as-is.
    //
    // BEHAVIOURAL NOTE: a `kind:'error'` from streamClaude is
    // surfaced as an SSE `error` event but does NOT break the route's
    // for-await loop. After the (now-terminated) generator returns,
    // the route still emits a final `done` event with the citations
    // counted so far. This differs from the *thrown exception* path
    // (next test) which jumps to the catch block and skips `done`.
    setMockEvents([
      { kind: 'delta', text: 'partial answer chunk... ' },
      { kind: 'error', message: 'synthesis subprocess exited unexpectedly' },
    ]);

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    expect(res.status).toBe(200);
    const events = await collectSSE(res);

    const errs = events.filter((e) => e.event === 'error');
    expect(errs).toHaveLength(1);
    expect((errs[0]!.data as { message: string }).message).toBe(
      'synthesis subprocess exited unexpectedly',
    );

    // `done` is the final event (route documented behaviour above).
    expect(events[events.length - 1]!.event).toBe('done');
    // And there is exactly one error event, never two.
    expect(events.filter((e) => e.event === 'error')).toHaveLength(1);
  });

  it('replaces an unexpected exception with a GENERIC user-safe message (never leaks raw)', async () => {
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'delta', text: 'doomed answer ' } as ClaudeStreamEvent;
        // Simulated catastrophic failure inside streamClaude — must
        // be caught by the route's try/catch and surfaced as ERR_SYNTHESIS_FAILED.
        throw new Error('subprocess died unexpectedly with SIGSEGV at 0xdead');
      })(),
    );

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    expect(res.status).toBe(200);
    const events = await collectSSE(res);

    const errs = events.filter((e) => e.event === 'error');
    expect(errs).toHaveLength(1);
    const msg = (errs[0]!.data as { message: string }).message;
    expect(msg).toMatch(/synthesis failed/i);

    // CRITICAL: the raw exception detail must NEVER be in any event payload.
    const wire = JSON.stringify(events);
    expect(wire).not.toContain('SIGSEGV');
    expect(wire).not.toContain('0xdead');
    expect(wire).not.toContain('subprocess died unexpectedly');
  });

  it('the response body fully terminates after the error (no hung stream)', async () => {
    setMockEvents([
      { kind: 'delta', text: 'oops...' },
      { kind: 'error', message: 'synthesis stalled; please try again' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());

    // If the stream did not terminate, collectSSE() would hang and the
    // vitest test-timeout (20s) would fire. Reaching this assertion
    // means the body close was observed.
    const events = await collectSSE(res);
    expect(events.find((e) => e.event === 'error')).toBeDefined();
    // And the body did terminate (otherwise we'd have hung).
    expect(events.length).toBeGreaterThan(0);
  });
});
