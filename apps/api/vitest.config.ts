import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Pick up workspace-local tests AND the consolidated unit suite that
    // lives at the repo root under tests/unit/api/ (unit-test-agent) and
    // the root-level integration suite (integration-test-agent).
    include: [
      'tests/**/*.test.ts',
      '../../tests/unit/api/**/*.test.ts',
      '../../tests/integration/**/*.test.ts',
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
