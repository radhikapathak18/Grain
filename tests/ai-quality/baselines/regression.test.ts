// Regression guard: fail if the latest judge run drifts >0.5 below
// the promoted baseline on either the overall average or any single
// dimension. Skipped (with a clear log line) if no baseline yet.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, './baseline.json');
const JUDGE_PATH = resolve(__dirname, '../findings/judge-scores.json');

type BaselineFile = {
  overallAverage: number;
  dimensionAverages: Record<string, number>;
  regressionTolerance: number;
  rowAverages: Record<string, number>;
};
type JudgeFile = {
  overallAverage: number;
  dimensionAverages: Record<string, number>;
  rows: { entryId: string; avg: number }[];
};

describe('AI-quality regression vs baseline', () => {
  if (!existsSync(BASELINE_PATH)) {
    it.skip('no baseline yet — run baseline:write to promote a baseline', () => {});
    return;
  }
  if (!existsSync(JUDGE_PATH)) {
    it.skip('no judge-scores yet — run eval:judge first', () => {});
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile;
  const judge = JSON.parse(readFileSync(JUDGE_PATH, 'utf8')) as JudgeFile;
  const tolerance = baseline.regressionTolerance ?? 0.5;

  it(`overall average has not dropped more than ${tolerance} below baseline`, () => {
    const drift = baseline.overallAverage - judge.overallAverage;
    expect(
      drift,
      `overall avg dropped ${drift.toFixed(2)} (baseline ${baseline.overallAverage}, current ${judge.overallAverage})`,
    ).toBeLessThanOrEqual(tolerance);
  });

  it(`no single dimension has dropped more than ${tolerance} below baseline`, () => {
    const regressions: string[] = [];
    for (const [dim, baseVal] of Object.entries(baseline.dimensionAverages)) {
      const curVal = judge.dimensionAverages[dim] ?? 0;
      const drift = baseVal - curVal;
      if (drift > tolerance) {
        regressions.push(
          `${dim}: baseline ${baseVal} → current ${curVal} (drift ${drift.toFixed(2)})`,
        );
      }
    }
    expect(regressions, regressions.join('; ')).toEqual([]);
  });

  it(`no individual entry has dropped more than ${tolerance} below its baseline avg`, () => {
    const baselineByEntry = baseline.rowAverages ?? {};
    const judgeByEntry = Object.fromEntries(
      judge.rows.map((r) => [r.entryId, r.avg]),
    );
    const regressions: string[] = [];
    for (const [entryId, baseAvg] of Object.entries(baselineByEntry)) {
      const cur = judgeByEntry[entryId];
      if (cur === undefined) continue; // entry removed — non-regression
      const drift = baseAvg - cur;
      if (drift > tolerance) {
        regressions.push(
          `${entryId}: baseline ${baseAvg} → current ${cur} (drift ${drift.toFixed(2)})`,
        );
      }
    }
    expect(regressions, regressions.join('; ')).toEqual([]);
  });
});
