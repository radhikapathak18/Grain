/**
 * Vitest setup for the a11y suite.
 *
 * - Loads jest-dom matchers (toBeInTheDocument, toHaveAccessibleName, …).
 * - Registers vitest-axe's `toHaveNoViolations` matcher.
 * - Polyfills the few DOM bits jsdom is missing that the components touch
 *   (matchMedia, IntersectionObserver, ResizeObserver, scrollIntoView).
 */
import '@testing-library/jest-dom/vitest';
import { expect, vi, afterEach } from 'vitest';
import * as matchers from 'vitest-axe/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia.
if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// jsdom doesn't implement these — the EvidencePanel uses raf, ChatView
// scrolls into view, etc.
if (typeof window !== 'undefined') {
  if (!('IntersectionObserver' in window)) {
    // @ts-expect-error — minimal stub
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }
  if (!('ResizeObserver' in window)) {
    // @ts-expect-error — minimal stub
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    /* noop in jsdom */
  };
}
