import { test, expect } from '@playwright/test';
import { installApiMocks, fixtures } from './mock-api';

/**
 * Cross-browser smoke flow for the Grain demo path.
 *
 * Runs identically against chromium / firefox / webkit. The point is NOT
 * to exhaustively cover behavior — that's the e2e-agent's job. We only
 * verify that the SSE pipeline boots and the critical journey completes
 * end-to-end in each engine.
 *
 * Flow (matches CR §"Smoke flow"):
 *  1. /login renders email + role inputs.
 *  2. Login as isathe@perforce.com → /select.
 *  3. Confirm products → /chat.
 *  4. Ask a one-word question → at least one delta + done reach the DOM.
 *  5. Click first citation chip → evidence panel opens.
 *  6. Close panel → no console errors.
 */
test.describe('cross-browser smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('login → select → ask → cite → evidence → close', async ({
    page,
    browserName,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // 1. /login renders.
    await page.goto('/login');
    const emailInput = page.getByLabel(/work email/i);
    const roleSelect = page.getByLabel(/^role$/i);
    await expect(emailInput).toBeVisible();
    await expect(roleSelect).toBeVisible();

    // 2. Login → /select.
    await emailInput.fill(fixtures.USER.email);
    await roleSelect.selectOption('researcher');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/select$/);

    // 3. Confirm products → /chat. The product chips are role="checkbox".
    const helixCore = page.getByRole('checkbox', { name: /helix core/i });
    await expect(helixCore).toBeVisible();
    await helixCore.click();
    await expect(helixCore).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/chat$/);

    // 4. Ask a one-word question — exercises the SSE pipeline.
    //    The MessageInput is a textarea; we type and press Enter.
    const input = page.getByRole('textbox');
    await expect(input).toBeVisible();
    await input.fill('onboarding');
    await input.press('Enter');

    // First delta must land in the DOM (proves event:delta parsing works).
    await expect(
      page.getByText(/onboarding pain is well-documented/i),
    ).toBeVisible({ timeout: 10_000 });
    // Second delta must also land — proves multi-block SSE parsing works
    // and the buffer-split-on-\n\n state machine handles >1 event.
    await expect(page.getByText(/in helix core/i)).toBeVisible({
      timeout: 10_000,
    });

    // 5. Click the first citation chip → evidence panel opens.
    //    The chip renders as a <button> containing the claim id in mono font.
    const citationChip = page
      .getByRole('button', { name: new RegExp(fixtures.CLAIM.id, 'i') })
      .first();
    await expect(citationChip).toBeVisible({ timeout: 10_000 });
    await citationChip.click();

    const panel = page.getByRole('dialog', { name: /evidence panel/i });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(/helix core onboarding takes weeks longer/i),
    ).toBeVisible();

    // 6. Close panel — by clicking the close button. ESC works too, but the
    //    close button is the demoed path. After close, no console errors
    //    should have accumulated from the whole flow.
    await panel.getByRole('button', { name: /close evidence panel/i }).click();
    await expect(panel).toBeHidden();

    // Allow Tailwind/HMR noise from the dev server but flag real errors.
    const realErrors = consoleErrors.filter(
      (e) =>
        !/\[vite\]/i.test(e) &&
        !/sourcemap/i.test(e) &&
        !/Failed to load resource/i.test(e),
    );
    expect(realErrors, `${browserName} console errors: ${realErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `${browserName} pageerrors`).toEqual([]);
  });
});
