/**
 * ThemeCard — locator screenshot scoped to one card on the /report view.
 * Catches frequency-bar fill ratio, trend icon, and per-product mini-count
 * layout regressions without the rest of the page contributing noise.
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

test('theme card — "Onboarding friction" (trend up)', async ({ page }) => {
  await signInAndPickProduct(page);
  await page.goto('/report');
  await waitForCalm(page);
  // article elements render each theme card.
  const card = page.locator('article').filter({ hasText: 'Onboarding friction' }).first();
  await card.waitFor();
  await waitForCalm(page);
  await expect(card).toHaveScreenshot('theme-card-onboarding.png');
});

test('theme card — "View spec churn" (trend flat)', async ({ page }) => {
  await signInAndPickProduct(page);
  await page.goto('/report');
  await waitForCalm(page);
  const card = page.locator('article').filter({ hasText: 'View spec churn' }).first();
  await card.waitFor();
  await waitForCalm(page);
  await expect(card).toHaveScreenshot('theme-card-view-spec.png');
});
