/**
 * Page-level a11y scan: runs @axe-core/playwright against each of the five
 * routes in a real chromium browser. This is the only place we can catch
 * color-contrast violations (jsdom doesn't compute Tailwind styles).
 *
 * Run from the repo root after installing chromium:
 *
 *   pnpm --filter @grain/tests-a11y exec playwright install chromium
 *   pnpm --filter @grain/tests-a11y test:pw
 *
 * Each test signs in via the mock API (no real auth), then navigates and
 * scans. Findings are written to ./findings/<route>.json by the reporter.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const FINDINGS_DIR = path.resolve(__dirname, '../findings');
if (!fs.existsSync(FINDINGS_DIR)) fs.mkdirSync(FINDINGS_DIR, { recursive: true });

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill('a11y@perforce.test');
  await page.getByRole('button', { name: /sign in/i }).click();
  // After sign in we land on /select.
  await page.waitForURL(/\/select$/);
}

async function scan(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  fs.writeFileSync(
    path.join(FINDINGS_DIR, `${label}.json`),
    JSON.stringify(results, null, 2),
  );
  return results;
}

test('/login — axe scan', async ({ page }) => {
  await page.goto('/login');
  const results = await scan(page, 'login');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/select — axe scan', async ({ page }) => {
  await signIn(page);
  const results = await scan(page, 'select');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/chat — empty state — axe scan', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL(/\/chat$/);
  const results = await scan(page, 'chat-empty');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/chat — streaming state — axe scan', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL(/\/chat$/);
  await page.getByRole('button', { name: /onboarding pain points/i }).click();
  // Wait for the streamed text to render so we scan a populated DOM.
  await page.getByText(/onboarding pain is real/i).waitFor();
  const results = await scan(page, 'chat-streaming');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/report — axe scan', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.goto('/report');
  await page.getByText(/april 2025/i).waitFor();
  const results = await scan(page, 'report');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/source/:id — gong variant — axe scan', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.goto('/source/gong-call-2025-11-04-stellar-forge');
  await page.getByText(/stellar forge/i).waitFor();
  const results = await scan(page, 'source-gong');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/source/:id — slack variant — axe scan', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.goto('/source/slack-perforce-customers-week-44');
  await page.getByText(/perforce-customers/i).waitFor();
  const results = await scan(page, 'source-slack');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('/source/:id — zoom placeholder — axe scan', async ({ page }) => {
  await signIn(page);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.goto('/source/zoom-research-2');
  await page.getByText(/research interview 2/i).waitFor();
  const results = await scan(page, 'source-placeholder');
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
