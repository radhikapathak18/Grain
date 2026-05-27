/**
 * /login — LoginView.
 *
 * a11y contract:
 *  - exactly one h1
 *  - email input has an associated <label> (it does — implicit wrapping)
 *  - role <select> has an associated <label>
 *  - submit button text changes accessibly when submitting
 *  - error message uses role="alert" or live region — CURRENTLY MISSING
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { LoginView } from '../../../apps/web/src/views/LoginView';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';

describe('LoginView (/login) — a11y', () => {
  it('has a single h1 with the app name', () => {
    renderWithProviders(<LoginView />, { route: '/login' });
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/grain/i);
  });

  it('email input has an associated label', () => {
    renderWithProviders(<LoginView />, { route: '/login' });
    const email = screen.getByLabelText(/work email/i);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toBeRequired();
  });

  it('role select has an associated label', () => {
    renderWithProviders(<LoginView />, { route: '/login' });
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('submit button is a real <button type=submit>', () => {
    renderWithProviders(<LoginView />, { route: '/login' });
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('axe scan: no violations on the login form', async () => {
    const { container } = renderWithProviders(<LoginView />, { route: '/login' });
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('LoginView a11y violations:\n' + formatViolations(results));
    }
    expect(results).toHaveNoViolations();
  });
});
