// AI-quality eval test suite.
//
// Loads `dataset/eval-set.json` and runs each entry through the chat
// route. Asserts:
//
//   - citation-grounding: every [CL-NNNN] marker the model emits is a
//     real claim id returned by retrieval. Hallucinated id = FAIL.
//   - citation-coverage: at least floor(min(retrieved, 3) * 0.5) of
//     retrieved claims are cited. Tunable.
//   - no-fabricated-quotes: every double-quoted span in the answer
//     appears as substring (or token-overlap >= 0.6) in some evidence
//     passage / claim text.
//   - retrieval-determinism for cross-role pairs: same pair_id → same
//     emitted citation ids regardless of role. (Same-claims/different-
//     framing contract from §3.6 demo-moment 7.)
//
// Negative-control rows (fail_mode != ok) are wrapped in flipped
// assertions: a hallucinate-cite row MUST fail grounding, a drop-
// citations row MUST fail coverage. This proves the assertions
// actually fire instead of silently always-passing.
//
// Also writes a fresh `findings/last-run.json` so the LLM-judge runner
// and the baseline writer can consume the per-row results.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvalDataset, EvalEntry, EvalRunResult, EvalAssertionResult } from './types.ts';
import { runEntry } from './runEntry.ts';
import { assertEval, ASSERTION_CONSTANTS } from './assertions.ts';
import { retrieve } from '../../../apps/api/src/lib/retrieval.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = resolve(__dirname, '../dataset/eval-set.json');
const FINDINGS_DIR = resolve(__dirname, '../findings');
const LAST_RUN_PATH = resolve(FINDINGS_DIR, 'last-run.json');

function loadDataset(): EvalDataset {
  if (!existsSync(DATASET_PATH)) {
    throw new Error(
      `eval-set.json not found at ${DATASET_PATH}. Run \`pnpm -F @grain/tests-ai-quality build:dataset\` first.`,
    );
  }
  return JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as EvalDataset;
}

const REAL_MODE = process.env.RUN_AI_EVALS === '1';

const allResults: { entry: EvalEntry; run: EvalRunResult; assertions: EvalAssertionResult }[] = [];

describe(`AI-quality eval suite (${REAL_MODE ? 'REAL claude' : 'mock'})`, () => {
  let dataset: EvalDataset;

  beforeAll(() => {
    dataset = loadDataset();
    if (REAL_MODE) {
      console.warn(
        [
          '',
          '╔══════════════════════════════════════════════════════════════╗',
          '║  RUN_AI_EVALS=1 — REAL Claude CLI mode.                       ║',
          '║  Each eval entry spawns the real `claude` binary and BURNS    ║',
          `║  model tokens. Dataset size: ${String(dataset.entries.length).padStart(2)} entries.                  ║`,
          '║  Typical run: 30-90 seconds + token spend per entry.          ║',
          '╚══════════════════════════════════════════════════════════════╝',
          '',
        ].join('\n'),
      );
    }
  });

  it('dataset is non-empty and has cross-role pairs', () => {
    expect(dataset.entries.length).toBeGreaterThanOrEqual(10);
    const pairs = dataset.entries.filter((e) => e.pair_id);
    const pairIds = new Set(pairs.map((e) => e.pair_id));
    // At least one pair, each pair has at least 2 entries.
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    for (const pid of pairIds) {
      const group = pairs.filter((e) => e.pair_id === pid);
      expect(group.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('expected_claim_ids matches current retrieve() output (no dataset drift)', () => {
    for (const entry of dataset.entries) {
      const live = retrieve(entry.question, entry.products, entry.shape).map(
        (c) => c.id,
      );
      expect(
        live,
        `entry ${entry.id} retrieval drift: dataset says ${JSON.stringify(entry.expected_claim_ids)}, live says ${JSON.stringify(live)}`,
      ).toEqual(entry.expected_claim_ids);
    }
  });

  // One test per entry so the report shows which question regressed.
  describe('per-entry assertions', () => {
    // We loop over a snapshot of entries; vitest `it.each` would be
    // nicer but we want to also persist `allResults` for the baseline
    // writer, so a manual loop is simpler.
    const ds = loadDataset();
    for (const entry of ds.entries) {
      const isNegative = entry.fail_mode && entry.fail_mode !== 'ok';
      const label = isNegative
        ? `[negative:${entry.fail_mode}] ${entry.id}`
        : entry.id;

      it(label, async () => {
        const retrievedClaims = retrieve(entry.question, entry.products, entry.shape);
        const run = await runEntry(entry);
        const assertions = assertEval(run, retrievedClaims);
        allResults.push({ entry, run, assertions });

        if (isNegative && entry.fail_mode === 'hallucinate-cite') {
          expect(
            assertions.passes.citationGrounding,
            `expected grounding to FAIL for negative control ${entry.id}`,
          ).toBe(false);
          expect(assertions.details.hallucinatedCitations).toContain('CL-9999');
          return;
        }
        if (isNegative && entry.fail_mode === 'drop-citations') {
          expect(
            assertions.passes.citationCoverage,
            `expected coverage to FAIL for negative control ${entry.id}`,
          ).toBe(false);
          return;
        }
        if (isNegative && entry.fail_mode === 'hallucinate-quote') {
          expect(
            assertions.passes.noFabricatedQuotes,
            `expected fabricated-quotes to FAIL for negative control ${entry.id}`,
          ).toBe(false);
          return;
        }

        // Positive rows: everything must pass.
        expect(
          assertions.passes.citationGrounding,
          `hallucinated citations: ${JSON.stringify(assertions.details.hallucinatedCitations)}`,
        ).toBe(true);

        // The gibberish row triggers empty-results — there are no claims
        // to cite, so we expect 0 markers and a polite empty bubble.
        if (run.expectedClaimIds.length === 0) {
          expect(run.proseCitationMarkers).toEqual([]);
          expect(run.done?.totalCitations).toBe(0);
          return;
        }

        expect(
          assertions.passes.citationCoverage,
          `coverage ${assertions.details.coverageRatio.toFixed(2)} < threshold (${assertions.details.coverageThreshold} of ${run.expectedClaimIds.length}); cited: ${JSON.stringify(run.emittedCitations)}`,
        ).toBe(true);

        expect(
          assertions.passes.noFabricatedQuotes,
          `fabricated quotes: ${JSON.stringify(assertions.details.fabricatedQuoteCandidates)}`,
        ).toBe(true);
      });
    }
  });

  it('cross-role pairs retrieve the same claim ids (same-claims/different-framing)', async () => {
    const byPair = new Map<string, typeof allResults>();
    for (const r of allResults) {
      if (!r.entry.pair_id) continue;
      const arr = byPair.get(r.entry.pair_id) ?? [];
      arr.push(r);
      byPair.set(r.entry.pair_id, arr);
    }
    expect(byPair.size, 'no cross-role pairs collected').toBeGreaterThan(0);

    for (const [pairId, group] of byPair) {
      expect(group.length, `pair ${pairId} needs >=2 runs`).toBeGreaterThanOrEqual(2);
      const citationSets = group.map(
        (r) => [...new Set(r.run.emittedCitations)].sort(),
      );
      const first = citationSets[0]!;
      for (let i = 1; i < citationSets.length; i += 1) {
        expect(
          citationSets[i],
          `pair ${pairId}: role ${group[i]!.entry.role} cited ${JSON.stringify(citationSets[i])} but role ${group[0]!.entry.role} cited ${JSON.stringify(first)}`,
        ).toEqual(first);
      }
      // Prose must differ — same evidence, different framing.
      const proseList = group.map((r) => r.run.answer);
      // In mock mode the scripted answer is identical because the shim
      // does not vary prose by role. We only enforce this in REAL mode,
      // and even then only as a soft check (different roles can produce
      // similar prose for very short answers). Documented.
      if (REAL_MODE) {
        const allSame = proseList.every((p) => p === proseList[0]);
        expect(allSame, `pair ${pairId} produced identical prose across roles`).toBe(false);
      }
    }
  });

  it('persists findings/last-run.json for the judge + baseline runners', () => {
    mkdirSync(FINDINGS_DIR, { recursive: true });
    const payload = {
      mode: REAL_MODE ? 'real' : 'mock',
      ranAt: new Date().toISOString(),
      assertionConstants: ASSERTION_CONSTANTS,
      results: allResults.map(({ entry, run, assertions }) => ({
        entryId: entry.id,
        pair_id: entry.pair_id,
        role: entry.role,
        shape: entry.shape,
        products: entry.products,
        question: entry.question,
        fail_mode: entry.fail_mode,
        expectedClaimIds: entry.expected_claim_ids,
        answer: run.answer,
        emittedCitations: run.emittedCitations,
        proseCitationMarkers: run.proseCitationMarkers,
        durationMs: run.durationMs,
        passes: assertions.passes,
        details: assertions.details,
      })),
    };
    writeFileSync(LAST_RUN_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    expect(existsSync(LAST_RUN_PATH)).toBe(true);
  });
});
