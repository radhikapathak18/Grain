// Unit tests for apps/web/src/components/TrustBadgeRow.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustBadgeRow } from '../../../../apps/web/src/components/TrustBadgeRow.tsx';
import type { Claim, TrustTier } from '@grain/types';

function makeClaim(
  trust_tier: TrustTier = 'T1',
  most_recent_evidence_at = '2026-05-26T00:00:00Z',
  evidence_count = 3,
): Claim {
  return {
    id: 'CL-0001',
    text: 'placeholder',
    product: 'p4v',
    area: 'workspace-setup',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [],
    evidence_count,
    most_recent_evidence_at,
    trust_tier,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-26T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TrustBadgeRow', () => {
  it.each(['T1', 'T2', 'T3'] as TrustTier[])(
    'renders the %s tier badge',
    (tier) => {
      render(<TrustBadgeRow claim={makeClaim(tier)} />);
      expect(screen.getByText(tier)).toBeInTheDocument();
    },
  );

  it('renders the evidence count', () => {
    render(<TrustBadgeRow claim={makeClaim('T1', '2026-05-26T00:00:00Z', 7)} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders a "today" or "0d ago" label for current-day evidence', () => {
    render(<TrustBadgeRow claim={makeClaim('T1', '2026-05-26T00:00:00Z')} />);
    expect(screen.getByText(/0d ago/)).toBeInTheDocument();
  });

  it('renders weeks ago for evidence within a month', () => {
    render(<TrustBadgeRow claim={makeClaim('T1', '2026-05-12T00:00:00Z')} />);
    expect(screen.getByText(/2w ago/)).toBeInTheDocument();
  });

  it('renders months ago for evidence older than a month', () => {
    render(<TrustBadgeRow claim={makeClaim('T1', '2025-11-26T00:00:00Z')} />);
    expect(screen.getByText(/6mo ago/)).toBeInTheDocument();
  });

  it('renders years ago for evidence older than a year', () => {
    render(<TrustBadgeRow claim={makeClaim('T1', '2024-05-26T00:00:00Z')} />);
    expect(screen.getByText(/2y ago/)).toBeInTheDocument();
  });

  it('falls back to "—" for an unparseable date', () => {
    render(<TrustBadgeRow claim={makeClaim('T1', 'not-a-date')} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
