import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { reportRoutes } from '../../src/routes/reports.ts';
import { MONTHLY_REPORT } from '../../src/data/reports.ts';

function makeApp() {
  const app = new Hono();
  app.route('/api/reports', reportRoutes);
  return app;
}

describe('GET /api/reports/monthly', () => {
  it('returns the cached MONTHLY_REPORT', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.periodLabel).toBe(MONTHLY_REPORT.periodLabel);
    expect(body.generatedAt).toBe(MONTHLY_REPORT.generatedAt);
    expect(body.totalClaims).toBe(MONTHLY_REPORT.totalClaims);
    expect(body.themes).toHaveLength(MONTHLY_REPORT.themes.length);
    expect(body.emerging).toHaveLength(MONTHLY_REPORT.emerging.length);
  });

  it('responds with JSON content-type', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    expect(res.headers.get('content-type') ?? '').toMatch(/application\/json/);
  });

  it('returns 404 on unknown sub-paths', async () => {
    const res = await makeApp().request('/api/reports/quarterly');
    expect(res.status).toBe(404);
  });
});
