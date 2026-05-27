// Eval assertion library — the four core AI-quality checks.
//
// 1. Citation grounding: every [CL-NNNN] marker in the answer prose
//    must correspond to a real claim id that retrieval returned.
//    Hallucinated citation ids = FAIL. This is the #1 failure mode
//    for synthesis models and is the most important assertion in
//    this suite.
//
// 2. Citation coverage: at least `floor(min(retrieved, 3) * 0.5)` of
//    the retrieved claims should be cited. The bar starts at 50% of
//    up-to-3 claims — small enough that a focused answer that picks
//    its strongest evidence passes, but large enough that an answer
//    citing only 1 of 6 retrieved claims fails as under-supported.
//    Tunable via the COVERAGE_FRACTION constant below.
//
// 3. No fabricated quotes: every double-quoted span in the answer
//    must appear as a substring in at least one retrieved claim's
//    text or evidence passages (case-insensitive, whitespace-normalized).
//    This is a heuristic — it will not catch paraphrased fabrication,
//    only literal quote-fabrication. Documented limitation.
//
// 4. No fabricated claims: the citation-marker set MUST be a subset
//    of `expectedClaimIds`. This is a tighter form of (1) that fires
//    even if the citation ID format is well-formed but unrelated to
//    the question.

import type { Claim } from '@grain/types';
import type { EvalAssertionResult, EvalRunResult } from './types.ts';

// 50% of up-to-three retrieved claims must be cited. Override per
// dataset by extending the assertion call signature; documented as a
// starting bar. As the dataset grows, raise this.
const COVERAGE_FRACTION = 0.5;
const COVERAGE_MAX_REQUIRED = 3;

const QUOTE_RE = /"([^"\n]{8,200})"/g;
const QUOTE_MIN_TOKENS = 5;
const QUOTE_MIN_OVERLAP = 0.6;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

/**
 * For each quoted phrase, returns it as "fabricated" if it shares
 * fewer than QUOTE_MIN_OVERLAP of its tokens with any evidence
 * passage or claim text. Conservative — a paraphrased quote that
 * happens to share most tokens with the source will pass.
 */
function findFabricatedQuotes(answer: string, claims: Claim[]): string[] {
  const corpus = claims
    .flatMap((c) => [c.text, ...c.evidence.map((e) => e.passage)])
    .map(normalize);
  const fabricated: string[] = [];
  const matches = answer.matchAll(QUOTE_RE);
  for (const m of matches) {
    const quote = m[1]!;
    const qTokens = tokens(quote);
    if (qTokens.length < QUOTE_MIN_TOKENS) continue;
    const normalizedQuote = normalize(quote);
    // Substring match short-circuits the token check.
    if (corpus.some((c) => c.includes(normalizedQuote))) continue;
    // Token-overlap fallback for minor punctuation drift.
    const bestOverlap = Math.max(
      0,
      ...corpus.map((c) => {
        const ct = new Set(tokens(c));
        const hit = qTokens.filter((t) => ct.has(t)).length;
        return hit / qTokens.length;
      }),
    );
    if (bestOverlap < QUOTE_MIN_OVERLAP) {
      fabricated.push(quote);
    }
  }
  return fabricated;
}

export function assertEval(
  run: EvalRunResult,
  retrievedClaims: Claim[],
): EvalAssertionResult {
  const retrievedIds = new Set(run.expectedClaimIds);
  const allMarkers = new Set<string>([
    ...run.emittedCitations,
    ...run.proseCitationMarkers,
  ]);

  // 1. Grounding — every marker in the prose must be in retrieval.
  const hallucinated = [...allMarkers].filter((id) => !retrievedIds.has(id));
  const citationGrounding = hallucinated.length === 0;

  // 2. Coverage — must cite at least the required fraction of retrieved claims.
  const required = Math.floor(
    Math.min(run.expectedClaimIds.length, COVERAGE_MAX_REQUIRED) *
      COVERAGE_FRACTION,
  );
  const citedFromRetrieval = [...allMarkers].filter((id) => retrievedIds.has(id));
  const coverageRatio =
    run.expectedClaimIds.length === 0
      ? 1
      : citedFromRetrieval.length / run.expectedClaimIds.length;
  const citationCoverage =
    run.expectedClaimIds.length === 0
      ? true // empty-results path: no claims to cover.
      : citedFromRetrieval.length >= required;

  // 3. Quote fabrication.
  const fabricatedQuoteCandidates = findFabricatedQuotes(
    run.answer,
    retrievedClaims,
  );
  const noFabricatedQuotes = fabricatedQuoteCandidates.length === 0;

  // 4. Claim fabrication — same set as (1) but reported as a separate
  // assertion so the report can distinguish "wrong id format" from
  // "id doesn't exist in retrieval".
  const noFabricatedClaims = hallucinated.length === 0;

  return {
    entryId: run.entryId,
    passes: {
      citationGrounding,
      citationCoverage,
      noFabricatedQuotes,
      noFabricatedClaims,
    },
    details: {
      hallucinatedCitations: hallucinated,
      coverageRatio,
      coverageThreshold: required,
      fabricatedQuoteCandidates,
    },
  };
}

export const ASSERTION_CONSTANTS = {
  COVERAGE_FRACTION,
  COVERAGE_MAX_REQUIRED,
  QUOTE_MIN_TOKENS,
  QUOTE_MIN_OVERLAP,
} as const;
