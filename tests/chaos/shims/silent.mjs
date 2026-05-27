#!/usr/bin/env node
/**
 * Chaos shim: SILENT.
 *
 * Behaviour:
 *   - Drains stdin so the parent's stdin.end() resolves.
 *   - Writes NOTHING to stdout.
 *   - Stays alive until killed by a signal.
 *
 * Forces the IDLE_TIMEOUT_MS (60s) path in apps/api/src/lib/claude.ts:
 * the idle timer is armed at spawn and never re-armed because no stdout
 * activity ever happens. After 60s the wrapper should:
 *   1. push { kind: 'error', message: 'synthesis stalled; please try again' }
 *   2. call killWithEscalation(proc) → SIGTERM, then SIGKILL after 2s.
 *
 * Verify locally:
 *   echo "hi" | node tests/chaos/shims/silent.mjs &
 *   # the process should stay alive; kill it manually with: kill %1
 */

process.stdin.resume();
process.stdin.on('data', () => {
  // Intentionally swallow — never reply.
});

// Defensive: even if stdin closes, do not exit.
process.stdin.on('end', () => {
  // no-op
});
process.stdin.on('close', () => {
  // no-op
});

// Park forever. The interval keeps the event loop alive without
// producing any observable output.
setInterval(() => {
  // no-op
}, 60_000);

// Respond to SIGTERM so a polite kill works, but make SIGKILL the only
// guaranteed exit. We exit on SIGTERM here (instead of trapping it) so
// THIS shim only exercises the idle-timeout path, not the kill
// escalation path (that has its own dedicated shim: trap-term.mjs).
process.on('SIGTERM', () => {
  process.exit(143);
});
