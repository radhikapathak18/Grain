// Spike test — 10x burst against cached / fixture endpoints.
//
// Hypothesis: the API serves /api/claims, /api/reports/monthly and
// /api/sources/:id entirely from in-memory fixtures (see MODULE_MAP.md).
// A sudden 10x jump in concurrent VUs should not raise the error rate
// above ~1% and should not push p95 latency above ~250ms. If it does,
// the bottleneck is in Hono request handling, Node's event loop, or the
// JSON.stringify cost of the (large) claims fixture — none of which is
// addressed by caching.
//
// We deliberately exclude /api/chat/stream from this profile. The
// rateLimit module hard-codes CONCURRENT_MAX=1 per IP, so any spike
// against /chat/stream becomes a rate-limit-rejection test rather than
// a load-shape test (see rate-limit-stress.k6.js for that).
//
// Run:
//   BASE_URL=http://localhost:3001 k6 run tests/stress/scripts/spike.k6.js
//
// Expected pass:
//   - http_req_failed rate < 1% over the whole run
//   - p95 latency < 250ms on the spike segment
//   - the recovery segment returns to baseline p95 within 30s
//
// Expected fail (== bug surface):
//   - elevated 5xx during the spike → event-loop starvation or
//     unhandled-rejection cascade in Hono
//   - p95 stays elevated in the recovery segment → resource leak
//     (open sockets, retained references in CLAIMS lookup)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Endpoint pool. CL-0001..CL-0040 exist in the fixture (40 claims total).
// Source IDs are taken from apps/api/src/data/sources/index.ts.
const SOURCE_IDS = [
  'gong-call-2025-11-04-stellar-forge',
  'gong-call-2026-01-22-hexagon-pictures',
  'slack-release-eng-2026-02-18',
  'confluence-internal-2025-12-09-workspace-setup-runbook',
  'pendo-export-2026-03-15-p4v-feature-usage',
  'zoom-research-2026-04-08-lumen-foundry-tech-lead',
];

const failureRate = new Rate('spike_failures');
const claimsLatency = new Trend('claims_latency_ms', true);
const reportLatency = new Trend('report_latency_ms', true);
const sourceLatency = new Trend('source_latency_ms', true);

export const options = {
  // 30s baseline → instant jump to 100 VU for 1min → 1min recovery at 10 VU.
  stages: [
    { duration: '30s', target: 10 },
    { duration: '5s', target: 100 }, // near-instant 10x spike
    { duration: '1m', target: 100 },
    { duration: '5s', target: 10 }, // near-instant return
    { duration: '1m', target: 10 },
  ],
  thresholds: {
    // Pass criteria — see header comment.
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:claims}': ['p(95)<250'],
    'http_req_duration{endpoint:report}': ['p(95)<250'],
    'http_req_duration{endpoint:source}': ['p(95)<250'],
  },
};

function pickClaimIds() {
  // Random batch of 1..5 claim ids for /api/claims?ids=...
  const n = 1 + Math.floor(Math.random() * 5);
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = 1 + Math.floor(Math.random() * 40); // CL-0001..CL-0040
    ids.push(`CL-${String(id).padStart(4, '0')}`);
  }
  return ids.join(',');
}

function pickSourceId() {
  return SOURCE_IDS[Math.floor(Math.random() * SOURCE_IDS.length)];
}

export default function () {
  // Weighted endpoint rotation: claims is the hottest, source second,
  // monthly report least frequent (matches the rough demo traffic shape).
  const r = Math.random();
  if (r < 0.6) {
    const res = http.get(`${BASE_URL}/api/claims?ids=${pickClaimIds()}`, {
      tags: { endpoint: 'claims' },
    });
    claimsLatency.add(res.timings.duration);
    const ok = check(res, {
      'claims 200': (r) => r.status === 200,
      'claims has body': (r) => r.body && r.body.length > 0,
    });
    failureRate.add(!ok);
  } else if (r < 0.85) {
    const res = http.get(`${BASE_URL}/api/sources/${pickSourceId()}`, {
      tags: { endpoint: 'source' },
    });
    sourceLatency.add(res.timings.duration);
    const ok = check(res, {
      'source 200': (r) => r.status === 200,
    });
    failureRate.add(!ok);
  } else {
    const res = http.get(`${BASE_URL}/api/reports/monthly`, {
      tags: { endpoint: 'report' },
    });
    reportLatency.add(res.timings.duration);
    const ok = check(res, {
      'report 200': (r) => r.status === 200,
    });
    failureRate.add(!ok);
  }

  // Loose pacing so we don't synthesize a closed-model hammer; spike
  // shape is controlled by the VU stages above, not by tight loops.
  sleep(0.1 + Math.random() * 0.4);
}
