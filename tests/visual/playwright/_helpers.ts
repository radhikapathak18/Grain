/**
 * Shared Playwright helpers for visual regression. Every screenshot test
 * should call `stabilize(page)` before the first goto() and `waitForCalm()`
 * before each toHaveScreenshot.
 *
 * Stability checklist (per TEST_PLAN visual-regression-agent brief):
 *   1. Freeze Date so TrustBadgeRow renders deterministic "Xd ago".
 *   2. Disable transitions / animations / caret so paint is identical.
 *   3. Wait for document.fonts.ready before screenshot.
 *   4. Disable Math.random / crypto-style nondeterminism (best effort).
 */
import type { Page } from '@playwright/test';

/** Pinned wall-clock instant for visual tests (UTC). */
export const FROZEN_NOW_ISO = '2026-05-27T12:00:00.000Z';
export const FROZEN_NOW_MS = Date.parse(FROZEN_NOW_ISO);

const STABILITY_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  /* Make spinners hold a single frame. lucide-react spinners use animate-spin. */
  .animate-spin, .animate-pulse, .animate-ping, .animate-bounce {
    animation: none !important;
  }
`;

/**
 * Inject Date/Math freezing BEFORE any app script runs. Must be called as
 * `await page.addInitScript(...)` *before* `page.goto`, so React mounts under
 * the frozen clock.
 */
export async function stabilize(page: Page): Promise<void> {
  await page.addInitScript(
    ({ nowMs }) => {
      // Freeze Date but keep the constructor + static API intact.
      const OriginalDate = Date;
      class FrozenDate extends OriginalDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(nowMs);
          } else {
            // @ts-expect-error variadic forwarding to Date
            super(...args);
          }
        }
        static now() {
          return nowMs;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).Date = FrozenDate;

      // Stub performance.now so any internal timing is also stable.
      const perf = globalThis.performance;
      if (perf) {
        const t0 = nowMs;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (perf as any).now = () => 0;
        // Keep timeOrigin coherent.
        try {
          Object.defineProperty(perf, 'timeOrigin', { value: t0, configurable: true });
        } catch {
          /* ignore */
        }
      }

      // Pin Math.random to a deterministic LCG. Any UI that uses random IDs
      // (we don't believe the app does) will at least be stable across runs.
      let seed = 1;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xffffffff;
      };
    },
    { nowMs: FROZEN_NOW_MS },
  );
}

/**
 * Inject the disable-animations stylesheet and wait for fonts. Call this
 * after navigation, before each `toHaveScreenshot`.
 */
export async function waitForCalm(page: Page): Promise<void> {
  await page.addStyleTag({ content: STABILITY_CSS });
  await page.evaluate(async () => {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      await document.fonts.ready;
    }
  });
  // Two RAFs settle any layout that depended on font metrics.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/**
 * Drive the login → select → chat flow with a single product picked.
 * Returns once the URL is /chat and the empty hero is visible.
 */
export async function signInAndPickProduct(page: Page): Promise<void> {
  await page.goto('/login');
  await waitForCalm(page);
  await page.getByLabel(/work email/i).fill('visual@perforce.test');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/select$/);
  await page.getByRole('checkbox', { name: /helix core/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL(/\/chat$/);
  await waitForCalm(page);
}
