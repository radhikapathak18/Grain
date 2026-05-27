/**
 * Synthetic fixtures for a11y tests. Kept in the shared `tests/fixtures/`
 * area per TEST_PLAN convention so other agents can reuse if needed. These
 * are narrow constructors — full real fixtures live in `apps/api/src/data`.
 */
import type {
  ChatMessage,
  Claim,
  StatusStep,
  User,
  Product,
} from '@grain/types';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    email: 'a11y@perforce.test',
    role: 'researcher',
    products: ['helix-core', 'p4v'],
    ...overrides,
  };
}

export const AVAILABLE_PRODUCTS: Product[] = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

export function makeStatuses(): StatusStep[] {
  return [
    { phase: 'searching', message: 'Searching across 40 claims…' },
    { phase: 'retrieved', message: 'Retrieved 6 relevant claims.' },
    { phase: 'synthesizing', message: 'Synthesizing an answer for you…' },
  ];
}

export function makeUserMessage(text: string): ChatMessage {
  return {
    id: 'msg-user-1',
    role: 'user',
    text,
    createdAt: '2025-05-27T12:00:00.000Z',
  };
}

export function makeAssistantMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: 'msg-asst-1',
    role: 'assistant',
    text: 'Helix Core onboarding is consistently called out as friction-heavy [CL-0001]. Artists in particular struggle with view spec setup [CL-0002].',
    citations: ['CL-0001', 'CL-0002'],
    statuses: makeStatuses(),
    shape: 'explore',
    asRole: 'researcher',
    createdAt: '2025-05-27T12:00:01.000Z',
    ...overrides,
  };
}

export function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'CL-0001',
    text: 'Helix Core onboarding is a friction-heavy multi-week effort because workspace + view-spec setup assumes Perforce literacy.',
    product: 'helix-core',
    area: 'onboarding',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage: 'the onboarding for our two new studios took almost three weeks longer than we planned',
        source_url: 'https://example.com/gong/abc',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
    ],
    evidence_count: 1,
    most_recent_evidence_at: '2025-11-04',
    trust_tier: 'T2',
    ...overrides,
  };
}
