import { beforeEach, vi } from 'vitest';

// Silence audit() / route console output globally. Individual tests that
// need to assert on console.log can still spyOn explicitly — vi.spyOn
// chains over this mock.
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
