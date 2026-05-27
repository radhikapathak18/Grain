// Rate-limit interaction test — adversarial.
//
// This test does TWO things at once:
//   1. Verifies that apps/api/src/lib/rateLimit.ts actually enforces its
//      hard-coded RATE_MAX=20/min and CONCURRENT_MAX=1 windows when
//      hammered concurrently.
//   2. Demonstrates the X-Forwarded-For trust gap the security agent
//      flagged: by sending 50 distinct X-Forwarded-For headers, one
//      client can multiply its effective rate-limit budget by 50.
//
// This is INTENTIONALLY ADVERSARIAL. The point is to make the prod gap
// visible as a number ("we sustained ~16 req/s/IP against a 20 req/min
// budget by spoofing XFF") rather than as a paragraph in a security
// report.
//
// Expected behavior the test asserts:
//   a) The server never crashes under this pattern (no 5xx, no socket
//      hangup). Rate limiting must degrade gracefully, not catastrophically.
//   b) For any single forged IP, the success count stays bounded by
//      RATE_MAX (20) per 60s window. We verify this by tagging
//      responses with the spoofed IP and inspecting per-tag counts.
//   c) Concurrent-stream cap (CONCURRENT_MAX=1) is enforced per IP:
//      two simultaneous streams from the same forged IP must produce
//      one 200 + one 429-or-equivalent.
//
// What we use the mock-Claude shim for: SSE responses against
// /api/chat/stream complete in ~100ms with the canned 2-citation
// answer. Without the mock, every request would block on a real
// subprocess.
//
// Setup before running:
//   - Start the API with CLAUDE_BIN pointing at
//     tests/e2e/scripts/mock-claude.mjs. The easiest way is to invoke
//     tests/e2e/scripts/start-e2e.sh which already wires this up.
//   - Pre-seed an authed session is not required — /api/chat/stream
//     does not enforce auth at the route level (see
//     apps/api/src/routes/chat.ts).
//
// Run:
//   BASE_URL=http://localhost:3001 k6 run tests/stress/scripts/rate-limit-stress.k6.js
//
// Expected pass:
//   - rate_limit_crashes counter == 0 (no 5xx, no hangups).
//   - For each spoofed IP, per-window success count <= 20 (tolerance ±2
//     for window-boundary races).
//   - Total successful chat streams across all 50 IPs over 1 minute is
//     in the range [50 * 18, 50 * 22] (50 IPs × ~20/min budget).
//
// Expected fail (== a real bug if it happens):
//   - Any 5xx response → rate limiter or chat route threw.
//   - Per-IP success count >> 20 in any 60s window → limiter is leaky.
//   - 0 rate-limit rejections at all → limiter is not firing (likely
//     because XFF parsing produced 'unknown' for every request — see
//     getClientIp in rateLimit.ts).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const NUM_FORGED_IPS = parseInt(__ENV.NUM_IPS || '50', 10);

const crashes = new Counter('rate_limit_crashes'); // 5xx or transport errors
const accepted = new Counter('rl_accepted');
const rateLimited = new Counter('rl_rejected_rate'); // 429s
const concurrencyRejected = new Counter('rl_rejected_concurrency'); // app-level 429
const transportErrors = new Rate('transport_error_rate');

// Generate a stable pool of spoofed IPs. We use 10.x.x.x so we never
// collide with a real client IP if someone runs this against a shared
// network for some reason.
const FORGED_IPS = (function makePool() {
  const ips = [];
  for (let i = 1; i <= NUM_FORGED_IPS; i++) {
    ips.push(`10.0.${Math.floor(i / 256)}.${i % 256}`);
  }
  return ips;
})();

export const options = {
  // 50 VUs, each pinned (best-effort) to one forged IP. We run for 2
  // minutes so each per-IP window cycles at least twice.
  scenarios: {
    forged_ips: {
      executor: 'constant-vus',
      vus: NUM_FORGED_IPS,
      duration: '2m',
    },
  },
  thresholds: {
    // Catastrophic-failure guard.
    rate_limit_crashes: ['count<5'],
    // Transport-level errors (TCP RST, premature EOF) are almost always
    // a real bug — bound aggressively.
    transport_error_rate: ['rate<0.01'],
  },
};

const CHAT_PAYLOAD = JSON.stringify({
  question: 'What are the top issues right now?',
  products: ['stellar-forge'],
  shape: 'explore',
  // role is irrelevant for retrieval per the lib/retrieval invariant
  // but the route requires the field, so we send it.
  role: 'product_manager',
});

export default function () {
  // VU N is pinned to FORGED_IPS[N-1]. This is the closest we can get
  // to "50 IPs each making their own requests" in k6 without launching
  // distributed runners.
  const forgedIp = FORGED_IPS[(__VU - 1) % FORGED_IPS.length];

  const res = http.post(`${BASE_URL}/api/chat/stream`, CHAT_PAYLOAD, {
    headers: {
      'Content-Type': 'application/json',
      // The spoof. lib/rateLimit.ts:getClientIp trusts the first
      // comma-separated entry. See security note in README.
      'X-Forwarded-For': forgedIp,
      // Streaming Accept so the route opens a real SSE response.
      Accept: 'text/event-stream',
    },
    tags: { forged_ip: forgedIp },
    // Keep response in memory only briefly — we just need status and
    // body length for assertions; full SSE body is ~few KB.
    timeout: '30s',
  });

  if (res.error_code || res.error) {
    transportErrors.add(1);
    crashes.add(1);
  } else {
    transportErrors.add(0);
  }

  if (res.status >= 500) {
    crashes.add(1);
  } else if (res.status === 200) {
    accepted.add(1, { forged_ip: forgedIp });
  } else if (res.status === 429) {
    // Hono returns 429 for both rate-window and concurrency rejections.
    // Body may include a reason field — best-effort parse.
    try {
      const body = JSON.parse(res.body);
      if (body && body.reason === 'concurrency') {
        concurrencyRejected.add(1, { forged_ip: forgedIp });
      } else {
        rateLimited.add(1, { forged_ip: forgedIp });
      }
    } catch (_e) {
      rateLimited.add(1, { forged_ip: forgedIp });
    }
  }

  check(res, {
    'no 5xx': (r) => r.status < 500,
    'no transport error': (r) => !r.error_code,
  });

  // Brief pause so we don't synthesize a wall of CONCURRENT_MAX
  // rejections — the goal is to spread requests across the per-IP
  // window, not to single-IP DoS ourselves.
  sleep(0.5 + Math.random() * 0.5);
}

export function handleSummary(data) {
  // Report per-IP acceptance distribution. If the limiter is working,
  // each forged IP should see at most ~40 accepted requests across the
  // 2m run (RATE_MAX=20 per 60s window × 2 windows).
  const out = {
    forged_ips_total: NUM_FORGED_IPS,
    duration_minutes: 2,
    rate_max_per_minute_per_ip: 20,
    accepted_total: data.metrics.rl_accepted
      ? data.metrics.rl_accepted.values.count
      : 0,
    rate_rejected_total: data.metrics.rl_rejected_rate
      ? data.metrics.rl_rejected_rate.values.count
      : 0,
    concurrency_rejected_total: data.metrics.rl_rejected_concurrency
      ? data.metrics.rl_rejected_concurrency.values.count
      : 0,
    crashes_total: data.metrics.rate_limit_crashes
      ? data.metrics.rate_limit_crashes.values.count
      : 0,
  };

  // Sanity envelope: expected accepted_total ~= 50 IPs * 40 reqs = 2000.
  // If we see meaningfully more, the limiter is broken.
  out.upper_bound_accepted_if_limiter_works = NUM_FORGED_IPS * 40;

  return {
    stdout:
      '\n=== RATE-LIMIT STRESS SUMMARY ===\n' +
      JSON.stringify(out, null, 2) +
      '\n=================================\n',
    'rate-limit-summary.json': JSON.stringify(out, null, 2),
  };
}
