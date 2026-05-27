import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../../src/routes/auth.ts';

function makeApp() {
  const app = new Hono();
  app.route('/api/auth', authRoutes);
  return app;
}

async function login(body: unknown) {
  const app = makeApp();
  return app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  describe('success', () => {
    it('returns a user and the products they have access to', async () => {
      const res = await login({ email: 'isathe@perforce.com', role: 'pm' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe('isathe@perforce.com');
      // The requested role overrides the seeded role — this is the demo's
      // "switch roles" mechanic at login time.
      expect(body.user.role).toBe('pm');
      expect(body.user.products).toEqual(['helix-core', 'p4v', 'helix-swarm']);
      expect(body.products.map((p: { id: string }) => p.id).sort()).toEqual(
        ['helix-core', 'helix-swarm', 'p4v'],
      );
    });

    it('looks up users case-insensitively', async () => {
      const res = await login({ email: 'ISATHE@PERFORCE.COM', role: 'engineer' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe('isathe@perforce.com');
      expect(body.user.role).toBe('engineer');
    });

    it('trims surrounding whitespace on the email', async () => {
      const res = await login({ email: '   isathe@perforce.com  ', role: 'designer' });
      expect(res.status).toBe(200);
    });

    it('restricts products to what the seeded user can see', async () => {
      const res = await login({ email: 'pm@perforce.com', role: 'pm' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.products).toEqual(['helix-core']);
      expect(body.products).toHaveLength(1);
      expect(body.products[0].id).toBe('helix-core');
    });

    it.each(['pm', 'designer', 'engineer', 'researcher'])(
      'accepts role=%s',
      async (role) => {
        const res = await login({ email: 'isathe@perforce.com', role });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user.role).toBe(role);
      },
    );
  });

  describe('400 validation', () => {
    it('rejects a missing body', async () => {
      const res = await login('not-json');
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/email/);
    });

    it('rejects a missing email', async () => {
      const res = await login({ role: 'pm' });
      expect(res.status).toBe(400);
    });

    it('rejects an empty / whitespace email', async () => {
      const res = await login({ email: '   ', role: 'pm' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-string email', async () => {
      const res = await login({ email: 123, role: 'pm' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing role', async () => {
      const res = await login({ email: 'isathe@perforce.com' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/role/);
    });

    it('rejects an unknown role', async () => {
      const res = await login({ email: 'isathe@perforce.com', role: 'manager' });
      expect(res.status).toBe(400);
    });

    it('rejects role with wrong type', async () => {
      const res = await login({ email: 'isathe@perforce.com', role: 42 });
      expect(res.status).toBe(400);
    });
  });

  describe('401 unknown user', () => {
    it('rejects an email not in the seed list', async () => {
      const res = await login({ email: 'someone@elsewhere.com', role: 'pm' });
      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/unknown user/);
    });
  });
});
