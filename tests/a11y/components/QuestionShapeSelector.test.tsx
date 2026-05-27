/**
 * QuestionShapeSelector — Explore / Verify / Trends.
 *
 * Implements ARIA tablist (role="tablist" + tabs). Tab semantics require:
 *  - role="tablist" on the container
 *  - each tab role="tab", aria-selected, and tabindex roving (axe doesn't
 *    require tabindex roving, but does require aria-selected presence on
 *    elements with role="tab")
 *  - tab + tabpanel association if there's a panel (this component has none
 *    — tabs drive state, not a panel — which is borderline non-standard but
 *    not an axe failure)
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QuestionShapeSelector } from '../../../apps/web/src/components/QuestionShapeSelector';
import { useSessionStore } from '../../../apps/web/src/state/session';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';
import { makeUser, AVAILABLE_PRODUCTS } from '../../fixtures/a11y';

beforeEach(() => {
  useSessionStore.setState({
    user: makeUser(),
    availableProducts: AVAILABLE_PRODUCTS,
    selectedProducts: ['helix-core'],
    questionShape: 'explore',
    loginComplete: true,
    productsConfirmed: true,
    history: [],
  });
});

describe('QuestionShapeSelector — a11y', () => {
  it('exposes a tablist with three tabs', () => {
    renderWithProviders(<QuestionShapeSelector />);
    const list = screen.getByRole('tablist', { name: /question shape/i });
    expect(list).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('exactly one tab has aria-selected=true', () => {
    renderWithProviders(<QuestionShapeSelector />);
    const selected = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
  });

  it('axe scan: tablist semantics', async () => {
    const { container } = renderWithProviders(<QuestionShapeSelector />);
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'QuestionShapeSelector a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});
