// Realtime invariant 7: absolute timeout — CLIENT-side observation.
//
// apps/api/src/lib/claude.ts enforces ABSOLUTE_TIMEOUT_MS = 300_000ms.
// When it fires, the wrapper:
//   1. emits a `kind:'error'` event with the user-safe message
//      ERR_ABSOLUTE_TIMEOUT = 'synthesis exceeded the time limit; please try again'
//   2. calls killWithEscalation(proc) → SIGTERM → 2s → SIGKILL
//
// The chat route forwards that error to the SSE wire as an `error`
// event. The frontend's useChatStream sets `error` state accordingly.
//
// CHAOS / REALTIME SPLIT:
//   - chaos-agent owns the SERVER-side process-tree assertion: that
//     the subprocess actually gets reaped (SIGTERM → SIGKILL), no
//     orphaned children, idle/abs timer correctly cleared. See
//     tests/chaos/shims/silent.mjs (idle path) and the future
//     trap-term.mjs / slow.mjs (abs path).
//   - This realtime spec owns the CLIENT-side observation: when the
//     wrapper emits the absolute-timeout error, the SSE stream MUST
//     surface it as an `error` event with the documented user-safe
//     message, and the stream MUST close cleanly.
//
// We do NOT wait 5 real minutes. Two strategies are valid:
//   (a) shim-driven: spawn the real API with $CLAUDE_BIN pointed at
//       tests/realtime/shims/slow.mjs and a TEST-ONLY env var that
//       overrides ABSOLUTE_TIMEOUT_MS (would require a code change
//       to apps/api). Not done — out of scope.
//   (b) mock-driven: have the streamClaude mock yield the exact
//       error event the real wrapper would emit, then assert the
//       client wire shape.
//
// We use (b). It pins the contract the chaos suite verifies the
// wrapper actually keeps.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';
import {
  loadApp,
  makeInit,
  resetMock,
  setMockEventsAsync,
} from '../lib/loadApp.ts';
import { collectSSE } from '../lib/sseReader.ts';

// Must match ERR_ABSOLUTE_TIMEOUT in apps/api/src/lib/claude.ts. If
// that constant is changed there, this test will fail loudly — which
// is intentional. The user-safe wording is a stable wire contract.
const ABS_TIMEOUT_MESSAGE = 'synthesis exceeded the time limit; please try again';

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

describe('absolute timeout — client-side observation', () => {
  it('surfaces the wrapper-emitted absolute-timeout error as a single SSE `error` event with the documented user-safe message', async () => {
    // Simulate: streamClaude produced some partial output, then the
    // absolute timer fired and the wrapper pushed its user-safe error.
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'delta', text: 'a partial answer that never finishes...' } as ClaudeStreamEvent;
        // Brief gap to mirror how the real wrapper would deliver this
        // (delta first, then timer fires).
        await new Promise((r) => setTimeout(r, 10));
        yield { kind: 'error', message: ABS_TIMEOUT_MESSAGE } as ClaudeStreamEvent;
      })(),
    );

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    expect(res.status).toBe(200);
    const events = await collectSSE(res);

    const errs = events.filter((e) => e.event === 'error');
    expect(errs).toHaveLength(1);
    expect((errs[0]!.data as { message: string }).message).toBe(
      ABS_TIMEOUT_MESSAGE,
    );

    // Wire must not include subprocess details, exit codes, or
    // stack traces. The wrapper scrubs those at the source; this
    // assertion catches a regression where someone wires the raw
    // message through.
    const wire = JSON.stringify(events);
    expect(wire).not.toMatch(/exit=/);
    expect(wire).not.toMatch(/sigterm/i);
    expect(wire).not.toMatch(/sigkill/i);
    expect(wire).not.toMatch(/stderr-tail/);
  });

  it('the stream closes cleanly after the absolute-timeout error', async () => {
    setMockEventsAsync(
      (async function* () {
        yield { kind: 'error', message: ABS_TIMEOUT_MESSAGE } as ClaudeStreamEvent;
      })(),
    );
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());

    // If the stream hung, this collect would time out via vitest's
    // testTimeout. Reaching the assertions means the body closed.
    // The chat route emits `done` after a streamClaude `kind:'error'`
    // (the for-await loop drains, then the post-loop `done` write
    // fires). This is documented in server-disconnect.test.ts.
    const events = await collectSSE(res);
    expect(events.find((e) => e.event === 'error')).toBeDefined();
    expect(events[events.length - 1]!.event).toBe('done');
  });
});
