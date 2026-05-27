/**
 * Minimal HTTP stand-in for the Hono API used during page-level a11y scans.
 *
 * Why we need it: Playwright drives a real browser at the Vite dev server,
 * which proxies /api/* through. Spinning the real API requires a Claude CLI
 * binary; for a11y scans we only need the page DOM, so we return canned
 * fixture responses. Routes covered:
 *   POST /api/auth/login        → 200 user payload
 *   GET  /api/claims?ids=…      → 200 { claims: [...] }
 *   GET  /api/claims/:id        → 200 single claim
 *   GET  /api/reports/monthly   → 200 fixture
 *   GET  /api/sources/:id       → 200 fixture (gong/slack/zoom/placeholder)
 *   POST /api/chat/stream       → SSE: one delta + one citation + done
 */
import http from 'node:http';

const PORT = Number(process.env.GRAIN_PW_API_PORT ?? 4011);

const USER = {
  email: 'a11y@perforce.test',
  role: 'researcher',
  products: ['helix-core', 'p4v'],
};

const PRODUCTS = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

const CLAIMS = [
  {
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
        passage: 'the onboarding for our two new studios took almost three weeks longer than we planned',
        source_url: 'https://example.com/g',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
    ],
    evidence_count: 1,
    most_recent_evidence_at: '2025-11-04',
    trust_tier: 'T2',
  },
];

const SOURCES = {
  'gong-call-2025-11-04-stellar-forge': {
    id: 'gong-call-2025-11-04-stellar-forge',
    type: 'gong',
    title: 'Stellar Forge — Helix Core onboarding review',
    date: '2025-11-04',
    customer: 'Stellar Forge Games',
    participants: ['Mara', 'Erik'],
    body: 'Mara: the onboarding for our two new studios took almost three weeks longer than we planned.',
    excerpts: [
      {
        passage: 'the onboarding for our two new studios took almost three weeks longer than we planned',
        offset_hint: '0:18',
      },
    ],
  },
  'slack-perforce-customers-week-44': {
    id: 'slack-perforce-customers-week-44',
    type: 'slack',
    title: '#perforce-customers week 44',
    date: '2025-10-31',
    body: 'mara: every artist needs their own view spec.',
    excerpts: [{ passage: 'every artist needs their own view spec', offset_hint: 'msg-1' }],
  },
  'zoom-research-2': {
    id: 'zoom-research-2',
    type: 'zoom',
    title: 'Research interview 2 (anonymized)',
    date: '2025-10-22',
    body: '',
    placeholder: true,
    excerpts: [{ passage: 'It took us three weeks longer.', offset_hint: 'r-1' }],
  },
};

const REPORT = {
  generatedAt: '2025-05-01T00:00:00.000Z',
  periodLabel: 'April 2025',
  totalClaims: 40,
  totalEvidence: 120,
  themes: [
    {
      id: 'theme-1',
      area: 'onboarding',
      title: 'Onboarding friction',
      summary: 'Weeks longer than planned.',
      frequency: 12,
      trend: 'up',
      byProduct: [{ product: 'helix-core', count: 8 }],
      topClaimIds: ['CL-0001'],
    },
  ],
  emerging: [],
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  json(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }
  if (url.pathname === '/api/health') return json(res, 200, { status: 'ok', service: 'mock' });
  if (url.pathname === '/api/auth/login') return json(res, 200, { user: USER, products: PRODUCTS });
  if (url.pathname === '/api/claims') {
    const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    return json(res, 200, { claims: CLAIMS.filter((c) => ids.includes(c.id)) });
  }
  if (url.pathname.startsWith('/api/claims/')) {
    const id = url.pathname.replace('/api/claims/', '');
    const c = CLAIMS.find((x) => x.id === id);
    return c ? json(res, 200, c) : notFound(res);
  }
  if (url.pathname === '/api/reports/monthly') return json(res, 200, REPORT);
  if (url.pathname.startsWith('/api/sources/')) {
    const id = decodeURIComponent(url.pathname.replace('/api/sources/', ''));
    const s = SOURCES[id];
    return s ? json(res, 200, s) : notFound(res);
  }
  if (url.pathname === '/api/chat/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'access-control-allow-origin': '*',
    });
    res.write('event: status\ndata: {"phase":"searching","message":"Searching…"}\n\n');
    res.write('event: delta\ndata: {"text":"Onboarding pain is real "}\n\n');
    res.write('event: citation\ndata: {"id":"CL-0001"}\n\n');
    res.write('event: delta\ndata: {"text":"[CL-0001]."}\n\n');
    res.write('event: done\ndata: {"totalCitations":1}\n\n');
    res.end();
    return;
  }
  notFound(res);
});

server.listen(PORT, () => {
  console.log(`[a11y mock api] listening on http://localhost:${PORT}`);
});
