/**
 * /login — baseline screenshots.
 *
 * Two states:
 *   1. Initial render (no email typed beyond the dev pre-fill, no error).
 *   2. With an explicit email value typed in (caret is hidden via the
 *      `caret-color: transparent` stability stylesheet, so the input bar
 *      paints identically every run).
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm } from '../_helpers';

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

test('/login — initial state', async ({ page }) => {
  await page.goto('/login');
  await waitForCalm(page);
  // Wait for the form's title to render so we screenshot a settled DOM.
  await page.getByRole('heading', { name: 'Grain' }).waitFor();
  await expect(page).toHaveScreenshot('login-initial.png', { fullPage: true });
});

test('/login — email entered', async ({ page }) => {
  await page.goto('/login');
  await waitForCalm(page);
  const email = page.getByLabel(/work email/i);
  await email.fill('visual@perforce.test');
  // Blur the input so no caret/focus-ring nondeterminism leaks in.
  await page.getByRole('heading', { name: 'Grain' }).click({ position: { x: 1, y: 1 } });
  await expect(page).toHaveScreenshot('login-email-entered.png', { fullPage: true });
});
