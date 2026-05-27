#!/usr/bin/env node
/**
 * CI guard: verify that apps/web/tsconfig.app.json *actually* gets the
 * strict-mode flags it claims to inherit.
 *
 * Why: the static-analysis-agent (Wave 1) flagged that tsconfig.app.json
 * does NOT extend tsconfig.base.json, yet apps/web/src/types/chat.ts has
 * a comment asserting `strict` and `noUncheckedIndexedAccess` are on. That
 * is a silent gap — TypeScript doesn't fail the build, but the type-safety
 * invariant is broken.
 *
 * This script reads the resolved tsconfig as Node sees it (we strip the
 * trailing comma / JSONC quirks via a tolerant parse) and asserts the
 * required flags. CI exits non-zero on miss so the gap surfaces in the
 * pipeline rather than rotting in a comment.
 *
 * Source-mod-free: this script only READS apps/web/tsconfig.app.json.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const REQUIRED = ['strict', 'noUncheckedIndexedAccess'];
const TARGET = resolve(repoRoot, 'apps/web/tsconfig.app.json');

function stripJsonc(src) {
  // Remove // and /* */ comments and trailing commas. Tolerant, not strict.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"\\])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
}

function loadTsconfigChain(path, seen = new Set()) {
  if (seen.has(path)) return {};
  seen.add(path);

  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`[verify-web-tsconfig] cannot read ${path}: ${err.message}`);
    process.exit(2);
  }
  const json = JSON.parse(stripJsonc(raw));

  const merged = { compilerOptions: {} };
  const extendsList = Array.isArray(json.extends)
    ? json.extends
    : json.extends
      ? [json.extends]
      : [];
  for (const ext of extendsList) {
    const extPath = resolve(dirname(path), ext);
    const parent = loadTsconfigChain(extPath, seen);
    Object.assign(merged.compilerOptions, parent.compilerOptions ?? {});
  }
  Object.assign(merged.compilerOptions, json.compilerOptions ?? {});
  return merged;
}

const cfg = loadTsconfigChain(TARGET);
const opts = cfg.compilerOptions ?? {};
const missing = REQUIRED.filter((flag) => opts[flag] !== true);

if (missing.length > 0) {
  console.error(
    `\n[verify-web-tsconfig] FAIL: apps/web/tsconfig.app.json (resolved) is missing required compilerOptions:`,
  );
  for (const flag of missing) {
    console.error(`  - ${flag} (got: ${JSON.stringify(opts[flag])})`);
  }
  console.error(
    '\nFix by either extending ../../tsconfig.base.json or by adding these\n' +
      'flags explicitly to apps/web/tsconfig.app.json. See reports/static/summary.md.',
  );
  process.exit(1);
}

console.log(
  '[verify-web-tsconfig] OK — strict and noUncheckedIndexedAccess are enabled for apps/web.',
);
