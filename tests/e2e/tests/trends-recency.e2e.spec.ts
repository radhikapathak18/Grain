import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { ChatPage } from '../pages/ChatPage';

/**
 * Journey 8 — Trends shape recency
 *
 *   The `trends` shape filters retrieval to claims with
 *   most_recent_evidence_at within the last 12 months (retrieval.ts
 *   TRENDS_WINDOW_MONTHS). The UI surfaces evidence dates via
 *   relativeDate() inside EvidenceItem (apps/web/src/components/
 *   EvidenceItem.tsx). We assert every visible evidence row in the
 *   panel for a trends answer renders a recent date — never older than
 *   "24mo ago" (the threshold relativeDate() uses before flipping to
 *   "Xy ago"), and never a "y ago" suffix.
 */

test('trends shape: evidence dates in the panel are within ~12 months', async ({ page }) => {
  await signInAsResearcher(page);
  const chat = new ChatPage(page);

  // Switch to trends shape via the QuestionShapeSelector pill.
  await page.getByRole('button', { name: /^Trends$/i }).click();

  await chat.send('How has CLI feedback shifted over the last 6 months?');
  await chat.waitForStreamSettled();

  // Open the first citation and inspect the rendered evidence rows.
  await chat.openFirstCitation();
  const dateLabels = chat.evidencePanel.locator('.text-xs.text-muted');
  const count = await dateLabels.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const txt = (await dateLabels.nth(i).innerText()).toLowerCase();
    // We accept relative formats: "today", "Xd ago", "Xw ago", "Xmo ago".
    // We REJECT "Xy ago" — that would be a recency violation.
    expect(txt).not.toMatch(/\b\d+y ago\b/);
  }
});
