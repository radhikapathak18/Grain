// Unit tests for apps/web/src/components/ThemeCard.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

// ThemeCard now uses useNavigate — it must be rendered inside a Router.
function renderCard(theme: ReportTheme, maxFrequency = 20) {
  return render(
    <MemoryRouter initialEntries={['/report/themes']}>
      <ThemeCard theme={theme} maxFrequency={maxFrequency} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useEvidencePanelStore.getState().closePanel();
});

afterEach(() => {
  useEvidencePanelStore.getState().closePanel();
  vi.restoreAllMocks();
});

describe('ThemeCard', () => {
  it('renders the title and summary', () => {
    renderCard(makeTheme());
    expect(screen.getByText(/Workspace setup blocks/)).toBeInTheDocument();
    expect(screen.getByText(/stall for 30\+ minutes/)).toBeInTheDocument();
  });

  it('renders the frequency value', () => {
    renderCard(makeTheme({ frequency: 17 }));
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it.each([
    ['up', 'up'],
    ['down', 'down'],
    ['flat', 'flat'],
  ] as [ReportTheme['trend'], string][])(
    'renders the trend label for %s',
    (trend, label) => {
      renderCard(makeTheme({ trend }));
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it('renders per-product counts', () => {
    renderCard(makeTheme());
    expect(screen.getByText('P4V')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Helix Core')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('opens the evidence panel when a top claim chip is clicked', () => {
    renderCard(makeTheme());
    fireEvent.click(screen.getByText('CL-0007'));
    expect(useEvidencePanelStore.getState().openClaimId).toBe('CL-0007');
  });

  it('hides the top claims section when the list is empty', () => {
    renderCard(makeTheme({ topClaimIds: [] }));
    expect(screen.queryByText(/Top claims/i)).not.toBeInTheDocument();
  });

  it('card article has role=button and tabIndex=0 for keyboard navigation', () => {
    const { container } = renderCard(makeTheme());
    // The <article> element is the navigable card — it is the only article in
    // the rendered output and carries role="button" + tabIndex="0".
    const article = container.querySelector('article[role="button"]') as HTMLElement;
    expect(article).not.toBeNull();
    expect(article.getAttribute('tabindex')).toBe('0');
  });
});
