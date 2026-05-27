import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for /chat.
 *
 * Notable DOM facts (see apps/web/src/views/ChatView.tsx + components):
 *   - MessageInput is the only <textarea> on the page.
 *   - Send button is `[aria-label="Send message"]`. Disabled while
 *     streaming OR while the textarea is empty/whitespace.
 *   - Assistant bubbles render their text inside a `<p>` inside the
 *     bubble container. Inline `[CL-NNNN]` markers become `<button>`s
 *     with a font-mono span — the CitationChip component. We expose
 *     `citationChips()` to count them per-bubble.
 *   - EvidencePanel mounts as `role="dialog"` aria-label "Evidence panel".
 *   - The role switcher button lives in AppHeader and exposes the
 *     current role as its text content.
 */
export class ChatPage {
  readonly page: Page;
  readonly textarea: Locator;
  readonly sendButton: Locator;
  readonly evidencePanel: Locator;
  readonly closePanelButton: Locator;
  readonly streamError: Locator;
  readonly roleButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.textarea = page.locator('textarea');
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.evidencePanel = page.getByRole('dialog', { name: /evidence panel/i });
    this.closePanelButton = page.getByRole('button', { name: /close evidence panel/i });
    this.streamError = page.locator('[role="alert"]');
    // The role button is the only button containing the role label text
    // inside the AppHeader. We grab by aria-expanded toggle role.
    this.roleButton = page.locator('header button[aria-expanded]');
  }

  async goto() {
    await this.page.goto('/chat');
    await expect(this.textarea).toBeVisible();
  }

  async send(question: string) {
    await this.textarea.fill(question);
    // Enter is the canonical submit affordance, but click is equally
    // valid and more explicit. We click so the assertion is unambiguous.
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
  }

  /** Returns the locator for the Nth (0-indexed) assistant bubble. */
  assistantBubble(index = 0): Locator {
    return this.page
      .locator('[data-testid="assistant-bubble"], .bg-surface.text-fg.border')
      .nth(index);
  }

  /**
   * Locator for the latest assistant bubble's text container.
   *
   * The bubble has no test id; we identify it as the last bubble that
   * does NOT have the user-bubble accent classes. Use the
   * `[role="presentation"]`-free fallback: pick the last bubble whose
   * parent column is left-aligned (`items-start`).
   */
  latestAssistantText(): Locator {
    return this.page.locator('div.items-start > div.bg-surface p').last();
  }

  /** All citation chip buttons in the chat (across all bubbles). */
  citationChips(): Locator {
    // CitationChip renders a button with a font-mono CL-NNNN span. We
    // match by the visible CL-NNNN text rather than relying on classes.
    return this.page.getByRole('button').filter({ hasText: /^CL-\d{4}/ });
  }

  /** Number of citation chips in the page. */
  async citationCount(): Promise<number> {
    return this.citationChips().count();
  }

  async openFirstCitation() {
    await this.citationChips().first().click();
    await expect(this.evidencePanel).toBeVisible();
  }

  async closePanel() {
    await this.closePanelButton.click();
    await expect(this.evidencePanel).toBeHidden();
  }

  /** Open the role-switch dropdown and pick a role by visible label. */
  async switchRole(label: string | RegExp) {
    await this.roleButton.click();
    await this.page.getByRole('button', { name: label }).click();
  }

  /**
   * Wait for the assistant's streaming to settle. We treat streaming as
   * settled once the send button is enabled again — useChatStream
   * disables the input via `disabled={streaming}` prop on MessageInput.
   */
  async waitForStreamSettled(timeout = 20_000) {
    await expect(this.sendButton).toBeEnabled({ timeout });
  }
}
