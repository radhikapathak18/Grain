// Synthetic probe — Source detail page.
//
// Proves:
//   - Direct navigation to /source/:id renders without server-side
//     routing being involved (it's a Vite SPA; we need the fallback
//     index.html serving rule to be configured correctly in prod).
//   - The SourceView component handles the seeded source-id without
//     hitting the "source not found" branch.
//
// We point at a KNOWN seeded source id (GONG-001 by default; see
// apps/api/src/data/sources/gong-001.ts and the index in
// apps/api/src/data/sources/index.ts). Override via
// `GRAIN_SYNTHETIC_SOURCE_ID` if the seed fixture changes.
//
// Selectors borrowed from `tests/e2e/pages/SourcePage.ts`.

import { expect, test } from '@playwright/test';

const WEB_URL = process.env.GRAIN_PROD_URL ?? 'http://localhost:5173';
const USER_EMAIL = process.env.GRAIN_SYNTHETIC_USER_EMAIL ?? '';
const USER_ROLE =
  (process.env.GRAIN_SYNTHETIC_USER_ROLE as 'researcher' | 'pm' | 'designer' | 'engineer') ??
  'researcher';
const SOURCE_ID = process.env.GRAIN_SYNTHETIC_SOURCE_ID ?? 'GONG-001';

test.skip(!USER_EMAIL, 'GRAIN_SYNTHETIC_USER_EMAIL not set — probe is dormant');

test(`source detail: /source/${SOURCE_ID} renders`, async ({ page }) => {
  // Login first (auth guard chain).
  await page.goto(`${WEB_URL}/login`);
  await page.locator('input[type="email"]').fill(USER_EMAIL);
  await page.locator('select').selectOption(USER_ROLE);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/select$/, { timeout: 10_000 });
  await page.locator('[role="checkbox"]').first().click();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/chat$/, { timeout: 10_000 });

  // ── /source/:id direct navigation
  await page.goto(`${WEB_URL}/source/${encodeURIComponent(SOURCE_ID)}`);

  // <h1> is the source title — present for both full docs and
  // synthesized placeholders.
  await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

  // Must NOT show the "source not found" error block.
  await expect(page.getByText(/source not found/i)).toHaveCount(0);

  // Back button is the canonical exit affordance.
  await expect(page.getByRole('button', { name: /^back$/i }).first()).toBeVisible();
});
