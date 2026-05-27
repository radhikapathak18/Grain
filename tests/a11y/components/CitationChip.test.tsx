/**
 * CitationChip — interactive `[CL-NNNN]` pill that opens the evidence panel.
 *
 * a11y contract:
 *  - must be a real <button> (not a div with onClick)
 *  - must have an accessible name that identifies the claim
 *  - must be keyboard-focusable and Enter/Space activatable
 *  - must pass axe with zero violations
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { CitationChip } from '../../../apps/web/src/components/CitationChip';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations } from '../lib/axe';

describe('CitationChip — a11y', () => {
  it('renders as a real button element', () => {
    renderWithProviders(<CitationChip claimId="CL-0001" />);
    const chip = screen.getByRole('button');
    expect(chip).toBeInTheDocument();
    expect(chip.tagName).toBe('BUTTON');
  });

  it('has the claim id as part of its accessible name', () => {
    renderWithProviders(<CitationChip claimId="CL-0042" />);
    const chip = screen.getByRole('button');
    // No data fetched yet → accessible name should still contain the id (it's
    // in the rendered text + title tooltip).
    expect(chip).toHaveAccessibleName(/CL-0042/);
  });

  it('is in the natural tab order (no tabindex="-1")', () => {
    renderWithProviders(<CitationChip claimId="CL-0001" />);
    const chip = screen.getByRole('button');
    // Default <button> tabIndex is 0. Verify nothing overrode it negatively.
    expect(chip.getAttribute('tabindex')).not.toBe('-1');
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<CitationChip claimId="CL-0001" />);
    const results = await axeRun(container);
    if (results.violations.length > 0) {
      console.warn(
        'CitationChip a11y violations:\n' + formatViolations(results),
      );
    }
    expect(results).toHaveNoViolations();
  });
});
