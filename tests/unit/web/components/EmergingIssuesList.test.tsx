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
  severity: 'high',
};

const MEDIUM_ISSUE: EmergingIssue = {
  id: 'e2',
  title: 'Review queue latency',
  summary: 'Queue refresh takes 4s on large projects.',
  firstSeen: '2026-03-01',
  product: 'swarm',
  evidence_count: 5,
  severity: 'medium',
};

const LOW_ISSUE: EmergingIssue = {
  id: 'e3',
  title: 'Wizard tooltip misaligned',
  summary: 'Tooltip appears 2px off in the wizard flow.',
  firstSeen: '2026-04-10',
  product: 'p4v',
  evidence_count: 1,
  severity: 'low',
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

  // --- Severity grouping ---

  it('renders a "High" section heading when a high-severity issue is present', () => {
    render(<EmergingIssuesList issues={[ISSUE]} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders a "Medium" section heading when a medium-severity issue is present', () => {
    render(<EmergingIssuesList issues={[MEDIUM_ISSUE]} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders a "Low" section heading when a low-severity issue is present', () => {
    render(<EmergingIssuesList issues={[LOW_ISSUE]} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('does not render Medium or Low sections when only a high-severity issue is passed', () => {
    render(<EmergingIssuesList issues={[ISSUE]} />);
    expect(screen.queryByText('Medium')).not.toBeInTheDocument();
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
  });

  it('does not render High or Low sections when only a medium-severity issue is passed', () => {
    render(<EmergingIssuesList issues={[MEDIUM_ISSUE]} />);
    expect(screen.queryByText('High')).not.toBeInTheDocument();
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
  });

  it('sorts issues within a tier by evidence_count descending', () => {
    const highA: EmergingIssue = {
      ...ISSUE,
      id: 'h1',
      title: 'Issue A — fewer evidence',
      evidence_count: 2,
      severity: 'high',
    };
    const highB: EmergingIssue = {
      ...ISSUE,
      id: 'h2',
      title: 'Issue B — more evidence',
      evidence_count: 8,
      severity: 'high',
    };
    render(<EmergingIssuesList issues={[highA, highB]} />);
    const titles = screen
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent);
    // highB has more evidence so must appear first.
    expect(titles.indexOf('Issue B — more evidence')).toBeLessThan(
      titles.indexOf('Issue A — fewer evidence'),
    );
  });

  it('renders all three sections when issues from each tier are provided', () => {
    render(<EmergingIssuesList issues={[ISSUE, MEDIUM_ISSUE, LOW_ISSUE]} />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});
