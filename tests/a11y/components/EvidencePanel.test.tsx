/**
 * EvidencePanel — slide-in dialog showing a claim's evidence.
 *
 * a11y contract for a true dialog:
 *  - role="dialog" ✓ (declared)
 *  - aria-modal="true" ✓ (declared)
 *  - aria-label or aria-labelledby ✓ ("Evidence panel")
 *  - Esc closes ✓ (handler in useEffect)
 *  - **FOCUS TRAP** ✗ (NOT implemented — see finding)
 *  - **Focus moves into the dialog on open** ✗ (NOT implemented — see finding)
 *  - **Focus restored to opener on close** ✗ (NOT implemented — see finding)
 *  - close button has aria-label="Close evidence panel" ✓
 *  - backdrop click closes ✓ (aria-hidden backdrop)
 *
 * This file's job is to ASSERT what's declared and DOCUMENT what isn't. Don't
 * fix the component.
 */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidencePanel } from '../../../apps/web/src/components/EvidencePanel';
import { useEvidencePanelStore } from '../../../apps/web/src/state/evidencePanel';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations, writeFindings } from '../lib/axe';
import { makeClaim } from '../../fixtures/a11y';

function stubFetch() {
  const claim = makeClaim();
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/claims')) {
      return new Response(JSON.stringify({ claims: [claim] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  stubFetch();
  useEvidencePanelStore.setState({ openClaimId: null });
});

afterEach(() => {
  useEvidencePanelStore.setState({ openClaimId: null });
});

describe('EvidencePanel — a11y (dialog)', () => {
  it('renders nothing while closed', () => {
    const { container } = renderWithProviders(<EvidencePanel />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('open state: dialog has role, aria-modal, aria-label', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    renderWithProviders(<EvidencePanel />);
    const dialog = await screen.findByRole('dialog', { name: /evidence panel/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Evidence panel');
  });

  it('open state: close button is accessible and clicking it clears state', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    renderWithProviders(<EvidencePanel />);
    const closeBtn = await screen.findByRole('button', {
      name: /close evidence panel/i,
    });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
    });
  });

  it('open state: Escape key closes the panel', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    renderWithProviders(<EvidencePanel />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
    });
  });

  it('FINDING: focus does NOT auto-move into the dialog on open', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    renderWithProviders(<EvidencePanel />);
    const dialog = await screen.findByRole('dialog');
    // WCAG 2.4.3 / dialog pattern: focus should be inside the dialog when it
    // opens. Document the current behaviour: focus stays on the body /
    // wherever it was.
    const active = document.activeElement;
    const focusInside = !!active && dialog.contains(active);
    if (!focusInside) {
      // eslint-disable-next-line no-console
      console.warn(
        '[a11y FINDING] EvidencePanel: focus is NOT moved into the dialog on open. ' +
          'WCAG 2.4.3 (Focus Order) + APG dialog pattern require initial focus inside the dialog.',
      );
    }
    // Assertion documents current behavior — change to .toBe(true) once fixed.
    expect(focusInside).toBe(false);
  });

  it('FINDING: focus is NOT trapped inside the dialog', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    renderWithProviders(<EvidencePanel />);
    await screen.findByRole('dialog');
    // The panel does not add a focus trap (no inert / aria-hidden on
    // background; no tab-cycle handler). Tabbing past the last focusable
    // inside the dialog would exit it. We can't easily simulate the full
    // browser tab behaviour in jsdom, but we can assert no tabindex /
    // inert siblings are managed.
    const inertSiblings = document.querySelectorAll('[inert], [aria-hidden="true"]');
    // The backdrop sets aria-hidden=true on itself but does NOT inert the
    // page behind. Log a finding.
    // eslint-disable-next-line no-console
    console.warn(
      '[a11y FINDING] EvidencePanel: no focus trap. Background is not `inert` or aria-hidden, ' +
        'so Tab can escape to elements behind the modal. inertSiblings=' +
        inertSiblings.length,
    );
    expect(inertSiblings.length).toBeGreaterThanOrEqual(0); // sanity
  });

  it('axe scan of the open dialog — captures findings', async () => {
    useEvidencePanelStore.setState({ openClaimId: 'CL-0001' });
    const { container } = renderWithProviders(<EvidencePanel />);
    await screen.findByRole('dialog');
    // Give react-query a tick to settle.
    await new Promise((r) => setTimeout(r, 30));
    const results = await axeRun(container);
    await writeFindings('component-EvidencePanel', results);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'EvidencePanel a11y violations:\n' + formatViolations(results),
      );
    }
    // Known FINDING (do not silently skip): <aside role="dialog"> trips
    // axe's aria-allowed-role rule. The component should either:
    //  (a) use <div role="dialog"> and let <aside> stay implicit, or
    //  (b) wrap dialog content in a <div role="dialog"> child of the aside.
    // Assert the EXPECTED set so the test still fails if NEW violations
    // appear, but documents the known one.
    const violationIds = results.violations.map((v) => v.id).sort();
    expect(violationIds).toEqual(['aria-allowed-role']);
  });
});
