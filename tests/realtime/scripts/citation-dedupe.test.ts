// Realtime invariant 3: citation-marker dedupe.
//
// `[CL-NNNN]` markers are emitted by Claude inside text deltas. They
// can:
//   (a) appear multiple times in a single answer — should fire only once
//   (b) straddle a chunk boundary — `'foo [CL-00'` + `'12]'` — must still
//       fire exactly once
//   (c) be sliced across MORE than two chunks — `'[CL-'` + `'00'` + `'12]'`
//       — same expectation
//
// apps/api/src/routes/chat.ts implements this via:
//   - a `cited` Set deduping by marker id
//   - a 16-char `scanTail` overlap that carries forward to the next
//     delta so a marker spanning chunks gets matched on the SECOND scan
//
// The integration suite already covers cases (a) and the two-chunk
// flavor of (b). This file pins the harder case (c) AND combines all
// three scenarios into one realistic stream to catch any regression
// in the overlap-window size or the dedupe key.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadApp, makeInit, resetMock, setMockEvents } from '../lib/loadApp.ts';
import { collectSSE } from '../lib/sseReader.ts';

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  resetMock();
});

function citationIds(events: { event: string; data: unknown }[]): string[] {
  return events
    .filter((e) => e.event === 'citation')
    .map((e) => (e.data as { id: string }).id);
}

describe('citation marker dedupe', () => {
  it('marker split across TWO chunks: `foo [CL-00` + `12] bar` → 1 citation', async () => {
    setMockEvents([
      { kind: 'delta', text: 'foo [CL-00' },
      { kind: 'delta', text: '12] bar' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    expect(citationIds(events)).toEqual(['CL-0012']);
  });

  it('marker split across THREE chunks: `[CL-` + `00` + `12]` → 1 citation', async () => {
    setMockEvents([
      { kind: 'delta', text: 'preamble ' },
      { kind: 'delta', text: '[CL-' },
      { kind: 'delta', text: '00' },
      { kind: 'delta', text: '12]' },
      { kind: 'delta', text: ' tail.' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    expect(citationIds(events)).toEqual(['CL-0012']);
  });

  it('marker split across MANY tiny chunks (per-char): `[`,`C`,`L`,`-`,`0`,`0`,`1`,`2`,`]` → 1 citation', async () => {
    // The route's CITATION_SCAN_OVERLAP is 16 chars — comfortably
    // larger than the 9-char marker — so even a per-character split
    // must reconstruct on the final `]` scan.
    setMockEvents([
      { kind: 'delta', text: 'open: ' },
      { kind: 'delta', text: '[' },
      { kind: 'delta', text: 'C' },
      { kind: 'delta', text: 'L' },
      { kind: 'delta', text: '-' },
      { kind: 'delta', text: '0' },
      { kind: 'delta', text: '0' },
      { kind: 'delta', text: '1' },
      { kind: 'delta', text: '2' },
      { kind: 'delta', text: ']' },
      { kind: 'delta', text: ' close.' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    expect(citationIds(events)).toEqual(['CL-0012']);
  });

  it('combined stream: split marker + duplicates → exactly one event per distinct id', async () => {
    // Spec prompt: `'foo [CL-00'` + `'12]'` + `'bar [CL-0012] [CL-0012]'`.
    // Expected: exactly ONE citation event for CL-0012 — covering both
    // the split-across-chunks path and the in-Set dedupe path in a
    // single stream.
    setMockEvents([
      { kind: 'delta', text: 'foo [CL-00' },
      { kind: 'delta', text: '12]' },
      { kind: 'delta', text: 'bar [CL-0012] [CL-0012]' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    expect(citationIds(events)).toEqual(['CL-0012']);
    const done = events.find((e) => e.event === 'done')!;
    expect((done.data as { totalCitations: number }).totalCitations).toBe(1);
  });

  it('multiple distinct markers, each appearing in fragments, dedupe per id', async () => {
    // CL-0001 split, then repeated; CL-0002 whole, then split and repeated.
    setMockEvents([
      { kind: 'delta', text: 'See [CL-00' },
      { kind: 'delta', text: '01] and also [CL-0002].' },
      { kind: 'delta', text: ' Again [CL-0001] plus [CL-' },
      { kind: 'delta', text: '0002] one more time.' },
    ]);
    const { app } = await loadApp();
    const res = await app.request('/api/chat/stream', makeInit());
    const events = await collectSSE(res);
    expect(citationIds(events)).toEqual(['CL-0001', 'CL-0002']);
  });
});
