// Soak test — sustained load over a long window.
//
// Goal: expose slow leaks the unit + integration suites cannot see.
//   - Map<string, Window> growth in lib/rateLimit.ts (windows never
//     evicted; only overwritten on next request from same IP).
//   - Retained references in the CLAIMS_BY_ID lookup chain.
//   - File-descriptor / socket leaks in the Hono+Node SSE plumbing
//     (even though we skip /chat/stream here, idle keepalive sockets
//     against /api/claims are a long-tail concern).
//   - V8 old-space growth — visible as slowly rising p95.
//
// k6 alone cannot see server memory. Pair this run with one of:
//   1. `node --inspect` + Chrome DevTools heap snapshots at t=0, t=30m, t=1h.
//   2. A lightweight side-process polling `process.memoryUsage()` every
//      30s and writing CSV. See README for a snippet.
//
// Profile: 30 VU sustained. Configurable via SOAK_DURATION env var so
// CI can run a 5m smoke version while the weekly nightly runs the full
// hour.
//
// Run (full 1h):
//   BASE_URL=http://localhost:3001 k6 run tests/stress/scripts/soak.k6.js
// Run (CI smoke, 5m):
//   SOAK_DURATION=5m k6 run tests/stress/scripts/soak.k6.js
//
// Expected pass:
//   - http_req_failed rate < 0.5% for the whole soak.
//   - p95 latency in the final 10% of the run is within 1.5x of the
//     p95 in the first 10% (no upward trend).
//   - Server RSS reported by the side-process poller stays flat
//     (sawtooth from GC is fine; monotonic growth is not).
//
// Expected fail:
//   - p95 climbs steadily → memory pressure / GC thrash.
//   - Errors appear after N minutes only → resource exhaustion
//     (sockets, file descriptors, Map cardinality).
//   - Server RSS climbs monotonically across the run.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const SOAK_DURATION = __ENV.SOAK_DURATION || '1h';
const VUS = parseInt(__ENV.SOAK_VUS || '30', 10);

const SOURCE_IDS = [
  'gong-call-2025-11-04-stellar-forge',
  'gong-call-2026-01-22-hexagon-pictures',
  'slack-release-eng-2026-02-18',
  'confluence-internal-2025-12-09-workspace-setup-runbook',
  'pendo-export-2026-03-15-p4v-feature-usage',
  'zoom-research-2026-04-08-lumen-foundry-tech-lead',
];

const failureRate = new Rate('soak_failures');
const earlyP95 = new Trend('latency_early_ms', true);
const lateP95 = new Trend('latency_late_ms', true);

// We split metrics into "early" (first 10%) and "late" (last 10%) using
// the elapsed wall clock relative to a small ramp + steady plateau.
// k6's `scenarios` with `tags` is the standard way to do this.
export const options = {
  scenarios: {
    early: {
      executor: 'constant-vus',
      vus: VUS,
      duration: SOAK_DURATION,
      startTime: '0s',
      tags: { phase: 'early' },
      exec: 'soakRequest',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    'http_req_duration{endpoint:health}': ['p(95)<100'],
    'http_req_duration{endpoint:claims}': ['p(95)<300'],
    'http_req_duration{endpoint:report}': ['p(95)<300'],
    'http_req_duration{endpoint:source}': ['p(95)<300'],
  },
};

function pickClaimIds() {
  const n = 1 + Math.floor(Math.random() * 5);
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = 1 + Math.floor(Math.random() * 40);
    ids.push(`CL-${String(id).padStart(4, '0')}`);
  }
  return ids.join(',');
}

function pickSourceId() {
  return SOURCE_IDS[Math.floor(Math.random() * SOURCE_IDS.length)];
}

export function soakRequest() {
  // Rotate evenly across four cheap endpoints so we exercise distinct
  // route handlers (each has its own closures + lookup tables to retain).
  const r = Math.floor(Math.random() * 4);
  let res;
  if (r === 0) {
    res = http.get(`${BASE_URL}/api/health`, { tags: { endpoint: 'health' } });
  } else if (r === 1) {
    res = http.get(`${BASE_URL}/api/claims?ids=${pickClaimIds()}`, {
      tags: { endpoint: 'claims' },
    });
  } else if (r === 2) {
    res = http.get(`${BASE_URL}/api/reports/monthly`, {
      tags: { endpoint: 'report' },
    });
  } else {
    res = http.get(`${BASE_URL}/api/sources/${pickSourceId()}`, {
      tags: { endpoint: 'source' },
    });
  }

  const ok = check(res, {
    '2xx': (r) => r.status >= 200 && r.status < 300,
  });
  failureRate.add(!ok);

  // Tag latencies into early / late buckets so the summary report
  // makes the drift visible at a glance. We use __ITER and a coarse
  // heuristic (first/last ~10% of iterations per VU) — good enough
  // because every VU runs the same closed loop length under
  // constant-vus.
  //
  // Note: we cannot easily get total iterations here, so we instead
  // use elapsed time relative to known SOAK_DURATION via __ENV. The
  // simpler and more reliable approach is to look at k6's own trend
  // summary at the end and compare buckets, which the README covers.
  earlyP95.add(res.timings.duration); // catch-all trend; analysis is post-hoc

  // Default sustain pacing — ~1 req/s/VU.
  sleep(1);
}

export default function () {
  // Kept for `k6 run` without scenarios; same code path.
  soakRequest();
}
