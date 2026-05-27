import { test, expect } from '@playwright/test';
import { installApiMocks, fixtures } from './mock-api';

/**
 * Firefox-specific spec: confirm zustand `persist` survives reload.
 *
 * Background: session.ts uses zustand/middleware persist with key
 * `grain.session`. `history` is excluded from persistence by design,
 * but user / selectedProducts / productsConfirmed must survive reload
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
    // history is deliberately excluded from partialize().
    expect(parsed.state?.history).toBeUndefined();

    // Ask a question so there's something in history (which must NOT
    // persist) — proves the partialize whitelist works.
    const input = page.getByRole('textbox');
    await input.fill('onboarding');
    await input.press('Enter');
    await expect(
      page.getByText(/onboarding pain is well-documented/i),
    ).toBeVisible({ timeout: 10_000 });

    // Reload. Auth guard chain should let us stay on /chat.
    await page.reload();
    await expect(page).toHaveURL(/\/chat$/);

    // The example-prompt hero appears when history is empty — confirms
    // history was NOT restored (by design).
    await expect(
      page.getByRole('heading', { name: /ask grain anything/i }),
    ).toBeVisible();
  });
});
