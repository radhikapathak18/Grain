#!/usr/bin/env node
/**
 * Realtime shim: SLOW.
 *
 * Behaviour:
 *   - Drains stdin so the parent's stdin.end() resolves.
 *   - Emits one harmless init envelope so the idle timer is reset.
 *   - Sleeps forever (well: 10 minutes) without producing any further
 *     stdout. Stays alive on SIGTERM long enough that the chat-route
 *     absolute timeout (300_000ms in apps/api/src/lib/claude.ts) is the
 *     first thing to fire.
 *
 * Different from chaos/shims/silent.mjs:
 *   - silent.mjs emits NO stdout, so the IDLE_TIMEOUT_MS (60s) fires first.
 *   - slow.mjs emits ONE init line up front, which resets the idle timer,
 *     letting the ABSOLUTE_TIMEOUT_MS (300s) be the trigger instead.
 *
 * Used by the realtime suite's absolute-timeout test EITHER:
 *   a) directly as $CLAUDE_BIN against a real spawned API server
 *      (slow — only run under RUN_REALTIME_SLOW=1), OR
 *   b) reused conceptually: the in-process test mocks streamClaude to
 *      emit the same user-safe `kind:'error'` event the real wrapper
 *      would emit on absolute timeout, then asserts the CLIENT
 *      observation. (The wrapper's own kill behaviour is the chaos
 *      suite's responsibility.)
 *
 * Verify locally:
 *   echo "hi" | node tests/realtime/shims/slow.mjs &
 *   # process should print one init line then park; kill it: kill %1
 */

import { setTimeout as wait } from 'node:timers/promises';

process.stdin.setEncoding('utf8');
process.stdin.on('data', () => {
  // discard
});
process.stdin.on('end', () => {
  // no-op; we are not exiting on stdin close
});
process.stdin.on('close', () => {
  // no-op
});

// One init envelope so the wrapper's idle timer is reset.
process.stdout.write(
  JSON.stringify({
    type: 'stream_event',
    event: { type: 'message_start' },
  }) + '\n',
);

// Park for ~10 minutes. The wrapper's absolute timeout (300s) will
// fire well before this resolves.
await wait(10 * 60 * 1000);

// Should be unreachable in practice — the wrapper will SIGKILL us
// before this point.
process.exit(0);
