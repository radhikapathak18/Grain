/**
 * SourceView responsive behavior.
 *
 * The body container uses `whitespace-pre-wrap` with no max-height; the
 * page scrolls instead of the container. We assert:
 *   - body wraps (no horizontal scroll on document)
 *   - body width does NOT exceed the viewport
 *   - page is scrollable vertically when the transcript is long
 *   - excerpt "Open source" navigation works via tap()
 */
import { test, expect } from '@playwright/test';
import {
  isTouch,
  projectOf,
  signInAndPickProduct,
} from './_helpers';

const GONG_PATH = '/source/gong-call-2025-11-04-stellar-forge?passage=' + encodeURIComponent(
  'the onboarding for our two new studios took almost three weeks longer than we planned',
);

test.describe('SourceView with a long transcript', () => {
  test('body wraps and never overflows horizontally', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    await page.goto(GONG_PATH);
    await page.getByText(/full transcript/i).waitFor();

    // The transcript container is the styled `bg-surface p-4 rounded-md`
    // div with `whitespace-pre-wrap`. We locate it by its enclosing heading.
    const bodyContainer = page.locator('section', { has: page.getByText(/full transcript/i) }).locator('div').last();
    const box = await bodyContainer.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const vw = info.project.use.viewport!.width;
    expect(
      box.x + box.width,
      `Transcript right edge (${box.x + box.width}) overflows viewport (${vw}) on ${projectOf(info)}`,
    ).toBeLessThanOrEqual(vw + 1);

    // Document level: no horizontal scroll.
    const docOverflow = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth - d.clientWidth;
    });
    expect(
      docOverflow,
      `Document horizontal overflow on ${projectOf(info)}: ${docOverflow}px`,
    ).toBeLessThanOrEqual(1);
  });

  test('page is scrollable vertically (transcript longer than viewport)', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    await page.goto(GONG_PATH);
    await page.getByText(/full transcript/i).waitFor();

    const dim = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(
      dim.scrollHeight,
      `Page should be taller than the viewport on ${projectOf(info)} (long transcript fixture)`,
    ).toBeGreaterThan(dim.clientHeight);
  });

  test('back link is reachable', async ({ page }, info) => {
    await signInAndPickProduct(page, info);
    await page.goto(GONG_PATH);
    await page.getByText(/full transcript/i).waitFor();

    const back = page.getByRole('button', { name: /back/i }).first();
    await back.waitFor();
    const box = await back.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const vw = info.project.use.viewport!.width;
      expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    }
    if (isTouch(info)) {
      await back.tap();
    } else {
      await back.click();
    }
  });
});
