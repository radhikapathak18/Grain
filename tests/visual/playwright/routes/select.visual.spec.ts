/**
 * /select — product selection screen.
 *
 * Two baseline states: empty selection (initial), and after picking
 * Helix Core (button label flips to "Continue (1 selected)").
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm } from '../_helpers';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await waitForCalm(page);
  await page.getByLabel(/work email/i).fill('visual@perforce.test');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/select$/);
  await waitForCalm(page);
}

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

test('/select — initial', async ({ page }) => {
  await signIn(page);
  await page.getByRole('heading', { name: /which products/i }).waitFor();
  await expect(page).toHaveScreenshot('select-initial.png', { fullPage: true });
});

test('/select — with helix-core selected', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  // Confirm the "Continue (1 selected)" label has rendered.
  await page.getByRole('button', { name: /continue \(1 selected\)/i }).waitFor();
  await expect(page).toHaveScreenshot('select-one-picked.png', { fullPage: true });
});
