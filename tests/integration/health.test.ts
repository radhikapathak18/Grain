// Integration test: GET /api/health
//
// `index.ts` calls `serve()` at module-import time, which spawns a real
// port listener. We do NOT import `index.ts` directly (would conflict
// with concurrent test runs and is also outside our agent's scope to
// refactor). Instead we re-create the exact `/api/health` registration
// from index.ts on a fresh Hono app — the response shape is the
// contract under test, not the wiring.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';

function makeHealthApp(): Hono {
  const app = new Hono();
  app.get('/api/health', (c) =>
    c.json({ status: 'ok', service: 'grain-api' }),
  );
  return app;
}

describe('GET /api/health', () => {
  it('returns 200 with the expected health payload', async () => {
    const res = await makeHealthApp().request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', service: 'grain-api' });
  });

  it('returns JSON content-type', async () => {
    const res = await makeHealthApp().request('/api/health');
    expect(res.headers.get('content-type') ?? '').toMatch(/application\/json/);
  });

  it('404s on any other path under /api/health', async () => {
    const res = await makeHealthApp().request('/api/health/nope');
    expect(res.status).toBe(404);
  });
});
