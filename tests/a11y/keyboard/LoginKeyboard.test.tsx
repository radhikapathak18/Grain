/**
 * Keyboard nav: /login.
 *
 * Tab order through email → role → submit.
 * Enter on submit triggers form submission.
 */
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { LoginView } from '../../../apps/web/src/views/LoginView';
import { renderWithProviders } from '../lib/render';

// We don't want LoginView's onSubmit to actually call the real /api/auth/login.
// Stub fetch to a permanent 401 so the form catches the error path silently.
beforeEachStubFetch();

function beforeEachStubFetch() {
  // hoisted helper
}

describe('LoginView — keyboard navigation', () => {
  it('Tab order: email → role → submit', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    ) as unknown as typeof fetch;
    const user = userEvent.setup();
    renderWithProviders(<LoginView />, { route: '/login' });

    const email = screen.getByLabelText(/work email/i);
    const role = screen.getByLabelText(/role/i);
    const submit = screen.getByRole('button', { name: /sign in/i });

    email.focus();
    expect(email).toHaveFocus();

    await user.tab();
    expect(role).toHaveFocus();

    await user.tab();
    expect(submit).toHaveFocus();
  });

  it('Enter inside the email field submits the form (keyboard activation)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();
    renderWithProviders(<LoginView />, { route: '/login' });

    const email = screen.getByLabelText(/work email/i) as HTMLInputElement;
    // The dev preset fills in isathe@perforce.com. Clear it then re-enter so
    // we know exactly what value submits.
    await user.clear(email);
    await user.type(email, 'a@b.test{Enter}');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
