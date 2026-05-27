#!/usr/bin/env node
/**
 * AI-quality mock Claude CLI shim.
 *
 * This shim is RICHER than the e2e mock at `tests/e2e/scripts/mock-claude.mjs`.
 * The e2e shim emits the same two-citation script for every question so
 * the UI is exercised consistently; that is the right thing for e2e but
 * not for AI-quality, where the harness asserts that the model's
 * citation IDs actually appear in the retrieved set.
 *
 * Strategy:
 *   The Grain API embeds the retrieved claims in the system prompt as a
 *   `<retrieved_claims>` JSON block. We never see that prompt here (the
 *   real CLI is invoked with `--system-prompt`, but `--print` mode pipes
 *   only the USER message to stdin). To stay faithful to the retrieval
 *   contract without re-implementing retrieval inside the shim, we read
 *   a small directive prefix from the user question:
 *
 *      ##AIEVAL claims=CL-0001,CL-0007,CL-0012 mode=ok##
 *      <actual question text>
 *
 * The directive is INJECTED by the harness — never by a real user. The
 * shim then constructs a plausible answer that:
 *   - cites every claim id in `claims=` exactly once,
 *   - optionally injects a single hallucinated citation if mode=hallucinate-cite,
 *   - optionally fabricates a quoted phrase if mode=hallucinate-quote,
 *   - optionally drops every citation if mode=drop-citations,
 *   - optionally emits an empty/refusal answer if mode=refuse.
 *
 * Without a directive (i.e. invoked by a human or by a non-eval test),
 * the shim falls back to a single delta containing a generic "no eval
 * directive" answer so its behavior is observable but harmless.
 *
 * Exit code 0 on success; 1 only if mode=spawn-error (used to test the
 * route's error-path forwarding in the eval harness).
 *
 * NOTE: this shim is only used by `eval:real`-equivalent flows that
 * still want a deterministic answer. The default `eval:dry` path uses
 * a Vitest `vi.mock('streamClaude', ...)` to bypass spawning entirely.
 */

import { setTimeout as wait } from 'node:timers/promises';

function jsonl(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function delta(text) {
  jsonl({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    },
  });
}

let stdinBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => {
  stdinBuf += c;
});

await new Promise((resolve) => {
  process.stdin.on('end', resolve);
  process.stdin.on('close', resolve);
});

// Look for the AIEVAL directive at the start of the message.
const directiveMatch = stdinBuf.match(/^##AIEVAL\s+([^\n#]+)##/);
const directive = directiveMatch
  ? Object.fromEntries(
      directiveMatch[1]
        .trim()
        .split(/\s+/)
        .map((kv) => {
          const [k, v] = kv.split('=');
          return [k, v ?? ''];
        }),
    )
  : null;

jsonl({ type: 'stream_event', event: { type: 'message_start' } });

if (!directive) {
  delta('No AIEVAL directive present; emitting a benign placeholder answer.');
  await wait(5);
  jsonl({ type: 'stream_event', event: { type: 'message_stop' } });
  process.exit(0);
}

const claimIds = (directive.claims ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const mode = directive.mode ?? 'ok';

if (mode === 'spawn-error') {
  delta('partial answer before crash ');
  process.exit(1);
}

if (mode === 'refuse') {
  delta('I do not have enough relevant research to answer that question.');
  jsonl({ type: 'stream_event', event: { type: 'message_stop' } });
  process.exit(0);
}

// Construct an answer that cites every retrieved claim id at least once.
// We chunk the output so the route's marker-scanner deals with
// boundary-splits, just like real Claude.
const chunks = ['Across the products you selected the strongest pattern is '];
claimIds.forEach((id, i) => {
  if (i > 0) {
    chunks.push(' A related thread appears as well ');
  } else {
    chunks.push('workspace setup taking weeks longer than planned ');
  }
  // Split the marker across two chunks half the time to exercise the
  // citation-marker boundary path.
  if (i % 2 === 0) {
    chunks.push(`[${id.slice(0, 5)}`);
    chunks.push(`${id.slice(5)}]`);
  } else {
    chunks.push(`[${id}]`);
  }
  chunks.push('.');
});

if (mode === 'hallucinate-cite') {
  // Inject a citation id NOT present in the retrieved set.
  chunks.push(' Also see [CL-9999].');
}

if (mode === 'hallucinate-quote') {
  // Fabricate a verbatim quote that won't appear in any evidence.
  chunks.push(
    ' One customer specifically said "this product is impossible to use and we are switching to Git tomorrow".',
  );
}

if (mode === 'drop-citations') {
  // Pretend the model forgot to include any citation marker.
  chunks.length = 0;
  chunks.push(
    'Workspace setup is slow across the selected products and CLI usage is confusing for newcomers.',
  );
}

for (const text of chunks) {
  delta(text);
  await wait(3);
}

jsonl({ type: 'stream_event', event: { type: 'message_stop' } });
process.exit(0);
