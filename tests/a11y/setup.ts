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

// Guarantee an in-memory localStorage exists at module-import time so the
// zustand `persist` middleware's lazy storage probe (which runs the first
// time a store is created) finds one. Without this we see
// "TypeError: Cannot read properties of undefined (reading 'setItem')" the
// moment a test calls useSessionStore.setState(...).
function installMemoryStorage(target: Storage | undefined): Storage {
  if (target && typeof target.setItem === 'function') return target;
  const m = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return m.size;
    },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    removeItem: (k) => {
      m.delete(k);
    },
    clear: () => {
      m.clear();
    },
  };
  return storage;
}

// Node 26 ships an experimental built-in `localStorage` that requires
// `--localstorage-file`. Even when jsdom is the test environment, that
// native can shadow jsdom's Storage and zustand's persist middleware then
// crashes on the first `setItem`. Unconditionally install our in-memory
// shim on both `window` and `globalThis` so the persist middleware always
// has a working store, regardless of which native showed up first.
const memoryStorage = installMemoryStorage(undefined);
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryStorage,
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryStorage,
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
