// Unit tests for apps/api/src/lib/process.ts — SIGTERM → 2s → SIGKILL
// escalation. We never spawn a real binary; the SUT only needs the
// `exitCode`, `signalCode`, and `kill()` surface area of ChildProcess.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { killWithEscalation } from '../../../../apps/api/src/lib/process.ts';

function makeStubProc(): ChildProcess {
  const stub: Partial<ChildProcess> = {
    exitCode: null,
    signalCode: null,
    kill: vi.fn().mockReturnValue(true),
  };
  return stub as ChildProcess;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('killWithEscalation', () => {
  it('sends SIGTERM immediately', () => {
    const proc = makeStubProc();
    killWithEscalation(proc);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('escalates to SIGKILL after 2s if the process has not exited', () => {
    const proc = makeStubProc();
    killWithEscalation(proc);
    expect(proc.kill).toHaveBeenCalledTimes(1);

    // 1.5s — not yet.
    vi.advanceTimersByTime(1_500);
    expect(proc.kill).toHaveBeenCalledTimes(1);

    // Cross the 2s boundary.
    vi.advanceTimersByTime(600);
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    expect(proc.kill).toHaveBeenCalledTimes(2);
  });

  it('does NOT send SIGKILL if the process exits within 2s', () => {
    const proc = makeStubProc();
    killWithEscalation(proc);

    // Simulate the child noticing SIGTERM and exiting.
    (proc as { exitCode: number | null }).exitCode = 143;

    vi.advanceTimersByTime(3_000);
    // Still only the original SIGTERM.
    expect(proc.kill).toHaveBeenCalledTimes(1);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('is a no-op if the process has already exited', () => {
    const proc = makeStubProc();
    (proc as { exitCode: number | null }).exitCode = 0;
    killWithEscalation(proc);
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it('is a no-op if the process has already been signaled', () => {
    const proc = makeStubProc();
    (proc as { signalCode: NodeJS.Signals | null }).signalCode = 'SIGTERM';
    killWithEscalation(proc);
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it('does not escalate if the process exits via signal after SIGTERM', () => {
    const proc = makeStubProc();
    killWithEscalation(proc);
    (proc as { signalCode: NodeJS.Signals | null }).signalCode = 'SIGTERM';
    vi.advanceTimersByTime(3_000);
    expect(proc.kill).toHaveBeenCalledTimes(1);
  });
});
