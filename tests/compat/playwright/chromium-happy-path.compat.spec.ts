import { test, expect } from '@playwright/test';
import { installApiMocks, fixtures } from './mock-api';

/**
 * Chromium baseline: full happy-path including role-switch and re-ask.
 *
 * Critical user journey #1 from MODULE_MAP.md:
 *   Login → Select products → Ask Explore question → Watch stream →
 *   Click citation → See evidence → Close → Switch role → Ask same
 *   question → Notice different framing.
 *
 * We run this only on chromium because:
 *   - it's the engine that's most likely to match what the demo audience
 *     sees (Chrome share dominates internal Perforce machines),
 *   - the other engines get coverage via the shared smoke spec,
 *   - role-switch is a session.ts mutation that's engine-agnostic.
 */
test.describe('chromium happy-path baseline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('ask → cite → close → switch role → re-ask', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/work email/i).fill(fixtures.USER.email);
    await page.getByLabel(/^role$/i).selectOption('researcher');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/select$/);

    await page.getByRole('checkbox', { name: /helix core/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/chat$/);

    // First ask, as researcher.
    const input = page.getByRole('textbox');
    await input.fill('onboarding');
    await input.press('Enter');
    await expect(
      page.getByText(/onboarding pain is well-documented/i),
    ).toBeVisible({ timeout: 10_000 });

    // Open + close citation panel.
    await page
      .getByRole('button', { name: new RegExp(fixtures.CLAIM.id, 'i') })
      .first()
      .click();
    const panel = page.getByRole('dialog', { name: /evidence panel/i });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /close evidence panel/i }).click();
    await expect(panel).toBeHidden();

    // Switch role via the header dropdown — picks "PM".
    await page
      .getByRole('button', { name: /researcher/i, exact: false })
      .first()
      .click();
    await page.getByRole('button', { name: /^pm$/i }).click();
    // Header should now reflect PM.
    await expect(
      page.getByRole('button', { name: /^pm$/i }).first(),
    ).toBeVisible();

    // Re-ask the same question — exercises that streaming works after a
    // role change and that a new user/assistant message pair is appended.
    await input.fill('onboarding');
    await input.press('Enter');

    // Two assistant messages now exist; the latest must show the streamed
    // text again. We assert on getByText with .nth(1) to confirm a second
    // occurrence appears (i.e., new message rendered, not the same DOM).
    const matches = page.getByText(/onboarding pain is well-documented/i);
    await expect(matches).toHaveCount(2, { timeout: 10_000 });
  });
});
