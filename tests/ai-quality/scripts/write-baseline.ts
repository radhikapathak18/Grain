// Promote the latest judge run to the regression baseline.
//
// Reads `findings/judge-scores.json` and writes `baselines/baseline.json`.
// Future runs compare against this; the CI step that calls this should
// be MANUAL — promoting a baseline is a deliberate "the new behavior is
// what we want" decision, not something we do every commit.
//
// Usage:
//   pnpm -F @grain/tests-ai-quality baseline:write
//   # (optionally after running both eval:dry/real and eval:judge)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JUDGE_PATH = resolve(__dirname, '../findings/judge-scores.json');
const BASELINE_DIR = resolve(__dirname, '../baselines');
const BASELINE_PATH = resolve(BASELINE_DIR, 'baseline.json');

if (!existsSync(JUDGE_PATH)) {
  console.error(`[baseline] no judge-scores.json at ${JUDGE_PATH}`);
  process.exit(1);
}

const judge = JSON.parse(readFileSync(JUDGE_PATH, 'utf8'));

const payload = {
  promotedAt: new Date().toISOString(),
  sourceMode: judge.mode,
  judgeBin: judge.judgeBin,
  judgeModel: judge.judgeModel,
  passThreshold: judge.passThreshold,
  regressionTolerance: 0.5,
  overallAverage: judge.overallAverage,
  dimensionAverages: judge.dimensionAverages,
  passRate: judge.passRate,
  rowAverages: Object.fromEntries(
    (judge.rows as { entryId: string; avg: number }[]).map((r) => [
      r.entryId,
      r.avg,
    ]),
  ),
};

mkdirSync(BASELINE_DIR, { recursive: true });
writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(
  `[baseline] wrote baseline.json — overall=${payload.overallAverage} passRate=${(payload.passRate * 100).toFixed(0)}% (source mode=${payload.sourceMode})`,
);
