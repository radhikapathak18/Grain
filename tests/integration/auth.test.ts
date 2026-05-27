// Integration test: POST /api/auth/login
//
// Asserts the route's contract end-to-end against the real `data/users`
// and `data/products` modules. Login is unauthenticated — there is no
// password check — so the suite focuses on:
//   - validation (400)
//   - unknown-user rejection (401)
//   - happy paths for both seeded users, including case + whitespace
//     normalization and per-request role override.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../../apps/api/src/routes/auth.ts';
import { SEEDED_USERS } from '../../apps/api/src/data/users.ts';
import { PRODUCTS } from '../../apps/api/src/data/products.ts';

function makeApp(): Hono {
  const app = new Hono();
  app.route('/api/auth', authRoutes);
  return app;
}

async function login(payload: unknown) {
  const body =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  return makeApp().request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('POST /api/auth/login — 400 validation', () => {
  it('rejects a missing body', async () => {
    const res = await login('not-json');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/email/);
  });

  it('rejects a missing email field', async () => {
    const res = await login({ role: 'pm' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/email/);
  });

  it('rejects an empty / whitespace-only email', async () => {
    const res = await login({ email: '    ', role: 'pm' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-string email', async () => {
    const res = await login({ email: 42, role: 'pm' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing role', async () => {
    const res = await login({ email: 'isathe@perforce.com' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/role/);
  });

  it('rejects an unknown role', async () => {
    const res = await login({ email: 'isathe@perforce.com', role: 'ceo' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/role/);
  });
});

describe('POST /api/auth/login — 401 unknown user', () => {
  it('rejects an email that is not in the seeded list', async () => {
    const res = await login({
      email: 'stranger@example.org',
      role: 'pm',
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/unknown user/);
  });
});

describe('POST /api/auth/login — 200 happy path', () => {
  it('returns the seeded researcher with all three products', async () => {
    const res = await login({
      email: 'isathe@perforce.com',
      role: 'researcher',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe('isathe@perforce.com');
    expect(body.user.role).toBe('researcher');
    // Seeded for the researcher: all three products.
    expect(body.user.products.sort()).toEqual(
      ['helix-core', 'helix-swarm', 'p4v'].sort(),
    );
    // Products array on the response is filtered to the user's
    // entitlements — verify ordering matches the canonical PRODUCTS
    // list (filter preserves the source order).
    const expectedFiltered = PRODUCTS.filter((p) =>
      body.user.products.includes(p.id),
    );
    expect(body.products).toEqual(expectedFiltered);
  });

  it('returns the seeded PM with only helix-core', async () => {
    const res = await login({
      email: 'pm@perforce.com',
      role: 'pm',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.products).toEqual(['helix-core']);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].id).toBe('helix-core');
    expect(body.products[0].displayName).toBe('Helix Core');
  });

  it('looks up email case-insensitively', async () => {
    const res = await login({
      email: 'ISATHE@PERFORCE.COM',
      role: 'pm',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Normalized to the seeded casing.
    expect(body.user.email).toBe('isathe@perforce.com');
  });

  it('trims leading and trailing whitespace on the email', async () => {
    const res = await login({
      email: '  pm@perforce.com  ',
      role: 'engineer',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe('pm@perforce.com');
  });

  it('overrides seeded role with the role from the request body', async () => {
    // isathe is seeded as 'researcher'. Login with role=designer.
    const res = await login({
      email: 'isathe@perforce.com',
      role: 'designer',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('designer');
    // Sanity: a different role on the same user still returns the same
    // product entitlements (entitlements are seeded; role is per-login).
    const seeded = SEEDED_USERS.find(
      (u) => u.email === 'isathe@perforce.com',
    );
    expect(body.user.products.sort()).toEqual(
      [...(seeded?.products ?? [])].sort(),
    );
  });
});
