// Build the eval dataset by calling the REAL `retrieve()` function so
// `expected_claim_ids` is always the source-of-truth ground truth.
//
// Why generate vs hand-write?  Hand-written expected ids drift the
// moment the CLAIMS fixture or retrieval algorithm changes. Generating
// at build-time means the dataset is always in sync with the actual
// retrieval contract — and any future drift will manifest as a delta
// in the JSON which the reviewer can inspect.
//
// Run:
//   pnpm -F @grain/tests-ai-quality build:dataset
//
// Writes:
//   tests/ai-quality/dataset/eval-set.json

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrieve } from '../../../apps/api/src/lib/retrieval.ts';
import type {
  EvalEntry,
  EvalEntryInput,
  EvalDataset,
} from '../harness/types.ts';
import { EVAL_INPUTS } from '../dataset/inputs.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../dataset/eval-set.json');

function expand(input: EvalEntryInput): EvalEntry {
  const claims = retrieve(input.question, [...input.products], input.shape);
  return {
    id: input.id,
    question: input.question,
    role: input.role,
    shape: input.shape,
    products: [...input.products],
    expected_claim_ids: claims.map((c) => c.id),
    expected_persona: input.expected_persona,
    expected_tone: input.expected_tone,
    expected_no_claim_fabrication: input.expected_no_claim_fabrication ?? true,
    notes: input.notes,
    pair_id: input.pair_id,
    fail_mode: input.fail_mode,
  };
}

const dataset: EvalDataset = {
  generatedAt: new Date().toISOString(),
  retrievalDeterminismNote:
    'expected_claim_ids derived from a direct call to retrieve(). Same algorithm the route uses; ids will drift only if retrieval logic or CLAIMS fixture changes.',
  entries: EVAL_INPUTS.map(expand),
};

writeFileSync(OUT_PATH, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
console.log(
  `[build-dataset] wrote ${dataset.entries.length} entries → ${OUT_PATH}`,
);
