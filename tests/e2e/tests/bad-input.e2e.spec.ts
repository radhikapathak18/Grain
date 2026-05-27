import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { ChatPage } from '../pages/ChatPage';

/**
 * Journey 9 — Bad input
 *
 *   Empty (or whitespace-only) textarea content must NOT trigger a
 *   network request. MessageInput.tsx gates submission on `trimmed.
 *   length > 0` and disables the send button accordingly.
 */

test('empty input keeps send button disabled, fires no request', async ({ page }) => {
  await signInAsResearcher(page);
  const chat = new ChatPage(page);

  // Capture POST /api/chat/stream calls; we expect zero during this test.
  const streamCalls: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/chat/stream')) {
      streamCalls.push(req.url());
    }
  });

  await expect(chat.sendButton).toBeDisabled();

  // Type whitespace; still disabled.
  await chat.textarea.fill('   \n   ');
  await expect(chat.sendButton).toBeDisabled();

  // Try Enter while the textarea is whitespace-only: MessageInput's
  // submit() short-circuits on `!canSubmit`.
  await chat.textarea.press('Enter');

  // Real content enables the button.
  await chat.textarea.fill('   real question   ');
  await expect(chat.sendButton).toBeEnabled();

  expect(streamCalls).toHaveLength(0);
});
