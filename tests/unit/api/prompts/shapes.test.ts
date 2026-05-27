// Unit tests for apps/api/src/prompts/shapes.ts.

import { describe, expect, it } from 'vitest';
import {
  SHAPE_DIRECTIVES,
  CUSTOMER_SCOPE_DIRECTIVE,
} from '../../../../apps/api/src/prompts/shapes.ts';
import { QUESTION_SHAPES, type QuestionShape } from '@grain/types';

describe('SHAPE_DIRECTIVES', () => {
  it.each(QUESTION_SHAPES)('has a non-empty directive for %s', (shape) => {
    expect(SHAPE_DIRECTIVES[shape as QuestionShape]).toBeTruthy();
    expect(SHAPE_DIRECTIVES[shape as QuestionShape].length).toBeGreaterThan(20);
  });

  it('all shape directives are unique', () => {
    const set = new Set(Object.values(SHAPE_DIRECTIVES));
    expect(set.size).toBe(QUESTION_SHAPES.length);
  });

  it('explore directive mentions themes / synthesis', () => {
    expect(SHAPE_DIRECTIVES.explore.toLowerCase()).toMatch(
      /(themes?|synthesis)/,
    );
  });

  it('verify directive mentions yes/no answer-first framing', () => {
    expect(SHAPE_DIRECTIVES.verify.toLowerCase()).toContain('yes/no');
  });

  it('trends directive mentions recency ordering', () => {
    expect(SHAPE_DIRECTIVES.trends.toLowerCase()).toContain('recency');
  });
});

describe('CUSTOMER_SCOPE_DIRECTIVE', () => {
  it('references the evidence.customer filter contract', () => {
    expect(CUSTOMER_SCOPE_DIRECTIVE).toContain('evidence[].customer');
  });

  it('tells the model to say so explicitly on empty match', () => {
    expect(CUSTOMER_SCOPE_DIRECTIVE.toLowerCase()).toContain('say so explicitly');
  });
});
