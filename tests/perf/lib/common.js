// Shared helpers for the Grain k6 perf scripts.
//
// Why this exists:
//   - All scripts share the same BASE_URL convention and stage shape
//     (warmup → ramp → sustain → cooldown). Centralising avoids drift.
//   - rateLimit.ts caps each client IP at 20 req/min and 1 in-flight
//     stream. Without spoofed X-Forwarded-For headers, every k6 VU
//     would be billed against the same loopback IP and we'd measure
//     429s, not endpoint latency. spoofedIpHeaders() returns a stable
//     synthetic IP per VU so the rate-limiter sees 1 IP per VU.
//   - We do NOT use these spoofed headers to break the rate limit on
//     purpose — we use them so a 50-VU load test does not collapse
//     into HTTP 429 noise on iteration #21 from a single shared key.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Default stage shape, parameterised by sustain VU count. All non-chat
// scripts use this. chat-stream.k6.js builds its own (5 VUs cap).
//
//   30s warmup @ 5 VUs
//   1m  ramp   → targetVUs
//   3m  sustain @ targetVUs
//   30s cooldown → 0 VUs
export function defaultStages(targetVUs) {
  return [
    { duration: '30s', target: 5 },
    { duration: '1m', target: targetVUs },
    { duration: '3m', target: targetVUs },
    { duration: '30s', target: 0 },
  ];
}

// Build a synthetic, stable per-VU client IP. The Hono rate-limiter
// trusts the first X-Forwarded-For entry (see apps/api/src/lib/
// rateLimit.ts:getClientIp). Using 198.51.x.x (TEST-NET-2, RFC 5737)
// guarantees we never collide with a real client. With a /16 we can
// represent ~65K distinct VUs, far above any load this suite drives.
export function spoofedIpHeaders() {
  // __VU is 1-indexed and unique per virtual user within a single run.
  const vu = Number(__VU) || 0;
  const third = Math.floor(vu / 254) % 254;
  const fourth = (vu % 254) + 1; // avoid .0
  return {
    'X-Forwarded-For': `198.51.${third}.${fourth}`,
    // Helps the API audit log distinguish perf traffic from real users.
    'User-Agent': `grain-k6/${__ENV.K6_PROFILE || 'default'}`,
  };
}

// HTTP status check helper — fails the iteration if not 200.
export function expect200(res, label) {
  const ok = res.status === 200;
  if (!ok) {
    console.error(`[${label}] expected 200, got ${res.status}: ${res.body && res.body.slice(0, 200)}`);
  }
  return ok;
}
