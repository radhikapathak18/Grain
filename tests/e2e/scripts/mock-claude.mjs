#!/usr/bin/env node
/**
 * Mock Claude CLI binary used by the Grain E2E suite.
 *
 * The real `apps/api/src/lib/claude.ts` shells out to `$CLAUDE_BIN` with:
 *
 *   echo "USER QUESTION" | $CLAUDE_BIN -p --model sonnet \
 *     --output-format stream-json --verbose \
 *     --include-partial-messages \
 *     --system-prompt "SYSTEM TEXT"
 *
 * It only inspects stdout lines of the shape:
 *
 *   { "type": "stream_event",
 *     "event": { "type": "content_block_delta",
 *                "delta": { "type": "text_delta", "text": "..." } } }
 *
 * Anything else on stdout is ignored. We mimic that minimal envelope and
 * emit text in small chunks so the SSE delta loop, the citation marker
 * scanner, and the UI cursor animation all exercise the same code paths
 * they would against the real CLI.
 *
 * The mock always includes [CL-0001] and [CL-0002] markers so the chat
 * UI surfaces two citation chips per answer. If the inbound question
 * contains "gibberish" we emit a clearly empty / unhelpful answer so the
 * gibberish-path test can assert on it (this is *in addition* to the
 * real "no claims retrieved" empty-shape branch the route owns).
 *
 * stdin is consumed (and discarded) so the API's `proc.stdin.end()` does
 * not race with our write loop.
 *
 * Exit code 0. The wrapper treats non-zero as a fatal error.
 */

import { setTimeout as wait } from 'node:timers/promises';

const args = process.argv.slice(2);

// If invoked with --emit-error, write one well-formed delta then a parse
// error line to stdout and exit 1. Used by one test to verify the
// error-path behavior.
const EMIT_ERROR = args.includes('--emit-error');

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

// Consume stdin so the parent's stdin.end() resolves immediately. We do
// NOT need the question content for the mock to behave correctly — the
// real CLI sees it; we only need to drain the pipe so it does not block.
let stdinBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  stdinBuf += chunk;
});

await new Promise((resolve) => {
  process.stdin.on('end', resolve);
  process.stdin.on('close', resolve);
});

// Decide which canned answer to emit based on the question. We don't try
// to be clever — we look for marker substrings the tests inject.
const lower = stdinBuf.toLowerCase();
const isGibberish = lower.includes('zzzqqq'); // distinctive marker
const isTrends = lower.includes('over the last') || lower.includes('trend');

// Tiny init / message_start envelope so the idle timer in claude.ts
// resets before the first delta. The wrapper ignores these — they only
// exist to mirror real CLI behavior.
jsonl({ type: 'stream_event', event: { type: 'message_start' } });

if (EMIT_ERROR) {
  delta('partial response then error ');
  // Bogus line on stdout; wrapper should ignore it.
  process.stdout.write('!!! not json\n');
  process.exit(1);
}

if (isGibberish) {
  // Even when retrieval returns claims, the model should be able to
  // produce an honest "nothing here" answer. Useful for asserting the
  // "no citations" UI state with at least one delta of text.
  delta('I do not have enough relevant research to answer that question.');
  await wait(20);
  process.exit(0);
}

// Default: a streamed answer with two citation markers split across
// chunks so the chat route's marker-scanner overlap logic exercises.
const chunks = isTrends
  ? [
      'Recent trends show ',
      'workspace setup friction climbing ',
      '[CL-0001]',
      ' while CLI confusion ',
      'has stayed flat ',
      '[CL-0002]',
      '.',
    ]
  : [
      'Across the products you selected ',
      'the strongest pattern is ',
      'workspace setup taking weeks longer than planned ',
      '[CL-0001]',
      '. A related thread is ',
      'CLI confusion in the merge flow ',
      '[CL-0002]',
      '.',
    ];

for (const text of chunks) {
  delta(text);
  // Small delay so the SSE consumer sees multiple `delta` events rather
  // than one batched write. 8ms is well under any test timeout but
  // enough to make the streaming UI visible to the human eye during
  // headed runs.
  await wait(8);
}

jsonl({ type: 'stream_event', event: { type: 'message_stop' } });
process.exit(0);
