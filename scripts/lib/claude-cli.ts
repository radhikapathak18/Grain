// Minimal one-shot wrapper around the local `claude` CLI for batch
// scripts. The app uses apps/api/src/lib/claude.ts which streams to SSE;
// for scripts we just want the full text back as a single Promise.
//
// Same invocation pattern as apps/api/src/lib/claude.ts:
//   echo "USER" | $CLAUDE_BIN -p --model <model> \
//     --output-format stream-json --verbose --include-partial-messages \
//     --system-prompt "SYSTEM"
//
// We parse stdout JSONL, concatenate text_delta chunks, return the joined
// string. Errors bubble up as thrown Errors with the CLI's stderr tail.

import { spawn } from 'node:child_process';

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';
const DEFAULT_MODEL = process.env.GRAIN_MODEL ?? 'sonnet';

export type CallClaudeInput = {
  systemPrompt: string;
  userMessage: string;
  model?: string;
};

export async function callClaude(input: CallClaudeInput): Promise<string> {
  const model = input.model ?? DEFAULT_MODEL;

  return new Promise((resolve, reject) => {
    const proc = spawn(
      CLAUDE_BIN,
      [
        '-p',
        '--model', model,
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--system-prompt', input.systemPrompt,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let stdoutBuf = '';
    let stderrBuf = '';
    const collected: string[] = [];

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      stdoutBuf += chunk;
      const parts = stdoutBuf.split('\n');
      stdoutBuf = parts.pop() ?? '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
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
        if (typeof text === 'string') collected.push(text);
      }
    });

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => {
      stderrBuf += chunk;
    });

    proc.on('error', (err) => {
      reject(new Error(`failed to spawn ${CLAUDE_BIN}: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(collected.join(''));
      } else {
        const tail = stderrBuf.trim().slice(-800) || '<empty>';
        reject(new Error(`claude exited ${code}: ${tail}`));
      }
    });

    proc.stdin.write(input.userMessage);
    proc.stdin.end();
  });
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseArgs(argv: string[]): {
  sourceType: 'zoom' | 'slack' | 'pendo' | null;
  file: string | null;
  rest: string[];
} {
  let sourceType: 'zoom' | 'slack' | 'pendo' | null = null;
  let file: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source-type') {
      const v = argv[++i];
      if (v === 'zoom' || v === 'slack' || v === 'pendo') sourceType = v;
      else throw new Error(`invalid --source-type: ${v ?? '(missing)'}`);
    } else if (a === '--file') {
      file = argv[++i] ?? null;
    } else {
      rest.push(a);
    }
  }
  return { sourceType, file, rest };
}
