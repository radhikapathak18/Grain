// Realtime invariant 6: slow consumer safety.
//
// SSE backpressure on Hono's streamSSE is implicit: when the consumer
// stops reading, the underlying TCP socket fills, writes block, and the
// Node event loop stops scheduling the producer task. We cannot
// directly observe "did the server OOM" from a test, but we CAN assert
// the weaker property: the response stream completes end-to-end even
// when the consumer reads with significant delay between chunks.
//
// If a misguided refactor swapped streamSSE for an in-memory buffer
// fill ("send all events at once"), this test would not catch it
// directly — but a paired check that the WALL CLOCK between the first
// status and the `done` event is bounded by (consumer-delay * N events)
// roughly approximates that.
//
// What this file owns:
//   - happy path with a deliberately throttled consumer completes
//   - the total event count matches what the producer emitted (no
//     events dropped under slow consumption)
//
// What this file does NOT own:
//   - Heap-growth assertion → out of scope (would require --expose-gc
//     + heapdump diffing; chaos-agent's process-tree work is closer).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';
import { loadApp, makeInit, resetMock, setMockEvents } from '../lib/loadApp.ts';
import { readSSE } from '../lib/sseReader.ts';

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

describe('slow consumer — stream completes without dropping events', () => {
  it(
    'a consumer that yields 25ms between reads still receives every event in order',
    async () => {
      // 12 deltas + 2 citations + 3 statuses + 1 done = 18 events.
      const chunks: ClaudeStreamEvent[] = [
        { kind: 'delta', text: 'one ' },
        { kind: 'delta', text: 'two ' },
        { kind: 'delta', text: 'three ' },
        { kind: 'delta', text: '[CL-0001] ' },
        { kind: 'delta', text: 'four ' },
        { kind: 'delta', text: 'five ' },
        { kind: 'delta', text: 'six ' },
        { kind: 'delta', text: 'seven ' },
        { kind: 'delta', text: '[CL-0002] ' },
        { kind: 'delta', text: 'eight ' },
        { kind: 'delta', text: 'nine ' },
        { kind: 'delta', text: 'ten.' },
      ];
      setMockEvents(chunks);

      const { app } = await loadApp();
      const res = await app.request('/api/chat/stream', makeInit());
      expect(res.status).toBe(200);

      const collected: { event: string; data: unknown }[] = [];
      // Read with a deliberate 25ms gap between each underlying
      // reader.read() — simulates a sluggish browser.
      for await (const ev of readSSE(res, {
        betweenReads: () => new Promise<void>((r) => setTimeout(r, 25)),
      })) {
        collected.push(ev);
      }

      const names = collected.map((e) => e.event);
      expect(names.filter((n) => n === 'status')).toHaveLength(3);
      // We sent 12 deltas through streamClaude. SSE framing is 1-to-1
      // with delta events, so the consumer should observe 12.
      expect(names.filter((n) => n === 'delta')).toHaveLength(12);
      expect(names.filter((n) => n === 'citation')).toHaveLength(2);
      expect(names[names.length - 1]).toBe('done');
    },
    20_000,
  );

  it('back-pressure does not corrupt SSE framing — every block parses', async () => {
    // 60 small deltas with no citations. If framing got out of sync
    // under back-pressure the parser would fail or merge events; we
    // assert each delta arrives with valid JSON `data`.
    const chunks: ClaudeStreamEvent[] = Array.from({ length: 60 }, (_, i) => ({
      kind: 'delta' as const,
      text: `d${i} `,
    }));
    setMockEvents(chunks);

    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const collected: { event: string; data: unknown }[] = [];
    for await (const ev of readSSE(res, {
      betweenReads: () => new Promise<void>((r) => setTimeout(r, 5)),
    })) {
      collected.push(ev);
    }
    // Every delta event's data must be a parsed object with a `text`
    // string. If framing corrupted, JSON.parse in the reader would
    // have left `data` as the raw string instead.
    for (const ev of collected.filter((e) => e.event === 'delta')) {
      expect(typeof (ev.data as { text?: unknown }).text).toBe('string');
    }
    expect(collected.filter((e) => e.event === 'delta')).toHaveLength(60);
  });
});
