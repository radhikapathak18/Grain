// Unit tests for apps/api/src/lib/claude.ts — the Claude CLI subprocess
// wrapper. We mock `node:child_process.spawn` to drive every stdout /
// stderr / close path without touching a real binary.
//
// Coverage targets (H-risk):
//   * JSONL stream-event filtering: only `content_block_delta.text_delta`
//     events become `kind: 'delta'`; junk / partial / malformed lines are
//     dropped silently.
//   * Delta parsing across chunk boundaries (a single text_delta split
//     across two `stdout.on('data')` chunks).
//   * Idle timeout — fires after IDLE_TIMEOUT_MS without any stdout.
//   * Absolute timeout — fires regardless of streaming progress.
//   * Escalating SIGTERM → SIGKILL via killWithEscalation.
//   * Non-zero exit emits a safe error event; stderr ring buffer is bounded.
//   * Spawn-error event emits a safe error.
//   * Generator abandonment (consumer breaks early) triggers escalate-kill
//     via the finally block.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { EventEmitter } from 'node:events';

// ---- spawn() mock ---------------------------------------------------------
//
// We expose a controllable fake child process from the spawn mock so each
// test can push stdout/stderr chunks, fire 'error' / 'close' events, and
// observe kill calls. spawn is hoisted via vi.mock so it's in place before
// the SUT imports it.

type FakeChild = EventEmitter & {
  stdout: EventEmitter & { setEncoding: (e: string) => void };
  stderr: EventEmitter & { setEncoding: (e: string) => void };
  stdin: { write: (s: string) => void; end: () => void };
  kill: ReturnType<typeof vi.fn>;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
};

function makeFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  const stdout = new EventEmitter() as FakeChild['stdout'];
  stdout.setEncoding = vi.fn();
  const stderr = new EventEmitter() as FakeChild['stderr'];
  stderr.setEncoding = vi.fn();
  child.stdout = stdout;
  child.stderr = stderr;
  child.stdin = { write: vi.fn(), end: vi.fn() };
  child.kill = vi.fn((signal?: NodeJS.Signals) => {
    // Simulate the kernel: SIGKILL marks the process exited; SIGTERM does
    // not, so the escalation timer can fire it again.
    if (signal === 'SIGKILL') {
      child.exitCode = null;
      child.signalCode = 'SIGKILL';
    }
    return true;
  });
  child.exitCode = null;
  child.signalCode = null;
  return child;
}

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// ---- helpers --------------------------------------------------------------

function streamEventLine(text: string): string {
  return (
    JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text },
      },
    }) + '\n'
  );
}

async function collect<T>(iter: AsyncGenerator<T>, limit = 50): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) {
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

// ---- shared state per test -----------------------------------------------

let fake: FakeChild;
let consoleErrorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers();
  fake = makeFakeChild();
  spawnMock.mockReset();
  spawnMock.mockReturnValue(fake);
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  consoleErrorSpy.mockRestore();
});

describe('streamClaude', () => {
  describe('spawn invocation', () => {
    it('invokes spawn with the expected CLI arguments', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({
        systemPrompt: 'SYS',
        userMessage: 'hi',
        model: 'sonnet',
      });

      // Kick the generator so spawn() runs.
      const next = gen.next();
      // Resolve cleanly.
      fake.emit('close', 0);
      await next;

      expect(spawnMock).toHaveBeenCalledTimes(1);
      const [, args] = spawnMock.mock.calls[0]!;
      expect(args).toContain('-p');
      expect(args).toContain('--model');
      expect(args).toContain('sonnet');
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
      expect(args).toContain('--verbose');
      expect(args).toContain('--include-partial-messages');
      expect(args).toContain('--system-prompt');
      expect(args).toContain('SYS');
    });

    it('writes the user message to stdin and closes it', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'question?' });
      const next = gen.next();
      fake.emit('close', 0);
      await next;
      expect(fake.stdin.write).toHaveBeenCalledWith('question?');
      expect(fake.stdin.end).toHaveBeenCalled();
    });
  });

  describe('delta parsing', () => {
    it('yields delta events for content_block_delta.text_delta lines', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      // Push a complete line.
      fake.stdout.emit('data', streamEventLine('Hello, '));
      fake.stdout.emit('data', streamEventLine('world!'));
      fake.emit('close', 0);

      const events = await collector;
      expect(events).toEqual([
        { kind: 'delta', text: 'Hello, ' },
        { kind: 'delta', text: 'world!' },
        { kind: 'done' },
      ]);
    });

    it('buffers a delta split across two stdout chunks', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      const full = streamEventLine('split across chunks');
      const cut = Math.floor(full.length / 2);
      fake.stdout.emit('data', full.slice(0, cut));
      // Nothing should be emitted yet — no newline.
      fake.stdout.emit('data', full.slice(cut));
      fake.emit('close', 0);

      const events = await collector;
      expect(events).toEqual([
        { kind: 'delta', text: 'split across chunks' },
        { kind: 'done' },
      ]);
    });

    it('skips malformed JSON lines silently', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      fake.stdout.emit('data', 'not-json\n');
      fake.stdout.emit('data', '{"broken":\n');
      fake.stdout.emit('data', streamEventLine('ok'));
      fake.emit('close', 0);

      const events = await collector;
      expect(events).toEqual([
        { kind: 'delta', text: 'ok' },
        { kind: 'done' },
      ]);
    });

    it('ignores stream_event lines that are not text_delta', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      fake.stdout.emit(
        'data',
        JSON.stringify({
          type: 'stream_event',
          event: { type: 'message_start' },
        }) + '\n',
      );
      fake.stdout.emit(
        'data',
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'thinking_delta', text: 'unused' },
          },
        }) + '\n',
      );
      fake.stdout.emit('data', streamEventLine('real'));
      fake.emit('close', 0);

      const events = await collector;
      expect(events).toEqual([
        { kind: 'delta', text: 'real' },
        { kind: 'done' },
      ]);
    });

    it('skips empty text deltas', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      fake.stdout.emit('data', streamEventLine(''));
      fake.stdout.emit('data', streamEventLine('non-empty'));
      fake.emit('close', 0);

      const events = await collector;
      expect(events).toEqual([
        { kind: 'delta', text: 'non-empty' },
        { kind: 'done' },
      ]);
    });
  });

  describe('non-zero exit', () => {
    it('emits a safe error event with no stderr leakage', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      fake.stderr.emit('data', 'AUTH FAILURE token=secret\n');
      fake.emit('close', 1);

      const events = await collector;
      expect(events).toHaveLength(1);
      expect(events[0]!.kind).toBe('error');
      if (events[0]!.kind === 'error') {
        // user-safe summary
        expect(events[0]!.message).toBe(
          'synthesis subprocess exited unexpectedly',
        );
        // stderr must NOT bleed into the public event
        expect(events[0]!.message).not.toContain('AUTH');
        expect(events[0]!.message).not.toContain('secret');
      }

      // operator log carries the stderr tail
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logged = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('exit=1');
      expect(logged).toContain('AUTH FAILURE');
    });
  });

  describe('spawn error', () => {
    it('emits an error when the child process emits "error"', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      fake.emit('error', new Error('ENOENT'));
      // Even though the process can still emit close after error, the
      // finished flag is set so subsequent events are ignored.
      fake.emit('close', null);

      const events = await collector;
      expect(events).toHaveLength(1);
      expect(events[0]!.kind).toBe('error');
      if (events[0]!.kind === 'error') {
        expect(events[0]!.message).toBe(
          'failed to start the synthesis subprocess',
        );
        expect(events[0]!.message).not.toContain('ENOENT');
      }
    });
  });

  describe('idle timeout', () => {
    it('kills and emits an error after 60s of stdout silence', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      // Less than the idle threshold — nothing should happen yet.
      vi.advanceTimersByTime(59_000);
      expect(fake.kill).not.toHaveBeenCalled();

      // Cross the threshold.
      vi.advanceTimersByTime(2_000);
      // SIGTERM should have been sent by killWithEscalation.
      expect(fake.kill).toHaveBeenCalledWith('SIGTERM');

      // Surface the error event so the consumer can complete.
      const events = await collector;
      expect(events[0]!.kind).toBe('error');
      if (events[0]!.kind === 'error') {
        expect(events[0]!.message).toBe('synthesis stalled; please try again');
      }
    });

    it('does NOT fire if stdout activity keeps arriving', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      // Heartbeat the subprocess every 30s for 5 minutes.
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(30_000);
        fake.stdout.emit('data', streamEventLine(`tick-${i}`));
      }
      fake.emit('close', 0);

      const events = await collector;
      const errored = events.find((e) => e.kind === 'error');
      expect(errored).toBeUndefined();
      expect(fake.kill).not.toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('absolute timeout', () => {
    it('fires after 5 minutes regardless of streaming progress', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      // Keep emitting stdout every 30s so the idle timer never trips.
      // After 5 minutes the absolute timer should still fire.
      for (let i = 0; i < 9; i++) {
        vi.advanceTimersByTime(30_000);
        fake.stdout.emit('data', streamEventLine(`d${i}`));
      }
      // total elapsed ~ 270s. Cross 300s.
      vi.advanceTimersByTime(31_000);

      expect(fake.kill).toHaveBeenCalledWith('SIGTERM');
      const events = await collector;
      const err = events.find((e) => e.kind === 'error');
      expect(err).toBeDefined();
      if (err && err.kind === 'error') {
        expect(err.message).toBe(
          'synthesis exceeded the time limit; please try again',
        );
      }
    });
  });

  describe('kill escalation (SIGTERM -> SIGKILL)', () => {
    it('sends SIGKILL 2s after SIGTERM if the child still has not exited', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      // Trip the idle timer.
      vi.advanceTimersByTime(60_000);
      expect(fake.kill).toHaveBeenCalledWith('SIGTERM');
      expect(fake.kill).toHaveBeenCalledTimes(1);

      // 2s of further inaction should escalate.
      vi.advanceTimersByTime(2_000);
      expect(fake.kill).toHaveBeenCalledWith('SIGKILL');

      await collector;
    });
  });

  describe('stderr ring buffer', () => {
    it('trims stderr to STDERR_MAX_BYTES (16 KB) so a chatty CLI cannot OOM', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });
      const collector = collect(gen);

      // Push way more than 16 KB so the ring buffer must trim. The exit-tail
      // logged through console.error is sliced to the last 500 chars, so we
      // assert that the head of the firehose did NOT make it through.
      const head = 'HEAD-MARKER-' + 'x'.repeat(100);
      fake.stderr.emit('data', head);
      for (let i = 0; i < 200; i++) {
        fake.stderr.emit('data', 'tail-' + i + '-' + 'y'.repeat(200) + '\n');
      }
      fake.emit('close', 7);

      await collector;

      const logged = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).not.toContain('HEAD-MARKER');
      expect(logged).toContain('exit=7');
    });
  });

  describe('generator abandonment', () => {
    it('runs killWithEscalation in the finally block when the consumer breaks', async () => {
      const { streamClaude } = await import('../../../../apps/api/src/lib/claude.ts');
      const gen = streamClaude({ systemPrompt: 's', userMessage: 'q' });

      // Pull one delta, then break out of the loop without exhausting.
      fake.stdout.emit('data', streamEventLine('one'));
      const first = await gen.next();
      expect(first.value).toEqual({ kind: 'delta', text: 'one' });

      // Calling .return() runs the finally block.
      await gen.return(undefined as never);

      expect(fake.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
