import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 26 ships an experimental `localStorage` that warns when used without
// `--localstorage-file`, and JSDOM's localStorage occasionally fails to
// initialize cleanly under that conflict. Force-install a deterministic
// in-memory localStorage so Zustand's persist middleware has somewhere to
// write to in tests.
function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memoryLS: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryLS,
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: memoryLS,
      writable: true,
      configurable: true,
    });
  }
}

installMemoryLocalStorage();

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
