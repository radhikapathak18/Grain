// LLM-as-judge rubric. Five dimensions, each scored 1–5.
//
// We send the judge: the question, the role, the expected_tone /
// expected_persona, the retrieved claim ids + claim texts, and the
// model's full answer. We do NOT send the system prompt — the judge
// is rating what the user sees, not the prompt engineering.
//
// Threshold: average across all five dimensions must be >= 4.0 for
// the answer to pass. (Tunable; baseline writer also tracks per-
// dimension averages so a regression in one axis is visible even if
// the mean still passes.)

import type { Claim, Role } from '@grain/types';

export const JUDGE_DIMENSIONS = [
  'accuracy',
  'faithfulness',
  'role_framing',
  'citation_quality',
  'refusal_handling',
] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

export type JudgeScore = Record<JudgeDimension, number> & {
  notes: string;
};

export const JUDGE_PASS_AVG = 4.0;

const RUBRIC = `
You are a strict evaluator for an internal research-synthesis tool.
The tool retrieves a deterministic set of pre-extracted research
"claims" and asks Claude to synthesize an answer that cites them.
Your job is to rate the answer on FIVE dimensions, each on a 1-5
integer scale (5 = best). Be a hard grader. 4 means very good with
minor issues. 5 means flawless for the audience.

DIMENSIONS:
1. accuracy             — Does the answer make claims that the
                          retrieved evidence supports? Penalize any
                          factual statement that isn't grounded.
2. faithfulness         — Does the prose stay inside what the claims
                          and evidence passages actually say? Penalize
                          paraphrase drift, invented details, made-up
                          quotes, and overclaims relative to trust tier.
3. role_framing         — Does the answer match the EXPECTED role
                          voice (e.g. PMs want frequency + ship hints;
                          designers want quotes + emotion + journey
                          stage)? Penalize generic prose.
4. citation_quality     — Are [CL-NNNN] markers placed after the
                          sentences they support? Are all material
                          claims cited? Do cited ids actually exist
                          in the retrieved set?
5. refusal_handling     — If the retrieved set is empty or weak, does
                          the answer honestly say so instead of
                          inventing content? For non-empty inputs,
                          score 5 if the answer engages confidently
                          with the evidence; score lower if it hedges
                          unnecessarily.

OUTPUT FORMAT — return ONLY a JSON object on a single line, no prose:
{"accuracy":<1-5>,"faithfulness":<1-5>,"role_framing":<1-5>,"citation_quality":<1-5>,"refusal_handling":<1-5>,"notes":"<one-sentence rationale>"}

Do not include any text before or after the JSON.
`.trim();

export function buildJudgePrompt(input: {
  question: string;
  role: Role;
  expected_persona?: string;
  expected_tone?: string;
  retrievedClaims: Claim[];
  answer: string;
}): string {
  const claimBlock = input.retrievedClaims
    .map(
      (c) =>
        `  - ${c.id} (${c.product}/${c.area}/${c.trust_tier}, persona=${c.persona}): ${c.text}`,
    )
    .join('\n');
  return [
    RUBRIC,
    '',
    `QUESTION: ${input.question}`,
    `ROLE: ${input.role}`,
    `EXPECTED_PERSONA: ${input.expected_persona ?? '<unspecified>'}`,
    `EXPECTED_TONE: ${input.expected_tone ?? '<unspecified>'}`,
    '',
    'RETRIEVED CLAIMS (the only evidence the synthesizer was given):',
    claimBlock || '  (none — empty retrieval; answer should be a polite refusal)',
    '',
    'ANSWER TO GRADE:',
    input.answer || '(empty answer)',
  ].join('\n');
}

export function avgScore(s: JudgeScore): number {
  const vals = JUDGE_DIMENSIONS.map((d) => s[d]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Parse the judge's JSON output. Tolerant of code-fence wrappers; the
 * rubric forbids them but real models sometimes ignore that.
 */
export function parseJudgeOutput(raw: string): JudgeScore | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  // Find the first {...} balanced block.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const out: Partial<JudgeScore> = { notes: typeof obj.notes === 'string' ? obj.notes : '' };
  for (const d of JUDGE_DIMENSIONS) {
    const v = obj[d];
    if (typeof v !== 'number' || v < 1 || v > 5) return null;
    out[d] = Math.round(v);
  }
  return out as JudgeScore;
}
