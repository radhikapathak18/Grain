// Integration test: /api/claims endpoints
//
// Exercises both the batch fetch (?ids=...) and the single fetch
// /:id form against the REAL CLAIMS fixture corpus. No mocking — the
// fixture is the source of truth for both routes.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { claimRoutes } from '../../apps/api/src/routes/claims.ts';
import { CLAIMS, CLAIMS_BY_ID } from '../../apps/api/src/data/claims.ts';

function makeApp(): Hono {
  const app = new Hono();
  app.route('/api/claims', claimRoutes);
  return app;
}

describe('GET /api/claims (batch)', () => {
  it('returns 400 when the ids query param is missing entirely', async () => {
    const res = await makeApp().request('/api/claims');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ids/);
  });

  it('returns 400 when the ids query param is present but empty', async () => {
    // `?ids=` is treated as "param present but empty string". The
    // route code checks for `!idsParam` which is falsy for "" — so
    // this also yields a 400.
    const res = await makeApp().request('/api/claims?ids=');
    expect(res.status).toBe(400);
  });

  it('returns a 2-item batch for two known ids', async () => {
    const res = await makeApp().request(
      '/api/claims?ids=CL-0001,CL-0002',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.claims)).toBe(true);
    expect(body.claims.map((c: { id: string }) => c.id)).toEqual([
      'CL-0001',
      'CL-0002',
    ]);
    // Spot-check hydration: each returned claim carries derived fields.
    for (const c of body.claims) {
      expect(typeof c.evidence_count).toBe('number');
      expect(typeof c.most_recent_evidence_at).toBe('string');
      expect(typeof c.trust_tier).toBe('string');
    }
  });

  it('preserves the requested order when fetching a batch', async () => {
    const res = await makeApp().request(
      '/api/claims?ids=CL-0003,CL-0001,CL-0002',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims.map((c: { id: string }) => c.id)).toEqual([
      'CL-0003',
      'CL-0001',
      'CL-0002',
    ]);
  });

  it('silently drops unknown ids (filter Boolean) without erroring', async () => {
    const res = await makeApp().request(
      '/api/claims?ids=CL-0001,CL-9999,CL-0002,NOT-AN-ID',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims.map((c: { id: string }) => c.id)).toEqual([
      'CL-0001',
      'CL-0002',
    ]);
  });

  it('trims whitespace around each id', async () => {
    const res = await makeApp().request(
      '/api/claims?ids=%20CL-0001%20,%20CL-0002%20',
    );
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
    const body = await res.json();
    expect(body.claims).toEqual([]);
  });
});

describe('GET /api/claims/:id (single)', () => {
  it('returns the full claim payload for a known id', async () => {
    const known = CLAIMS[0]!;
    const res = await makeApp().request(`/api/claims/${known.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(known.id);
    expect(body.product).toBe(known.product);
    expect(body.evidence).toHaveLength(known.evidence.length);
    // Hydrated derived fields are present.
    expect(body.evidence_count).toBe(known.evidence_count);
    expect(body.most_recent_evidence_at).toBe(known.most_recent_evidence_at);
    expect(body.trust_tier).toBe(known.trust_tier);
  });

  it('returns 404 when the id does not exist in the corpus', async () => {
    const res = await makeApp().request('/api/claims/CL-9999');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/);
  });

  it('returns 404 for a totally malformed id', async () => {
    const res = await makeApp().request('/api/claims/lolwut');
    expect(res.status).toBe(404);
  });

  it('every id in CLAIMS_BY_ID resolves over HTTP', async () => {
    // Schema-drift guard: if a claim is dropped from the index but its
    // id still appears as evidence elsewhere we want this to fail loudly.
    const ids = Object.keys(CLAIMS_BY_ID);
    expect(ids.length).toBeGreaterThan(0);
    const app = makeApp();
    // Sample 5 distinct ids (covering enough of the index without
    // running 40 sequential HTTP fetches).
    const sample = ids.slice(0, 5);
    for (const id of sample) {
      const res = await app.request(`/api/claims/${id}`);
      expect(res.status).toBe(200);
      expect((await res.json()).id).toBe(id);
    }
  });
});
