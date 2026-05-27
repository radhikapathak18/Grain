import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Resolve `@testing-library/*` and React from this workspace's node_modules
// even when a test file lives outside the workspace root (the consolidated
// unit suite under repo-root /tests/unit/web/ does this). Without these
// aliases, Vite's nearest-node_modules walk starts from the repo root and
// fails to find the packages.
const webNm = path.resolve(__dirname, 'node_modules');

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@testing-library/react': path.join(webNm, '@testing-library/react'),
      '@testing-library/jest-dom': path.join(
        webNm,
        '@testing-library/jest-dom',
      ),
      '@testing-library/dom': path.join(webNm, '@testing-library/dom'),
      react: path.join(webNm, 'react'),
      'react-dom': path.join(webNm, 'react-dom'),
      'react-router-dom': path.join(webNm, 'react-router-dom'),
      zustand: path.join(webNm, 'zustand'),
      '@tanstack/react-query': path.join(webNm, '@tanstack/react-query'),
      'lucide-react': path.join(webNm, 'lucide-react'),
    },
  },
  server: {
    fs: {
      // Allow vite to read sources under repo root.
      allow: [path.resolve(__dirname, '..', '..')],
    },
  },
  test: {
    environment: 'jsdom',
    // Pick up workspace-local tests AND the consolidated unit suite that
    // lives at the repo root under tests/unit/web/ (unit-test-agent).
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      '../../tests/unit/web/**/*.test.ts',
      '../../tests/unit/web/**/*.test.tsx',
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
