import type { Page, TestInfo } from '@playwright/test';

/**
 * Helpers shared across the responsive suite. We intentionally key off the
 * Playwright project name (`mobile` | `tablet` | `desktop`) to gate touch
 * vs. mouse interactions and to vary expectations per project.
 */

export type ProjectName = 'mobile' | 'tablet' | 'desktop';

export function projectOf(info: TestInfo): ProjectName {
  const name = info.project.name as ProjectName;
  if (name !== 'mobile' && name !== 'tablet' && name !== 'desktop') {
    throw new Error(`Unknown responsive project: ${info.project.name}`);
  }
  return name;
}

export function isTouch(info: TestInfo): boolean {
  return projectOf(info) !== 'desktop';
}

/**
 * Tap on touch projects, click on desktop. We force=true is NEVER used —
 * if the element isn't actually tappable that's a finding.
 */
export async function tapOrClick(
  page: Page,
  selector: string,
  info: TestInfo,
): Promise<void> {
  const locator = page.locator(selector).first();
  if (isTouch(info)) {
    await locator.tap();
  } else {
    await locator.click();
  }
}

/**
 * Sign in via the mock API. Uses the email field; the form auto-fills in
 * dev (Vite import.meta.env.DEV is true under the dev server we spawn).
 * After submit we land on /select.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  // Email is pre-filled in dev, but we set it explicitly so the test does
  // not depend on the dev-only autofill behavior.
  const email = page.getByLabel(/work email/i);
  await email.fill('responsive@perforce.test');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/select$/);
}

/**
 * Sign in, pick a product, and land on /chat. Used by the chat-flavored
 * tests so they don't each repeat the same dance.
 */
export async function signInAndPickProduct(page: Page, info: TestInfo): Promise<void> {
  await signIn(page);
  const helix = page.getByRole('checkbox', { name: /helix core/i });
  if (isTouch(info)) {
    await helix.tap();
  } else {
    await helix.click();
  }
  const cont = page.getByRole('button', { name: /continue/i });
  if (isTouch(info)) {
    await cont.tap();
  } else {
    await cont.click();
  }
  await page.waitForURL(/\/chat$/);
}

/**
 * Measure whether the document has a horizontal scrollbar at the current
 * viewport. We compare scrollWidth to clientWidth; >1px tolerance handles
 * sub-pixel anti-aliasing.
 */
export async function hasHorizontalOverflow(page: Page): Promise<{
  overflow: boolean;
  scrollWidth: number;
  clientWidth: number;
}> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth - doc.clientWidth > 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
}

/**
 * Measure a single element's bounding box. Returns null if not attached.
 */
export async function boxOf(
  page: Page,
  selector: string,
): Promise<{ width: number; height: number; x: number; y: number } | null> {
  const handle = page.locator(selector).first();
  await handle.waitFor({ state: 'attached', timeout: 5_000 });
  const box = await handle.boundingBox();
  return box;
}

/**
 * WCAG 2.1 SC 2.5.5 says ≥44x44 CSS px is a baseline touch target. We use
 * this as a soft threshold for findings — failures are reported, not
 * skipped. Returns the smallest dimension so test code can assert.
 */
export const TOUCH_TARGET_MIN = 44;
