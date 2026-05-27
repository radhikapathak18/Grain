/**
 * Mock API for the responsive test suite. Mirrors the shape of the a11y
 * mock at `tests/a11y/playwright/api-mock.mjs` but lives separately so the
 * two suites can run concurrently without colliding on a port. We do NOT
 * import the a11y file because folder ownership is strict.
 *
 * Routes covered (only what the React app actually calls):
 *   POST /api/auth/login        → 200 user payload
 *   GET  /api/claims?ids=…      → 200 { claims: [...] }
 *   GET  /api/claims/:id        → 200 single claim
 *   GET  /api/reports/monthly   → 200 fixture
 *   GET  /api/sources/:id       → 200 fixture (gong/slack/zoom)
 *   POST /api/chat/stream       → SSE: status + delta + citation + done
 *
 * Notes on long-content fixtures: we intentionally seed long claim text and
 * long source bodies so the responsive suite can exercise wrap / overflow /
 * scroll behaviors on narrow viewports. Without long content the tests
 * would falsely pass.
 */
import http from 'node:http';

const PORT = Number(process.env.GRAIN_PW_API_PORT ?? 4021);

const USER = {
  email: 'responsive@perforce.test',
  role: 'researcher',
  products: ['helix-core', 'p4v', 'helix-swarm'],
};

const PRODUCTS = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

// Long claim text to stress wrap / overflow on 375px.
const LONG_TEXT =
  'Helix Core onboarding takes substantially longer than customer release managers expect, with multi-studio installs consistently slipping by two to four weeks due to view-spec configuration, license routing, and proxy setup that nobody has documented end-to-end.';

const CLAIMS = [
  {
    id: 'CL-0001',
    text: LONG_TEXT,
    product: 'helix-core',
    area: 'onboarding',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'the onboarding for our two new studios took almost three weeks longer than we planned because we had to redo the view specs by hand',
        source_url: 'https://example.com/g',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
    ],
    evidence_count: 1,
    most_recent_evidence_at: '2025-11-04',
    trust_tier: 'T2',
  },
  {
    id: 'CL-0002',
    text: 'P4V merge UI buries conflict markers behind a modal that release managers cannot dismiss without losing context.',
    product: 'p4v',
    area: 'merge',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-perforce-customers-week-44',
        source_type: 'slack',
        passage: 'every artist needs their own view spec or it merges sideways',
        source_url: 'https://example.com/s',
        source_date: '2025-10-31',
        customer: 'Stellar Forge Games',
      },
    ],
    evidence_count: 1,
    most_recent_evidence_at: '2025-10-31',
    trust_tier: 'T3',
  },
];

// Long body to verify the SourceView body scrolls within its container on
// mobile rather than blowing out the page height.
const LONG_BODY = Array.from({ length: 60 }, (_, i) =>
  `[${String(i).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}] ` +
    'Speaker: ' +
    'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
).join('\n');

const SOURCES = {
  'gong-call-2025-11-04-stellar-forge': {
    id: 'gong-call-2025-11-04-stellar-forge',
    type: 'gong',
    title: 'Stellar Forge — Helix Core onboarding review',
    date: '2025-11-04',
    customer: 'Stellar Forge Games',
    participants: ['Mara', 'Erik'],
    body: LONG_BODY,
    excerpts: [
      {
        passage:
          'the onboarding for our two new studios took almost three weeks longer than we planned',
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
      summary: LONG_TEXT.slice(0, 140),
      frequency: 12,
      trend: 'up',
      byProduct: [
        { product: 'helix-core', count: 8 },
        { product: 'p4v', count: 4 },
      ],
      topClaimIds: ['CL-0001', 'CL-0002'],
    },
  ],
  emerging: [],
};

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
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
    res.write('event: delta\ndata: {"text":"[CL-0001]. Also: "}\n\n');
    res.write('event: citation\ndata: {"id":"CL-0002"}\n\n');
    res.write('event: delta\ndata: {"text":"[CL-0002]."}\n\n');
    res.write('event: done\ndata: {"totalCitations":2}\n\n');
    res.end();
    return;
  }
  notFound(res);
});

server.listen(PORT, () => {
  console.log(`[responsive mock api] listening on http://localhost:${PORT}`);
});
