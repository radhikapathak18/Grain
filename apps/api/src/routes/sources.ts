// Source document detail endpoint.
//
//   GET /api/sources/:id   full transcript/passage payload for the source
//                          panel (architecture plan §3.3).
//
// Graceful fallback: if no source file exists for `id`, we look across
// CLAIMS for evidence items that reference it. If we find any, we
// synthesize a placeholder SourceDocument carrying the citation
// excerpts but no fabricated body — the frontend renders a source-type
// specific notice instead of a fake transcript. This keeps the demo
// honest about which sources have full anonymized documents and which
// only have cited passages (real CS / research / analytics data lives
// in claims.ts but does not always have a corresponding source doc).

import { Hono } from 'hono';
import { CLAIMS } from '../data/claims.ts';
import { SOURCE_BY_ID, type SourceDocument } from '../data/sources/index.ts';
import type { SourceType } from '@grain/types';

export const sourceRoutes = new Hono();

const PLACEHOLDER_TITLE: Record<SourceType, string> = {
  zoom: 'Research interview transcript',
  slack: 'Slack thread summary',
  pendo: 'Pendo analytics aggregation',
  gong: 'Gong call recording',
  confluence: 'Confluence document',
};

function synthesizePlaceholder(id: string): SourceDocument | null {
  // Gather all evidence items across CLAIMS that reference this id. There
  // is normally only one source_type per source_id; if for any reason it
  // varies, take the first.
  type Hit = {
    source_type: SourceType;
    source_date: string;
    customer?: string;
    passage: string;
  };
  const hits: Hit[] = [];
  for (const claim of CLAIMS) {
    for (const e of claim.evidence) {
      if (e.source_id !== id) continue;
      hits.push({
        source_type: e.source_type,
        source_date: e.source_date,
        customer: e.customer,
        passage: e.passage,
      });
    }
  }
  if (hits.length === 0) return null;

  const sourceType = hits[0]!.source_type;
  // Earliest date wins — matches how the demo corpus uses one date per id.
  const date = [...hits.map((h) => h.source_date)].sort()[0]!;
  const customer = hits.find((h) => h.customer)?.customer;

  // Deduplicate passages while preserving order (a passage can be cited
  // by multiple claims).
  const seen = new Set<string>();
  const excerpts: SourceDocument['excerpts'] = [];
  for (const h of hits) {
    if (seen.has(h.passage)) continue;
    seen.add(h.passage);
    excerpts.push({ passage: h.passage, offset_hint: '' });
  }

  return {
    id,
    type: sourceType,
    title: PLACEHOLDER_TITLE[sourceType],
    date,
    customer,
    body: '',
    excerpts,
    placeholder: true,
  };
}

sourceRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const source = SOURCE_BY_ID[id];
  if (source) return c.json(source);

  const fallback = synthesizePlaceholder(id);
  if (fallback) return c.json(fallback);

  return c.json({ error: 'source not found' }, 404);
});
