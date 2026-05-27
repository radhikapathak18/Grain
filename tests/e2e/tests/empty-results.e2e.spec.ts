import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { ChatPage } from '../pages/ChatPage';
import { MOCK_TRIGGERS } from '../fixtures/users';

/**
 * Journey 2 — Empty results
 *
 *   Send a `verify`-shape question full of gibberish so retrieval can't
 *   match any claims. The chat route's no-claims branch should emit a
 *   single empty-message delta + done, and the UI should render a
 *   polite bubble with zero citation chips.
 *
 *   Note: We trigger TWO independent empty paths in one assertion-rich
 *   test:
 *     a) Real route behavior: retrieval returns 0 matches for "verify"
 *        shape against gibberish keywords → polite empty bubble.
 *     b) Mock-claude shim sees the gibberish marker → emits an honest
 *        "I do not have enough relevant research" string (only hit if
 *        the route's retrieval somehow finds claims; defensive).
 */

test('empty results: gibberish verify question yields zero citations', async ({ page }) => {
  await signInAsResearcher(page);
  const chat = new ChatPage(page);

  // Switch to the verify shape (filter is applied to retrieval). The
  // shape selector lives below the input — buttons labelled "Verify".
  await page.getByRole('button', { name: /^Verify$/ }).click();

  await chat.send(MOCK_TRIGGERS.gibberish);
  await chat.waitForStreamSettled();

  const text = (await chat.latestAssistantText().innerText()).trim();
  // At least *some* text must render — either the route's empty-state
  // message or the mock's "no research" line.
  expect(text.length).toBeGreaterThan(10);

  // Zero citation chips.
  await expect(chat.citationChips()).toHaveCount(0);

  // No stream error surfaced.
  await expect(chat.streamError).toHaveCount(0);
});
