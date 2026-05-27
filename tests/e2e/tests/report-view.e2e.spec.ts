import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { ReportPage } from '../pages/ReportPage';

/**
 * Journey 6 — Report view
 *
 *   Navigate to /report. ThemeCards + emerging issues render. Each
 *   theme card carries citation chips that, when clicked, open the
 *   shared EvidencePanel slide-over.
 */

test('report view renders themes + emerging issues + citation chips', async ({ page }) => {
  await signInAsResearcher(page);
  const report = new ReportPage(page);
  await report.goto();

  // Header period label is a paragraph under the H1.
  await expect(report.heading).toBeVisible();

  // Top themes heading + at least one theme card.
  await expect(page.getByRole('heading', { name: /top themes/i })).toBeVisible();
  await expect.poll(() => report.themeCards().count()).toBeGreaterThan(0);

  // Emerging issues section header is present (the list itself may be
  // empty in some fixtures — the heading is the demo signal).
  await expect(report.emergingSection()).toBeVisible();

  // At least one citation chip exists somewhere on the page.
  await expect.poll(() => report.citationChips().count()).toBeGreaterThan(0);

  // Click the first one; evidence panel opens with the right claim id.
  const firstChipText = await report.citationChips().first().innerText();
  const claimId = firstChipText.match(/CL-\d{4}/)?.[0] ?? '';
  expect(claimId).toMatch(/^CL-\d{4}$/);

  await report.citationChips().first().click();
  await expect(report.evidencePanel).toBeVisible();
  await expect(report.evidencePanel.locator('header').getByText(claimId)).toBeVisible();
});
