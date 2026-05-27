// Root ESLint flat config — lints apps/api, apps/web, and packages/types.
// Reuses the rule set apps/web shipped with (recommended JS + typescript-eslint
// recommended + react-hooks + react-refresh). Browser globals only apply to the
// web workspace; node globals apply to the api workspace, scripts/, config
// files, and packages/types.
//
// Note: typed lint (`recommended-type-checked`) is intentionally NOT enabled.
// Enabling it requires `parserOptions.project` and adds 5-10s of startup; the
// hackathon repo doesn't justify that cost yet. To enable later, replace
// `tseslint.configs.recommended` with `tseslint.configs.recommendedTypeChecked`
// and add `parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }`.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    '**/*.tsbuildinfo',
    'pnpm-lock.yaml',
    'reports/**',
    'docs/**',
  ]),

  // Base: all TS/TSX files across the monorepo.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Web workspace: browser globals + React rules.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Test files: allow vitest globals (describe/it/expect/etc.) and looser rules.
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Scripts directory: Node CLI scripts, allow console + relaxed rules.
  {
    files: ['scripts/**/*.{ts,js}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
