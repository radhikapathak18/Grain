// Ground-truth eval inputs. `expected_claim_ids` are derived at
// dataset-build time by calling the real retrieve() function — see
// `scripts/build-dataset.ts`. Edit THIS file, not eval-set.json.
//
// Coverage matrix (cell = entry id):
//
//                | helix-core         | p4v               | helix-swarm        | multi-product
//   explore-pm   | EX-PM-HC-ONBOARD   |                   |                    |
//   explore-des  |                    | EX-DES-P4V-WIZ    |                    |
//   explore-eng  |                    |                   |                    | EX-ENG-MULTI-PERF
//   explore-res  |                    |                   | EX-RES-SW-REVIEW   |
//   verify-pm    | VE-PM-HC-MERGE     |                   |                    |
//   verify-des   |                    | VE-DES-P4V-WIZ    |                    |
//   verify-eng   | VE-ENG-HC-CLI      |                   |                    |
//   verify-res   |                    |                   | VE-RES-SW-DASH     |
//   trends-pm    |                    |                   |                    | TR-PM-MULTI
//   trends-des   | TR-DES-HC-FRICTION |                   |                    |
//   trends-eng   |                    | TR-ENG-P4V-PERF   |                    |
//   adversarial  | gibberish-empty + drop-citations + hallucinated-cite probes
//
// Cross-role pair: PAIR-WORKSPACE = same workspace-setup question asked
// as PM and as Designer. Assert same claim ids, judge scores different
// framing.

import type { EvalEntryInput } from '../harness/types.ts';

export const EVAL_INPUTS: readonly EvalEntryInput[] = [
  // -------- EXPLORE --------
  {
    id: 'EX-PM-HC-ONBOARD',
    question:
      'What are the top onboarding pain points for new artists in Helix Core?',
    role: 'pm',
    shape: 'explore',
    products: ['helix-core'],
    expected_persona: 'release-manager',
    expected_tone:
      'frequency-led, business-impact framed, ends with a ship hint',
    notes: 'Single-product, PM voice. Should surface CL-0001 cluster.',
  },
  {
    id: 'EX-DES-P4V-WIZ',
    question: 'Where in the P4V workspace wizard do users get stuck?',
    role: 'designer',
    shape: 'explore',
    products: ['p4v'],
    expected_persona: 'developer',
    expected_tone:
      'quote-driven, names emotion, frames by journey stage (first-run)',
    notes: 'Designer voice on the CL-0002 step-3 abandonment cluster.',
  },
  {
    id: 'EX-ENG-MULTI-PERF',
    question:
      'Across our products, what are the common performance complaints engineers raise about CLI and integrations?',
    role: 'engineer',
    shape: 'explore',
    products: ['helix-core', 'p4v', 'helix-swarm'],
    expected_persona: 'build-engineer',
    expected_tone: 'technical, specifies subsystems and reproduction conditions',
    notes: 'Multi-product, engineering audience.',
  },
  {
    id: 'EX-RES-SW-REVIEW',
    question:
      'What complaints have surfaced about the Swarm review dashboard for tech leads?',
    role: 'researcher',
    shape: 'explore',
    products: ['helix-swarm'],
    expected_persona: 'tech-lead',
    expected_tone: 'methodological, calls out evidence tier and sample sources',
    notes: 'Researcher voice on the CL-0003 Swarm dashboard cluster.',
  },

  // -------- VERIFY --------
  {
    id: 'VE-PM-HC-MERGE',
    question: 'Is there evidence that merge conflicts cause data-loss anxiety?',
    role: 'pm',
    shape: 'verify',
    products: ['helix-core'],
    expected_persona: 'build-engineer',
    expected_tone: 'frequency-led, severity-tagged',
    notes:
      'Verify-shape with strong keyword overlap (merge, conflict, loss).',
  },
  {
    id: 'VE-DES-P4V-WIZ',
    question:
      'Is there evidence that the P4V workspace wizard step 3 confuses first-run users?',
    role: 'designer',
    shape: 'verify',
    products: ['p4v'],
    expected_persona: 'developer',
    expected_tone: 'quote-led, emotional vocabulary',
  },
  {
    id: 'VE-ENG-HC-CLI',
    question:
      'Are there reports of confusion around p4 CLI flag ergonomics?',
    role: 'engineer',
    shape: 'verify',
    products: ['helix-core'],
    expected_persona: 'developer',
    expected_tone: 'precise about subcommand and failure mode',
  },
  {
    id: 'VE-RES-SW-DASH',
    question:
      'Is there documented evidence the Swarm dashboard mixes assigned vs posted reviews?',
    role: 'researcher',
    shape: 'verify',
    products: ['helix-swarm'],
    expected_persona: 'tech-lead',
    expected_tone: 'cites tier, attributes to source type',
  },

  // -------- TRENDS --------
  {
    id: 'TR-PM-MULTI',
    question:
      'What user-experience pain points have been trending across all our products in the last year?',
    role: 'pm',
    shape: 'trends',
    products: ['helix-core', 'p4v', 'helix-swarm'],
    expected_persona: 'release-manager',
    expected_tone: 'recency-led, frequency-led',
    notes: 'Trends shape — claims must be within 12 months.',
  },
  {
    id: 'TR-DES-HC-FRICTION',
    question:
      'Which onboarding friction moments have grown most recently in Helix Core?',
    role: 'designer',
    shape: 'trends',
    products: ['helix-core'],
    expected_persona: 'release-manager',
    expected_tone: 'narrative arc, emotion-anchored',
  },
  {
    id: 'TR-ENG-P4V-PERF',
    question: 'What performance regressions have engineers reported in P4V recently?',
    role: 'engineer',
    shape: 'trends',
    products: ['p4v'],
    expected_persona: 'developer',
    expected_tone: 'technical, version-aware where evidence supports it',
  },

  // -------- CROSS-ROLE PAIR --------
  {
    id: 'PAIR-PM-WORKSPACE',
    pair_id: 'PAIR-WORKSPACE',
    question:
      'What is the evidence about workspace setup taking too long for new users?',
    role: 'pm',
    shape: 'explore',
    products: ['helix-core', 'p4v'],
    expected_persona: 'release-manager',
    expected_tone: 'frequency-led, business-impact framed',
    notes:
      'Pair with PAIR-DES-WORKSPACE. Retrieved claims MUST match; prose MUST differ.',
  },
  {
    id: 'PAIR-DES-WORKSPACE',
    pair_id: 'PAIR-WORKSPACE',
    question:
      'What is the evidence about workspace setup taking too long for new users?',
    role: 'designer',
    shape: 'explore',
    products: ['helix-core', 'p4v'],
    expected_persona: 'release-manager',
    expected_tone: 'quote-led, emotional, first-run framing',
  },

  // -------- ADVERSARIAL / EDGE CASES --------
  {
    id: 'ADV-EMPTY-GIBBERISH',
    question: 'zzzqqq xyxy nonsensicalstringthatcannotmatchaclaim',
    role: 'pm',
    shape: 'verify',
    products: ['helix-core'],
    expected_tone:
      'polite refusal with no fabricated citations; empty-results path',
    notes:
      'Retrieval returns 0 claims so the route short-circuits before calling Claude. Asserts no [CL-NNNN] markers appear and totalCitations=0.',
  },
  {
    id: 'ADV-HALLUCINATE-CITE',
    question: 'What are the top onboarding pain points in Helix Core?',
    role: 'pm',
    shape: 'explore',
    products: ['helix-core'],
    fail_mode: 'hallucinate-cite',
    expected_no_claim_fabrication: false,
    notes:
      'Negative control: shim emits an extra [CL-9999] marker not in retrieval. Citation-grounding assertion MUST fail this row in mock mode.',
  },
  {
    id: 'ADV-DROP-CITATIONS',
    question: 'What are the top onboarding pain points in Helix Core?',
    role: 'pm',
    shape: 'explore',
    products: ['helix-core'],
    fail_mode: 'drop-citations',
    expected_no_claim_fabrication: true,
    notes:
      'Negative control: shim drops every [CL-NNNN] marker. Coverage assertion MUST fail this row in mock mode.',
  },
];
