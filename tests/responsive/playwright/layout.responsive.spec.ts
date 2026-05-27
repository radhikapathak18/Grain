/**
 * Layout integrity tests — runs per route per viewport project.
 *
 * Goal: catch unintended horizontal scrolling, off-screen content, and
 * controls that wrap into broken positions when the app is squeezed below
 * its desktop target. Failures are reported, NOT skipped — by design, this
 * is a hackathon-grade UI shipped without explicit mobile breakpoints, so
 * findings here are expected. Each test asserts and prints details.
 */
import { test, expect } from '@playwright/test';
import {
  hasHorizontalOverflow,
  projectOf,
  signIn,
  signInAndPickProduct,
} from './_helpers';

test.describe('layout integrity per route', () => {
  test('/login has no horizontal scroll and form fits the viewport', async ({ page }, info) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).waitFor();
    const overflow = await hasHorizontalOverflow(page);
    expect(
      overflow.overflow,
      `Login horizontal overflow on ${projectOf(info)}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
    ).toBe(false);

    const form = await page.locator('form').first().boundingBox();
    expect(form).not.toBeNull();
    if (form) {
      // The form must not be wider than the viewport. The view uses
      // `max-w-sm` (24rem ≈ 384px) and `p-8` padding; on a 375px viewport
      // the form should naturally shrink because of `w-full`.
      expect(form.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    }
  });

  test('/select renders without horizontal overflow', async ({ page }, info) => {
    await signIn(page);
    await page.getByRole('button', { name: /continue/i }).waitFor();
    const overflow = await hasHorizontalOverflow(page);
    expect(
      overflow.overflow,
      `Product select horizontal overflow on ${projectOf(info)}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
    ).toBe(false);
  });

  test('/chat empty state renders without horizontal overflow', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    await page.getByRole('heading', { name: /ask grain anything/i }).waitFor();
    const overflow = await hasHorizontalOverflow(page);
    expect(
      overflow.overflow,
      `Chat empty horizontal overflow on ${projectOf(info)}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
    ).toBe(false);
  });

  test('/chat header controls are inside the viewport', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    const header = page.locator('header').first();
    await header.waitFor();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        info.project.use.viewport!.width + 1, // +1 tolerance for sub-pixel
      );
    }

    // The signed-in user has 3 products in the mock fixture but selected
    // only 1, so the header shows "Querying: Helix Core". The role button
    // and the product chip must both be visible — i.e. not pushed offscreen
    // by header wrapping. We assert their right edges stay inside the
    // viewport.
    const roleButton = page.locator('header button', { hasText: /researcher|pm|designer|engineer/i }).first();
    const productLink = page.locator('header a[href="/select"]').first();
    const viewportWidth = info.project.use.viewport!.width;
    for (const [name, locator] of [
      ['role button', roleButton],
      ['product chip', productLink],
    ] as const) {
      const b = await locator.boundingBox();
      expect(b, `${name} should be in the DOM`).not.toBeNull();
      if (b) {
        expect(
          b.x + b.width,
          `${name} right edge (${b.x + b.width}) overflows viewport (${viewportWidth}) on ${projectOf(info)}`,
        ).toBeLessThanOrEqual(viewportWidth + 1);
      }
    }
  });

  test('/report renders without horizontal overflow', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    await page.goto('/report');
    await page.getByText(/april 2025/i).waitFor();
    const overflow = await hasHorizontalOverflow(page);
    expect(
      overflow.overflow,
      `Report horizontal overflow on ${projectOf(info)}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
    ).toBe(false);
  });

  test('/source/:id (gong, long transcript) renders without horizontal overflow', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    await page.goto('/source/gong-call-2025-11-04-stellar-forge');
    await page.getByText(/stellar forge/i).first().waitFor();
    const overflow = await hasHorizontalOverflow(page);
    expect(
      overflow.overflow,
      `Source/gong horizontal overflow on ${projectOf(info)}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
    ).toBe(false);
  });
});
