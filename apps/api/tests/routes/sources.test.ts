import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { sourceRoutes } from '../../src/routes/sources.ts';
import { SOURCES } from '../../src/data/sources/index.ts';

function makeApp() {
  const app = new Hono();
  app.route('/api/sources', sourceRoutes);
  return app;
}

describe('GET /api/sources/:id', () => {
  it('returns the source document for a known id', async () => {
    const known = SOURCES[0]!;
    const res = await makeApp().request(`/api/sources/${encodeURIComponent(known.id)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(known.id);
    expect(body.type).toBe(known.type);
    expect(typeof body.title).toBe('string');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await makeApp().request('/api/sources/does-not-exist');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/source not found/);
  });

  it.each(SOURCES.map((s) => [s.id] as const))('serves %s', async (id) => {
    const res = await makeApp().request(`/api/sources/${encodeURIComponent(id)}`);
    expect(res.status).toBe(200);
  });
});
