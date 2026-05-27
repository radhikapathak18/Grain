/**
 * /report — monthly synthesis. Single baseline: fully-loaded report with
 * two theme cards + one emerging issue. The mock pins `periodLabel` to
 * "April 2026" and `generatedAt` to a fixed ISO so all text is stable.
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

test('/report — initial render', async ({ page }) => {
  await signInAndPickProduct(page);
  await page.goto('/report');
  await waitForCalm(page);
  // Wait for the period label — it's the last text to settle after loading.
  await page.getByText(/april 2026/i).waitFor();
  // Theme card title also paints late.
  await page.getByText(/onboarding friction/i).waitFor();
  await expect(page).toHaveScreenshot('report-initial.png', { fullPage: true });
});
