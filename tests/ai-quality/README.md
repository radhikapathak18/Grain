# `@grain/tests-ai-quality`

AI-quality eval harness for Grain's `POST /api/chat/stream` synthesis endpoint.
Owned by the ai-quality-agent. Folder ownership is strict — only this
directory is mine.

## What this catches

| Failure mode | Test |
|---|---|
| Model writes a `[CL-NNNN]` id that retrieval never returned | `citationGrounding` |
| Model cites only 1 of 6 retrieved claims (under-supported) | `citationCoverage` |
| Model fabricates a verbatim `"quote"` not in any evidence passage | `noFabricatedQuotes` |
| Same question across roles returns different claim ids (breaks the "same claims, different framing" promise) | cross-role pair assertion |
| Role/persona drift (PM voice vs Designer voice vs Engineer voice) | LLM-as-judge (`role_framing`) |
| Empty-results path doesn't fabricate citations | `ADV-EMPTY-GIBBERISH` row |

The harness also includes **negative-control rows** that deliberately
inject failures (hallucinated citation, dropped citations, fabricated
quote). These rows must FAIL the relevant assertion — that proves the
assertions actually fire instead of silently always-passing.

## Run modes

```bash
# Default — deterministic, no token spend, runs in ~10s.
pnpm -F @grain/tests-ai-quality eval:dry

# REAL Claude — spawns the real `claude` binary for every entry. Token spend.
RUN_AI_EVALS=1 pnpm -F @grain/tests-ai-quality eval:real

# LLM-as-judge — STUB by default, hits real model when RUN_AI_EVALS=1.
pnpm -F @grain/tests-ai-quality eval:judge

# Rebuild dataset (only needed if retrieval logic or CLAIMS fixture changes).
pnpm -F @grain/tests-ai-quality build:dataset

# Promote the latest judge run to the regression baseline.
pnpm -F @grain/tests-ai-quality baseline:write
```

### Token-budget warning (REAL mode)

Each `eval:real` run with the seed dataset (16 entries) spawns the
`claude` binary 16 times. Each request:

- Sends the full Grain synthesis prompt (~3-6k input tokens depending
  on how many claims retrieval returns; the `<retrieved_claims>` block
  is the biggest chunk).
- Streams an answer up to ~250 words (~350 output tokens).

A judge pass adds another 16 model calls of ~1-2k input + 150 output
each.

**Both `eval:real` and `eval:judge` real-mode are GATED behind
`RUN_AI_EVALS=1`. Default flows never touch the network.** Run them
manually when you're investigating a regression, never in PR CI.

## Files

- `harness/eval.test.ts` — main vitest runner.
- `harness/runEntry.ts` — exercises the in-process Hono app per entry.
- `harness/assertions.ts` — the four core checks.
- `harness/types.ts` — shared types.
- `dataset/inputs.ts` — hand-written eval inputs (edit this).
- `dataset/eval-set.json` — generated from inputs via `build:dataset`
  (commit it; reviewers want to see the expected claim ids).
- `judges/rubric.ts` — judge prompt + score parser (+ unit tests).
- `judges/run-judge.ts` — runs the judge over `findings/last-run.json`.
- `baselines/baseline.json` — promoted scores. Created by `baseline:write`.
- `baselines/regression.test.ts` — fails if drift > tolerance vs baseline.
- `shims/mock-claude.mjs` — richer shim, used when you want a real
  subprocess path without the real Claude binary. The default dry-run
  uses `vi.mock` and never spawns anything.
- `findings/` — last run + judge scores. Not committed.

## Documented assumptions and tunables

- **Coverage bar** (`assertions.ts:COVERAGE_FRACTION = 0.5`,
  `COVERAGE_MAX_REQUIRED = 3`): we require the model to cite at least
  `floor(min(retrieved, 3) * 0.5)` of retrieved claims. Starting bar.
  As the dataset grows, raise this — synthesis quality should
  earn it.
- **Judge pass threshold** (`rubric.ts:JUDGE_PASS_AVG = 4.0`): an
  answer "passes" if the mean across all five dimensions is ≥4. Hard
  grader by design.
- **Regression tolerance** (`baselines/baseline.json:regressionTolerance = 0.5`):
  a drop of more than 0.5 in overall avg or any single dimension fires
  the regression test. Tune in `write-baseline.ts`.
- **Quote-fabrication detection** is a substring + token-overlap
  heuristic (`assertions.ts:QUOTE_MIN_OVERLAP = 0.6`). It will catch
  literal fabricated quotes; it will NOT catch paraphrased
  fabrication. The judge's `faithfulness` dimension is the second
  layer of defense for that.
- **Dataset drift guard**: `eval.test.ts` re-runs `retrieve()` on every
  entry and asserts the dataset's `expected_claim_ids` still match.
  When you change retrieval logic or the CLAIMS fixture, regenerate
  with `build:dataset` and commit the diff so it is visible in code
  review.
- **In-process Hono**: we use `app.request()` (no real port) just like
  the integration suite. This is fast and isolates from the real `serve()`
  bootstrap in `apps/api/src/index.ts`.
- **vi.mock + vi.resetModules** is required because the chat route
  binds `streamClaude` at import time. The harness re-binds the mock
  before each `loadChatApp()` so the script can vary per entry.
- **Single-threaded vitest** (`pool: 'threads' + singleThread: true`)
  because the rate-limit module is module-singleton state; parallel
  workers would collide.
- **Mock-mode prose is identical across role pairs** because the
  scripted answer doesn't vary by role. Real-mode runs SHOULD produce
  different prose; that check fires only with `RUN_AI_EVALS=1`.
- **No WER** — Grain has no ASR. Skipped per the test plan.
- **No real subprocess in CI** — per the test plan and the agent's
  hard rules: `RUN_AI_EVALS=1` is the only path that spawns a real
  `claude` binary, and that path is never on a PR.
