// GET /api/claims — both shapes:
//   1. Batch lookup:   GET /api/claims?ids=CL-0001,CL-0002,CL-0003
//      SLO: p50 < 8ms, p95 < 20ms, p99 < 40ms
//   2. Single lookup:  GET /api/claims/:id
//      SLO: p50 < 4ms, p95 < 10ms, p99 < 20ms
//
// The route does an O(n) Array.find / filter over the 40-claim
// in-memory fixture (apps/api/src/data/claims.ts). At 40 records the
// scan is effectively free; the SLO is therefore dominated by HTTP +
// JSON serialization (the batch response can be 5-15 KB depending on
// claim evidence length).
//
// We tag each request by `mode` (batch vs single) so the JSON summary
// shows separate latency distributions and the thresholds below apply
// per-mode using sub-metric tag selectors.
//
// Run:
//   k6 run scripts/claims.k6.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, defaultStages, spoofedIpHeaders, expect200 } from '../lib/common.js';

// Sample of real claim IDs from apps/api/src/data/claims.ts. Mixing
// across the corpus exercises different evidence sizes (CL-0001 has 3
// evidence items with long passages; later IDs vary).
const CLAIM_IDS = [
  'CL-0001', 'CL-0002', 'CL-0003', 'CL-0004', 'CL-0005',
  'CL-0010', 'CL-0015', 'CL-0020', 'CL-0030', 'CL-0040',
];

export const options = {
  stages: defaultStages(50),
  thresholds: {
    // Aggregate gates (always evaluated)
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
    // Per-mode SLOs (tag-scoped sub-metrics). k6 evaluates these only
    // for requests carrying the matching tag.
    'http_req_duration{mode:batch}': ['p(50)<8', 'p(95)<20', 'p(99)<40'],
    'http_req_duration{mode:single}': ['p(50)<4', 'p(95)<10', 'p(99)<20'],
  },
  tags: { script: 'claims' },
};

function pickThree() {
  // Deterministic per-iteration rotation so every VU exercises every
  // ID over time. Random selection would still cover the corpus, but
  // makes flake-debugging harder.
  const i = (__ITER * 3) % CLAIM_IDS.length;
  return [
    CLAIM_IDS[i % CLAIM_IDS.length],
    CLAIM_IDS[(i + 1) % CLAIM_IDS.length],
    CLAIM_IDS[(i + 2) % CLAIM_IDS.length],
  ];
}

export default function () {
  const headers = spoofedIpHeaders();
  const trio = pickThree();

  // ── Batch lookup
  const batchRes = http.get(
    `${BASE_URL}/api/claims?ids=${trio.join(',')}`,
    { headers, tags: { mode: 'batch' } },
  );
  check(batchRes, {
    'batch status 200': (r) => expect200(r, 'claims.batch'),
    'batch returns claims array of expected length': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.claims) && body.claims.length === trio.length;
      } catch {
        return false;
      }
    },
  });

  // ── Single lookup
  const single = trio[__ITER % trio.length];
  const singleRes = http.get(
    `${BASE_URL}/api/claims/${single}`,
    { headers, tags: { mode: 'single' } },
  );
  check(singleRes, {
    'single status 200': (r) => expect200(r, 'claims.single'),
    'single returns correct id': (r) => {
      try {
        return JSON.parse(r.body).id === single;
      } catch {
        return false;
      }
    },
  });
}
