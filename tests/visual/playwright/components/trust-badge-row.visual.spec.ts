/**
 * TrustBadgeRow — three baselines, one per tier (T1, T2, T3).
 *
 * The mock chat stream emits three citations (CL-0001 T1, CL-0002 T2,
 * CL-0003 T3) so a single chat exchange surfaces all three tiers inside
 * the CitationList below the assistant message. We scope each screenshot
 * to the row inside the matching CitationCard.
 *
 * Recency labels are deterministic: Date is frozen at FROZEN_NOW_ISO in
 * `_helpers.stabilize`, and source dates in the mock are picked so the
 * rendered "Xd / Xw / Xmo ago" string is fixed.
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

async function gotoChatWithThreeCitations(page: import('@playwright/test').Page) {
  await signInAndPickProduct(page);
  await page.getByRole('button', { name: /onboarding pain points/i }).click();
  // Wait for the last citation chip — guarantees all three citation cards
  // are mounted below the bubble.
  await page.getByRole('button', { name: /CL-0003/i }).first().waitFor();
  await waitForCalm(page);
}

// CitationCard renders an outer role="button" with the claim id as the
// first text node. We can locate by that text and screenshot the card.
async function cardFor(page: import('@playwright/test').Page, id: string) {
  // The CitationList renders a clickable div containing the claim id and
  // the badges. Filter on the id text to find the right card.
  return page
    .locator('div[role="button"]')
    .filter({ hasText: id })
    .first();
}

test('trust badge — T1 (CL-0001)', async ({ page }) => {
  await gotoChatWithThreeCitations(page);
  const card = await cardFor(page, 'CL-0001');
  await expect(card).toHaveScreenshot('trust-badge-T1.png');
});

test('trust badge — T2 (CL-0002)', async ({ page }) => {
  await gotoChatWithThreeCitations(page);
  const card = await cardFor(page, 'CL-0002');
  await expect(card).toHaveScreenshot('trust-badge-T2.png');
});

test('trust badge — T3 (CL-0003)', async ({ page }) => {
  await gotoChatWithThreeCitations(page);
  const card = await cardFor(page, 'CL-0003');
  await expect(card).toHaveScreenshot('trust-badge-T3.png');
});
