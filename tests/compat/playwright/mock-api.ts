import type { Page, Route, Request } from '@playwright/test';

/**
 * Fixture corpus for the cross-browser smoke flow.
 *
 * Kept minimal — we only need enough data to satisfy the routes the smoke
 * journey hits. Real claim/source content lives in apps/api/src/data/*; the
 * point of this mock is to avoid spinning the actual Hono API + Claude CLI
 * subprocess in CI.
 */

const USER = {
  email: 'isathe@perforce.com',
  role: 'researcher' as const,
  products: ['helix-core', 'p4v'],
};

const PRODUCTS = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

const CLAIM = {
  id: 'CL-0001',
  text: 'Helix Core onboarding takes weeks longer than planned.',
  product: 'helix-core',
  area: 'onboarding',
  persona: 'release-manager',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'gong-call-2025-11-04-stellar-forge',
      source_type: 'gong',
      passage:
        'the onboarding for our two new studios took almost three weeks longer than we planned',
      source_url: 'https://example.com/g',
      source_date: '2025-11-04',
      customer: 'Stellar Forge Games',
    },
  ],
  evidence_count: 1,
  most_recent_evidence_at: '2025-11-04',
  trust_tier: 'T2',
};

const SOURCE = {
  id: 'gong-call-2025-11-04-stellar-forge',
  type: 'gong' as const,
  title: 'Stellar Forge — Helix Core onboarding review',
  date: '2025-11-04',
  customer: 'Stellar Forge Games',
  participants: ['Mara', 'Erik'],
  body: 'Mara: the onboarding for our two new studios took almost three weeks longer than we planned.',
  excerpts: [
    {
      passage:
        'the onboarding for our two new studios took almost three weeks longer than we planned',
      offset_hint: '0:18',
    },
  ],
};

/**
 * Build the SSE payload as a single string. We deliberately keep this
 * formatted exactly as Hono's streamSSE would emit so the web client's
 * delta/citation/done parsing path is exercised, not bypassed.
 *
 * The web reader splits on `\n\n` blocks (see useChatStream.ts), so each
 * event MUST be terminated with a double newline.
 */
function buildSseBody(): string {
  return [
    'event: status\ndata: {"phase":"searching","message":"Searching evidence…"}\n\n',
    'event: status\ndata: {"phase":"retrieved","message":"Retrieved 1 claim"}\n\n',
    'event: delta\ndata: {"text":"Onboarding pain is well-documented "}\n\n',
    'event: citation\ndata: {"id":"CL-0001"}\n\n',
    'event: delta\ndata: {"text":"in Helix Core [CL-0001]."}\n\n',
    'event: done\ndata: {"totalCitations":1}\n\n',
  ].join('');
}

/**
 * Stream the SSE response one event at a time with a short gap so we
 * can observe progressive rendering (matters for WebKit, which has
 * historically buffered streaming fetch responses on some Safari builds).
 *
 * We avoid `fulfill()` and instead use the Node-side `Route.fetch`-bypass
 * trick: write events with small delays via a chunked Response built from
 * a ReadableStream-like sequence of fulfill calls is not supported by
 * Playwright. Instead we emit the whole SSE body in one fulfill but rely
 * on the smoke spec to assert that the client surfaces multiple deltas —
 * which proves the parser segmentation works regardless of buffering.
 *
 * Engine-specific specs (webkit.compat.spec.ts) take a different angle:
 * they observe network timing via response/finished events to confirm the
 * stream wasn't buffered server-side.
 */
async function streamChatSse(route: Route): Promise<void> {
  const body = buildSseBody();
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': '*',
    },
    body,
  });
}

/**
 * Install all /api/* mocks on a page. Call from a beforeEach hook so each
 * test gets a clean slate.
 */
export async function installApiMocks(page: Page): Promise<void> {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'compat-mock' }),
    }),
  );

  await page.route('**/api/auth/login', (route, request: Request) => {
    if (request.method() !== 'POST') {
      return route.fulfill({ status: 405, body: 'method not allowed' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: USER, products: PRODUCTS }),
    });
  });

  await page.route('**/api/claims**', (route, request: Request) => {
    const url = new URL(request.url());
    // Batch fetch
    if (url.pathname === '/api/claims') {
      const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
      const claims = ids.includes(CLAIM.id) ? [CLAIM] : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ claims }),
      });
    }
    // Single fetch
    const id = url.pathname.replace('/api/claims/', '');
    if (id === CLAIM.id) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CLAIM),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not found' }),
    });
  });

  await page.route('**/api/sources/**', (route, request: Request) => {
    const url = new URL(request.url());
    const id = decodeURIComponent(url.pathname.replace('/api/sources/', ''));
    if (id === SOURCE.id) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SOURCE),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not found' }),
    });
  });

  await page.route('**/api/chat/stream', (route) => streamChatSse(route));
}

export const fixtures = {
  USER,
  PRODUCTS,
  CLAIM,
  SOURCE,
};
