import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { ChatPage } from '../pages/ChatPage';

/**
 * Journey 7 — Persisted session
 *
 *   Login → confirm products → ask a question → reload page. The user
 *   record, product selection, open tabs, and live chat history MUST all
 *   survive (Zustand persist with localStorage key `grain.session`).
 *   `tabs`, `activeTabId`, and `history` are included in the `partialize`
 *   config in apps/web/src/state/session.ts.
 *
 *   This is asserted via UI: after reload the chat textarea is visible
 *   (so we are still authed) and the assistant response is still shown.
 */

test('persisted session survives reload, including history', async ({ page }) => {
  await signInAsResearcher(page);

  const chat = new ChatPage(page);
  await chat.send('A question whose answer must survive reload.');
  await chat.waitForStreamSettled();

  const beforeBubbles = await page.locator('div.items-start > div.bg-surface p').count();
  expect(beforeBubbles).toBeGreaterThan(0);

  // Reload — Zustand persist rehydrates user + products + flags + history + tabs.
  await page.reload();

  // Still on /chat (not bounced to /login or /select).
  await expect(page).toHaveURL(/\/chat$/);
  // Header is rendered (AppHeader returns null when user is missing).
  await expect(page.getByRole('link', { name: 'Grain' })).toBeVisible();
  // Empty hero must NOT be visible — history was restored from localStorage.
  await expect(page.getByRole('heading', { name: /ask grain anything/i })).not.toBeVisible();

  // Assistant bubbles must still be present after reload.
  await expect(page.locator('div.items-start > div.bg-surface p')).not.toHaveCount(0);
});
