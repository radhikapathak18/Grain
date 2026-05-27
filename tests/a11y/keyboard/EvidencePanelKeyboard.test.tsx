/**
 * Keyboard nav: EvidencePanel.
 *
 *  - Escape closes the panel (we re-verify here in a keyboard context).
 *  - Tab from inside the close button cycles within the panel — FINDING:
 *    in the current implementation focus can leave the panel because no
 *    focus-trap is installed (documented in EvidencePanel.test.tsx).
 */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { EvidencePanel } from '../../../apps/web/src/components/EvidencePanel';
import { useEvidencePanelStore } from '../../../apps/web/src/state/evidencePanel';
import { renderWithProviders } from '../lib/render';
import { makeClaim } from '../../fixtures/a11y';

beforeEach(() => {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ claims: [makeClaim()] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
  useEvidencePanelStore.setState({ openClaimId: null });
});

afterEach(() => {
  useEvidencePanelStore.setState({ openClaimId: null });
});

describe('EvidencePanel keyboard behaviour', () => {
  it('Escape closes the panel', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    const user = userEvent.setup();
    renderWithProviders(<EvidencePanel />);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
    });
  });

  it('close button is focusable via Tab from document start', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    const user = userEvent.setup();
    renderWithProviders(<EvidencePanel />);
    const dialog = await screen.findByRole('dialog');
    const closeBtn = await screen.findByRole('button', { name: /close evidence panel/i });
    // Focus the body, then Tab — we expect the close button to be reachable.
    document.body.focus();
    // Find tab steps to close button:
    for (let i = 0; i < 5; i++) {
      await user.tab();
      if (document.activeElement === closeBtn) break;
    }
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
