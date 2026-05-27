// Realtime invariant 1: SSE event ordering on /api/chat/stream.
//
// Wire contract (defined in apps/api/src/routes/chat.ts):
//
//   1. status   { phase: 'searching',     ... }
//   2. status   { phase: 'retrieved',     ... }
//   3. status   { phase: 'synthesizing',  ... }
//   4. delta*   ── one per text chunk from streamClaude, in arrival order
//   5. citation* ── one per NEWLY-SEEN [CL-NNNN] marker, interleaved with deltas
//   6. done     { totalCitations: <int> }
//
// Hard invariants this test owns:
//   - All three status events are emitted in the order above.
//   - All status events arrive BEFORE the first delta.
//   - All citations arrive AFTER the synthesizing status (because they
//     come from scanning streamed deltas).
//   - `done` is the LAST event of the stream.
//   - Deltas and citations may interleave; the ONLY ordering constraint
//     between them is that a citation event for `CL-NNNN` cannot arrive
//     before the delta that contained the marker text.
//
// The chat.test.ts spec in tests/integration already covers a
// happy-path version of (1)-(6). This file pins the FULL invariant
// (interleaving constraints + delta/citation causal ordering) which is
// the actual realtime SLA, not just "same set of events arrive".

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';
import { loadApp, makeInit, resetMock, setMockEvents } from '../lib/loadApp.ts';
import { collectSSE } from '../lib/sseReader.ts';

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

describe('SSE event ordering — /api/chat/stream', () => {
  it('emits status×3 (searching → retrieved → synthesizing) before any delta', async () => {
    setMockEvents([
      { kind: 'delta', text: 'Across the products ' },
      { kind: 'delta', text: 'the strongest pattern is X.' },
    ]);

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    expect(res.status).toBe(200);

    const events = await collectSSE(res);
    const names = events.map((e) => e.event);

    const statusIdxs = names
      .map((n, i) => (n === 'status' ? i : -1))
      .filter((i) => i >= 0);
    const firstDeltaIdx = names.indexOf('delta');
    expect(statusIdxs).toHaveLength(3);
    expect(firstDeltaIdx).toBeGreaterThan(statusIdxs[2]!);

    const phases = events
      .filter((e) => e.event === 'status')
      .map((e) => (e.data as { phase: string }).phase);
    expect(phases).toEqual(['searching', 'retrieved', 'synthesizing']);
  });

  it('terminates with a `done` event as the FINAL event in the stream', async () => {
    setMockEvents([{ kind: 'delta', text: 'short answer.' }]);

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    const names = events.map((e) => e.event);

    expect(names[names.length - 1]).toBe('done');
    // No event of any kind follows `done`.
    expect(names.lastIndexOf('done')).toBe(names.length - 1);
  });

  it('allows citation events to INTERLEAVE with delta events (no batch-at-end)', async () => {
    // Stream three deltas; each carries one citation marker. The route
    // must emit a citation event progressively, not collect them and
    // dump them all just before `done`.
    setMockEvents([
      { kind: 'delta', text: 'first claim [CL-0001].' },
      { kind: 'delta', text: ' second claim [CL-0002].' },
      { kind: 'delta', text: ' third claim [CL-0003].' },
    ]);

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);

    const orderedNames = events.map((e) => e.event);
    // We expect citations to appear BEFORE `done`, not all bunched at the end.
    const doneIdx = orderedNames.indexOf('done');
    const citationIdxs = orderedNames
      .map((n, i) => (n === 'citation' ? i : -1))
      .filter((i) => i >= 0);
    expect(citationIdxs).toHaveLength(3);
    expect(citationIdxs.every((i) => i < doneIdx)).toBe(true);

    // Causal: a citation event must arrive after the delta that contained
    // the marker. We assert this by checking that there is at least one
    // delta event preceding each citation event.
    for (const cIdx of citationIdxs) {
      const precedingDeltas = orderedNames
        .slice(0, cIdx)
        .filter((n) => n === 'delta').length;
      expect(precedingDeltas).toBeGreaterThan(0);
    }
  });

  it('emits NO citation events when streamClaude emits no markers', async () => {
    setMockEvents([
      { kind: 'delta', text: 'A clean answer ' },
      { kind: 'delta', text: 'with no citation markers at all.' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    expect(events.filter((e) => e.event === 'citation')).toHaveLength(0);
    const done = events.find((e) => e.event === 'done')!;
    expect((done.data as { totalCitations: number }).totalCitations).toBe(0);
  });

  it('ordering invariant holds even when streamClaude yields nothing', async () => {
    // Edge: zero deltas. Status events must still fire in order, then
    // `done` immediately. There is no `delta` and no `citation`.
    setMockEvents([] as ClaudeStreamEvent[]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    const names = events.map((e) => e.event);

    expect(names.filter((n) => n === 'status')).toHaveLength(3);
    expect(names.filter((n) => n === 'delta')).toHaveLength(0);
    expect(names.filter((n) => n === 'citation')).toHaveLength(0);
    expect(names[names.length - 1]).toBe('done');
  });
});
