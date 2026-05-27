import { describe, expect, it } from 'vitest';
import { extractKeywords } from '../../src/lib/keywords.ts';

describe('extractKeywords', () => {
  describe('basic tokenization', () => {
    it('returns lowercase tokens from a simple sentence', () => {
      expect(extractKeywords('Helix Core onboarding workflow')).toEqual([
        'helix',
        'core',
        'onboarding',
        'workflow',
      ]);
    });

    it('preserves first-seen order across duplicates', () => {
      expect(extractKeywords('workflow workflow onboarding workflow')).toEqual([
        'workflow',
        'onboarding',
      ]);
    });

    it('lowercases mixed-case input', () => {
      expect(extractKeywords('CONFLICT Resolve MERGE')).toEqual([
        'conflict',
        'resolve',
        'merge',
      ]);
    });
  });

  describe('splitting on non-alphanumeric runs', () => {
    it('splits on punctuation', () => {
      expect(extractKeywords('merge, resolve; conflict!')).toEqual([
        'merge',
        'resolve',
        'conflict',
      ]);
    });

    it('splits on hyphens and slashes', () => {
      expect(extractKeywords('view-spec/client-spec')).toEqual([
        'view',
        'spec',
        'client',
      ]);
    });

    it('handles consecutive separators without producing empty tokens', () => {
      expect(extractKeywords('merge .   ,  resolve')).toEqual([
        'merge',
        'resolve',
      ]);
    });

    it('treats underscores as a separator', () => {
      expect(extractKeywords('view_spec onboarding')).toEqual([
        'view',
        'spec',
        'onboarding',
      ]);
    });
  });

  describe('minimum token length (3+)', () => {
    it('drops tokens shorter than 3 characters', () => {
      expect(extractKeywords('a be cat dog')).toEqual(['cat', 'dog']);
    });

    it('drops pure single characters surrounded by punctuation', () => {
      expect(extractKeywords('x y z workspace')).toEqual(['workspace']);
    });

    it('keeps exactly-3-character tokens', () => {
      expect(extractKeywords('cli ide gui')).toEqual(['cli', 'ide', 'gui']);
    });
  });

  describe('stopword filtering', () => {
    it('filters common articles and prepositions', () => {
      expect(extractKeywords('the merge of the conflict in the branch')).toEqual([
        'merge',
        'conflict',
        'branch',
      ]);
    });

    it('filters auxiliary verbs and pronouns', () => {
      expect(
        extractKeywords('what are they doing with workspace setup'),
      ).toEqual(['doing', 'workspace', 'setup']);
    });

    it('filters domain-specific stopwords (evidence/question/find)', () => {
      expect(extractKeywords('find evidence about this question')).toEqual([]);
    });

    it('returns empty when the entire input is stopwords', () => {
      expect(extractKeywords('the a an is are was were of in on at')).toEqual(
        [],
      );
    });
  });

  describe('numerics and mixed content', () => {
    it('keeps alphanumeric tokens with digits', () => {
      expect(extractKeywords('p4v version 2025.4 release')).toEqual([
        'p4v',
        'version',
        '2025',
        'release',
      ]);
    });

    it('keeps version-like identifiers', () => {
      expect(extractKeywords('upgrade to v2 from v1')).toEqual(['upgrade']);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for an empty string', () => {
      expect(extractKeywords('')).toEqual([]);
    });

    it('returns empty array for whitespace-only input', () => {
      expect(extractKeywords('     \t\n  ')).toEqual([]);
    });

    it('returns empty array for punctuation-only input', () => {
      expect(extractKeywords('!!! ???   ...')).toEqual([]);
    });

    it('handles unicode by stripping it (only [a-z0-9] is kept)', () => {
      expect(extractKeywords('café résumé naïve')).toEqual([
        'caf',
        'sum',
        'na',
        've',
      ].filter((t) => t.length >= 3));
    });

    it('does not throw on extremely long input', () => {
      const long = 'merge '.repeat(5000) + 'unique';
      const out = extractKeywords(long);
      expect(out).toEqual(['merge', 'unique']);
    });
  });

  describe('determinism', () => {
    it('returns the same result for the same input each call', () => {
      const input = 'Helix Core onboarding workflow merges fast';
      const a = extractKeywords(input);
      const b = extractKeywords(input);
      expect(a).toEqual(b);
    });

    it('does not mutate global state across calls', () => {
      extractKeywords('alpha beta gamma');
      expect(extractKeywords('alpha beta gamma')).toEqual([
        'alpha',
        'beta',
        'gamma',
      ]);
    });
  });
});
