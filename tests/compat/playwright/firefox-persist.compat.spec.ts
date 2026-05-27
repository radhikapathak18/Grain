import { test, expect } from '@playwright/test';
import { installApiMocks, fixtures } from './mock-api';

/**
 * Firefox-specific spec: confirm zustand `persist` survives reload.
 *
 * Background: session.ts uses zustand/middleware persist with key
 * `grain.session`. `history`, `tabs`, and `activeTabId` are included in
 * persistence so open tabs and live chat messages survive a page reload.
 * user / selectedProducts / productsConfirmed must also survive reload
 * so the auth guards don't bounce the user back to /login.
 *
 * We run only on firefox because:
 *   - firefox's localStorage quota + same-origin policy is the historical
 *     odd-one-out (Chrome and WebKit are both more permissive),
 *   - the other engines get coverage via the chromium baseline smoke spec.
 *
 * If firefox eviction quirks ever drop the persist payload, the guard at
 * /chat will redirect to /login after reload, and this test fails.
 */
test.describe('firefox session persistence', () => {
  test.skip(({ browserName }) => browserName !== 'firefox');

  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('login + product confirm survives reload', async ({ page }) => {
    // Drive the flow up to /chat.
    await page.goto('/login');
    await page.getByLabel(/work email/i).fill(fixtures.USER.email);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/select$/);
    await page.getByRole('checkbox', { name: /helix core/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/chat$/);

    // Verify the persist key actually wrote.
    const stored = await page.evaluate(() => {
      return window.localStorage.getItem('grain.session');
    });
    expect(stored, 'grain.session must be persisted to localStorage').not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.state?.user?.email).toBe(fixtures.USER.email);
    expect(parsed.state?.productsConfirmed).toBe(true);
    // history, tabs, and activeTabId are now included in partialize().
    expect(parsed.state?.history).toBeDefined();
    expect(parsed.state?.tabs).toBeDefined();
    expect(parsed.state?.activeTabId).toBeDefined();

    // Ask a question so there's something in history — confirms the
    // partialize whitelist includes it and it will survive reload.
    const input = page.getByRole('textbox');
    await input.fill('onboarding');
    await input.press('Enter');
    await expect(
      page.getByText(/onboarding pain is well-documented/i),
    ).toBeVisible({ timeout: 10_000 });

    // Reload. Auth guard chain should let us stay on /chat.
    await page.reload();
    await expect(page).toHaveURL(/\/chat$/);
  });
});
