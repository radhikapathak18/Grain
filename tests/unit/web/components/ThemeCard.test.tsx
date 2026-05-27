// Unit tests for apps/web/src/components/ThemeCard.tsx.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeCard } from '../../../../apps/web/src/components/ThemeCard.tsx';
import { useEvidencePanelStore } from '../../../../apps/web/src/state/evidencePanel.ts';
import type { ReportTheme } from '@grain/types';

function makeTheme(overrides: Partial<ReportTheme> = {}): ReportTheme {
  return {
    id: 'th-1',
    area: 'workspace-setup',
    title: 'Workspace setup blocks first commit',
    summary: 'Customers stall for 30+ minutes on first workspace.',
    frequency: 12,
    trend: 'up',
    byProduct: [
      { product: 'p4v', count: 8 },
      { product: 'helix-core', count: 4 },
    ],
    topClaimIds: ['CL-0001', 'CL-0007'],
    ...overrides,
  };
}

beforeEach(() => {
  useEvidencePanelStore.getState().closePanel();
});

afterEach(() => {
  useEvidencePanelStore.getState().closePanel();
});

describe('ThemeCard', () => {
  it('renders the title and summary', () => {
    render(<ThemeCard theme={makeTheme()} maxFrequency={20} />);
    expect(screen.getByText(/Workspace setup blocks/)).toBeInTheDocument();
    expect(screen.getByText(/stall for 30\+ minutes/)).toBeInTheDocument();
  });

  it('renders the frequency value', () => {
    render(<ThemeCard theme={makeTheme({ frequency: 17 })} maxFrequency={20} />);
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it.each([
    ['up', 'up'],
    ['down', 'down'],
    ['flat', 'flat'],
  ] as [ReportTheme['trend'], string][])(
    'renders the trend label for %s',
    (trend, label) => {
      render(<ThemeCard theme={makeTheme({ trend })} maxFrequency={20} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it('renders per-product counts', () => {
    render(<ThemeCard theme={makeTheme()} maxFrequency={20} />);
    expect(screen.getByText('P4V')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Helix Core')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('opens the evidence panel when a top claim chip is clicked', () => {
    render(<ThemeCard theme={makeTheme()} maxFrequency={20} />);
    fireEvent.click(screen.getByText('CL-0007'));
    expect(useEvidencePanelStore.getState().openClaimId).toBe('CL-0007');
  });

  it('hides the top claims section when the list is empty', () => {
    render(
      <ThemeCard theme={makeTheme({ topClaimIds: [] })} maxFrequency={20} />,
    );
    expect(screen.queryByText(/Top claims/i)).not.toBeInTheDocument();
  });
});
