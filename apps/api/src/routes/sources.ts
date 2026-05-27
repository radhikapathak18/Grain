// Source document detail endpoint.
//
//   GET /api/sources/:id   full transcript/passage payload for the source
//                          panel (architecture plan §3.3).

import { Hono } from 'hono';
import { SOURCE_BY_ID } from '../data/sources/index.ts';

export const sourceRoutes = new Hono();

sourceRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const source = SOURCE_BY_ID[id];
  if (!source) return c.json({ error: 'source not found' }, 404);
  return c.json(source);
});
