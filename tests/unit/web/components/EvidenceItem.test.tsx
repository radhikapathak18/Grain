// Unit tests for apps/web/src/components/EvidenceItem.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceItem } from '../../../../apps/web/src/components/EvidenceItem.tsx';
import type { Evidence, SourceType } from '@grain/types';

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    source_id: 'gong-001',
    source_type: 'gong',
    passage: 'I needed thirty minutes to get my first workspace set up.',
    source_url: 'https://example.test/gong/001',
    source_date: new Date().toISOString(),
    customer: 'Acme',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-26T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EvidenceItem', () => {
  it('renders the passage text', () => {
    render(
      <EvidenceItem
        evidence={makeEvidence({ passage: 'A quoted passage.' })}
        onOpenSource={() => undefined}
      />,
    );
    expect(screen.getByText('A quoted passage.')).toBeInTheDocument();
  });

  it.each([
    ['gong', 'Gong call'],
    ['zoom', 'Zoom interview'],
    ['slack', 'Slack message'],
    ['pendo', 'Pendo signal'],
    ['confluence', 'Confluence doc'],
  ] as [SourceType, string][])(
    'renders the %s source label',
    (sourceType, expected) => {
      render(
        <EvidenceItem
          evidence={makeEvidence({ source_type: sourceType, customer: undefined })}
          onOpenSource={() => undefined}
        />,
      );
      expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
    },
  );

  it('includes the customer when present', () => {
    render(
      <EvidenceItem
        evidence={makeEvidence({ customer: 'Stellar Forge' })}
        onOpenSource={() => undefined}
      />,
    );
    expect(screen.getByText(/Stellar Forge/)).toBeInTheDocument();
  });

  it('renders a "today" recency label for an evidence dated now', () => {
    render(
      <EvidenceItem
        evidence={makeEvidence({ source_date: '2026-05-26T00:00:00Z' })}
        onOpenSource={() => undefined}
      />,
    );
    expect(screen.getByText(/today/)).toBeInTheDocument();
  });

  it('fires onOpenSource with id + passage on the View full source button', () => {
    const onOpen = vi.fn();
    render(
      <EvidenceItem
        evidence={makeEvidence({
          source_id: 'gong-XYZ',
          passage: 'specific passage',
        })}
        onOpenSource={onOpen}
      />,
    );
    fireEvent.click(screen.getByText('View full source'));
    expect(onOpen).toHaveBeenCalledWith('gong-XYZ', 'specific passage');
  });
});
