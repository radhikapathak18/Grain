// Unit tests for apps/api/src/prompts/roles/* — each role prompt must be a
// non-empty <role audience="..."> block and must NOT cross-contaminate
// audience targeting.

import { describe, expect, it } from 'vitest';
import {
  ROLE_PROMPTS,
  PM_FORBIDDEN,
  DESIGNER_FORBIDDEN,
  ENGINEER_FORBIDDEN,
  RESEARCHER_FORBIDDEN,
} from '../../../../apps/api/src/prompts/roles/index.ts';
import type { Role } from '@grain/types';

const ROLES: Role[] = ['pm', 'designer', 'engineer', 'researcher'];

describe('ROLE_PROMPTS', () => {
  it.each(ROLES)('has a non-empty prompt for %s', (role) => {
    expect(ROLE_PROMPTS[role]).toBeTruthy();
    expect(ROLE_PROMPTS[role].length).toBeGreaterThan(100);
  });

  it.each(ROLES)('opens with a <role audience="..."> block for %s', (role) => {
    expect(ROLE_PROMPTS[role]).toMatch(/^<role audience="[^"]+">/);
    expect(ROLE_PROMPTS[role]).toMatch(/<\/role>\s*$/);
  });

  it.each(ROLES)('tags the correct audience attribute for %s', (role) => {
    expect(ROLE_PROMPTS[role]).toContain(`audience="${role}"`);
  });

  it('every role prompt is unique', () => {
    const unique = new Set(ROLES.map((r) => ROLE_PROMPTS[r]));
    expect(unique.size).toBe(ROLES.length);
  });
});

describe('FORBIDDEN phrase lists', () => {
  it.each([
    ['pm', PM_FORBIDDEN],
    ['designer', DESIGNER_FORBIDDEN],
    ['engineer', ENGINEER_FORBIDDEN],
    ['researcher', RESEARCHER_FORBIDDEN],
  ] as const)('exports a non-empty forbidden list for %s', (_role, list) => {
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    for (const phrase of list) {
      expect(typeof phrase).toBe('string');
      expect(phrase.length).toBeGreaterThan(0);
    }
  });
});
