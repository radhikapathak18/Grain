/**
 * AppHeader — sticky top nav (Chat/Report links, role switcher, products,
 * sign-out, skip link).
 *
 * a11y contract:
 *  - <header> + <nav> landmarks
 *  - skip link is the first focusable element and routes to #main
 *  - role switcher is a button with aria-expanded reflecting menu state
 *  - all icon-only buttons have accessible names
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { AppHeader } from '../../../apps/web/src/components/AppHeader';
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

describe('AppHeader — a11y', () => {
  it('renders header and navigation landmarks', () => {
    renderWithProviders(<AppHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('exposes a skip-to-content link pointing at #main', () => {
    renderWithProviders(<AppHeader />);
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toBeInTheDocument();
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('renders nothing if no user is signed in', () => {
    useSessionStore.setState({ user: null });
    const { container } = renderWithProviders(<AppHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it('role menu button has aria-expanded=false collapsed', () => {
    renderWithProviders(<AppHeader />);
    // The role-switcher button's accessible name is the role label
    // ("Researcher" for our fixture).
    const roleBtn = screen.getByRole('button', { name: /researcher/i });
    expect(roleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('axe scan', async () => {
    const { container } = renderWithProviders(<AppHeader />);
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'AppHeader a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});
