// Unit tests for apps/api/src/prompts/synthesis.ts — buildSystemPrompt.
//
// We don't assert the exact prose (that would lock the demo into one
// wording). We assert SHAPE: every required slot is present, the role +
// shape are swapped in correctly, products names appear, and the claims
// JSON block is well-formed.

import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../../../../apps/api/src/prompts/synthesis.ts';
import { ROLE_PROMPTS } from '../../../../apps/api/src/prompts/roles/index.ts';
import { SHAPE_DIRECTIVES } from '../../../../apps/api/src/prompts/shapes.ts';
import type { Claim, Product } from '@grain/types';

const PRODUCTS: Product[] = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
];

const CLAIM: Claim = {
  id: 'CL-0001',
  text: 'Workspace setup blocks the first commit.',
  product: 'p4v',
  area: 'workspace-setup',
  persona: 'developer',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'gong-001',
      source_type: 'gong',
      passage: 'It takes 30 minutes to get my first workspace.',
      source_url: 'https://example.test/gong/001',
      source_date: '2026-01-15',
      customer: 'Acme',
    },
  ],
  evidence_count: 1,
  most_recent_evidence_at: '2026-01-15',
  trust_tier: 'T2',
};

describe('buildSystemPrompt', () => {
  it('includes the static frame, citation, and response-shape slots', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    expect(out).toContain('You are Grain');
    expect(out).toContain('research synthesis system for Perforce');
    expect(out).toContain('cite the claim ids');
    expect(out).toContain('[CL-xxxx]');
    expect(out).toContain('under 250 words');
  });

  it('embeds the requested role prompt verbatim', () => {
    for (const role of ['pm', 'designer', 'engineer', 'researcher'] as const) {
      const out = buildSystemPrompt({
        role,
        shape: 'explore',
        products: PRODUCTS,
        claims: [CLAIM],
      });
      expect(out).toContain(ROLE_PROMPTS[role]);
    }
  });

  it('embeds the shape directive for the requested shape', () => {
    for (const shape of ['explore', 'verify', 'trends'] as const) {
      const out = buildSystemPrompt({
        role: 'pm',
        shape,
        products: PRODUCTS,
        claims: [CLAIM],
      });
      expect(out).toContain(SHAPE_DIRECTIVES[shape]);
    }
  });

  it('lists the product display names in the cross-product attribution slot', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    expect(out).toContain('Helix Core');
    expect(out).toContain('P4V');
    expect(out).toContain('selected these products');
  });

  it('embeds the trust calibration map with all three tiers', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    expect(out).toContain('T1');
    expect(out).toContain('T2');
    expect(out).toContain('T3');
    expect(out).toContain('Customers report');
    expect(out).toContain('Some users mention');
  });

  it('wraps the claims JSON in a <retrieved_claims> block', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    expect(out).toContain('<retrieved_claims>');
    expect(out).toContain('</retrieved_claims>');
    // The claim id is inside the JSON block.
    expect(out).toContain('CL-0001');
  });

  it('produces parseable JSON for the claims block', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    const between = out.match(
      /<retrieved_claims>\n([\s\S]*?)\n<\/retrieved_claims>/,
    );
    expect(between).not.toBeNull();
    const parsed = JSON.parse(between![1]!) as Claim[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]!.id).toBe('CL-0001');
  });

  it('handles an empty claims array without throwing', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [],
    });
    expect(out).toContain('<retrieved_claims>');
    const between = out.match(
      /<retrieved_claims>\n([\s\S]*?)\n<\/retrieved_claims>/,
    );
    expect(JSON.parse(between![1]!)).toEqual([]);
  });

  it('includes the customer-scope directive', () => {
    const out = buildSystemPrompt({
      role: 'pm',
      shape: 'verify',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    expect(out).toContain('customer segment');
    expect(out).toContain('evidence[].customer');
  });

  it('changes between roles even with identical shape/products/claims (role-swap is the demo contract)', () => {
    const pm = buildSystemPrompt({
      role: 'pm',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    const designer = buildSystemPrompt({
      role: 'designer',
      shape: 'explore',
      products: PRODUCTS,
      claims: [CLAIM],
    });
    expect(pm).not.toEqual(designer);
  });
});
