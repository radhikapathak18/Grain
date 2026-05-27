/**
 * /select — ProductSelectView.
 *
 * a11y contract:
 *  - heading hierarchy: one h1
 *  - product chips render as role="checkbox" with aria-checked
 *  - "Continue" button disabled when nothing selected
 *  - axe pass
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { ProductSelectView } from '../../../apps/web/src/views/ProductSelectView';
import { useSessionStore } from '../../../apps/web/src/state/session';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';
import { makeUser, AVAILABLE_PRODUCTS } from '../../fixtures/a11y';

beforeEach(() => {
  useSessionStore.setState({
    user: makeUser(),
    availableProducts: AVAILABLE_PRODUCTS,
    selectedProducts: [],
    questionShape: 'explore',
    loginComplete: true,
    productsConfirmed: false,
    history: [],
  });
});

describe('ProductSelectView (/select) — a11y', () => {
  it('has one h1', () => {
    renderWithProviders(<ProductSelectView />, { route: '/select' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('all product options are exposed as role=checkbox', () => {
    renderWithProviders(<ProductSelectView />, { route: '/select' });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(AVAILABLE_PRODUCTS.length);
    for (const cb of checkboxes) {
      expect(cb).toHaveAttribute('aria-checked');
    }
  });

  it('group has an accessible name', () => {
    renderWithProviders(<ProductSelectView />, { route: '/select' });
    expect(screen.getByRole('group', { name: /products/i })).toBeInTheDocument();
  });

  it('Continue button is disabled with zero selected', () => {
    renderWithProviders(<ProductSelectView />, { route: '/select' });
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('axe scan', async () => {
    const { container } = renderWithProviders(<ProductSelectView />, {
      route: '/select',
    });
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'ProductSelectView a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});
