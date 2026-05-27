import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaudeStreamEvent } from '../../src/lib/claude.ts';

// streamClaude is mocked so tests do not shell out to the real Claude CLI.
// Each test seeds `mockEvents` with the synthetic stream it wants to assert
// on. The default empty array means "model produced nothing" (the route
// should still emit a `done` event with totalCitations=0).
let mockEvents: ClaudeStreamEvent[] = [];

vi.mock('../../src/lib/claude.ts', () => ({
  streamClaude: async function* () {
    for (const ev of mockEvents) yield ev;
  },
}));

vi.mock('../../src/prompts/index.ts', () => ({
  buildSystemPrompt: () => 'mock system prompt',
}));

// Imports must come AFTER vi.mock so the mocked modules are used.
async function loadApp() {
  vi.resetModules();
  // Re-register mocks after resetModules (vi.mock hoists, but reset clears
  // dynamic module instances).
  vi.doMock('../../src/lib/claude.ts', () => ({
    streamClaude: async function* () {
      for (const ev of mockEvents) yield ev;
    },
  }));
  vi.doMock('../../src/prompts/index.ts', () => ({
    buildSystemPrompt: () => 'mock system prompt',
  }));
  const { Hono } = await import('hono');
  const { chatRoutes } = await import('../../src/routes/chat.ts');
  const app = new Hono();
  app.route('/api/chat', chatRoutes);
  return app;
}

async function readSSE(res: Response): Promise<{ event: string; data: unknown }[]> {
  const text = await res.text();
  const out: { event: string; data: unknown }[] = [];
  // Hono SSE format: blocks separated by \n\n, each block has `event:` + `data:` lines.
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());
  for (const block of blocks) {
    let event = 'message';
    let data: unknown = null;
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
      }
    }
    out.push({ event, data });
  }
  return out;
}

const VALID = {
  question: 'What are the top pain points across products?',
  role: 'pm',
  shape: 'explore',
  products: ['helix-core', 'p4v'],
};

describe('POST /api/chat/stream — validation', () => {
  beforeEach(() => {
    mockEvents = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a missing JSON body with 400', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('question required');
  });

  it('rejects an empty question', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, question: '   ' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('question required');
  });

  it('rejects a question longer than 2000 chars', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, question: 'x'.repeat(2001) }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/2000 characters/);
  });

  it('accepts a question of exactly 2000 chars after trim', async () => {
    const app = await loadApp();
    mockEvents = [{ kind: 'delta', text: 'ok' }];
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, question: 'x'.repeat(2000) }),
    });
    expect(res.status).toBe(200);
  });

  it('rejects an unknown role', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, role: 'manager' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid role');
  });

  it('rejects an unknown shape', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, shape: 'sketch' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid shape');
  });

  it('rejects products that is not an array', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, products: 'helix-core' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid products');
  });

  it('rejects an empty products array', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, products: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown product ids', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID, products: ['helix-core', 'unknown'] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects more product ids than known products', async () => {
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...VALID,
        products: ['helix-core', 'p4v', 'helix-swarm', 'helix-core'],
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/chat/stream — SSE happy paths', () => {
  beforeEach(() => {
    mockEvents = [];
  });

  it('streams status events then a delta + done for a successful call', async () => {
    mockEvents = [
      { kind: 'delta', text: 'Hello ' },
      { kind: 'delta', text: 'world.' },
    ];
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID),
    });
    expect(res.status).toBe(200);
    const events = await readSSE(res);
    const phases = events.filter((e) => e.event === 'status').map((e) => (e.data as { phase: string }).phase);
    expect(phases).toEqual(['searching', 'retrieved', 'synthesizing']);
    const deltas = events.filter((e) => e.event === 'delta').map((e) => (e.data as { text: string }).text);
    expect(deltas).toEqual(['Hello ', 'world.']);
    const done = events.find((e) => e.event === 'done');
    expect(done).toBeDefined();
    expect((done!.data as { totalCitations: number }).totalCitations).toBe(0);
  });

  it('emits a citation event the first time a [CL-NNNN] marker appears', async () => {
    mockEvents = [
      { kind: 'delta', text: 'Issue with merge [CL-' },
      { kind: 'delta', text: '0001] and again [CL-0001] (dup).' },
    ];
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID),
    });
    const events = await readSSE(res);
    const citationIds = events
      .filter((e) => e.event === 'citation')
      .map((e) => (e.data as { id: string }).id);
    expect(citationIds).toEqual(['CL-0001']); // deduped across boundary
    const done = events.find((e) => e.event === 'done');
    expect((done!.data as { totalCitations: number }).totalCitations).toBe(1);
  });

  it('emits multiple distinct citations in first-seen order', async () => {
    mockEvents = [
      { kind: 'delta', text: 'See [CL-0001] and [CL-0002]. Also [CL-0001].' },
    ];
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID),
    });
    const events = await readSSE(res);
    const citationIds = events
      .filter((e) => e.event === 'citation')
      .map((e) => (e.data as { id: string }).id);
    expect(citationIds).toEqual(['CL-0001', 'CL-0002']);
  });

  it('returns a polite empty-result message when retrieval finds nothing (verify)', async () => {
    mockEvents = [{ kind: 'delta', text: 'should not appear' }];
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...VALID,
        shape: 'verify',
        question: 'qqqzzz xxxxyyy nonsensicalstringthatcannotmatch',
      }),
    });
    const events = await readSSE(res);
    const deltas = events.filter((e) => e.event === 'delta').map((e) => (e.data as { text: string }).text);
    expect(deltas.join(' ')).toMatch(/No supporting evidence found/);
    // The mocked claude generator should NOT have run — its delta is absent.
    expect(deltas.join(' ')).not.toContain('should not appear');
    const done = events.find((e) => e.event === 'done');
    expect((done!.data as { totalCitations: number }).totalCitations).toBe(0);
  });

  it('emits an error event when streamClaude yields an error', async () => {
    mockEvents = [
      { kind: 'delta', text: 'starting…' },
      { kind: 'error', message: 'safe user-visible message' },
    ];
    const app = await loadApp();
    const res = await app.request('/api/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID),
    });
    const events = await readSSE(res);
    const errs = events.filter((e) => e.event === 'error');
    expect(errs).toHaveLength(1);
    expect((errs[0]!.data as { message: string }).message).toBe('safe user-visible message');
  });
});
