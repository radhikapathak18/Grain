import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env.ts';
import { authRoutes } from './routes/auth.ts';
import { chatRoutes } from './routes/chat.ts';
import { claimRoutes } from './routes/claims.ts';
import { reportRoutes } from './routes/reports.ts';
import { sourceRoutes } from './routes/sources.ts';

const app = new Hono();

app.use('*', cors({ origin: env.WEB_ORIGIN }));

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'grain-api' }));
app.route('/api/auth', authRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/claims', claimRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/sources', sourceRoutes);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`grain-api listening on http://localhost:${info.port}`);
});
