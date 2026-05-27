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

import { spawn } from 'node:child_process';
import { env } from '../env.ts';

export type ClaudeStreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export type StreamClaudeInput = {
  systemPrompt: string;
  userMessage: string;
  model?: string; // defaults to env.MODEL
};

type DeferredResolve = (value: ClaudeStreamEvent) => void;

// Hard upper bound on a single chat invocation. The CLI normally completes
// in under 30s; 60s is a generous safety net so a wedged subprocess can't
// stall the demo.
const STREAM_TIMEOUT_MS = 60_000;

export async function* streamClaude(
  input: StreamClaudeInput,
): AsyncGenerator<ClaudeStreamEvent> {
  const model = input.model ?? env.MODEL;

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

  // Line-buffered stdout JSONL parser. Hold partial trailing data in
  // `buffer` until the next '\n'.
  let buffer = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk: string) => {
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

  // stderr: collect for diagnostics on non-zero exit; per spec we ignore
  // warnings/deprecations unless the process fails.
  let stderrBuf = '';
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk;
  });

  proc.on('error', (err: Error) => {
    push({ kind: 'error', message: `spawn failed: ${err.message}` });
  });

  const timeoutHandle = setTimeout(() => {
    if (finished) return;
    push({
      kind: 'error',
      message: `claude CLI timed out after ${STREAM_TIMEOUT_MS / 1000}s`,
    });
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGTERM');
      // Escalate to SIGKILL if SIGTERM is ignored.
      setTimeout(() => {
        if (proc.exitCode === null && proc.signalCode === null) {
          proc.kill('SIGKILL');
        }
      }, 2_000);
    }
  }, STREAM_TIMEOUT_MS);

  proc.on('close', (code: number | null) => {
    clearTimeout(timeoutHandle);
    if (code === 0) {
      push({ kind: 'done' });
    } else {
      const tail = stderrBuf.trim().slice(-500);
      push({
        kind: 'error',
        message: `claude CLI exited with code ${code ?? 'null'}${tail ? `: ${tail}` : ''}`,
      });
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
    // Consumer abandoned the generator — ensure the child does not linger.
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGTERM');
    }
  }
}
