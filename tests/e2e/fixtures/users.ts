// Seeded user credentials mirrored from apps/api/src/data/users.ts. We
// intentionally keep this fixture small — the LoginView only validates
// email shape locally; the API is the source of truth. If the seed list
// changes, update both this file and the unit tests in `tests/unit`.

export type SeededUser = {
  email: string;
  defaultRole: 'researcher' | 'pm' | 'designer' | 'engineer';
  productCount: number;
};

export const SEEDED: Record<string, SeededUser> = {
  researcher: {
    email: 'isathe@perforce.com',
    defaultRole: 'researcher',
    productCount: 3,
  },
  pm: {
    email: 'pm@perforce.com',
    defaultRole: 'pm',
    productCount: 1,
  },
};

// Distinct, deterministic marker words the mock-claude shim recognizes.
// Keep these in sync with tests/e2e/scripts/mock-claude.mjs.
export const MOCK_TRIGGERS = {
  /** Forces the mock to emit an honest "no relevant research" answer. */
  gibberish: 'zzzqqq why does the moon zzzqqq',
} as const;
