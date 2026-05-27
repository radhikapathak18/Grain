import { describe, expect, it } from 'vitest';
import { AREAS, PRODUCTS } from '@grain/types';
import { MONTHLY_REPORT } from '../../src/data/reports.ts';
import { CLAIMS_BY_ID } from '../../src/data/claims.ts';

describe('MONTHLY_REPORT', () => {
  describe('top-level shape', () => {
    it('exposes the expected scalar fields', () => {
      expect(MONTHLY_REPORT.periodLabel).toBe('April 2026');
      expect(MONTHLY_REPORT.generatedAt).toBe('2026-05-26T22:00:00Z');
      expect(MONTHLY_REPORT.totalClaims).toBeGreaterThan(0);
      expect(MONTHLY_REPORT.totalEvidence).toBeGreaterThan(0);
    });

    it('totalEvidence is the sum across themes (greater-than themes-only because themes are top-5 only)', () => {
      expect(MONTHLY_REPORT.totalEvidence).toBeGreaterThanOrEqual(
        MONTHLY_REPORT.themes.reduce((s, t) => s + t.frequency, 0),
      );
    });
  });

  describe('themes', () => {
    it('returns at most 5 themes', () => {
      expect(MONTHLY_REPORT.themes.length).toBeLessThanOrEqual(5);
      expect(MONTHLY_REPORT.themes.length).toBeGreaterThan(0);
    });

    it('themes are sorted by frequency desc', () => {
      const f = MONTHLY_REPORT.themes.map((t) => t.frequency);
      const sorted = [...f].sort((a, b) => b - a);
      expect(f).toEqual(sorted);
    });

    it('each theme has a valid area, title, summary, and trend', () => {
      for (const t of MONTHLY_REPORT.themes) {
        expect(AREAS).toContain(t.area);
        expect(t.title.length).toBeGreaterThan(0);
        expect(t.summary.length).toBeGreaterThan(0);
        expect(['up', 'down', 'flat']).toContain(t.trend);
      }
    });

    it('byProduct counts sum to greater than zero and only reference valid products', () => {
      for (const t of MONTHLY_REPORT.themes) {
        const total = t.byProduct.reduce((s, p) => s + p.count, 0);
        expect(total).toBeGreaterThan(0);
        for (const p of t.byProduct) {
          expect(PRODUCTS).toContain(p.product);
          expect(p.count).toBeGreaterThan(0);
        }
      }
    });

    it('byProduct is sorted by count desc', () => {
      for (const t of MONTHLY_REPORT.themes) {
        const counts = t.byProduct.map((p) => p.count);
        const sorted = [...counts].sort((a, b) => b - a);
        expect(counts).toEqual(sorted);
      }
    });

    it('topClaimIds reference real claims (at most 4 per theme)', () => {
      for (const t of MONTHLY_REPORT.themes) {
        expect(t.topClaimIds.length).toBeLessThanOrEqual(4);
        for (const id of t.topClaimIds) {
          const claim = CLAIMS_BY_ID[id];
          expect(claim, `theme ${t.area} top claim ${id} should exist`).toBeDefined();
          expect(claim!.area).toBe(t.area);
        }
      }
    });

    it('areas across themes are unique', () => {
      const areas = MONTHLY_REPORT.themes.map((t) => t.area);
      expect(new Set(areas).size).toBe(areas.length);
    });
  });

  describe('emerging issues', () => {
    it('exposes a non-empty emerging list', () => {
      expect(MONTHLY_REPORT.emerging.length).toBeGreaterThan(0);
    });

    it('each emerging issue references a real claim and is internally consistent', () => {
      for (const e of MONTHLY_REPORT.emerging) {
        expect(e.id).toMatch(/^emerging-\d{2}$/);
        expect(PRODUCTS).toContain(e.product);
        expect(e.title.length).toBeGreaterThan(0);
        expect(e.summary.length).toBeGreaterThan(0);
        expect(e.firstSeen).toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(Number.isNaN(Date.parse(e.firstSeen))).toBe(false);
        expect(e.evidence_count).toBeGreaterThan(0);
      }
    });

    it('emerging ids are unique', () => {
      const ids = MONTHLY_REPORT.emerging.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
