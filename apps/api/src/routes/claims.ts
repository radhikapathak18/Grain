// Claim lookup endpoints.
//
//   GET /api/claims?ids=CL-0007,CL-0012   batch fetch for citation hydration
//   GET /api/claims/:id                    single claim detail
//
// noUncheckedIndexedAccess: true means CLAIMS_BY_ID[id] is Claim|undefined,
// so the .filter(Boolean) keeps the array typed as Claim[].

import { Hono } from 'hono';
import type { Claim } from '@grain/types';
import { CLAIMS_BY_ID } from '../data/claims.ts';

export const claimRoutes = new Hono();

claimRoutes.get('/', (c) => {
  const idsParam = c.req.query('ids');
  if (!idsParam) return c.json({ error: 'ids query required' }, 400);
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const claims: Claim[] = ids
    .map((id) => CLAIMS_BY_ID[id])
    .filter((c): c is Claim => Boolean(c));
  return c.json({ claims });
});

claimRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const claim = CLAIMS_BY_ID[id];
  if (!claim) return c.json({ error: 'claim not found' }, 404);
  return c.json(claim);
});
