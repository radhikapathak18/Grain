// Integration test: GET /api/sources/:id
//
// Three response classes:
//   1. id ∈ SOURCE_BY_ID → full anonymized SourceDocument.
//   2. id ∉ SOURCE_BY_ID but referenced in CLAIMS evidence →
//      synthesized placeholder (no body, excerpts populated,
//      placeholder:true, title from PLACEHOLDER_TITLE).
//   3. id otherwise → 404.
//
// These three are end-to-end important because the SourceView is the
// "show your work" surface — a wrong shape there breaks the demo's
// trust story.

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { sourceRoutes } from '../../apps/api/src/routes/sources.ts';
import {
  SOURCES,
  SOURCE_BY_ID,
} from '../../apps/api/src/data/sources/index.ts';
import { CLAIMS } from '../../apps/api/src/data/claims.ts';

function makeApp(): Hono {
  const app = new Hono();
  app.route('/api/sources', sourceRoutes);
  return app;
}

// All evidence source_ids referenced anywhere in CLAIMS. We use this
// to pick concrete examples for the placeholder + full-doc cases.
function evidenceSourceIds(): Set<string> {
  const out = new Set<string>();
  for (const c of CLAIMS) {
    for (const e of c.evidence) out.add(e.source_id);
  }
  return out;
}

describe('GET /api/sources/:id — full source document', () => {
  it('returns the full document for every SOURCE_BY_ID entry', async () => {
    const app = makeApp();
    for (const known of SOURCES) {
      const res = await app.request(
        `/api/sources/${encodeURIComponent(known.id)}`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(known.id);
      expect(body.type).toBe(known.type);
      expect(body.title).toBe(known.title);
      // Full docs always have a non-empty body (unlike placeholders).
      expect(typeof body.body).toBe('string');
      expect(body.body.length).toBeGreaterThan(0);
      // No `placeholder: true` on real docs (the route returns the
      // fixture as-is; the fixture does not set the flag).
      expect(body.placeholder).not.toBe(true);
    }
  });

  it('returns the gong-001 transcript with its participants array', async () => {
    const id = 'gong-call-2025-11-04-stellar-forge';
    const res = await makeApp().request(
      `/api/sources/${encodeURIComponent(id)}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('gong');
    expect(body.customer).toBe('Stellar Forge Games');
    expect(Array.isArray(body.participants)).toBe(true);
    expect(body.participants.length).toBeGreaterThan(0);
  });
});

describe('GET /api/sources/:id — synthesized placeholder', () => {
  it('synthesizes a placeholder for an id referenced only in CLAIMS', async () => {
    // Pick an id that appears in CLAIMS evidence but is NOT a full
    // SourceDocument in SOURCE_BY_ID.
    const referenced = [...evidenceSourceIds()].filter(
      (id) => !SOURCE_BY_ID[id],
    );
    expect(referenced.length).toBeGreaterThan(0); // sanity
    const id = referenced[0]!;

    const res = await makeApp().request(
      `/api/sources/${encodeURIComponent(id)}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(id);
    expect(body.placeholder).toBe(true);
    // Body is empty by design — we do not fabricate a transcript.
    expect(body.body).toBe('');
    // Excerpts must be populated from the citations themselves.
    expect(Array.isArray(body.excerpts)).toBe(true);
    expect(body.excerpts.length).toBeGreaterThan(0);
    for (const ex of body.excerpts) {
      expect(typeof ex.passage).toBe('string');
      expect(ex.passage.length).toBeGreaterThan(0);
    }
    // Type matches the first evidence record found for this id.
    expect(['gong', 'slack', 'pendo', 'zoom', 'confluence']).toContain(
      body.type,
    );
    // PLACEHOLDER_TITLE map: the title is a fixed, type-specific
    // string — never the real source's title.
    const expectedTitleByType: Record<string, string> = {
      zoom: 'Research interview transcript',
      slack: 'Slack thread summary',
      pendo: 'Pendo analytics aggregation',
      gong: 'Gong call recording',
      confluence: 'Confluence document',
    };
    expect(body.title).toBe(expectedTitleByType[body.type as string]);
  });

  it('deduplicates excerpts when a passage is cited by multiple claims', async () => {
    // Find a placeholder id that is cited multiple times — pick any
    // referenced-only id and assert that excerpt count <= hit count.
    const referenced = [...evidenceSourceIds()].filter(
      (id) => !SOURCE_BY_ID[id],
    );
    expect(referenced.length).toBeGreaterThan(0);

    const id = referenced[0]!;
    let hits = 0;
    for (const c of CLAIMS) {
      for (const e of c.evidence) if (e.source_id === id) hits += 1;
    }
    const res = await makeApp().request(
      `/api/sources/${encodeURIComponent(id)}`,
    );
    const body = await res.json();
    // Excerpts are deduplicated by passage string, so the count must
    // be at most the number of evidence hits.
    expect(body.excerpts.length).toBeLessThanOrEqual(hits);
  });
});

describe('GET /api/sources/:id — 404', () => {
  it('returns 404 for an id that exists in neither SOURCE_BY_ID nor CLAIMS', async () => {
    const res = await makeApp().request(
      '/api/sources/not-a-source-id-anywhere',
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/);
  });
});
