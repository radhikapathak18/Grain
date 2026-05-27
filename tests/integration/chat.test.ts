// Integration test: POST /api/chat/stream
//
// The full SSE pipeline end-to-end — validation, rate limit / concurrency
// cap, status events, retrieval, progressive citation emission, empty
// results, error propagation, and audit logging.
//
// ONE mock: `streamClaude` is replaced with a scripted async generator
// so we never spawn the real Claude CLI. The rest is real:
//   - retrieval against the CLAIMS fixture
//   - rateLimit's module-level windows + concurrency cap
//   - the audit() function (we hijack console.log to capture lines)
//   - the prompts builder (we keep the real one — its output is just
//     fed to the mocked streamClaude and discarded).
//
// The rate-limit module holds state across imports, so each `describe`
// that touches the limiter uses a unique IP via the
// `X-Forwarded-For` header. Tests that care about state isolation also
// call `vi.resetModules()` before re-importing the route.

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ClaudeStreamEvent } from '../../apps/api/src/lib/claude.ts';
import {
  collectSSE,
  eventsOfType,
  streamSSE as streamSSEReader,
} from './_sse-collect.ts';

// --------------------------------------------------------------------
// Scripted streamClaude — each test seeds `mockEvents` (synchronous
// list) or `mockEventsAsync` (async generator that lets us pause /
// gate events mid-stream).
// --------------------------------------------------------------------
let mockEvents: ClaudeStreamEvent[] = [];
let mockEventsAsync: AsyncGenerator<ClaudeStreamEvent> | null = null;

vi.mock('../../apps/api/src/lib/claude.ts', () => ({
  streamClaude: async function* () {
    if (mockEventsAsync) {
      for await (const ev of mockEventsAsync) yield ev;
      return;
    }
    for (const ev of mockEvents) yield ev;
  },
}));

// --------------------------------------------------------------------
// audit() writes single-line JSON to console.log. We capture every
// such write (and only those that parse as JSON with an `event` field)
// so tests can assert audit emission without standing up a log shipper.
// --------------------------------------------------------------------
type AuditLine = {
  ts: string;
  event: string;
  [k: string]: unknown;
};

let auditLines: AuditLine[] = [];
let consoleLogSpy: ReturnType<typeof vi.spyOn> | null = null;

function startAuditCapture() {
  auditLines = [];
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    const first = args[0];
    if (typeof first !== 'string') return;
    try {
      const parsed = JSON.parse(first);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as Record<string, unknown>).event === 'string'
      ) {
        auditLines.push(parsed as AuditLine);
      }
    } catch {
      // not an audit line — ignore.
    }
  });
}

function stopAuditCapture() {
  consoleLogSpy?.mockRestore();
  consoleLogSpy = null;
}

// --------------------------------------------------------------------
// loadApp — re-imports the chat route AFTER vi.mock is in effect.
// Calling vi.resetModules() between tests gives each test a fresh
// rate-limit state map, which is critical for the rate-limit and
// concurrency-cap tests.
// --------------------------------------------------------------------
async function loadApp() {
  vi.resetModules();
  vi.doMock('../../apps/api/src/lib/claude.ts', () => ({
    streamClaude: async function* () {
      if (mockEventsAsync) {
        for await (const ev of mockEventsAsync) yield ev;
        return;
      }
      for (const ev of mockEvents) yield ev;
    },
  }));
  const { Hono } = await import('hono');
  const { chatRoutes } = await import('../../apps/api/src/routes/chat.ts');
  const app = new Hono();
  app.route('/api/chat', chatRoutes);
  return app;
}

const VALID_REQUEST = {
  question: 'What are the top onboarding pain points across products?',
  role: 'pm' as const,
  shape: 'explore' as const,
  products: ['helix-core', 'p4v'] as const,
};

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Per-test IP so rateLimit state buckets do not collide across
      // unrelated assertions. Tests that NEED a shared bucket override
      // this header explicitly.
      'x-forwarded-for': `127.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

beforeEach(() => {
  mockEvents = [];
  mockEventsAsync = null;
});

afterEach(() => {
  stopAuditCapture();
  vi.clearAllMocks();
});

afterAll(() => {
  // Defensive — make sure no spy outlives the suite.
  stopAuditCapture();
});

// ====================================================================
// 1. Validation (400)
// ====================================================================
describe('POST /api/chat/stream — validation (400)', () => {
  it('rejects a missing question with 400 / "question required"', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, question: '' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('question required');
  });

  it('rejects a whitespace-only question', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, question: '\n\t  ' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects unparseable JSON', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest('not-json-at-all'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects an oversized question (> 2000 chars)', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, question: 'x'.repeat(2001) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/2000 characters/);
  });

  it('accepts a question of exactly 2000 chars (boundary)', async () => {
    mockEvents = [{ kind: 'delta', text: 'ok' }];
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, question: 'x'.repeat(2000) }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects an unknown role', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, role: 'manager' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid role');
  });

  it('rejects an unknown shape', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, shape: 'sketch' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid shape');
  });

  it('rejects a products field that is not an array', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, products: 'helix-core' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid products');
  });

  it('rejects an empty products array', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, products: [] }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects unknown product ids', async () => {
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({
        ...VALID_REQUEST,
        products: ['helix-core', 'made-up-product'],
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ====================================================================
// 2. SSE happy path: status → status → status → delta → done
// ====================================================================
describe('POST /api/chat/stream — SSE event ordering', () => {
  it('emits searching → retrieved → synthesizing → delta(s) → done in order', async () => {
    mockEvents = [
      { kind: 'delta', text: 'Hello ' },
      { kind: 'delta', text: 'world.' },
    ];
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST),
    );
    expect(res.status).toBe(200);

    const events = await collectSSE(res);
    const names = events.map((e) => e.event);

    // Three statuses, then deltas, then done.
    const statusIdxs = names
      .map((n, i) => (n === 'status' ? i : -1))
      .filter((i) => i >= 0);
    expect(statusIdxs).toHaveLength(3);
    const phases = events
      .filter((e) => e.event === 'status')
      .map((e) => (e.data as { phase: string }).phase);
    expect(phases).toEqual(['searching', 'retrieved', 'synthesizing']);

    const deltaIdxs = names
      .map((n, i) => (n === 'delta' ? i : -1))
      .filter((i) => i >= 0);
    const doneIdx = names.indexOf('done');
    expect(deltaIdxs.length).toBeGreaterThan(0);
    // Every delta arrives AFTER the third (synthesizing) status.
    expect(Math.min(...deltaIdxs)).toBeGreaterThan(statusIdxs[2]!);
    // `done` is the last event.
    expect(doneIdx).toBe(names.length - 1);

    const done = events[doneIdx]!;
    expect((done.data as { totalCitations: number }).totalCitations).toBe(0);
  });
});

// ====================================================================
// 3. Citation dedupe across delta-chunk boundaries
// ====================================================================
describe('POST /api/chat/stream — citation marker handling', () => {
  it('emits ONE citation event when a [CL-NNNN] marker is split across deltas', async () => {
    // Marker [CL-0012] is split: 'foo [CL-00' arrives first, '12]'
    // arrives next. The route holds a 16-char overlap tail so the
    // boundary marker is matched on the next scan.
    mockEvents = [
      { kind: 'delta', text: 'foo [CL-00' },
      { kind: 'delta', text: '12] bar' },
    ];
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST),
    );
    const events = await collectSSE(res);
    const citations = eventsOfType(events, 'citation').map(
      (e) => (e.data as { id: string }).id,
    );
    expect(citations).toEqual(['CL-0012']);
  });

  it('emits each distinct marker exactly once, even when repeated', async () => {
    mockEvents = [
      { kind: 'delta', text: 'See [CL-0001], also [CL-0002].' },
      { kind: 'delta', text: ' And again [CL-0001]; once more [CL-0002].' },
    ];
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST),
    );
    const events = await collectSSE(res);
    const citations = eventsOfType(events, 'citation').map(
      (e) => (e.data as { id: string }).id,
    );
    expect(citations).toEqual(['CL-0001', 'CL-0002']);

    const done = events.find((e) => e.event === 'done')!;
    expect((done.data as { totalCitations: number }).totalCitations).toBe(2);
  });
});

// ====================================================================
// 4. Empty-results path (verify shape, no keyword match)
// ====================================================================
describe('POST /api/chat/stream — empty results path', () => {
  it('returns a polite delta + done(0 citations) and audits outcome=empty', async () => {
    mockEvents = [
      // These should NEVER be emitted — retrieval returns 0 claims so
      // the route short-circuits before calling streamClaude.
      { kind: 'delta', text: 'this should not be sent' },
    ];
    startAuditCapture();
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({
        ...VALID_REQUEST,
        shape: 'verify',
        question: 'qzzz xxyy nonsensicalstringthatcannotmatchaclaim',
      }),
    );
    expect(res.status).toBe(200);
    const events = await collectSSE(res);

    const deltas = eventsOfType(events, 'delta').map(
      (e) => (e.data as { text: string }).text,
    );
    expect(deltas.join(' ')).toMatch(/No supporting evidence found/);
    // The Claude mock did NOT run — its text is absent.
    expect(deltas.join(' ')).not.toContain('this should not be sent');

    const done = events.find((e) => e.event === 'done')!;
    expect((done.data as { totalCitations: number }).totalCitations).toBe(0);

    // Audit: start + end, end's outcome is 'empty'.
    stopAuditCapture();
    const start = auditLines.find((l) => l.event === 'chat.stream.start');
    const end = auditLines.find((l) => l.event === 'chat.stream.end');
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect((end as AuditLine).outcome).toBe('empty');
    expect((end as AuditLine).claimsRetrieved).toBe(0);
    expect((end as AuditLine).totalCitations).toBe(0);
  });
});

// ====================================================================
// 5. Error from streamClaude → SSE error event
// ====================================================================
describe('POST /api/chat/stream — error propagation', () => {
  it('forwards a streamClaude error event to the SSE error channel', async () => {
    mockEvents = [
      { kind: 'delta', text: 'starting...' },
      { kind: 'error', message: 'safe user-visible message' },
    ];
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST),
    );
    expect(res.status).toBe(200);
    const events = await collectSSE(res);
    const errs = eventsOfType(events, 'error');
    expect(errs).toHaveLength(1);
    expect((errs[0]!.data as { message: string }).message).toBe(
      'safe user-visible message',
    );
  });

  it('emits a generic error message when streamClaude throws unexpectedly', async () => {
    // Use the async-generator form so we can throw mid-iteration.
    mockEventsAsync = (async function* () {
      yield { kind: 'delta', text: 'boom incoming...' } as ClaudeStreamEvent;
      throw new Error('subprocess died unexpectedly');
    })();
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST),
    );
    expect(res.status).toBe(200);
    const events = await collectSSE(res);
    const errs = eventsOfType(events, 'error');
    expect(errs).toHaveLength(1);
    // The catch block in the route emits ERR_SYNTHESIS_FAILED — a
    // generic, user-safe string — not the underlying message.
    expect((errs[0]!.data as { message: string }).message).toMatch(
      /synthesis failed/i,
    );
    // The raw error.message must never leak to the client payload.
    expect(JSON.stringify(events)).not.toContain('subprocess died unexpectedly');
  });
});

// ====================================================================
// 6. Audit log: every accepted request emits start + end
// ====================================================================
describe('POST /api/chat/stream — audit logging', () => {
  it('emits chat.stream.start then chat.stream.end with structured fields', async () => {
    mockEvents = [
      { kind: 'delta', text: 'A short answer with [CL-0001].' },
    ];
    startAuditCapture();
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({
        ...VALID_REQUEST,
        question: 'onboarding question',
      }),
    );
    expect(res.status).toBe(200);
    await collectSSE(res);
    stopAuditCapture();

    const startIdx = auditLines.findIndex(
      (l) => l.event === 'chat.stream.start',
    );
    const endIdx = auditLines.findIndex(
      (l) => l.event === 'chat.stream.end',
    );
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(startIdx); // end follows start
    const start = auditLines[startIdx]!;
    const end = auditLines[endIdx]!;

    // start structure
    expect(typeof start.requestId).toBe('string');
    expect(start.role).toBe('pm');
    expect(start.shape).toBe('explore');
    expect(Array.isArray(start.productIds)).toBe(true);
    expect((start.productIds as string[]).sort()).toEqual([
      'helix-core',
      'p4v',
    ]);
    expect(start.questionChars).toBe('onboarding question'.length);
    expect(typeof start.questionPreview).toBe('string');

    // end structure
    expect(end.requestId).toBe(start.requestId); // correlation id
    expect(end.outcome).toBe('ok');
    expect(typeof end.claimsRetrieved).toBe('number');
    expect(end.totalCitations).toBe(1);
    expect(typeof end.responseChars).toBe('number');
    expect(typeof end.durationMs).toBe('number');
    expect((end.durationMs as number) >= 0).toBe(true);
  });

  it('emits chat.stream.invalid for a 400 (and does NOT emit start/end)', async () => {
    startAuditCapture();
    const app = await loadApp();
    const res = await app.request(
      '/api/chat/stream',
      makeRequest({ ...VALID_REQUEST, role: 'manager' }),
    );
    expect(res.status).toBe(400);
    stopAuditCapture();
    const invalid = auditLines.find(
      (l) => l.event === 'chat.stream.invalid',
    );
    const start = auditLines.find((l) => l.event === 'chat.stream.start');
    const end = auditLines.find((l) => l.event === 'chat.stream.end');
    expect(invalid).toBeDefined();
    expect(start).toBeUndefined();
    expect(end).toBeUndefined();
    expect(invalid!.reason).toBe('invalid role');
  });
});

// ====================================================================
// 7. Rate limit: 21st request in window → 429 with Retry-After
// ====================================================================
// Each accepted request takes ~500ms (the route's two 250ms status
// `beat()` calls plus a tiny amount of mock streamClaude work) so the
// 20 priming requests in a row are intrinsically ~10s long. The
// suite-wide `testTimeout` is 10s; these two tests therefore get
// their own generous timeout via the per-test third argument.
const RATE_LIMIT_TIMEOUT = 30_000;

describe('POST /api/chat/stream — rate limit', () => {
  it(
    'rejects the 21st request from the same IP within the window with 429 + Retry-After',
    async () => {
      // Use a single fixed IP so all 21 requests share a bucket. Each
      // request must fully drain (release concurrency slot) before the
      // next, so we await collectSSE in a sequential loop.
      const ip = '10.99.0.1';
      mockEvents = [{ kind: 'delta', text: 'short' }];
      const app = await loadApp();

      // 20 accepted requests.
      for (let i = 0; i < 20; i += 1) {
        const res = await app.request(
          '/api/chat/stream',
          makeRequest(VALID_REQUEST, { 'x-forwarded-for': ip }),
        );
        expect(res.status).toBe(200);
        // Drain the body to release the concurrency slot.
        await collectSSE(res);
      }

      // 21st: rate-limited.
      const blocked = await app.request(
        '/api/chat/stream',
        makeRequest(VALID_REQUEST, { 'x-forwarded-for': ip }),
      );
      expect(blocked.status).toBe(429);
      // Retry-After header is present (positive integer seconds).
      const retry = blocked.headers.get('retry-after');
      expect(retry).toBeTruthy();
      expect(Number(retry)).toBeGreaterThan(0);
      expect((await blocked.json()).error).toMatch(/rate limit/i);
    },
    RATE_LIMIT_TIMEOUT,
  );

  it(
    'audits chat.stream.rejected with reason=rate when the limit fires',
    async () => {
      const ip = '10.99.0.2';
      mockEvents = [{ kind: 'delta', text: 'short' }];
      const app = await loadApp();
      for (let i = 0; i < 20; i += 1) {
        const res = await app.request(
          '/api/chat/stream',
          makeRequest(VALID_REQUEST, { 'x-forwarded-for': ip }),
        );
        await collectSSE(res);
      }
      startAuditCapture();
      const blocked = await app.request(
        '/api/chat/stream',
        makeRequest(VALID_REQUEST, { 'x-forwarded-for': ip }),
      );
      expect(blocked.status).toBe(429);
      stopAuditCapture();
      const rejected = auditLines.find(
        (l) => l.event === 'chat.stream.rejected',
      );
      expect(rejected).toBeDefined();
      expect(rejected!.reason).toBe('rate');
    },
    RATE_LIMIT_TIMEOUT,
  );
});

// ====================================================================
// 8. Concurrency cap: second concurrent stream from same IP → 429
// ====================================================================
describe('POST /api/chat/stream — concurrency cap', () => {
  it('rejects a second simultaneous stream from the same IP with 429 / "concurrency"', async () => {
    // First stream uses a gated async generator so we can observe it
    // mid-flight. We open a manual "gate" that the generator awaits;
    // the test starts the first stream, fires a second from the same
    // IP while the first is still pumping, asserts the 429, and only
    // then opens the gate.
    let release: (() => void) | null = null;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    mockEventsAsync = (async function* () {
      yield { kind: 'delta', text: 'first chunk' } as ClaudeStreamEvent;
      await gate;
      yield { kind: 'delta', text: ' second chunk' } as ClaudeStreamEvent;
    })();

    const app = await loadApp();
    const ip = '10.99.0.99';

    // Kick off the first stream WITHOUT awaiting completion.
    const firstResPromise = app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST, { 'x-forwarded-for': ip }),
    );
    const firstRes = await firstResPromise;
    expect(firstRes.status).toBe(200);

    // Begin consuming the body so the stream actually flows and the
    // concurrency slot is held.
    const reader = streamSSEReader(firstRes);
    // Pull the first event (status: searching) to ensure the slot is
    // currently checked out.
    const first = await reader.next();
    expect(first.done).toBe(false);

    // Second request from the SAME IP — should hit concurrency cap.
    const second = await app.request(
      '/api/chat/stream',
      makeRequest(VALID_REQUEST, { 'x-forwarded-for': ip }),
    );
    expect(second.status).toBe(429);
    const json = await second.json();
    expect(json.error).toMatch(/concurrent/i);

    // Release the gate so the first stream can finish, then drain.
    release!();
    // Drain the rest of the first stream so it completes cleanly.
    while (true) {
      const r = await reader.next();
      if (r.done) break;
    }
  });
});
