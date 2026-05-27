import { expect, test } from '@playwright/test';
import { signInAsResearcher } from '../fixtures/auth';
import { SourcePage } from '../pages/SourcePage';

/**
 * Journey 5 — Source detail variants
 *
 *   /source/:id renders one of five SourceType layouts (gong, slack,
 *   pendo, zoom, confluence) plus a placeholder fallback synthesized by
 *   the API when no full source file exists.
 *
 *   We exercise every concrete source (ids from
 *   apps/api/src/data/sources/*) plus one placeholder by hitting an id
 *   that exists in CLAIMS evidence but has no source file.
 */

const SOURCES: Array<{ label: string; id: string; bodyHeading: RegExp }> = [
  { label: 'gong', id: 'gong-call-2025-11-04-stellar-forge', bodyHeading: /full transcript/i },
  { label: 'gong-2', id: 'gong-call-2026-01-22-hexagon-pictures', bodyHeading: /full transcript/i },
  { label: 'slack', id: 'slack-release-eng-2026-02-18', bodyHeading: /full thread/i },
  { label: 'pendo', id: 'pendo-export-2026-03-15-p4v-feature-usage', bodyHeading: /full document/i },
  { label: 'zoom', id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead', bodyHeading: /full transcript/i },
  { label: 'confluence', id: 'confluence-internal-2025-12-09-workspace-setup-runbook', bodyHeading: /full document/i },
];

test.beforeEach(async ({ page }) => {
  await signInAsResearcher(page);
});

for (const { label, id, bodyHeading } of SOURCES) {
  test(`source detail — ${label} renders its layout`, async ({ page }) => {
    const source = new SourcePage(page);
    await source.gotoId(id);
    await source.expectVisible();
    // Each non-placeholder source has a body heading.
    await expect(source.bodyHeading()).toBeVisible();
    await expect(source.bodyHeading()).toHaveText(bodyHeading);
  });
}

test('source detail — placeholder variant renders excerpts (no fake body)', async ({ page }) => {
  // gong-call-2026-02-03-nimbus is referenced by claims.ts but does NOT
  // have a corresponding source file under apps/api/src/data/sources/.
  // The API synthesizes a placeholder SourceDocument carrying the
  // citation excerpts.
  const source = new SourcePage(page);
  await source.gotoId('gong-call-2026-02-03-nimbus');
  await source.expectVisible();

  // Placeholder layout uses "Cited passages (N)" heading and renders the
  // PLACEHOLDER_NOTICE block in place of the body. The "Source" heading
  // is rendered by SourceView's isPlaceholder branch.
  await expect(page.getByRole('heading', { name: /^Source$/i })).toBeVisible();
  // Body-heading regexes should NOT match — the placeholder has none.
  await expect(source.bodyHeading()).toHaveCount(0);
});

test('source detail — passage deep link scrolls to highlighted excerpt', async ({ page }) => {
  // Drive the same code path /chat → "view full source" uses by setting
  // ?passage=… on a known gong transcript. The first excerpt in the
  // fixture is a stable string; we use the head of it.
  const source = new SourcePage(page);
  // Pass the full first-excerpt passage so the (exact-then-fuzzy)
  // matcher in SourceView resolves it cleanly.
  await source.gotoId(
    'gong-call-2025-11-04-stellar-forge',
    'The onboarding for our two new studios took almost three weeks longer than we planned. The biggest piece was just getting the workspaces configured. We have about 140 artists between the two teams and every single one needed a per-user view spec that mapped their depot paths to their local SSD layout.',
  );
  await source.expectVisible();
  // At least one <mark> highlight must render.
  await expect(source.highlights().first()).toBeVisible();
});
