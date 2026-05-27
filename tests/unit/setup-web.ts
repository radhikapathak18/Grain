// Global test setup for jsdom-based unit tests under tests/unit/web/.
//
// - Loads @testing-library/jest-dom's custom matchers (toBeInTheDocument,
//   toHaveTextContent, ...).
// - Resets the document body and localStorage between tests so tests cannot
//   leak DOM nodes / persisted Zustand state across files.

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // jsdom storage may not be available in some envs — degrade silently.
  }
});
