// Shared types for the AI-quality eval harness.

import type {
  ProductId,
  Role,
  QuestionShape,
  PersonaId,
} from '@grain/types';

export type EvalEntryInput = {
  /** Stable id for cross-run baseline alignment (e.g. "explore-pm-helix-onboarding"). */
  id: string;
  question: string;
  role: Role;
  shape: QuestionShape;
  products: readonly ProductId[];
  /**
   * Optional expected persona — used by the LLM judge to score
   * role-appropriate framing (a "release-manager" persona answer should
   * feel different from a "developer" persona answer).
   */
  expected_persona?: PersonaId;
  /**
   * Free-text guidance for the judge ("imperative, frequency-led",
   * "quote-driven, emotional", etc).
   */
  expected_tone?: string;
  /** Defaults to true. Set false only for adversarial probes. */
  expected_no_claim_fabrication?: boolean;
  /**
   * Cross-role pair marker — entries with the same `pair_id` MUST be
   * the same question (and same retrieval result) asked under
   * different roles. The harness asserts citation IDs are equal.
   */
  pair_id?: string;
  /**
   * Used by the harness to drive the mock-claude shim into a specific
   * failure mode for negative-control rows. Real-Claude runs ignore it.
   *
   * - `ok` (default): normal answer with all retrieved citation ids.
   * - `hallucinate-cite`: appends [CL-9999] to provoke the grounding test.
   * - `hallucinate-quote`: invents a fake verbatim quote.
   * - `drop-citations`: writes prose with no markers.
   * - `refuse`: returns a "not enough research" line.
   */
  fail_mode?:
    | 'ok'
    | 'hallucinate-cite'
    | 'hallucinate-quote'
    | 'drop-citations'
    | 'refuse';
  notes?: string;
};

export type EvalEntry = Omit<EvalEntryInput, 'products' | 'expected_no_claim_fabrication'> & {
  products: ProductId[];
  expected_claim_ids: string[];
  expected_no_claim_fabrication: boolean;
};

export type EvalDataset = {
  generatedAt: string;
  retrievalDeterminismNote: string;
  entries: EvalEntry[];
};

export type EvalRunResult = {
  entryId: string;
  pair_id?: string;
  role: Role;
  shape: QuestionShape;
  products: ProductId[];
  /** Full assembled answer text from all `delta` events, in order. */
  answer: string;
  /** Citation IDs emitted by the API's `citation` SSE event channel. */
  emittedCitations: string[];
  /** Citation IDs the model wrote into the prose (raw [CL-NNNN] markers). */
  proseCitationMarkers: string[];
  /** What retrieval claims the dataset said should be available. */
  expectedClaimIds: string[];
  /** Final SSE `done` payload (or null on error). */
  done: { totalCitations: number } | null;
  /** Any `error` event payloads. */
  errors: string[];
  /** ms wallclock for the whole stream. */
  durationMs: number;
};

export type EvalAssertionResult = {
  entryId: string;
  passes: {
    citationGrounding: boolean;
    citationCoverage: boolean;
    noFabricatedQuotes: boolean;
    noFabricatedClaims: boolean;
  };
  details: {
    hallucinatedCitations: string[];
    coverageRatio: number;
    coverageThreshold: number;
    fabricatedQuoteCandidates: string[];
  };
};
