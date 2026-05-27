// Synthetic probe — GET /api/health.
//
// Proves the Hono process is alive and the load balancer / TLS
// terminator are happy. This is the cheapest, fastest signal —
// runs every 5 minutes from 2 regions.
//
// The Hono /api/health route returns `{ status: 'ok', service:
// 'grain-api' }` synchronously with no downstream calls — so any
// non-200 here means the process is dead, OOMed, deadlocked, or
// the network in front of it is broken. SLO: 99.5% uptime, <500ms
// p95.
//
// Portability: in Datadog Synthetics this becomes an HTTP test
// with the same URL + assertions. In a homegrown runner, see the
// fetch + assert pattern at the bottom for reference.

import { ApiCheck, AssertionBuilder } from 'checkly/constructs';

const API_URL = process.env.GRAIN_PROD_API_URL ?? 'http://localhost:3001';

export const apiHealthCheck = new ApiCheck('api-health', {
  name: 'API: /api/health',
  activated: Boolean(process.env.GRAIN_PROD_API_URL),
  // Run every 5 minutes from 2 locations.
  frequency: 5,
  locations: ['us-east-1', 'eu-west-1'],
  tags: ['grain', 'api', 'critical-path'],
  // 500ms p95 is the SLO; we alert at 1000ms so transient spikes
  // don't flap the page.
  degradedResponseTime: 500,
  maxResponseTime: 1000,
  request: {
    method: 'GET',
    url: `${API_URL}/api/health`,
    followRedirects: true,
    skipSSL: false,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.status').equals('ok'),
      AssertionBuilder.jsonBody('$.service').equals('grain-api'),
      AssertionBuilder.responseTime().lessThan(1000),
    ],
  },
});

// ── Reference fetch+assert implementation for non-Checkly runners
//
// async function probeHealth(apiUrl: string): Promise<void> {
//   const start = Date.now();
//   const res = await fetch(`${apiUrl}/api/health`);
//   const elapsed = Date.now() - start;
//   if (res.status !== 200) throw new Error(`health: ${res.status}`);
//   const body = await res.json();
//   if (body.status !== 'ok' || body.service !== 'grain-api') {
//     throw new Error(`health body: ${JSON.stringify(body)}`);
//   }
//   if (elapsed > 1000) throw new Error(`health slow: ${elapsed}ms`);
// }
