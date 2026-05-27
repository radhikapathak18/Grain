import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { ChatPage } from '../pages/ChatPage';

/**
 * Journey 7 — Persisted session
 *
 *   Login → confirm products → ask a question → reload page. The user
 *   record + product selection MUST survive (Zustand persist with
 *   localStorage key `grain.session`). History MUST NOT (it is excluded
 *   via the `partialize` config in apps/web/src/state/session.ts).
 *
 *   This is asserted via UI: after reload, the chat textarea is
 *   visible (so we are still authed) and the message list is empty.
 */

test('persisted session survives reload, history does not', async ({ page }) => {
  await signInAsResearcher(page);

  const chat = new ChatPage(page);
  await chat.send('A question whose answer must not survive reload.');
  await chat.waitForStreamSettled();

  const beforeBubbles = await page.locator('div.items-start > div.bg-surface p').count();
  expect(beforeBubbles).toBeGreaterThan(0);

  // Reload — Zustand persist rehydrates user + products + flags.
  await page.reload();

  // Still on /chat (not bounced to /login or /select).
  await expect(page).toHaveURL(/\/chat$/);
  // Header is rendered (AppHeader returns null when user is missing).
  await expect(page.getByRole('link', { name: 'Grain' })).toBeVisible();
  // Empty hero is back because history is intentionally not persisted.
  await expect(page.getByRole('heading', { name: /ask grain anything/i })).toBeVisible();

  // No assistant bubbles after reload.
  await expect(page.locator('div.items-start > div.bg-surface p')).toHaveCount(0);
});
