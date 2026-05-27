import type { ChildProcess } from 'node:child_process';

const KILL_ESCALATION_MS = 2_000;

// SIGTERM the child, then SIGKILL after KILL_ESCALATION_MS if it ignores
// the term. No-op if the process has already exited.
export function killWithEscalation(proc: ChildProcess): void {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  proc.kill('SIGTERM');
  setTimeout(() => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGKILL');
    }
  }, KILL_ESCALATION_MS);
}
