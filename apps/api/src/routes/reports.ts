// Monthly report endpoint.
//
//   GET /api/reports/monthly   returns the cached MONTHLY_REPORT fixture
//
// The fixture is computed at module load (see data/reports.ts) so each request
// is just a JSON serialize.

import { Hono } from 'hono';
import { MONTHLY_REPORT } from '../data/reports.ts';

export const reportRoutes = new Hono();

reportRoutes.get('/monthly', (c) => c.json(MONTHLY_REPORT));
