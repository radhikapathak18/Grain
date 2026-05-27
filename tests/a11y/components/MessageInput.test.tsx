/**
 * MessageInput — the textarea + send button form.
 *
 * a11y contract:
 *  - send button has an accessible name ("Send message")
 *  - textarea is keyboard-reachable and has a visible/implicit label
 *  - axe: no violations on the rendered form
 *
 * KNOWN ISSUE (documented, NOT fixed by this agent):
 *   The textarea currently uses placeholder text only — no <label> association.
 *   axe should flag this as "label" or "aria-input-field-name". We log the
 *   finding and assert the textarea exists, but do NOT pass-through the axe
 *   result.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MessageInput } from '../../../apps/web/src/components/MessageInput';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';

describe('MessageInput — a11y', () => {
  it('renders an enabled textarea and Send button by default', () => {
    renderWithProviders(<MessageInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('Send button is disabled when prop disabled=true', () => {
    renderWithProviders(<MessageInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('axe scan reports any violations (logged + asserted)', async () => {
    const { container } = renderWithProviders(
      <MessageInput onSend={vi.fn()} disabled={false} />,
    );
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'MessageInput a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});
