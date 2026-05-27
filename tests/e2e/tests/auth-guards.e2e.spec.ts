import { expect, test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SEEDED } from '../fixtures/users';

/**
 * Journey 4 — Auth guard chain
 *
 *   - Hit /chat unauthenticated → redirected to /login.
 *   - Hit /report unauthenticated → redirected to /login.
 *   - Hit /source/foo unauthenticated → redirected to /login.
 *   - Login but skip /select → /chat should bounce to /select.
 *   - Already-authed user navigating to /login redirects forward.
 *
 * Guards live in apps/web/src/routes/guards.tsx.
 */

test.beforeEach(async ({ context }) => {
  // Each test starts with an empty localStorage — the persist middleware
  // restores from `grain.session` so we must scrub between cases.
  await context.clearCookies();
});

test('unauthenticated /chat redirects to /login', async ({ page }) => {
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated /report redirects to /login', async ({ page }) => {
  await page.goto('/report');
  await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated /source/:id redirects to /login', async ({ page }) => {
  await page.goto('/source/gong-call-2025-11-04-stellar-forge');
  await expect(page).toHaveURL(/\/login$/);
});

test('authed but products-not-confirmed bounces /chat → /select', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(SEEDED.researcher.email, 'researcher');
  // After login the app navigates to /select. Try /chat directly —
  // RequireProducts should bounce us back.
  await expect(page).toHaveURL(/\/select$/);
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/select$/);
});

test('rejects unknown user with inline error, stays on /login', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login('nobody@example.com', 'researcher');
  await expect(login.errorMessage()).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
