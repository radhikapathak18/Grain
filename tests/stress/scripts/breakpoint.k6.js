// Breakpoint test — find the VU level at which the API breaks.
//
// Strategy: linear ramp from 10 → 1000 VU over 10 minutes against the
// cheapest cached endpoint (/api/claims?ids=CL-0001). k6 aborts the
// test as soon as either threshold fires:
//   - http_req_failed rate > 5%, OR
//   - p95 latency > 2000ms.
//
// The VU count at the moment of the abort is the breakpoint estimate.
// k6 prints `level of concurrency at time of failure` in its summary;
// you can also tail `current_vus` from the `--out json=...` file.
//
// Why /api/claims?ids=CL-0001 specifically:
//   - Single-id batch hits exactly one CLAIMS_BY_ID lookup → cheapest
//     route handler in the app.
//   - Response body is small (one Claim record), so we measure server
//     work, not Node's serialization cost.
//   - Any failure here cannot be blamed on retrieval, prompts, or
//     SSE plumbing — it is pure Hono + Node throughput.
//
// Run:
//   BASE_URL=http://localhost:3001 k6 run tests/stress/scripts/breakpoint.k6.js
//
// Expected pass:
//   - The full ramp completes without thresholds firing. This means the
//     single-node demo handles ≥1000 concurrent VUs against a fixture
//     endpoint, which is surprising — investigate whether k6 is
//     actually saturating the network path (run with --http-debug if so).
//
// Expected fail (== expected outcome on a laptop):
//   - Thresholds fire at some VU level N between 200 and 800. Record N.
//     N is the operational ceiling for the single-node demo against the
//     cheapest endpoint; the real-world ceiling for the chat-stream
//     endpoint is *much* lower (CONCURRENT_MAX=1 per IP).
//
// Caveat: macOS default `ulimit -n` is often 256 or 1024. The test will
// be limited by file descriptors long before CPU on most laptops. Bump
// to 65535 before running: `ulimit -n 65535`.

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

const breakpointFailures = new Rate('breakpoint_failures');
const breakpointLatency = new Trend('breakpoint_latency_ms', true);

export const options = {
  // Linear-ish ramp: 10 → 1000 VU over 10 minutes.
  stages: [
    { duration: '10m', target: 1000 },
  ],
  thresholds: {
    // ABORT-ON-FAIL semantics: as soon as one of these fires k6 will
    // mark the test failed; the abortOnFail / delayAbortEval pair makes
    // k6 stop the run so we get a clean "breakpoint at X VU" signal in
    // the summary.
    http_req_failed: [
      { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '10s' },
    ],
    http_req_duration: [
      { threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '10s' },
    ],
  },
  // Discard the response body to keep the k6 client cheap so we measure
  // the server, not the test rig.
  discardResponseBodies: true,
};

export default function () {
  const res = http.get(`${BASE_URL}/api/claims?ids=CL-0001`, {
    tags: { endpoint: 'claims' },
  });
  breakpointLatency.add(res.timings.duration);
  const ok = check(res, {
    'status 200': (r) => r.status === 200,
  });
  breakpointFailures.add(!ok);
  // No sleep — we want each VU to push as fast as the server allows.
  // The ramp shape is controlled by `stages`.
}

export function handleSummary(data) {
  // Surface the VU count at end-of-run prominently. When k6 aborts on
  // threshold breach, `max_vus` reflects the ramp position at that
  // moment. Combined with the `vus` time series in the JSON output,
  // this pinpoints the breakpoint.
  const maxVus = data.metrics.vus_max ? data.metrics.vus_max.values.max : null;
  const lastVus = data.metrics.vus ? data.metrics.vus.values.value : null;
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values['p(95)']
    : null;
  const failRate = data.metrics.http_req_failed
    ? data.metrics.http_req_failed.values.rate
    : null;

  const summary = {
    breakpoint_estimate: {
      vus_at_end: lastVus,
      vus_max_observed: maxVus,
      p95_ms_at_end: p95,
      failure_rate_at_end: failRate,
    },
  };

  return {
    stdout:
      '\n=== BREAKPOINT SUMMARY ===\n' +
      JSON.stringify(summary, null, 2) +
      '\n=========================\n',
    'breakpoint-summary.json': JSON.stringify(summary, null, 2),
  };
}
