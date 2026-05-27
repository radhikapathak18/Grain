/**
 * Product chip ergonomics on /select. We assert:
 *   - each chip is at least 44px tall on touch projects
 *   - chips do not overflow the viewport
 *   - tapping the chip flips its aria-checked state
 *   - the Continue button is enabled and responds to tap()
 *
 * The chips are full-width buttons with role=checkbox; the implementation
 * uses `w-full py-3`, which exceeds 44px even on mobile.
 */
import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_MIN, isTouch, projectOf, signIn } from './_helpers';

test.describe('product select chips', () => {
  test('chips fit the viewport and meet the touch target', async ({ page }, info) => {
    await signIn(page);

    const chips = page.getByRole('checkbox');
    const count = await chips.count();
    expect(count, 'mock fixture seeds 3 products').toBeGreaterThanOrEqual(1);
    const vw = info.project.use.viewport!.width;

    for (let i = 0; i < count; i++) {
      const chip = chips.nth(i);
      const box = await chip.boundingBox();
      expect(box, `chip ${i} should be measurable`).not.toBeNull();
      if (!box) continue;

      expect(
        box.x + box.width,
        `chip ${i} right edge overflows viewport on ${projectOf(info)}`,
      ).toBeLessThanOrEqual(vw + 1);

      if (isTouch(info)) {
        expect(
          box.height,
          `chip ${i} height (${box.height}px) below ${TOUCH_TARGET_MIN}px on ${projectOf(info)}`,
        ).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
      }
    }
  });

  test('tap toggles aria-checked', async ({ page }, info) => {
    await signIn(page);
    const helix = page.getByRole('checkbox', { name: /helix core/i });
    await helix.waitFor();
    expect(await helix.getAttribute('aria-checked')).toBe('false');

    if (isTouch(info)) {
      await helix.tap();
    } else {
      await helix.click();
    }
    expect(await helix.getAttribute('aria-checked')).toBe('true');
  });

  test('Continue button is reachable and responds', async ({ page }, info) => {
    await signIn(page);
    const helix = page.getByRole('checkbox', { name: /helix core/i });
    const cont = page.getByRole('button', { name: /continue/i });

    if (isTouch(info)) {
      await helix.tap();
    } else {
      await helix.click();
    }
    expect(await cont.isEnabled()).toBe(true);
    const box = await cont.boundingBox();
    expect(box).not.toBeNull();
    if (box && isTouch(info)) {
      expect(box.height, `Continue button height on ${projectOf(info)}`).toBeGreaterThanOrEqual(
        TOUCH_TARGET_MIN - 8,
      );
    }

    if (isTouch(info)) {
      await cont.tap();
    } else {
      await cont.click();
    }
    await page.waitForURL(/\/chat$/);
  });
});
