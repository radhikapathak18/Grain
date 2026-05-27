// Synthetic probe — end-to-end happy path.
//
// What it proves (the most load-bearing check we have):
//   1. The web app is reachable at $GRAIN_PROD_URL and renders /login.
//   2. The seeded synthetic user can authenticate against the API.
//   3. Product selection persists into chat state.
//   4. POST /api/chat/stream returns an SSE stream that yields
//      `delta` events AND `[CL-NNNN]` citation markers — i.e. the
//      Claude CLI subprocess on the prod server is alive and the
//      retrieval pipeline is wired through.
//   5. The citation chip → EvidencePanel flow opens correctly.
//
// Why this is the canary check for an AI app: the Claude CLI
// subprocess can fail SILENTLY (binary missing, model deprecated,
// auth rotated, idle timeout misconfigured) without anything else
// going wrong. The API will keep responding 200 to /health, the
// web build keeps serving — but `/chat/stream` never emits a
// `delta`. This probe is the only thing that detects that class
// of failure before a user does.
//
// Selectors borrowed from `tests/e2e/pages/*.ts` — see attribution
// in the helpers below. Post-prod-deploy we should factor the
// Page Objects into a shared workspace package so this duplication
// goes away.

import { expect, test } from '@playwright/test';

const WEB_URL = process.env.GRAIN_PROD_URL ?? 'http://localhost:5173';
const USER_EMAIL = process.env.GRAIN_SYNTHETIC_USER_EMAIL ?? '';
const USER_ROLE =
  (process.env.GRAIN_SYNTHETIC_USER_ROLE as 'researcher' | 'pm' | 'designer' | 'engineer') ??
  'researcher';

test.skip(!USER_EMAIL, 'GRAIN_SYNTHETIC_USER_EMAIL not set — probe is dormant');

test('login → select → ask → citation → evidence panel', async ({ page }) => {
  // ── /login (selectors: tests/e2e/pages/LoginPage.ts)
  await page.goto(`${WEB_URL}/login`);
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill('');
  await emailInput.fill(USER_EMAIL);
  await page.locator('select').selectOption(USER_ROLE);
  await page.getByRole('button', { name: /sign in/i }).click();

  // ── /select (selectors: tests/e2e/pages/ProductSelectPage.ts)
  await expect(page).toHaveURL(/\/select$/, { timeout: 10_000 });
  const productGroup = page.getByRole('group', { name: /products/i });
  await expect(productGroup).toBeVisible();
  const checked = await page.locator('[role="checkbox"][aria-checked="true"]').count();
  if (checked === 0) {
    await page.locator('[role="checkbox"]').first().click();
  }
  await page.getByRole('button', { name: /continue/i }).click();

  // ── /chat (selectors: tests/e2e/pages/ChatPage.ts)
  await expect(page).toHaveURL(/\/chat$/, { timeout: 10_000 });
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill('what are top pain points?');
  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  // Wait for the FIRST delta to arrive. The assistant bubble's <p>
  // becomes non-empty once `delta` events start landing — this is
  // the moment that proves the SSE → CLI → render chain works.
  const assistantText = page.locator('div.items-start > div.bg-surface p').last();
  await expect(assistantText).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => (await assistantText.innerText()).trim().length, { timeout: 20_000 })
    .toBeGreaterThan(0);

  // Wait for the stream to settle (send button re-enables when done).
  await expect(sendButton).toBeEnabled({ timeout: 60_000 });

  // ── Citation chip → evidence panel
  const citationChips = page.getByRole('button').filter({ hasText: /^CL-\d{4}/ });
  await expect.poll(() => citationChips.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  await citationChips.first().click();
  const evidencePanel = page.getByRole('dialog', { name: /evidence panel/i });
  await expect(evidencePanel).toBeVisible({ timeout: 5_000 });
  await expect(evidencePanel.locator('header').getByText(/^CL-\d{4}$/)).toBeVisible();
});
