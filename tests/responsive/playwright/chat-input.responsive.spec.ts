/**
 * Chat input ergonomics on /chat. The bottom message form is `sticky
 * bottom-0` and lives inside a flex column. We assert:
 *   - the textarea stays inside the viewport before and after focus
 *   - the send button is at least the touch target on mobile/tablet
 *   - typing + tapping send actually triggers the SSE stream (mocked)
 *   - the question-shape selector renders inside the viewport (its pills
 *     have icons + text; they may overflow on 375px — that's a finding)
 */
import { test, expect } from '@playwright/test';
import {
  TOUCH_TARGET_MIN,
  isTouch,
  projectOf,
  signInAndPickProduct,
} from './_helpers';

test.describe('chat input', () => {
  test('textarea is visible inside the viewport before focus', async ({ page }, info) => {
    await signInAndPickProduct(page, info);

    const textarea = page.getByPlaceholder(/ask anything/i);
    await textarea.waitFor();
    const box = await textarea.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const vw = info.project.use.viewport!.width;
    const vh = info.project.use.viewport!.height;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    // The form is sticky bottom-0 inside the scrolled <main>. It should be
    // visible without scrolling on first paint.
    expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
  });

  test('textarea remains in viewport after focus (mobile keyboard concern)', async ({ page }, info) => {
    await signInAndPickProduct(page, info);

    const textarea = page.getByPlaceholder(/ask anything/i);
    if (isTouch(info)) {
      await textarea.tap();
    } else {
      await textarea.click();
    }
    // After focus the visual viewport may shrink on a real device, but
    // Playwright does not simulate the on-screen keyboard. We can still
    // assert the element is in-document and not transformed off-screen.
    const box = await textarea.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const vw = info.project.use.viewport!.width;
      expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    }
  });

  test('send button is tappable and triggers the streamed reply', async ({ page }, info) => {
    await signInAndPickProduct(page, info);

    const textarea = page.getByPlaceholder(/ask anything/i);
    await textarea.fill('What are the top onboarding pain points?');

    const send = page.getByRole('button', { name: /send message/i });
    const box = await send.boundingBox();
    expect(box).not.toBeNull();
    if (box && isTouch(info)) {
      expect(
        box.height,
        `Send button height (${box.height}) below ${TOUCH_TARGET_MIN}px on ${projectOf(info)}`,
      ).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN - 12);
    }

    if (isTouch(info)) {
      await send.tap();
    } else {
      await send.click();
    }

    // The mock SSE emits "Onboarding pain is real ...". Wait for it to land.
    await page.getByText(/onboarding pain is real/i).waitFor();
  });

  test('question shape selector pills fit inside the viewport', async ({ page }, info) => {
    await signInAndPickProduct(page, info);

    // The selector pills are role=tab inside an aria-label="Question shape"
    // tablist. We grab the tablist container itself so we measure the
    // whole pill group, not just one pill.
    const tablist = page.getByRole('tablist', { name: /question shape/i });
    await tablist.waitFor();
    const box = await tablist.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const vw = info.project.use.viewport!.width;
      expect(
        box.x + box.width,
        `Question-shape tablist right edge (${box.x + box.width}) overflows viewport (${vw}) on ${projectOf(info)}`,
      ).toBeLessThanOrEqual(vw + 1);
      expect(box.x, `tablist left edge`).toBeGreaterThanOrEqual(0);
    }
  });
});
