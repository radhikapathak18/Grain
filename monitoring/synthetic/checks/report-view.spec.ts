// Synthetic probe — Monthly report view.
//
// Proves:
//   - /report renders the MonthlyReport fixture (theme cards,
//     emerging issues, citation chips).
//   - The citation chip → evidence panel hand-off still works
//     OUTSIDE the chat surface (it's a separate Zustand store —
//     see apps/web/src/state/evidencePanel.ts).
//
// This is a lighter check than login-and-ask: no SSE, no Claude
// CLI. It's here so we detect "report shell broke after a deploy
// that didn't touch chat" cases quickly.
//
// Selectors borrowed from `tests/e2e/pages/ReportPage.ts`.

import { expect, test } from '@playwright/test';

const WEB_URL = process.env.GRAIN_PROD_URL ?? 'http://localhost:5173';
const USER_EMAIL = process.env.GRAIN_SYNTHETIC_USER_EMAIL ?? '';
const USER_ROLE =
  (process.env.GRAIN_SYNTHETIC_USER_ROLE as 'researcher' | 'pm' | 'designer' | 'engineer') ??
  'researcher';

test.skip(!USER_EMAIL, 'GRAIN_SYNTHETIC_USER_EMAIL not set — probe is dormant');

test('report view: theme cards + citation panel', async ({ page }) => {
  // Login (RequireSession guard would otherwise punt us back to /login).
  await page.goto(`${WEB_URL}/login`);
  await page.locator('input[type="email"]').fill(USER_EMAIL);
  await page.locator('select').selectOption(USER_ROLE);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/select$/, { timeout: 10_000 });

  // Confirm one product so RequireProducts is satisfied. We then
  // jump straight to /report rather than going through /chat.
  await page.locator('[role="checkbox"]').first().click();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/chat$/, { timeout: 10_000 });

  // ── /report
  await page.goto(`${WEB_URL}/report`);
  await expect(
    page.getByRole('heading', { name: /monthly research synthesis/i }),
  ).toBeVisible({ timeout: 10_000 });

  // Theme cards mount under the "Top themes" heading.
  const themeCards = page.locator('h2:has-text("Top themes") + div > *');
  await expect.poll(() => themeCards.count(), { timeout: 5_000 }).toBeGreaterThan(0);

  // Emerging issues sidebar renders.
  await expect(page.getByRole('heading', { name: /emerging issues/i })).toBeVisible();

  // At least one citation chip is visible and clickable.
  const chips = page.getByRole('button').filter({ hasText: /^CL-\d{4}/ });
  await expect.poll(() => chips.count(), { timeout: 5_000 }).toBeGreaterThan(0);
  await chips.first().click();

  // Evidence panel opens on top of /report (same component, different host).
  await expect(page.getByRole('dialog', { name: /evidence panel/i })).toBeVisible({
    timeout: 5_000,
  });
});
