// Claude CLI subprocess wrapper.
//
// Phase 0 §2: corporate IT blocks Anthropic API keys, so the backend shells
// out to the local `claude` CLI (Claude Code's native binary, which uses
// login auth). Stream output is JSONL on stdout; we forward
// content_block_delta.text_delta chunks as SSE deltas to the frontend.
//
// Verified invocation pattern (Phase 0 §2):
//   echo "USER QUESTION" | $CLAUDE_BIN -p --model sonnet \
//     --output-format stream-json \
//     --include-partial-messages \
//     --system-prompt "SYSTEM TEXT"
//
// --system-prompt REPLACES Claude Code's default system prompt (eliminates
// ~12k tokens of overhead, improves TTFT significantly).
//
// SECURITY: messages emitted as `kind: 'error'` are user-safe summaries —
// they never include stderr, file paths, exit codes, or stack traces.
// Full diagnostic detail is logged through console.error with a stable
// [claude] prefix so operators can correlate without exposure to clients.

import { spawn } from 'node:child_process';
import { env } from '../env.ts';
import { killWithEscalation } from './process.ts';

export type ClaudeStreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export type StreamClaudeInput = {
  systemPrompt: string;
  userMessage: string;
  model?: string; // defaults to env.MODEL
  // Opaque correlation id for server logs. Optional — the wrapper falls
  // back to "-" if the caller does not thread one through.
  requestId?: string;
};

type DeferredResolve = (value: ClaudeStreamEvent) => void;

// Idle timeout: kill the subprocess if it goes IDLE_TIMEOUT_MS without
// ANY stdout activity (not just text deltas — the CLI emits init / rate
// limit / message_start / content_block_start events before the first
// text token, and those count as "alive"). Caught a wedged subprocess
// without cutting off a cold-cache stream that has a long TTFT.
const IDLE_TIMEOUT_MS = 60_000;

// Absolute ceiling. Streaming may keep going for a long time on a fully
// warm cache, but no realistic answer will exceed 5 minutes total. This is
// a last-resort safety net for the demo.
const ABSOLUTE_TIMEOUT_MS = 300_000;

// Cap stderr accumulation. The CLI is fairly chatty on warnings; an
// unbounded buffer is a memory-exhaustion vector if the subprocess goes
// into a warning loop. We only ever log a tail, so 16 KB is plenty.
const STDERR_MAX_BYTES = 16 * 1024;

// Generic, user-safe error strings. Detail is logged server-side via
// console.error so operators can correlate by requestId.
const ERR_SPAWN_FAILED = 'failed to start the synthesis subprocess';
const ERR_IDLE_TIMEOUT = 'synthesis stalled; please try again';
const ERR_ABSOLUTE_TIMEOUT = 'synthesis exceeded the time limit; please try again';
const ERR_NONZERO_EXIT = 'synthesis subprocess exited unexpectedly';

export async function* streamClaude(
  input: StreamClaudeInput,
): AsyncGenerator<ClaudeStreamEvent> {
  const model = input.model ?? env.MODEL;
  const reqId = input.requestId ?? '-';

  const args = [
    '-p',
    '--model', model,
    '--output-format', 'stream-json',
    // `--verbose` is REQUIRED when combining `-p` with `--output-format=stream-json`.
    // Without it the CLI exits with code 1 and the error
    //   "When using --print, --output-format=stream-json requires --verbose".
    '--verbose',
    '--include-partial-messages',
    '--system-prompt', input.systemPrompt,
  ];

  const proc = spawn(env.CLAUDE_BIN, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Bounded queue of events the producer (stdout/exit handlers) push into
  // and the async generator pulls from. We resolve a waiting consumer
  // immediately, else buffer.
  const queue: ClaudeStreamEvent[] = [];
  const waiters: DeferredResolve[] = [];
  let finished = false;

  const push = (event: ClaudeStreamEvent): void => {
    if (finished) return;
    if (event.kind === 'done' || event.kind === 'error') {
      finished = true;
    }
    const waiter = waiters.shift();
    if (waiter) {
      waiter(event);
    } else {
      queue.push(event);
    }
  };

  // Emit a user-safe error event and log the operator-facing detail
  // through console.error. Never leak `detail` to consumers.
  const emitError = (safeMessage: string, detail: string): void => {
    console.error(`[claude] requestId=${reqId} ${safeMessage} | ${detail}`);
    push({ kind: 'error', message: safeMessage });
  };

  // Idle timer — reset on every chunk. If `IDLE_TIMEOUT_MS` passes without
  // any new output from the CLI, we treat the subprocess as wedged and kill it.
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (finished) return;
      emitError(ERR_IDLE_TIMEOUT, `idle ${IDLE_TIMEOUT_MS / 1000}s — killed`);
      killWithEscalation(proc);
    }, IDLE_TIMEOUT_MS);
  };
  armIdleTimer();

  // Line-buffered stdout JSONL parser. Hold partial trailing data in
  // `buffer` until the next '\n'.
  let buffer = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk: string) => {
    // ANY stdout activity proves the subprocess is alive — reset the idle
    // timer here, BEFORE the parse loop, so init / message_start /
    // content_block_start / rate-limit events count too. Otherwise a slow
    // cold-cache TTFT trips the timer even though the CLI is fine.
    armIdleTimer();

    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Non-JSON noise on stdout — skip.
        continue;
      }
      if (!parsed || typeof parsed !== 'object') continue;
      const obj = parsed as Record<string, unknown>;
      if (obj.type !== 'stream_event') continue;
      const event = obj.event as Record<string, unknown> | undefined;
      if (!event || event.type !== 'content_block_delta') continue;
      const delta = event.delta as Record<string, unknown> | undefined;
      if (!delta || delta.type !== 'text_delta') continue;
      const text = delta.text;
      if (typeof text !== 'string' || text.length === 0) continue;
      push({ kind: 'delta', text });
    }
  });

  // stderr: bounded ring buffer for diagnostics on non-zero exit. We trim
  // from the head once we exceed STDERR_MAX_BYTES so a misbehaving CLI
  // cannot exhaust Node memory.
  let stderrBuf = '';
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk;
    if (stderrBuf.length > STDERR_MAX_BYTES) {
      stderrBuf = stderrBuf.slice(-STDERR_MAX_BYTES);
    }
  });

  proc.on('error', (err: Error) => {
    emitError(ERR_SPAWN_FAILED, `spawn error: ${err.message}`);
  });

  // Absolute timeout — last-resort safety net that fires regardless of
  // streaming progress. Five minutes is more than enough for any answer
  // the synthesis prompt can produce; if we hit it, something is genuinely
  // wrong.
  const absoluteTimer = setTimeout(() => {
    if (finished) return;
    emitError(
      ERR_ABSOLUTE_TIMEOUT,
      `absolute timeout ${ABSOLUTE_TIMEOUT_MS / 1000}s — killed`,
    );
    killWithEscalation(proc);
  }, ABSOLUTE_TIMEOUT_MS);

  proc.on('close', (code: number | null) => {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(absoluteTimer);
    if (code === 0) {
      push({ kind: 'done' });
    } else {
      const tail = stderrBuf.trim().slice(-500);
      emitError(
        ERR_NONZERO_EXIT,
        `exit=${code ?? 'null'} stderr-tail=${tail || '<empty>'}`,
      );
    }
  });

  // Write the user question and close stdin so the CLI starts.
  proc.stdin.write(input.userMessage);
  proc.stdin.end();

  // Pull from queue / wait on next event until we yield a terminal one.
  try {
    while (true) {
      let event: ClaudeStreamEvent;
      const buffered = queue.shift();
      if (buffered !== undefined) {
        event = buffered;
      } else {
        event = await new Promise<ClaudeStreamEvent>((resolve) => {
          waiters.push(resolve);
        });
      }
      yield event;
      if (event.kind === 'done' || event.kind === 'error') return;
    }
  } finally {
    // Consumer abandoned the generator — escalate-kill so we never leave a
    // SIGTERM-trapping child lingering.
    killWithEscalation(proc);
  }
}
