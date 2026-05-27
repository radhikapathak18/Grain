// GET /api/sources/:id — full source document or synthesized placeholder.
//
// Two distinct code paths, both exercised here:
//
//   1. "known" — id is in SOURCE_BY_ID (apps/api/src/data/sources/index.ts).
//      Direct map lookup, returns the full transcript/passage payload.
//      SLO: p50 < 8ms, p95 < 20ms, p99 < 40ms.
//
//   2. "placeholder" — id is referenced by CLAIMS evidence but has no
//      source document file. synthesizePlaceholder() scans every
//      CLAIM and every evidence item looking for matches, then dedupes
//      passages. O(claims * evidence) = ~40*3 = 120 comparisons.
//      Expected to be a hair slower than the direct lookup, but still
//      well under our p95 budget.
//      SLO: p50 < 10ms, p95 < 25ms, p99 < 50ms.
//
// "gong-call-2024-09-12-citadel-defense" is the canonical placeholder
// test id: it is cited by at least one CLAIM in apps/api/src/data/
// claims.ts but has NO matching file under apps/api/src/data/sources/.
// If this fixture changes (a real source doc is added for that id)
// the test will start measuring the wrong path — bump to another
// referenced-but-undocumented id at that point.
//
// Run:
//   k6 run scripts/sources.k6.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, defaultStages, spoofedIpHeaders, expect200 } from '../lib/common.js';

// Full source-document IDs (have files under apps/api/src/data/sources/).
const KNOWN_SOURCE_IDS = [
  'gong-call-2025-11-04-stellar-forge',
  'gong-call-2026-01-22-hexagon-pictures',
  'slack-release-eng-2026-02-18',
  'confluence-internal-2025-12-09-workspace-setup-runbook',
  'pendo-export-2026-03-15-p4v-feature-usage',
  'zoom-research-2026-04-08-lumen-foundry-tech-lead',
];

// Referenced by claims but without a source file (drives synthesis path).
const PLACEHOLDER_ID = 'gong-call-2024-09-12-citadel-defense';

export const options = {
  stages: defaultStages(50),
  thresholds: {
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
    'http_req_duration{path:known}': ['p(50)<8', 'p(95)<20', 'p(99)<40'],
    'http_req_duration{path:placeholder}': ['p(50)<10', 'p(95)<25', 'p(99)<50'],
  },
  tags: { script: 'sources' },
};

export default function () {
  const headers = spoofedIpHeaders();

  // Rotate through the known-source corpus deterministically so each VU
  // touches every doc over a sustain window.
  const known = KNOWN_SOURCE_IDS[__ITER % KNOWN_SOURCE_IDS.length];
  const knownRes = http.get(`${BASE_URL}/api/sources/${known}`, {
    headers,
    tags: { path: 'known' },
  });
  check(knownRes, {
    'known status 200': (r) => expect200(r, 'sources.known'),
    'known returns matching id': (r) => {
      try {
        return JSON.parse(r.body).id === known;
      } catch {
        return false;
      }
    },
    'known is not placeholder': (r) => {
      try {
        return JSON.parse(r.body).placeholder !== true;
      } catch {
        return false;
      }
    },
  });

  // Placeholder synthesis path — exercises the CLAIMS scan + dedupe.
  const phRes = http.get(`${BASE_URL}/api/sources/${PLACEHOLDER_ID}`, {
    headers,
    tags: { path: 'placeholder' },
  });
  check(phRes, {
    'placeholder status 200': (r) => expect200(r, 'sources.placeholder'),
    'placeholder is flagged placeholder:true': (r) => {
      try {
        return JSON.parse(r.body).placeholder === true;
      } catch {
        return false;
      }
    },
    'placeholder excerpts non-empty': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.excerpts) && body.excerpts.length > 0;
      } catch {
        return false;
      }
    },
  });
}
