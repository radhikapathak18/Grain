// Root vitest config — runs the consolidated unit suite under tests/unit/.
//
// We use multi-project mode so api-style modules run under node and
// web-style modules run under jsdom with @testing-library/react. Per-
// workspace `apps/*/vitest.config.ts` files are NOT touched (the unit-test
// agent's scope is tests/unit/ at the repo root).

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const repoRoot = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@grain/types': path.resolve(repoRoot, 'packages/types/src/index.ts'),
    },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-api',
          environment: 'node',
          include: ['tests/unit/api/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-web',
          environment: 'jsdom',
          include: [
            'tests/unit/web/**/*.test.ts',
            'tests/unit/web/**/*.test.tsx',
          ],
          setupFiles: ['./tests/unit/setup-web.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'apps/api/src/lib/**/*.ts',
        'apps/api/src/prompts/**/*.ts',
        'apps/web/src/hooks/**/*.ts',
        'apps/web/src/state/**/*.ts',
        'apps/web/src/routes/**/*.tsx',
        'apps/web/src/lib/**/*.ts',
        'apps/web/src/components/**/*.tsx',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        'apps/api/src/index.ts',
      ],
    },
  },
});
