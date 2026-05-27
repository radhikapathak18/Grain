// GET /api/reports/monthly — cached fixture (apps/api/src/data/reports.ts).
//
// SLO: p50 < 10ms, p95 < 30ms, p99 < 60ms, errors < 0.1%.
//
// The handler returns a pre-computed MONTHLY_REPORT object built once
// at module load. There is no I/O, but the response body is the
// largest of any GET in this app (themes, emerging issues, sample
// citations), so serialization dominates. We allow more headroom than
// /claims/:id because of that payload size.
//
// Run:
//   k6 run scripts/reports.k6.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, defaultStages, spoofedIpHeaders, expect200 } from '../lib/common.js';

export const options = {
  stages: defaultStages(50),
  thresholds: {
    http_req_duration: ['p(50)<10', 'p(95)<30', 'p(99)<60'],
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
  },
  tags: { script: 'reports' },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/reports/monthly`, {
    headers: spoofedIpHeaders(),
  });
  check(res, {
    'status 200': (r) => expect200(r, 'reports.monthly'),
    'body looks like MonthlyReport': (r) => {
      try {
        const body = JSON.parse(r.body);
        // Loose structural check — keeps the perf script independent
        // of trivial schema field renames. If the report shape changes
        // meaningfully, the integration tests (Wave 1) will catch it.
        return (
          body && typeof body === 'object' &&
          Array.isArray(body.themes) &&
          body.themes.length > 0
        );
      } catch {
        return false;
      }
    },
  });
}
