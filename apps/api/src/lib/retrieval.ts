// Retrieval — the actual algorithm (architecture plan §3.6).
//
// No embeddings, no vector store, no ranking model. The claims fixture is
// small enough that filter + sort is the whole retrieval system.
//
// DETERMINISM CONTRACT (architecture plan §3.6 demo-moment 7):
//   retrieve() MUST NOT take `role` as input. The PM and Designer versions
//   of the same question receive IDENTICAL retrieved claims. The difference
//   between answers comes entirely from the role prompt, not from different
//   evidence. This is what lets the demo say "same claims, different framing"
//   honestly.

import type { Claim, ProductId, QuestionShape } from '@grain/types';
import { CLAIMS } from '../data/claims.ts';
import { extractKeywords } from './keywords.ts';

const TOP_K = 20;
const TRENDS_WINDOW_MONTHS = 12;

function monthsSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const now = Date.now();
  const millisPerMonth = (365.25 / 12) * 24 * 60 * 60 * 1000;
  return (now - then) / millisPerMonth;
}

export function retrieve(
  question: string,
  products: ProductId[],
  shape: QuestionShape,
): Claim[] {
  const productSet = new Set<ProductId>(products);
  let candidates: Claim[] = CLAIMS.filter((c) => productSet.has(c.product));

  if (shape === 'verify') {
    const keywords = extractKeywords(question);
    if (keywords.length > 0) {
      candidates = candidates.filter((c) => {
        const text = c.text.toLowerCase();
        const area = c.area.toLowerCase();
        const persona = c.persona.toLowerCase();
        for (const kw of keywords) {
          if (text.includes(kw)) return true;
          if (area.includes(kw)) return true;
          if (persona.includes(kw)) return true;
          for (const e of c.evidence) {
            if (e.passage.toLowerCase().includes(kw)) return true;
          }
        }
        return false;
      });
    }
  }

  if (shape === 'trends') {
    candidates = candidates.filter(
      (c) => monthsSince(c.most_recent_evidence_at) <= TRENDS_WINDOW_MONTHS,
    );
    candidates.sort((a, b) =>
      b.most_recent_evidence_at.localeCompare(a.most_recent_evidence_at),
    );
  } else {
    // explore + verify: rank by evidence_count desc, then recency desc
    candidates.sort(
      (a, b) =>
        b.evidence_count - a.evidence_count ||
        b.most_recent_evidence_at.localeCompare(a.most_recent_evidence_at),
    );
  }

  return candidates.slice(0, TOP_K);
}
