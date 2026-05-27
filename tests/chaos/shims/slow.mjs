#!/usr/bin/env node
/**
 * Chaos shim: SLOW.
 *
 * Behaviour:
 *   - Drains stdin.
 *   - Emits one text_delta every 65 seconds.
 *
 * The idle timer in apps/api/src/lib/claude.ts is 60s and resets on
 * ANY stdout activity. By spacing deltas at 65s, the FIRST gap exceeds
 * the timer and the wrapper should emit the user-safe idle-timeout
 * error and kill the child.
 *
 * Use this scenario sparingly — each invocation takes >60s of wall time.
 *
 * Verify locally:
 *   echo "hi" | node tests/chaos/shims/slow.mjs
 *   # First delta arrives at t=65s; if the wrapper is in front, it should
 *   # have killed this process at t=60s instead.
 */

import { setTimeout as wait } from 'node:timers/promises';

const GAP_MS = Number(process.env.GRAIN_CHAOS_SLOW_GAP_MS ?? 65_000);

let stdinDone = false;
process.stdin.setEncoding('utf8');
process.stdin.on('data', () => {});
process.stdin.on('end', () => {
  stdinDone = true;
});

function delta(text) {
  process.stdout.write(
    JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text },
      },
    }) + '\n',
  );
}

// Wait for stdin to fully drain (mirrors mock-claude.mjs) so we do not
// race the parent.
await new Promise((resolve) => {
  if (stdinDone) return resolve(undefined);
  process.stdin.on('end', resolve);
  process.stdin.on('close', resolve);
});

// Now produce deltas with deliberately long gaps. The wrapper should
// never see the second one.
for (let i = 0; i < 5; i += 1) {
  await wait(GAP_MS);
  delta(`slow chunk ${i} `);
}

process.exit(0);
