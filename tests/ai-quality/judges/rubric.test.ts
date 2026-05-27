// Unit tests for the judge rubric parser. The judge is the only
// component in this suite whose correctness is independent of a
// running API, so we exercise the parser thoroughly here.

import { describe, it, expect } from 'vitest';
import {
  parseJudgeOutput,
  avgScore,
  buildJudgePrompt,
  JUDGE_DIMENSIONS,
} from './rubric.ts';
import type { Claim } from '@grain/types';

describe('parseJudgeOutput', () => {
  it('parses a clean single-line JSON verdict', () => {
    const raw =
      '{"accuracy":5,"faithfulness":4,"role_framing":4,"citation_quality":5,"refusal_handling":4,"notes":"clean"}';
    const parsed = parseJudgeOutput(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.accuracy).toBe(5);
    expect(parsed!.notes).toBe('clean');
  });

  it('tolerates a ```json fenced block (model violates the rubric)', () => {
    const raw =
      '```json\n{"accuracy":3,"faithfulness":3,"role_framing":3,"citation_quality":3,"refusal_handling":3,"notes":"meh"}\n```';
    const parsed = parseJudgeOutput(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.faithfulness).toBe(3);
  });

  it('tolerates leading prose before the JSON object', () => {
    const raw =
      'Here is my evaluation. {"accuracy":2,"faithfulness":2,"role_framing":2,"citation_quality":2,"refusal_handling":2,"notes":"weak"}';
    const parsed = parseJudgeOutput(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.accuracy).toBe(2);
  });

  it('rejects out-of-range scores', () => {
    const raw =
      '{"accuracy":7,"faithfulness":4,"role_framing":4,"citation_quality":4,"refusal_handling":4,"notes":""}';
    expect(parseJudgeOutput(raw)).toBeNull();
  });

  it('rejects missing dimensions', () => {
    const raw = '{"accuracy":4,"notes":"incomplete"}';
    expect(parseJudgeOutput(raw)).toBeNull();
  });

  it('rejects non-number scores', () => {
    const raw =
      '{"accuracy":"4","faithfulness":4,"role_framing":4,"citation_quality":4,"refusal_handling":4,"notes":"bad type"}';
    expect(parseJudgeOutput(raw)).toBeNull();
  });

  it('rounds fractional scores to integers', () => {
    const raw =
      '{"accuracy":4.4,"faithfulness":4.6,"role_framing":4,"citation_quality":4,"refusal_handling":4,"notes":""}';
    const parsed = parseJudgeOutput(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.accuracy).toBe(4);
    expect(parsed!.faithfulness).toBe(5);
  });
});

describe('avgScore', () => {
  it('returns the arithmetic mean across the five dimensions', () => {
    const s = {
      accuracy: 5,
      faithfulness: 4,
      role_framing: 3,
      citation_quality: 4,
      refusal_handling: 4,
      notes: '',
    };
    expect(avgScore(s)).toBeCloseTo(4.0, 5);
  });
});

describe('buildJudgePrompt', () => {
  const fakeClaim: Claim = {
    id: 'CL-0001',
    text: 'Workspace setup takes weeks.',
    product: 'helix-core',
    area: 'onboarding',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 's1',
        source_type: 'gong',
        passage: 'two-three weeks longer than planned',
        source_url: '/source/s1',
        source_date: '2025-11-04',
      },
    ],
    evidence_count: 1,
    most_recent_evidence_at: '2025-11-04',
    trust_tier: 'T2',
  };

  it('includes question, role, retrieved claims, and answer in the prompt', () => {
    const p = buildJudgePrompt({
      question: 'What about onboarding?',
      role: 'pm',
      expected_persona: 'release-manager',
      expected_tone: 'frequency-led',
      retrievedClaims: [fakeClaim],
      answer: 'Three customers report long onboarding [CL-0001].',
    });
    expect(p).toContain('What about onboarding?');
    expect(p).toContain('ROLE: pm');
    expect(p).toContain('release-manager');
    expect(p).toContain('CL-0001');
    expect(p).toContain('[CL-0001]');
    expect(p).toContain('Three customers report long onboarding');
    // All five dimensions are explained.
    for (const d of JUDGE_DIMENSIONS) {
      expect(p).toContain(d);
    }
  });

  it('handles empty retrieval (refusal case)', () => {
    const p = buildJudgePrompt({
      question: 'gibberish?',
      role: 'pm',
      retrievedClaims: [],
      answer: 'No supporting evidence found.',
    });
    expect(p).toMatch(/empty retrieval/i);
  });
});
