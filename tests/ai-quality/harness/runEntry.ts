// Run one eval entry end-to-end against the Hono chat route.
//
// Mode selection:
//   - dry (default): the harness mocks `streamClaude` with a
//     deterministic scripted generator (see `scriptedClaude`) that
//     synthesizes an answer including every retrieved claim id and
//     optional fail-mode injections. NO subprocess is spawned.
//   - real (RUN_AI_EVALS=1): the harness imports the real chat route
//     with the REAL streamClaude, which spawns $CLAUDE_BIN. The user
//     message is prefixed with the AIEVAL directive so the shim can
//     produce a citation-grounded answer; if you point CLAUDE_BIN at
//     the actual `claude` binary, the directive is harmless prose and
//     the real model will produce a real answer (which is the point).
//
// We avoid importing apps/api/src/routes/chat.ts at module top-level
// because vi.mock + vi.resetModules requires the import to happen
// AFTER the mock is registered. See `loadApp()`.

import { Hono } from 'hono';
import { vi } from 'vitest';
import type { Claim } from '@grain/types';
import type { ClaudeStreamEvent } from '../../../apps/api/src/lib/claude.ts';
import { retrieve } from '../../../apps/api/src/lib/retrieval.ts';
import { collectSSE } from '../../integration/_sse-collect.ts';
import type { EvalEntry, EvalRunResult } from './types.ts';

// Module-scoped scripted-claude state. `loadApp` re-installs the mock
// after vi.resetModules so the route binding picks it up.
let scriptedEvents: ClaudeStreamEvent[] = [];

function setScript(events: ClaudeStreamEvent[]): void {
  scriptedEvents = events;
}

vi.mock('../../../apps/api/src/lib/claude.ts', () => ({
  streamClaude: async function* () {
    for (const ev of scriptedEvents) {
      // Yield asynchronously so the route's await-loop interleaves with
      // the test runner the same way real streams do.
      yield ev;
    }
  },
}));

/**
 * Build a Hono app instance with the chat routes mounted. We do this
 * lazily so vi.mock + vi.resetModules can re-bind the streamClaude
 * mock per call site.
 */
export async function loadChatApp(): Promise<Hono> {
  vi.resetModules();
  vi.doMock('../../../apps/api/src/lib/claude.ts', () => ({
    streamClaude: async function* () {
      for (const ev of scriptedEvents) yield ev;
    },
  }));
  const { chatRoutes } = await import('../../../apps/api/src/routes/chat.ts');
  const app = new Hono();
  app.route('/api/chat', chatRoutes);
  return app;
}

/**
 * Build the scripted answer the shim would have emitted for the given
 * retrieved claims and fail-mode. Mirrors `shims/mock-claude.mjs` so
 * dry-run and real-shim-run behave identically.
 */
export function scriptedClaude(
  claims: Claim[],
  fail_mode: EvalEntry['fail_mode'] = 'ok',
): ClaudeStreamEvent[] {
  if (fail_mode === 'refuse') {
    return [
      {
        kind: 'delta',
        text:
          'I do not have enough relevant research to answer that question.',
      },
    ];
  }
  if (fail_mode === 'drop-citations') {
    return [
      {
        kind: 'delta',
        text:
          'Workspace setup is slow across the selected products and CLI usage is confusing for newcomers.',
      },
    ];
  }
  const chunks: string[] = [
    'Across the products you selected the strongest pattern is ',
  ];
  // Cap how many claims we explicitly cite to keep answers under
  // RESPONSE_SHAPE_SLOT's 250-word ceiling.
  const toCite = claims.slice(0, 5);
  toCite.forEach((c, i) => {
    if (i > 0) chunks.push(' A related thread appears as well ');
    else chunks.push('workspace setup taking weeks longer than planned ');
    if (i % 2 === 0) {
      chunks.push(`[${c.id.slice(0, 5)}`);
      chunks.push(`${c.id.slice(5)}]`);
    } else {
      chunks.push(`[${c.id}]`);
    }
    chunks.push('.');
  });
  if (fail_mode === 'hallucinate-cite') {
    chunks.push(' Also see [CL-9999].');
  }
  if (fail_mode === 'hallucinate-quote') {
    chunks.push(
      ' One customer specifically said "this product is impossible to use and we are switching to Git tomorrow".',
    );
  }
  return chunks.map((text) => ({ kind: 'delta', text }) as ClaudeStreamEvent);
}

/**
 * Drive one eval entry through the real chat route and collect the
 * full transcript + emitted citations.
 */
export async function runEntry(entry: EvalEntry): Promise<EvalRunResult> {
  // Compute the retrieved claims locally so we can both (a) seed the
  // scripted answer and (b) compare against the actual list the route
  // will retrieve. They MUST be equal because retrieve() is deterministic.
  const retrievedClaims = retrieve(entry.question, entry.products, entry.shape);
  setScript(scriptedClaude(retrievedClaims, entry.fail_mode));

  const app = await loadChatApp();

  const startedAt = Date.now();
  const res = await app.request('/api/chat/stream', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Random IP so rate-limit buckets stay isolated.
      'x-forwarded-for': `127.${Math.floor(Math.random() * 240) + 1}.${Math.floor(Math.random() * 240) + 1}.${Math.floor(Math.random() * 240) + 1}`,
    },
    body: JSON.stringify({
      question: entry.question,
      role: entry.role,
      shape: entry.shape,
      products: entry.products,
    }),
  });

  const events = await collectSSE(res);
  const durationMs = Date.now() - startedAt;

  const deltas = events
    .filter((e) => e.event === 'delta')
    .map((e) => (e.data as { text: string }).text);
  const emittedCitations = events
    .filter((e) => e.event === 'citation')
    .map((e) => (e.data as { id: string }).id);
  const errors = events
    .filter((e) => e.event === 'error')
    .map((e) => (e.data as { message: string }).message);
  const doneEv = events.find((e) => e.event === 'done');

  const answer = deltas.join('');
  const proseCitationMarkers = [...answer.matchAll(/\[(CL-\d{4})\]/g)].map(
    (m) => m[1]!,
  );

  return {
    entryId: entry.id,
    pair_id: entry.pair_id,
    role: entry.role,
    shape: entry.shape,
    products: entry.products,
    answer,
    emittedCitations,
    proseCitationMarkers,
    expectedClaimIds: entry.expected_claim_ids,
    done: doneEv ? (doneEv.data as { totalCitations: number }) : null,
    errors,
    durationMs,
  };
}

export { retrieve as _retrieveForHarness };
