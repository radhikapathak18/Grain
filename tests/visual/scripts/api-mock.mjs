/**
 * Deterministic HTTP stand-in for the Hono API used during visual-regression
 * runs. Returns the *same* bytes on every invocation so baseline screenshots
 * stay stable.
 *
 * Key choices versus the a11y mock:
 *   - All ISO dates are pinned (no Date.now in payloads).
 *   - The /api/chat/stream SSE emits a fixed delta sequence and then `done`,
 *     so the streamed assistant bubble lands in a known final state.
 *   - Source variants for every SourceType (gong / slack / pendo / zoom /
 *     confluence) plus a placeholder fixture, so /source/:id baselines cover
 *     each layout branch.
 *   - All emoji-free, plain ASCII strings — fonts render identically across
 *     test runs.
 */
import http from 'node:http';

// Default to 3001 to align with apps/web/vite.config.ts proxy target. The
// dev server forwards /api/* to localhost:3001, so the mock just has to be
// listening there instead of the real Hono API.
const PORT = Number(process.env.GRAIN_PW_API_PORT ?? 3001);

const USER = {
  email: 'visual@perforce.test',
  role: 'researcher',
  products: ['helix-core', 'p4v'],
};

const PRODUCTS = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

/**
 * Pinned recency reference. Visual tests freeze Date in the browser context
 * (see tests/visual/playwright/_helpers.ts) so TrustBadgeRow renders a
 * deterministic "Xd ago". This date must match the freeze instant minus the
 * intended bucket. The fixture dates below are chosen so the rendered
 * recency label is "5d ago" / "3w ago" / "8mo ago" against FROZEN_NOW.
 */
const CLAIMS_T1 = {
  id: 'CL-0001',
  text: 'Helix Core onboarding for new studios takes three weeks longer than planned.',
  product: 'helix-core',
  area: 'onboarding',
  persona: 'release-manager',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
      source_type: 'zoom',
      passage: 'It took us three weeks longer.',
      source_url: 'https://example.com/z',
      source_date: '2026-05-22',
      customer: 'Lumen Foundry',
    },
  ],
  evidence_count: 1,
  most_recent_evidence_at: '2026-05-22',
  trust_tier: 'T1',
};

const CLAIMS_T2 = {
  id: 'CL-0002',
  text: 'P4V users want a clearer way to switch view specs without restarting.',
  product: 'p4v',
  area: 'workflows',
  persona: 'artist',
  sentiment: 'neutral',
  evidence: [
    {
      source_id: 'gong-call-2025-11-04-stellar-forge',
      source_type: 'gong',
      passage: 'every artist needs their own view spec',
      source_url: 'https://example.com/g',
      source_date: '2026-05-06',
      customer: 'Stellar Forge Games',
    },
  ],
  evidence_count: 1,
  most_recent_evidence_at: '2026-05-06',
  trust_tier: 'T2',
};

const CLAIMS_T3 = {
  id: 'CL-0003',
  text: 'Internal docs about workspace setup are out of date.',
  product: 'helix-core',
  area: 'docs',
  persona: 'release-manager',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
      source_type: 'confluence',
      passage: 'Runbook last touched in December.',
      source_url: 'https://example.com/c',
      source_date: '2025-09-15',
      customer: null,
    },
  ],
  evidence_count: 1,
  most_recent_evidence_at: '2025-09-15',
  trust_tier: 'T3',
};

const CLAIMS = [CLAIMS_T1, CLAIMS_T2, CLAIMS_T3];

const SOURCES = {
  'gong-call-2025-11-04-stellar-forge': {
    id: 'gong-call-2025-11-04-stellar-forge',
    type: 'gong',
    title: 'Stellar Forge - Helix Core onboarding review',
    date: '2026-05-06',
    customer: 'Stellar Forge Games',
    participants: ['Mara', 'Erik'],
    body: 'Mara: the onboarding for our two new studios took almost three weeks longer than we planned. Every artist needs their own view spec.',
    excerpts: [
      {
        passage: 'every artist needs their own view spec',
        offset_hint: '0:18',
      },
    ],
  },
  'slack-release-eng-2026-02-18': {
    id: 'slack-release-eng-2026-02-18',
    type: 'slack',
    title: '#release-eng week 8',
    date: '2026-02-18',
    body: 'mara: every artist needs their own view spec.\nerik: confirmed, see thread.',
    excerpts: [
      { passage: 'every artist needs their own view spec', offset_hint: 'msg-1' },
    ],
  },
  'confluence-internal-2025-12-09-workspace-setup-runbook': {
    id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
    type: 'confluence',
    title: 'Workspace setup runbook',
    date: '2025-12-09',
    body: 'This runbook covers workspace setup for new artists at Perforce. It was last updated in December 2025 and may be out of date.',
    excerpts: [{ passage: 'Runbook last touched in December.', offset_hint: 'sec-1' }],
  },
  'pendo-export-2026-03-15-p4v-feature-usage': {
    id: 'pendo-export-2026-03-15-p4v-feature-usage',
    type: 'pendo',
    title: 'P4V feature usage - March 2026',
    date: '2026-03-15',
    body: 'feature: view-spec-switch — 12% adoption among active artists.',
    excerpts: [{ passage: '12% adoption among active artists', offset_hint: 'row-2' }],
  },
  'zoom-research-2026-04-08-lumen-foundry-tech-lead': {
    id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
    type: 'zoom',
    title: 'Lumen Foundry - tech lead interview (anonymized)',
    date: '2026-04-08',
    body: '',
    placeholder: true,
    excerpts: [{ passage: 'It took us three weeks longer.', offset_hint: 'r-1' }],
  },
};

const REPORT = {
  generatedAt: '2026-05-01T00:00:00.000Z',
  periodLabel: 'April 2026',
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
      byProduct: [
        { product: 'helix-core', count: 8 },
        { product: 'p4v', count: 4 },
      ],
      topClaimIds: ['CL-0001', 'CL-0002'],
    },
    {
      id: 'theme-2',
      area: 'workflows',
      title: 'View spec churn',
      summary: 'Artists want clearer per-user view specs.',
      frequency: 7,
      trend: 'flat',
      byProduct: [{ product: 'p4v', count: 7 }],
      topClaimIds: ['CL-0002'],
    },
  ],
  emerging: [
    {
      id: 'emerging-1',
      title: 'Documentation drift',
      summary: 'Internal runbooks are not being kept up to date with releases.',
      claimIds: ['CL-0003'],
    },
  ],
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

/**
 * Deterministic SSE for visual diffs: status -> 4 fixed deltas -> citation
 * marker -> trailing delta -> done. The final assistant bubble text is
 * always exactly:
 *   "Onboarding pain is real for two of the three studios we spoke to [CL-0001]."
 * Streaming time is short (<200ms) and the client typically renders the
 * complete message before the screenshot point.
 */
function sseChatStream(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
    connection: 'keep-alive',
  });
  res.write('event: status\ndata: {"phase":"searching","message":"Searching evidence..."}\n\n');
  res.write('event: status\ndata: {"phase":"retrieved","message":"Retrieved 3 claims."}\n\n');
  res.write('event: status\ndata: {"phase":"synthesizing","message":"Synthesizing answer..."}\n\n');
  res.write('event: delta\ndata: {"text":"Onboarding pain is real "}\n\n');
  res.write('event: delta\ndata: {"text":"for two of the three studios we spoke to "}\n\n');
  res.write('event: citation\ndata: {"id":"CL-0001"}\n\n');
  res.write('event: delta\ndata: {"text":"[CL-0001]. View spec churn is the second-most common complaint "}\n\n');
  res.write('event: citation\ndata: {"id":"CL-0002"}\n\n');
  res.write('event: delta\ndata: {"text":"[CL-0002]. The runbook is also out of date "}\n\n');
  res.write('event: citation\ndata: {"id":"CL-0003"}\n\n');
  res.write('event: delta\ndata: {"text":"[CL-0003]."}\n\n');
  res.write('event: done\ndata: {"totalCitations":3}\n\n');
  res.end();
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
  if (url.pathname === '/api/chat/stream') return sseChatStream(res);
  notFound(res);
});

server.listen(PORT, () => {
  console.log(`[visual mock api] listening on http://localhost:${PORT}`);
});
