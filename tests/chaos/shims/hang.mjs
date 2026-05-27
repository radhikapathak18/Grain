#!/usr/bin/env node
/**
 * Chaos shim: HANG.
 *
 * Behaviour:
 *   - Drains stdin.
 *   - Emits non-text stream_event envelopes (message_start,
 *     content_block_start) so the wrapper sees stdout activity that is
 *     NOT a text_delta.
 *   - Then goes idle forever.
 *
 * Exercises the subtle path in apps/api/src/lib/claude.ts where
 * armIdleTimer() is reset by every chunk (init + start envelopes count),
 * but NO `delta` events are ever yielded. The expected behaviour is that
 * the idle timer fires 60s after the LAST envelope (here, the last
 * content_block_start), the wrapper emits the user-safe stalled error,
 * and the route's done event never arrives.
 *
 * Verify locally:
 *   echo "hi" | node tests/chaos/shims/hang.mjs
 *   # You will see two init lines on stdout, then nothing. Kill manually.
 */

import { setTimeout as wait } from 'node:timers/promises';

process.stdin.setEncoding('utf8');
process.stdin.on('data', () => {});

await new Promise((resolve) => {
  process.stdin.on('end', resolve);
  process.stdin.on('close', resolve);
});

function jsonl(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

jsonl({ type: 'stream_event', event: { type: 'message_start' } });
await wait(50);
jsonl({ type: 'stream_event', event: { type: 'content_block_start' } });

// Now park forever. No text deltas will ever arrive.
setInterval(() => {}, 60_000);

process.on('SIGTERM', () => {
  process.exit(143);
});
