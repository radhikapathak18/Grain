// GET /api/health — sanity baseline.
//
// SLO:
//   p50 < 2ms, p95 < 5ms, p99 < 10ms, error rate < 0.1%
//   on a single-process Node host with no other load. This endpoint
//   returns a static JSON body (no I/O, no fixture scan), so any time
//   above 10ms p99 indicates Node event-loop contention from another
//   workload or local proxy interference.
//
// Why this matters even though the endpoint is trivial:
//   - Calibrates the harness: if /api/health is slow the box is busy
//     and every other SLO in this suite is suspect.
//   - Smoke-checks the CORS middleware and Hono router setup on every
//     CI perf run before more expensive scripts execute.
//
// Run:
//   k6 run scripts/health.k6.js
//   BASE_URL=http://localhost:3001 k6 run scripts/health.k6.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, defaultStages, spoofedIpHeaders, expect200 } from '../lib/common.js';

export const options = {
  stages: defaultStages(50),
  thresholds: {
    http_req_duration: ['p(50)<2', 'p(95)<5', 'p(99)<10'],
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
  },
  // Tag every metric with this scenario name so multi-script CI runs
  // can be filtered in the resulting JSON summary.
  tags: { script: 'health' },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { headers: spoofedIpHeaders() });
  check(res, {
    'status 200': (r) => expect200(r, 'health'),
    'body has status:ok': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch {
        return false;
      }
    },
  });
}
