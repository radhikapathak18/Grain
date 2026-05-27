#!/usr/bin/env node
/**
 * Chaos shim: NOISY (stderr flood).
 *
 * Behaviour:
 *   - Drains stdin.
 *   - Floods stderr with ~1 MB of repeated warning lines.
 *   - Emits a few valid text_delta lines on stdout.
 *   - Exits non-zero so the wrapper logs the stderr TAIL (≤500 chars).
 *
 * Exercises the STDERR_MAX_BYTES = 16 KB ring buffer in
 * apps/api/src/lib/claude.ts. Without the cap, a megabyte of warnings
 * would keep growing inside Node memory; with the cap, only the tail is
 * retained and only the last 500 chars are logged on non-zero exit.
 *
 * Pass criteria for the scenario that uses this shim:
 *   - Server process memory stays roughly flat (no unbounded growth).
 *   - Audit log line on non-zero exit shows a short stderr-tail (not
 *     the megabyte of repeated text).
 *
 * Verify locally:
 *   echo "hi" | node tests/chaos/shims/noisy.mjs 2>/dev/null
 *   # stdout: 2 deltas. stderr: ~1 MB of repeated warnings (suppressed
 *   # by `2>/dev/null` above).
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

delta('still streaming despite stderr flood ');

// Roughly 1 MB of stderr: 16k of 64-byte lines = 1 MB. We write in
// chunks so the kernel pipe buffer (64 KB on macOS, 64 KB on Linux)
// gets exercised too.
const LINE = 'WARN: chaos: noisy shim diagnostic warning line padding-XXXXX\n'; // 64 chars
const CHUNK_LINES = 256; // 16 KB per chunk
const TOTAL_CHUNKS = 64;  // 64 × 16 KB = 1 MB

for (let i = 0; i < TOTAL_CHUNKS; i += 1) {
  let chunk = '';
  for (let j = 0; j < CHUNK_LINES; j += 1) {
    chunk += LINE;
  }
  process.stderr.write(chunk);
  // Small yield so the parent's `proc.stderr.on('data')` handler runs
  // and exercises the ring-buffer trim path repeatedly, not just once
  // at the end.
  await wait(1);
}

delta('done flooding ');

// Distinctive tail so reviewers can confirm the wrapper logged the
// LAST bytes of stderr (not the first).
process.stderr.write('CHAOS-TAIL-MARKER-END-OF-STREAM\n');

process.exit(2);
