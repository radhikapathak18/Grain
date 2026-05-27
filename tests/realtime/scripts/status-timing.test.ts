// Realtime invariant 2: status events are paced.
//
// apps/api/src/routes/chat.ts deliberately inserts a 250ms `beat()`
// between status events so the user has time to register each one
// before the next replaces it. Retrieval is sub-millisecond, so without
// the beat the first two statuses would flash by invisibly.
//
// The route comment is explicit (line 61):
//   "Deliberate UX latency — do not 'optimize' away."
//
// This test pins the lower bound. We assert the inter-status gap is
// >=200ms (loose — clock noise, GC pauses, and process scheduling can
// shave a few ms off the nominal 250ms even on a fast machine). We do
// NOT assert an upper bound; that would flake under CI load.
//
// If somebody removes the `beat()` calls the gap collapses to <5ms and
// this test fails loudly.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadApp, makeInit, resetMock, setMockEvents } from '../lib/loadApp.ts';
import { collectSSE } from '../lib/sseReader.ts';

const STATUS_BEAT_LOWER_BOUND_MS = 200;

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

describe('status-event timing — paced by route `beat()`', () => {
  it(
    'inserts >=200ms between consecutive status events (searching → retrieved → synthesizing)',
    async () => {
      setMockEvents([{ kind: 'delta', text: 'ok' }]);
      const { app } = await loadApp();
      const res = await app.request('/api/chat/stream', makeInit());
      const events = await collectSSE(res);

      const statuses = events.filter((e) => e.event === 'status');
      expect(statuses).toHaveLength(3);

      // Two inter-status gaps. Both should be >= STATUS_BEAT_LOWER_BOUND_MS.
      const gap1 = statuses[1]!.tHighResMs - statuses[0]!.tHighResMs;
      const gap2 = statuses[2]!.tHighResMs - statuses[1]!.tHighResMs;
      expect(gap1).toBeGreaterThanOrEqual(STATUS_BEAT_LOWER_BOUND_MS);
      expect(gap2).toBeGreaterThanOrEqual(STATUS_BEAT_LOWER_BOUND_MS);
    },
    10_000,
  );

  it('status pacing holds on the empty-results branch (only two beats fire)', async () => {
    // On the empty branch the route emits searching → beat → retrieved
    // and then short-circuits to a polite delta + done. There is only
    // ONE inter-status gap to measure (between searching and retrieved).
    // Use a question that retrieval will not match.
    setMockEvents([{ kind: 'delta', text: 'should never appear' }]);

    const { app } = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeInit({
        question: 'qzzzz xxxxyy nonsensicalstringnoclaimwillmatch',
        role: 'pm' as const,
        shape: 'verify' as const,
        products: ['helix-core'],
      }),
    );
    const events = await collectSSE(res);
    const statuses = events.filter((e) => e.event === 'status');
    expect(statuses.length).toBeGreaterThanOrEqual(2);
    const gap = statuses[1]!.tHighResMs - statuses[0]!.tHighResMs;
    expect(gap).toBeGreaterThanOrEqual(STATUS_BEAT_LOWER_BOUND_MS);
  });
});
