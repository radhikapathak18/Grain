import { describe, expect, it } from 'vitest';
import {
  AREAS,
  PERSONAS,
  PRODUCTS,
  SOURCE_TIER,
  SOURCE_TYPES,
} from '@grain/types';
import { CLAIMS, CLAIMS_BY_ID } from '../../src/data/claims.ts';

describe('CLAIMS fixture integrity', () => {
  it('has at least one claim', () => {
    expect(CLAIMS.length).toBeGreaterThan(0);
  });

  it('has unique CL-XXXX ids', () => {
    const ids = CLAIMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^CL-\d{4}$/);
    }
  });

  it('CLAIMS_BY_ID indexes every claim', () => {
    expect(Object.keys(CLAIMS_BY_ID).length).toBe(CLAIMS.length);
    for (const c of CLAIMS) {
      expect(CLAIMS_BY_ID[c.id]).toBe(c);
    }
  });

  it.each(CLAIMS.map((c) => [c.id, c] as const))(
    '%s passes structural checks',
    (_id, c) => {
      expect(PRODUCTS).toContain(c.product);
      expect(AREAS).toContain(c.area);
      expect(PERSONAS).toContain(c.persona);
      expect(['positive', 'negative', 'neutral', 'mixed']).toContain(c.sentiment);
      expect(c.text.length).toBeGreaterThan(0);
      expect(c.evidence.length).toBeGreaterThan(0);
      expect(c.evidence_count).toBe(c.evidence.length);
    },
  );

  it.each(CLAIMS.map((c) => [c.id, c] as const))(
    '%s evidence references valid source types and date format',
    (_id, c) => {
      for (const e of c.evidence) {
        expect(SOURCE_TYPES).toContain(e.source_type);
        expect(e.passage.length).toBeGreaterThan(0);
        expect(e.source_id.length).toBeGreaterThan(0);
        expect(e.source_url.startsWith('/source/')).toBe(true);
        // ISO date (YYYY-MM-DD prefix)
        expect(e.source_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(Number.isNaN(Date.parse(e.source_date))).toBe(false);
      }
    },
  );

  it('derives most_recent_evidence_at as the max of evidence dates', () => {
    for (const c of CLAIMS) {
      const expected = [...c.evidence.map((e) => e.source_date)].sort().reverse()[0];
      expect(c.most_recent_evidence_at).toBe(expected);
    }
  });

  it('derives trust_tier as the highest tier across evidence', () => {
    for (const c of CLAIMS) {
      const tiers = c.evidence.map((e) => SOURCE_TIER[e.source_type]);
      const expected = tiers.includes('T1')
        ? 'T1'
        : tiers.includes('T2')
          ? 'T2'
          : 'T3';
      expect(c.trust_tier).toBe(expected);
    }
  });
});
