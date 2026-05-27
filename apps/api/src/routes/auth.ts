import { Hono } from 'hono';
import { ROLES, type LoginRequest, type LoginResponse } from '@grain/types';
import { findUserByEmail } from '../data/users.ts';
import { PRODUCTS } from '../data/products.ts';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<LoginRequest> | null;

  if (!body || typeof body.email !== 'string' || !body.email.trim()) {
    return c.json({ error: 'email required' }, 400);
  }

  if (!body.role || !ROLES.includes(body.role)) {
    return c.json({ error: 'invalid role' }, 400);
  }

  const seeded = findUserByEmail(body.email);
  if (!seeded) {
    return c.json({ error: 'unknown user' }, 401);
  }

  const response: LoginResponse = {
    user: {
      email: seeded.email,
      role: body.role,
      products: seeded.products,
    },
    products: PRODUCTS.filter((p) => seeded.products.includes(p.id)),
  };

  return c.json(response);
});
