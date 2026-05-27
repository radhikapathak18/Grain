// POST /api/chat/stream — Server-Sent Events synthesis endpoint.
//
// This is the only AI-shaped endpoint Grain exposes. It spawns the
// Claude CLI subprocess (apps/api/src/lib/claude.ts → $CLAUDE_BIN) and
// proxies JSONL deltas as SSE events.
//
// !!! CRITICAL — read README.md before running !!!
// Real Claude calls cost tokens, take seconds, and produce non-
// deterministic output. This script MUST be run against the API with
// CLAUDE_BIN pointed at tests/e2e/scripts/mock-claude.mjs (the same
// shim the E2E suite uses). The mock emits deterministic deltas with
// [CL-0001] and [CL-0002] markers in <100ms of subprocess time. See
// the README for the exact start command.
//
// SLOs (against mock-Claude; not meaningful against real Claude):
//   - ttft_ms   p95 < 1000ms
//       Floor is dictated by the route itself: three status `beat()`
//       calls of STATUS_BEAT_MS = 250ms each (chat.ts) sit BEFORE the
//       first `delta` SSE frame for the happy path. That's 750ms of
//       deliberate UX latency. The remaining ~250ms budget covers
//       request parsing, retrieval, subprocess spawn, and the first
//       JSONL line round-trip from the mock.
//   - total_ms  p95 < 5000ms
//       Mock emits ~8 chunks at 8ms intervals plus envelope. Real-
//       world total under mock should be ~1.0s. 5s gives ample slack
//       for a cold CI box.
//   - error rate < 1%
//
// Throughput considerations:
//   apps/api/src/lib/rateLimit.ts caps CONCURRENT_MAX=1 PER IP.
//   To exercise concurrency we MUST send distinct X-Forwarded-For
//   headers (see lib/common.js:spoofedIpHeaders). RATE_MAX=20 per
//   60s per IP also applies — at 5 sustained VUs each VU comfortably
//   stays under 20/min even with sub-second iterations.
//
// Concurrent VUs cap: 5. Going higher does not improve throughput
// (each VU is a single in-flight stream behind its own spoofed IP)
// and would just increase the report noise.
//
// Run:
//   k6 run scripts/chat-stream.k6.js
//   BASE_URL=http://localhost:3001 k6 run scripts/chat-stream.k6.js

import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE_URL, spoofedIpHeaders } from '../lib/common.js';

// Custom metrics — http_req_duration on a streaming POST measures the
// total response time including SSE close, which is what we want for
// the `total_ms` SLO. For TTFT we use r.timings.waiting which is the
// server-side latency until the first byte returned. Hono's streamSSE
// flushes headers immediately, so `waiting` aligns with first-byte of
// the SSE body in practice.
const ttftMs = new Trend('ttft_ms', true);
const totalMs = new Trend('total_ms', true);
const streamErrors = new Rate('stream_errors');
const citationsSeen = new Counter('citations_seen');
const deltasSeen = new Counter('deltas_seen');

export const options = {
  // Chat needs its own stage shape — lower VU cap because of
  // CONCURRENT_MAX=1 per IP and because the endpoint is intentionally
  // slow (status beats + subprocess spawn).
  stages: [
    { duration: '30s', target: 2 },   // warmup
    { duration: '1m', target: 5 },    // ramp
    { duration: '3m', target: 5 },    // sustain
    { duration: '30s', target: 0 },   // cooldown
  ],
  thresholds: {
    ttft_ms: ['p(50)<900', 'p(95)<1000', 'p(99)<1500'],
    total_ms: ['p(50)<2000', 'p(95)<5000', 'p(99)<8000'],
    stream_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
  // Larger per-request timeout because the mock takes ~1s end-to-end
  // and real Claude (if accidentally pointed at) could be 10s+. Hard
  // ceiling is well above the SLO so threshold failures, not timeouts,
  // drive test failures.
  noConnectionReuse: false,
  tags: { script: 'chat-stream' },
};

const QUESTIONS = [
  {
    question: 'What are the top onboarding friction points across our products?',
    shape: 'explore',
  },
  {
    question: 'Verify that workspace setup is the dominant onboarding complaint.',
    shape: 'verify',
  },
  {
    question: 'How have CLI confusion complaints trended over the last quarter?',
    shape: 'trends',
  },
];

const ROLES = ['pm', 'designer', 'researcher'];

// Parse an SSE body string into a flat list of {event, data} entries.
// Used purely for assertions / metric counting — k6 does not yet
// expose a first-class streaming HTTP client in the stable build, so
// we read the body in full once the connection closes and walk it.
function parseSSE(body) {
  const events = [];
  if (!body) return events;
  // SSE frames are separated by blank lines (\n\n).
  const frames = body.split(/\r?\n\r?\n/);
  for (const frame of frames) {
    const trimmed = frame.trim();
    if (!trimmed) continue;
    let event = 'message';
    const dataLines = [];
    for (const line of trimmed.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join('\n') });
    }
  }
  return events;
}

export default function () {
  const pick = QUESTIONS[__ITER % QUESTIONS.length];
  const role = ROLES[__ITER % ROLES.length];
  const payload = JSON.stringify({
    question: pick.question,
    role,
    shape: pick.shape,
    // helix-core is in every seeded user's product list and yields
    // non-empty retrieval for the question set above.
    products: ['helix-core', 'p4v'],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...spoofedIpHeaders(),
    },
    timeout: '30s',
    tags: { endpoint: 'chat-stream' },
  };

  const started = Date.now();
  const res = http.post(`${BASE_URL}/api/chat/stream`, payload, params);
  const finished = Date.now();

  // r.timings.waiting = ms from end-of-request-write to first byte
  // of response. For an SSE endpoint that flushes headers immediately
  // this is our TTFT proxy. Documented limitation: includes TCP
  // connect+TLS for the very first iteration of each VU, then drops
  // for keep-alived iterations.
  ttftMs.add(res.timings.waiting);
  totalMs.add(finished - started);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'content-type is text/event-stream': (r) => {
      const ct = r.headers['Content-Type'] || r.headers['content-type'] || '';
      return ct.includes('text/event-stream');
    },
  });
  if (!ok) {
    streamErrors.add(1);
    return;
  }
  streamErrors.add(0);

  const events = parseSSE(res.body);
  const byKind = events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] || 0) + 1;
    return acc;
  }, {});
  deltasSeen.add(byKind.delta || 0);
  citationsSeen.add(byKind.citation || 0);

  check(events, {
    'received at least one status event': () => (byKind.status || 0) >= 1,
    'received at least one delta event': () => (byKind.delta || 0) >= 1,
    'received terminal done event': () => (byKind.done || 0) === 1,
    'no error events': () => (byKind.error || 0) === 0,
    // Mock-Claude path always emits two citation markers; the empty
    // / gibberish branches do not. We only assert > 0 when this
    // iteration's question is expected to retrieve claims (all three
    // canned questions above do).
    'at least one citation when retrieval non-empty': () =>
      (byKind.citation || 0) >= 1,
  });
}
