/**
 * Shared axe runner. Centralises rule config so every component test scans
 * against the same WCAG 2.1 AA rule set.
 *
 * `axeRun` returns the raw AxeResults so tests can use vitest-axe's
 * `toHaveNoViolations` matcher AND inspect violations to write findings.
 */
import axe, { type AxeResults, type RunOptions } from 'axe-core';

const DEFAULT_RUN_OPTIONS: RunOptions = {
  // WCAG 2.0 A, 2.0 AA, 2.1 A, 2.1 AA + best-practices. Drop wcag22 since
  // the app pre-dates 2.2.
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
  },
  // color-contrast cannot be evaluated reliably in jsdom (no computed
  // styles from Tailwind) — we let Playwright do that pass against the real
  // browser. Keep all other rules.
  rules: {
    'color-contrast': { enabled: false },
  },
  resultTypes: ['violations', 'incomplete'],
};

export async function axeRun(
  container: Element,
  overrides: RunOptions = {},
): Promise<AxeResults> {
  return axe.run(container, { ...DEFAULT_RUN_OPTIONS, ...overrides });
}

/** Pretty-print violations for snapshot output. */
export function formatViolations(results: AxeResults): string {
  if (results.violations.length === 0) return 'no violations';
  return results.violations
    .map((v) => {
      const targets = v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 5)
        .join('\n      ');
      return `- [${v.impact ?? 'unknown'}] ${v.id} (${v.help})\n      ${targets}`;
    })
    .join('\n');
}
