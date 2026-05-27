// Unit tests for apps/web/src/components/EmergingIssuesList.tsx.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmergingIssuesList } from '../../../../apps/web/src/components/EmergingIssuesList.tsx';
import type { EmergingIssue } from '@grain/types';

const ISSUE: EmergingIssue = {
  id: 'e1',
  title: 'Streaming UI flicker',
  summary: 'Customers see a brief layout shift on cold-cache streams.',
  firstSeen: '2026-02-18',
  product: 'helix-core',
  evidence_count: 3,
};

describe('EmergingIssuesList', () => {
  it('renders an empty-state message when given no issues', () => {
    render(<EmergingIssuesList issues={[]} />);
    expect(screen.getByText(/No emerging issues/)).toBeInTheDocument();
  });

  it('renders the issue title and summary', () => {
    render(<EmergingIssuesList issues={[ISSUE]} />);
    expect(screen.getByText(ISSUE.title)).toBeInTheDocument();
    expect(screen.getByText(ISSUE.summary)).toBeInTheDocument();
  });

  it('renders the product label as a chip', () => {
    render(<EmergingIssuesList issues={[ISSUE]} />);
    expect(screen.getByText('Helix Core')).toBeInTheDocument();
  });

  it('formats firstSeen as "Mon D, YYYY"', () => {
    render(<EmergingIssuesList issues={[ISSUE]} />);
    expect(screen.getByText(/Feb 18, 2026/)).toBeInTheDocument();
  });

  it('singularizes "evidence item" for count=1', () => {
    render(
      <EmergingIssuesList issues={[{ ...ISSUE, evidence_count: 1 }]} />,
    );
    expect(screen.getByText(/evidence item$/)).toBeInTheDocument();
  });

  it('pluralizes "evidence items" for count !== 1', () => {
    render(<EmergingIssuesList issues={[ISSUE]} />);
    expect(screen.getByText(/evidence items$/)).toBeInTheDocument();
  });

  it('falls back to the raw firstSeen string when parsing fails', () => {
    render(
      <EmergingIssuesList
        issues={[{ ...ISSUE, firstSeen: 'not-a-date' }]}
      />,
    );
    expect(screen.getByText(/not-a-date/)).toBeInTheDocument();
  });
});
