// Integration test: GET /api/reports/monthly
//
// The route is a thin passthrough of a cached MonthlyReport fixture
// computed at module-load time from CLAIMS. The integration value here
// is asserting the *response shape* end-to-end, in case anything ever
// gets transformed in transit.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { reportRoutes } from '../../apps/api/src/routes/reports.ts';
import { MONTHLY_REPORT } from '../../apps/api/src/data/reports.ts';

function makeApp(): Hono {
  const app = new Hono();
  app.route('/api/reports', reportRoutes);
  return app;
}

describe('GET /api/reports/monthly', () => {
  it('returns 200 with the full MonthlyReport payload', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    expect(res.status).toBe(200);
    const body = await res.json();
    // Top-level shape — primitives.
    expect(body.periodLabel).toBe(MONTHLY_REPORT.periodLabel);
    expect(body.generatedAt).toBe(MONTHLY_REPORT.generatedAt);
    expect(body.totalClaims).toBe(MONTHLY_REPORT.totalClaims);
    // Themes and emerging are arrays with stable lengths.
    expect(Array.isArray(body.themes)).toBe(true);
    expect(body.themes).toHaveLength(MONTHLY_REPORT.themes.length);
    expect(Array.isArray(body.emerging)).toBe(true);
    expect(body.emerging).toHaveLength(MONTHLY_REPORT.emerging.length);
  });

  it('emits JSON content-type', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    expect(res.headers.get('content-type') ?? '').toMatch(
      /application\/json/,
    );
  });

  it('every theme has the expected fields populated', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    const body = await res.json();
    for (const theme of body.themes) {
      expect(typeof theme.id).toBe('string');
      expect(typeof theme.area).toBe('string');
      expect(typeof theme.title).toBe('string');
      expect(typeof theme.summary).toBe('string');
      expect(typeof theme.frequency).toBe('number');
      expect(['up', 'flat', 'down']).toContain(theme.trend);
      expect(Array.isArray(theme.byProduct)).toBe(true);
      expect(Array.isArray(theme.topClaimIds)).toBe(true);
      expect(theme.topClaimIds.length).toBeGreaterThan(0);
    }
  });

  it('every emerging issue has the expected EmergingIssue shape', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    const body = await res.json();
    for (const issue of body.emerging) {
      expect(typeof issue.id).toBe('string');
      expect(typeof issue.title).toBe('string');
      expect(typeof issue.summary).toBe('string');
      // firstSeen is an ISO date string.
      expect(typeof issue.firstSeen).toBe('string');
      expect(Number.isNaN(Date.parse(issue.firstSeen))).toBe(false);
      expect(typeof issue.product).toBe('string');
      expect(typeof issue.evidence_count).toBe('number');
      expect(issue.evidence_count).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(issue.severity);
    }
  });

  it('totalClaims and totalEvidence are positive integers', async () => {
    const res = await makeApp().request('/api/reports/monthly');
    const body = await res.json();
    expect(Number.isInteger(body.totalClaims)).toBe(true);
    expect(body.totalClaims).toBeGreaterThan(0);
    expect(Number.isInteger(body.totalEvidence)).toBe(true);
    expect(body.totalEvidence).toBeGreaterThan(0);
  });

  it('returns 404 on a sibling path that does not exist', async () => {
    const res = await makeApp().request('/api/reports/weekly');
    expect(res.status).toBe(404);
  });
});
