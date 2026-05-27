import { describe, expect, it } from 'vitest';
import type { Claim, Product } from '@grain/types';
import {
  searchingStatus,
  retrievedStatus,
  synthesizingStatus,
} from '../../src/lib/statusMessages.ts';

const makeClaim = (id: string, area: Claim['area']): Claim =>
  ({
    id,
    text: 't',
    product: 'helix-core',
    area,
    persona: 'developer',
    sentiment: 'neutral',
    evidence: [],
    evidence_count: 0,
    most_recent_evidence_at: '2026-01-01',
    trust_tier: 'T3',
  }) as Claim;

const PRODUCT_HC: Product = { id: 'helix-core', displayName: 'Helix Core' };
const PRODUCT_P4V: Product = { id: 'p4v', displayName: 'P4V' };

describe('searchingStatus', () => {
  it('formats a single product', () => {
    const s = searchingStatus([PRODUCT_HC]);
    expect(s.phase).toBe('searching');
    expect(s.message).toBe('Searching customer research across Helix Core…');
  });

  it('joins multiple products with commas', () => {
    const s = searchingStatus([PRODUCT_HC, PRODUCT_P4V]);
    expect(s.message).toBe('Searching customer research across Helix Core, P4V…');
  });

  it('does not crash on empty products', () => {
    const s = searchingStatus([]);
    expect(s.phase).toBe('searching');
    expect(s.message).toBe('Searching customer research across …');
  });
});

describe('retrievedStatus', () => {
  it('singularizes "claim" when only one was found', () => {
    const s = retrievedStatus([makeClaim('CL-0001', 'onboarding')]);
    expect(s.phase).toBe('retrieved');
    expect(s.message).toContain('Found 1 claim');
    expect(s.message).toContain('onboarding');
  });

  it('pluralizes "claims" when multiple', () => {
    const s = retrievedStatus([
      makeClaim('CL-0001', 'onboarding'),
      makeClaim('CL-0002', 'onboarding'),
      makeClaim('CL-0003', 'merge'),
    ]);
    expect(s.message).toContain('Found 3 claims');
  });

  it('emits "no areas" wording when claims is empty', () => {
    const s = retrievedStatus([]);
    expect(s.message).toBe('Found 0 claims.');
  });

  it('replaces hyphens in multi-word area names', () => {
    const s = retrievedStatus([
      makeClaim('CL-0001', 'cli-ergonomics'),
      makeClaim('CL-0002', 'workspace-setup'),
    ]);
    expect(s.message).toContain('cli ergonomics');
    expect(s.message).toContain('workspace setup');
    expect(s.message).not.toContain('cli-ergonomics');
  });

  it('lists areas in descending frequency', () => {
    const s = retrievedStatus([
      makeClaim('CL-0001', 'merge'),
      makeClaim('CL-0002', 'merge'),
      makeClaim('CL-0003', 'merge'),
      makeClaim('CL-0004', 'onboarding'),
    ]);
    // merge (3) must appear before onboarding (1)
    const mergeIdx = s.message.indexOf('merge');
    const onbIdx = s.message.indexOf('onboarding');
    expect(mergeIdx).toBeGreaterThanOrEqual(0);
    expect(onbIdx).toBeGreaterThanOrEqual(0);
    expect(mergeIdx).toBeLessThan(onbIdx);
  });

  it('truncates to top 3 areas + "and N more areas" overflow', () => {
    const s = retrievedStatus([
      makeClaim('a', 'onboarding'),
      makeClaim('b', 'merge'),
      makeClaim('c', 'branching'),
      makeClaim('d', 'permissions'),
      makeClaim('e', 'performance'),
    ]);
    expect(s.message).toMatch(/and 2 more areas/);
  });

  it('uses singular "area" when exactly one overflow area', () => {
    const s = retrievedStatus([
      makeClaim('a', 'onboarding'),
      makeClaim('b', 'merge'),
      makeClaim('c', 'branching'),
      makeClaim('d', 'permissions'),
    ]);
    expect(s.message).toMatch(/and 1 more area\./);
    expect(s.message).not.toMatch(/and 1 more areas/);
  });
});

describe('synthesizingStatus', () => {
  it.each([
    ['pm', 'PM'],
    ['designer', 'Designer'],
    ['engineer', 'Engineer'],
    ['researcher', 'Researcher'],
  ] as const)('renders %s as "%s"', (role, label) => {
    const s = synthesizingStatus(role);
    expect(s.phase).toBe('synthesizing');
    expect(s.message).toBe(`Synthesizing answer for a ${label} audience…`);
  });
});
