import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductId, QuestionShape } from '@grain/types';
import { retrieve } from '../../src/lib/retrieval.ts';
import { CLAIMS } from '../../src/data/claims.ts';

const ALL_PRODUCTS: ProductId[] = ['helix-core', 'p4v', 'helix-swarm'];

const TOP_K = 20;

describe('retrieve', () => {
  beforeEach(() => {
    // Pin "now" so the trends-window math is reproducible. The newest
    // evidence in the fixture is in early 2026, so 2026-05-26 gives both
    // in-window and out-of-window claims a meaningful split.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('product filtering', () => {
    it('returns only claims for the requested product (helix-core)', () => {
      const out = retrieve('any question', ['helix-core'], 'explore');
      expect(out.length).toBeGreaterThan(0);
      for (const c of out) expect(c.product).toBe('helix-core');
    });

    it('returns only claims for the requested product (p4v)', () => {
      const out = retrieve('any question', ['p4v'], 'explore');
      expect(out.length).toBeGreaterThan(0);
      for (const c of out) expect(c.product).toBe('p4v');
    });

    it('returns only claims for the requested product (helix-swarm)', () => {
      const out = retrieve('any question', ['helix-swarm'], 'explore');
      expect(out.length).toBeGreaterThan(0);
      for (const c of out) expect(c.product).toBe('helix-swarm');
    });

    it('returns the union when multiple products are requested', () => {
      const out = retrieve('any question', ['helix-core', 'p4v'], 'explore');
      const products = new Set(out.map((c) => c.product));
      expect(products.has('helix-core')).toBe(true);
      expect(products.has('p4v')).toBe(true);
      expect(products.has('helix-swarm')).toBe(false);
    });

    it('returns nothing when no products are passed', () => {
      expect(retrieve('any', [], 'explore')).toEqual([]);
    });

    it('ignores duplicate product ids in the input', () => {
      const once = retrieve('any', ['helix-core'], 'explore');
      const twice = retrieve(
        'any',
        ['helix-core', 'helix-core'] as ProductId[],
        'explore',
      );
      expect(twice).toEqual(once);
    });
  });

  describe('TOP_K bound', () => {
    it('returns at most 20 claims regardless of corpus size', () => {
      const out = retrieve('any', ALL_PRODUCTS, 'explore');
      expect(out.length).toBeLessThanOrEqual(TOP_K);
    });

    it('returns exactly the matching count when below TOP_K', () => {
      const out = retrieve('any', ['p4v'], 'explore');
      const total = CLAIMS.filter((c) => c.product === 'p4v').length;
      expect(out.length).toBe(Math.min(total, TOP_K));
    });
  });

  describe('explore shape (default ranking)', () => {
    it('sorts by evidence_count desc, then recency desc', () => {
      const out = retrieve('any', ALL_PRODUCTS, 'explore');
      for (let i = 1; i < out.length; i++) {
        const prev = out[i - 1];
        const cur = out[i];
        const sameEvidence = prev.evidence_count === cur.evidence_count;
        if (sameEvidence) {
          expect(
            prev.most_recent_evidence_at >= cur.most_recent_evidence_at,
          ).toBe(true);
        } else {
          expect(prev.evidence_count).toBeGreaterThanOrEqual(cur.evidence_count);
        }
      }
    });

    it('does not filter by question content (returns all matching products)', () => {
      const meaningfulQ = retrieve('merge resolve conflicts', ALL_PRODUCTS, 'explore');
      const garbageQ = retrieve('zzzzzzzz qqqqqqqq', ALL_PRODUCTS, 'explore');
      expect(garbageQ.map((c) => c.id)).toEqual(meaningfulQ.map((c) => c.id));
    });
  });

  describe('verify shape (keyword overlap)', () => {
    it('returns only claims containing at least one keyword', () => {
      const out = retrieve('workspace setup wizard', ['p4v'], 'verify');
      expect(out.length).toBeGreaterThan(0);
      for (const c of out) {
        const haystack = [
          c.text.toLowerCase(),
          c.area.toLowerCase(),
          c.persona.toLowerCase(),
          ...c.evidence.map((e) => e.passage.toLowerCase()),
        ].join(' ');
        const hit =
          haystack.includes('workspace') ||
          haystack.includes('setup') ||
          haystack.includes('wizard');
        expect(hit).toBe(true);
      }
    });

    it('falls back to all product-filtered claims when keywords are empty', () => {
      // All-stopword question — keywords ends up []. The implementation
      // contract is to skip the keyword filter entirely in that case.
      const out = retrieve('what is the', ['helix-core'], 'verify');
      const baseline = retrieve('any', ['helix-core'], 'explore');
      expect(out.map((c) => c.id)).toEqual(baseline.map((c) => c.id));
    });

    it('returns nothing for keywords that match no claims', () => {
      const out = retrieve('xyzzz qqqqqq nonexistentterm', ALL_PRODUCTS, 'verify');
      expect(out).toEqual([]);
    });

    it('matches against evidence passage text, not just claim.text', () => {
      // "pinging" appears only inside an evidence passage on CL-0001 — it is
      // not in claim.text, area, or persona. A hit here proves the matcher
      // walks the evidence array.
      const out = retrieve('pinging', ['helix-core'], 'verify');
      expect(out.map((c) => c.id)).toContain('CL-0001');
    });

    it('is case-insensitive', () => {
      const lower = retrieve('onboarding', ['helix-core'], 'verify');
      const upper = retrieve('ONBOARDING', ['helix-core'], 'verify');
      const mixed = retrieve('OnBoarding', ['helix-core'], 'verify');
      expect(upper.map((c) => c.id)).toEqual(lower.map((c) => c.id));
      expect(mixed.map((c) => c.id)).toEqual(lower.map((c) => c.id));
    });

    it('sorts verified hits by evidence_count desc', () => {
      const out = retrieve('merge resolve', ALL_PRODUCTS, 'verify');
      for (let i = 1; i < out.length; i++) {
        const prev = out[i - 1];
        const cur = out[i];
        if (prev.evidence_count === cur.evidence_count) {
          expect(
            prev.most_recent_evidence_at >= cur.most_recent_evidence_at,
          ).toBe(true);
        } else {
          expect(prev.evidence_count).toBeGreaterThanOrEqual(cur.evidence_count);
        }
      }
    });
  });

  describe('trends shape (recency window)', () => {
    it('drops claims older than the 12-month window', () => {
      const out = retrieve('any', ALL_PRODUCTS, 'trends');
      const cutoff = new Date('2026-05-26T00:00:00Z').getTime();
      const window = 12 * (365.25 / 12) * 24 * 60 * 60 * 1000;
      for (const c of out) {
        const age = cutoff - new Date(c.most_recent_evidence_at).getTime();
        expect(age).toBeLessThanOrEqual(window);
      }
    });

    it('sorts by most_recent_evidence_at desc', () => {
      const out = retrieve('any', ALL_PRODUCTS, 'trends');
      for (let i = 1; i < out.length; i++) {
        expect(
          out[i - 1].most_recent_evidence_at >=
            out[i].most_recent_evidence_at,
        ).toBe(true);
      }
    });

    it('ignores the question text — trends are not keyword-filtered', () => {
      const a = retrieve('merge conflicts', ALL_PRODUCTS, 'trends');
      const b = retrieve('zzz garbage', ALL_PRODUCTS, 'trends');
      expect(b.map((c) => c.id)).toEqual(a.map((c) => c.id));
    });

    it('drops everything when "now" is far past the corpus', () => {
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      const out = retrieve('any', ALL_PRODUCTS, 'trends');
      expect(out).toEqual([]);
    });
  });

  describe('determinism contract (architecture plan §3.6)', () => {
    it('does not accept role as input (signature-level guarantee)', () => {
      // The function arity must be 3 — adding a `role` parameter would be
      // a semantic regression of the demo-moment 7 contract.
      expect(retrieve.length).toBe(3);
    });

    it('returns identical results across repeated calls', () => {
      const a = retrieve('merge conflicts', ALL_PRODUCTS, 'verify');
      const b = retrieve('merge conflicts', ALL_PRODUCTS, 'verify');
      expect(b.map((c) => c.id)).toEqual(a.map((c) => c.id));
    });

    it('does not mutate the source CLAIMS array', () => {
      const before = CLAIMS.map((c) => c.id);
      retrieve('any', ALL_PRODUCTS, 'trends');
      retrieve('merge', ALL_PRODUCTS, 'verify');
      retrieve('onboarding', ALL_PRODUCTS, 'explore');
      const after = CLAIMS.map((c) => c.id);
      expect(after).toEqual(before);
    });
  });

  describe('shape × product matrix smoke', () => {
    const shapes: QuestionShape[] = ['explore', 'verify', 'trends'];
    for (const shape of shapes) {
      for (const product of ALL_PRODUCTS) {
        it(`returns a typed Claim[] for shape=${shape} product=${product}`, () => {
          const out = retrieve('onboarding setup', [product], shape);
          expect(Array.isArray(out)).toBe(true);
          for (const c of out) {
            expect(typeof c.id).toBe('string');
            expect(c.product).toBe(product);
            expect(typeof c.evidence_count).toBe('number');
          }
        });
      }
    }
  });
});
