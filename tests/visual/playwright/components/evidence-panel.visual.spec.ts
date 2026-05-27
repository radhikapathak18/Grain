/**
 * EvidencePanel — open state, captured as a locator screenshot scoped to
 * the dialog only (so we don't double-cover this with the /chat panel-open
 * baseline; that one captures the panel-against-content composition).
 *
 * The translate-x slide-in animation is disabled by `waitForCalm`'s CSS.
 * Panel position is therefore fixed at translate-x-0.
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

test('evidence panel — open with claim CL-0001', async ({ page }) => {
  await signInAndPickProduct(page);
  await page.getByRole('button', { name: /onboarding pain points/i }).click();
  const chip = page.getByRole('button', { name: /CL-0001/i }).first();
  await chip.waitFor();
  await chip.click();
  const panel = page.getByRole('dialog', { name: /evidence panel/i });
  await panel.waitFor();
  // Wait for the claim text inside the panel — that's the last network
  // round-trip (useClaim hook).
  await panel.getByText(/three weeks longer/i).waitFor();
  await waitForCalm(page);
  await expect(panel).toHaveScreenshot('evidence-panel-open.png');
});
