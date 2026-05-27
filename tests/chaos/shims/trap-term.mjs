#!/usr/bin/env node
/**
 * Chaos shim: TRAP-TERM.
 *
 * Behaviour:
 *   - Drains stdin.
 *   - Installs a SIGTERM handler that intentionally IGNORES the signal
 *     (logs to stderr, then continues).
 *   - Stays alive forever otherwise.
 *
 * Exercises killWithEscalation() in apps/api/src/lib/process.ts:
 *   - The wrapper sends SIGTERM (no-op here).
 *   - After KILL_ESCALATION_MS (2_000 ms) the wrapper sends SIGKILL.
 *   - SIGKILL cannot be trapped, so the child dies.
 *
 * Pass criteria:
 *   - Child eventually exits with signal SIGKILL (or `null` exit code
 *     with signalCode === 'SIGKILL').
 *   - Time from SIGTERM to SIGKILL is ≈ 2 s (within 200 ms tolerance).
 *
 * Verify locally:
 *   echo "hi" | node tests/chaos/shims/trap-term.mjs &
 *   pid=$!
 *   sleep 1
 *   kill -TERM $pid    # trapped — child should NOT exit
 *   sleep 1
 *   ps -p $pid         # still running
 *   kill -KILL $pid    # SIGKILL — child exits immediately
 */

process.stdin.setEncoding('utf8');
process.stdin.on('data', () => {});

let trapCount = 0;
process.on('SIGTERM', () => {
  trapCount += 1;
  process.stderr.write(`chaos: trapped SIGTERM (#${trapCount}), ignoring\n`);
});

// Park forever. The interval keeps the event loop alive between traps.
setInterval(() => {}, 60_000);
