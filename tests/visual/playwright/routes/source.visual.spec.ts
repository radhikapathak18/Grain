/**
 * /source/:id — one baseline per SourceType plus a placeholder baseline.
 *
 * SourceView is 382 LOC and branches heavily on type. Each variant has a
 * different icon, label, body-heading, and (for placeholders) a different
 * notice. Baselines per type catch regressions to any of those branches.
 *
 * Coverage:
 *   - gong       (full transcript layout, with customer + participants)
 *   - slack      (thread layout)
 *   - confluence (document layout)
 *   - pendo      (analytics document layout)
 *   - zoom       (placeholder branch — no body, excerpts-only)
 */
import { test, expect } from '@playwright/test';
import { stabilize, waitForCalm, signInAndPickProduct } from '../_helpers';

const VARIANTS: { id: string; baseline: string; waitText: RegExp }[] = [
  {
    id: 'gong-call-2025-11-04-stellar-forge',
    baseline: 'source-gong.png',
    waitText: /stellar forge/i,
  },
  {
    id: 'slack-release-eng-2026-02-18',
    baseline: 'source-slack.png',
    waitText: /release-eng/i,
  },
  {
    id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
    baseline: 'source-confluence.png',
    waitText: /workspace setup runbook/i,
  },
  {
    id: 'pendo-export-2026-03-15-p4v-feature-usage',
    baseline: 'source-pendo.png',
    waitText: /feature usage/i,
  },
  {
    id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
    baseline: 'source-zoom-placeholder.png',
    waitText: /lumen foundry/i,
  },
];

test.beforeEach(async ({ page }) => {
  await stabilize(page);
});

for (const v of VARIANTS) {
  test(`/source/${v.id}`, async ({ page }) => {
    await signInAndPickProduct(page);
    await page.goto(`/source/${v.id}`);
    await waitForCalm(page);
    await page.getByText(v.waitText).first().waitFor();
    await expect(page).toHaveScreenshot(v.baseline, { fullPage: true });
  });
}
