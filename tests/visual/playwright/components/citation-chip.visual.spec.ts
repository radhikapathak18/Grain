/**
 * CitationChip — three states captured at the component level via locator
 * screenshots:
 *   1. Closed (default).
 *   2. Hover.
 *   3. After click — but rather than re-screenshot the chip in its open
 *      state, we screenshot the opened EvidencePanel (see evidence-panel
 *      spec). Here we only diff the chip rest + hover.
 *
 * We deliberately use the chip *inside* the chat message bubble rather
 * than synthesizing a standalone harness page — that keeps the test in
 * sync with the real visual context (border-color, accent-subtle bg).
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

async function gotoChipInChat(page: import('@playwright/test').Page) {
  await signInAndPickProduct(page);
  await page.getByRole('button', { name: /onboarding pain points/i }).click();
  const chip = page.getByRole('button', { name: /CL-0001/i }).first();
  await chip.waitFor();
  await waitForCalm(page);
  return chip;
}

test('citation chip — rest', async ({ page }) => {
  const chip = await gotoChipInChat(page);
  await expect(chip).toHaveScreenshot('citation-chip-rest.png');
});

test('citation chip — hover', async ({ page }) => {
  const chip = await gotoChipInChat(page);
  await chip.hover();
  // Hover-induced background transition is killed by waitForCalm's CSS,
  // so the hover state is paint-stable as soon as the pointer lands.
  await waitForCalm(page);
  await expect(chip).toHaveScreenshot('citation-chip-hover.png');
});
