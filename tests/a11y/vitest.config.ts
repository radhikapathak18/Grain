import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Vitest config for the accessibility test suite.
 *
 * Runs jsdom + @testing-library/react against the source components in
 * `apps/web` so we exercise the real production code. axe-core runs against
 * the rendered DOM with WCAG 2.1 AA + a11y best-practices rule sets.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['components/**/*.test.tsx', 'keyboard/**/*.test.tsx', 'pages/**/*.test.tsx'],
    setupFiles: ['./setup.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15_000,
    // The web app uses Tailwind utility classes that don't load in jsdom.
    // We're testing semantics + ARIA, not visual contrast at the pixel level
    // — color-contrast rule is disabled per-test (see setup) but still
    // reported in summary as something Playwright covers.
  },
  resolve: {
    alias: {
      '@grain/web': path.resolve(__dirname, '../../apps/web/src'),
      '@grain/types': path.resolve(__dirname, '../../packages/types/src'),
    },
  },
});
