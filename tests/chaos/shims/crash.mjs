#!/usr/bin/env node
/**
 * Chaos shim: CRASH.
 *
 * Behaviour:
 *   - Drains stdin.
 *   - Emits one or two valid text_delta lines.
 *   - Calls process.exit(1).
 *
 * Exercises the non-zero exit path in apps/api/src/lib/claude.ts:
 *   - the `close` handler sees a non-zero code,
 *   - it pulls the (≤500-char) stderr tail,
 *   - emits { kind: 'error', message: 'synthesis subprocess exited
 *     unexpectedly' } via emitError() and logs server-side detail.
 *
 * Verify locally:
 *   echo "hi" | node tests/chaos/shims/crash.mjs ; echo "exit=$?"
 *   # Expect two JSON lines on stdout and exit=1.
 */

import { setTimeout as wait } from 'node:timers/promises';

process.stdin.setEncoding('utf8');
process.stdin.on('data', () => {});

await new Promise((resolve) => {
  process.stdin.on('end', resolve);
  process.stdin.on('close', resolve);
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

// Write a couple of valid deltas first so the consumer route observes
// real streaming progress before the failure.
delta('partial synthesis... ');
await wait(20);
delta('more text ');
await wait(20);

// Also push something to stderr so the wrapper has tail content to log.
process.stderr.write('chaos: simulated CLI crash\n');

process.exit(1);
