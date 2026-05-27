import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { claimRoutes } from '../../src/routes/claims.ts';
import { CLAIMS } from '../../src/data/claims.ts';

function makeApp() {
  const app = new Hono();
  app.route('/api/claims', claimRoutes);
  return app;
}

describe('GET /api/claims', () => {
  it('returns a 400 when no ids query is provided', async () => {
    const res = await makeApp().request('/api/claims');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ids query required/);
  });

  it('returns a single claim when one id is given', async () => {
    const res = await makeApp().request('/api/claims?ids=CL-0001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toHaveLength(1);
    expect(body.claims[0].id).toBe('CL-0001');
  });

  it('returns multiple claims preserving requested order', async () => {
    const res = await makeApp().request('/api/claims?ids=CL-0003,CL-0001,CL-0002');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims.map((c: { id: string }) => c.id)).toEqual([
      'CL-0003',
      'CL-0001',
      'CL-0002',
    ]);
  });

  it('silently drops unknown ids and returns only valid ones', async () => {
    const res = await makeApp().request('/api/claims?ids=CL-0001,CL-9999,CL-0002');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims.map((c: { id: string }) => c.id)).toEqual([
      'CL-0001',
      'CL-0002',
    ]);
  });

  it('trims whitespace around ids', async () => {
    const res = await makeApp().request('/api/claims?ids=  CL-0001  , CL-0002');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims.map((c: { id: string }) => c.id)).toEqual([
      'CL-0001',
      'CL-0002',
    ]);
  });

  it('returns an empty array when all ids are unknown', async () => {
    const res = await makeApp().request('/api/claims?ids=NOPE-1,NOPE-2');
    expect(res.status).toBe(200);
    expect((await res.json()).claims).toEqual([]);
  });

  it('returns an empty array when ids parses to an empty list', async () => {
    const res = await makeApp().request('/api/claims?ids=,,,');
    expect(res.status).toBe(200);
    expect((await res.json()).claims).toEqual([]);
  });
});

describe('GET /api/claims/:id', () => {
  it('returns the full claim payload when found', async () => {
    const known = CLAIMS[0]!;
    const res = await makeApp().request(`/api/claims/${known.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(known.id);
    expect(body.evidence).toHaveLength(known.evidence.length);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await makeApp().request('/api/claims/CL-9999');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/claim not found/);
  });

  it('returns 404 for a malformed id', async () => {
    const res = await makeApp().request('/api/claims/not-a-real-id');
    expect(res.status).toBe(404);
  });
});
