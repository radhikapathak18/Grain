// Synthetic probe — GET /api/claims?ids=CL-0001,CL-0002.
//
// Proves the claims fixture has loaded, the route handler is wired,
// and CORS / JSON content-type are correct. Two-id batch is what
// the web app uses for citation hydration (see
// apps/web/src/hooks/useClaims.ts).
//
// If this check fails while /api/health passes, the route module
// is broken — almost certainly a fixture schema drift (the
// claims.ts file is 1,015 LOC of typed data; one stray malformed
// entry breaks the module-load step).
//
// We assert exactly 2 claims because the API filters unknown ids,
// so if either fixture id has been renamed we'll see length=1 or
// length=0 and alert. The synthetic-monitoring env var
// `GRAIN_SYNTHETIC_CLAIM_IDS` can override (comma-separated).

import { ApiCheck, AssertionBuilder } from 'checkly/constructs';

const API_URL = process.env.GRAIN_PROD_API_URL ?? 'http://localhost:3001';
const CLAIM_IDS = process.env.GRAIN_SYNTHETIC_CLAIM_IDS ?? 'CL-0001,CL-0002';
const EXPECTED_LENGTH = CLAIM_IDS.split(',').filter(Boolean).length;

export const apiClaimsCheck = new ApiCheck('api-claims', {
  name: 'API: /api/claims (batch)',
  activated: Boolean(process.env.GRAIN_PROD_API_URL),
  frequency: 5,
  locations: ['us-east-1', 'eu-west-1'],
  tags: ['grain', 'api', 'critical-path'],
  degradedResponseTime: 800,
  maxResponseTime: 2000,
  request: {
    method: 'GET',
    url: `${API_URL}/api/claims?ids=${encodeURIComponent(CLAIM_IDS)}`,
    followRedirects: true,
    skipSSL: false,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      // claims is an array; jsonpath asserts its length.
      AssertionBuilder.jsonBody('$.claims.length').equals(EXPECTED_LENGTH),
      // Spot-check that the first claim has the expected shape.
      AssertionBuilder.jsonBody('$.claims[0].id').isNotEmpty(),
      AssertionBuilder.jsonBody('$.claims[0].text').isNotEmpty(),
      AssertionBuilder.responseTime().lessThan(2000),
    ],
  },
});

// ── Reference fetch+assert implementation
//
// async function probeClaims(apiUrl: string, ids: string): Promise<void> {
//   const url = `${apiUrl}/api/claims?ids=${encodeURIComponent(ids)}`;
//   const res = await fetch(url);
//   if (res.status !== 200) throw new Error(`claims: ${res.status}`);
//   const body = await res.json() as { claims: { id: string; text: string }[] };
//   const expected = ids.split(',').filter(Boolean).length;
//   if (!Array.isArray(body.claims) || body.claims.length !== expected) {
//     throw new Error(`claims length ${body.claims?.length} !== ${expected}`);
//   }
// }
