// scripts/demo-preflight.ts — exercise the demo questions against the
// LOCAL running API and capture each streamed response (text +
// citations + retrieved-claim count) into a markdown log Parth and
// Ishani can read between rehearsals.
//
// Usage (api must already be running on localhost:3001):
//   pnpm tsx scripts/demo-preflight.ts
//
// Output: docs/demo-question-responses.md (appended each run with a
// fresh timestamped section, so we can compare across batches of
// claims).

import { readFile, mkdir, appendFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const QUESTIONS_FILE = resolve(REPO, 'scripts/demo-questions.json');
const OUTPUT_FILE = resolve(REPO, 'docs/demo-question-responses.md');
const API_BASE = process.env.GRAIN_API ?? 'http://localhost:3001';

type Question = {
  label: string;
  question: string;
  role: string;
  shape: string;
  products: string[];
};

type RunResult = {
  label: string;
  question: string;
  role: string;
  shape: string;
  products: string[];
  text: string;
  citations: string[];
  retrievedCount: number | null;
  totalCitations: number;
  durationMs: number;
  errored: string | null;
};

// SSE parser: yields { event, data } objects as they arrive. Spec
// allows multi-line data fields; we join them with '\n'. We assume the
// API uses single-line JSON for `data:` which matches what hono/streaming
// emits.
async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{
  event: string;
  data: string;
}> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let event = '';
  const dataLines: string[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    while (true) {
      const nl = buf.indexOf('\n');
      if (nl === -1) break;
      const rawLine = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (line === '') {
        if (event || dataLines.length > 0) {
          yield { event: event || 'message', data: dataLines.join('\n') };
        }
        event = '';
        dataLines.length = 0;
      } else if (line.startsWith(':')) {
        // SSE comment / heartbeat
        continue;
      } else if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }
  }
}

async function runQuestion(q: Question): Promise<RunResult> {
  const started = Date.now();
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: q.question,
      role: q.role,
      shape: q.shape,
      products: q.products,
    }),
  });

  const result: RunResult = {
    label: q.label,
    question: q.question,
    role: q.role,
    shape: q.shape,
    products: q.products,
    text: '',
    citations: [],
    retrievedCount: null,
    totalCitations: 0,
    durationMs: 0,
    errored: null,
  };

  if (!res.ok || !res.body) {
    result.errored = `http ${res.status}`;
    result.durationMs = Date.now() - started;
    return result;
  }

  const citedSeen = new Set<string>();
  for await (const ev of parseSSE(res.body)) {
    let data: unknown;
    try {
      data = JSON.parse(ev.data);
    } catch {
      continue;
    }
    const obj = data as Record<string, unknown>;
    if (ev.event === 'status') {
      if (obj.phase === 'retrieved' && typeof obj.message === 'string') {
        // "Found 8 claims spanning ..." → 8
        const m = /Found\s+(\d+)\s+claim/.exec(obj.message);
        if (m) result.retrievedCount = Number(m[1]);
      }
    } else if (ev.event === 'delta') {
      if (typeof obj.text === 'string') result.text += obj.text;
    } else if (ev.event === 'citation') {
      const id = typeof obj.id === 'string' ? obj.id : null;
      if (id && !citedSeen.has(id)) {
        citedSeen.add(id);
        result.citations.push(id);
      }
    } else if (ev.event === 'done') {
      if (typeof obj.totalCitations === 'number') {
        result.totalCitations = obj.totalCitations;
      }
    } else if (ev.event === 'error') {
      result.errored = typeof obj.message === 'string' ? obj.message : 'error';
    }
  }
  result.durationMs = Date.now() - started;
  return result;
}

function formatResult(r: RunResult): string {
  const cites = r.citations.length === 0 ? '_none_' : r.citations.map((c) => `\`${c}\``).join(', ');
  const retrieved = r.retrievedCount == null ? 'n/a' : String(r.retrievedCount);
  return [
    `### ${r.label}`,
    '',
    `- **Question:** ${r.question}`,
    `- **Role / shape / products:** ${r.role} · ${r.shape} · ${r.products.join(', ')}`,
    `- **Retrieved claims:** ${retrieved}`,
    `- **Total citations:** ${r.totalCitations}`,
    `- **Cited IDs:** ${cites}`,
    `- **Duration:** ${r.durationMs} ms${r.errored ? `   ·   **ERROR:** ${r.errored}` : ''}`,
    '',
    '**Response:**',
    '',
    '```',
    r.text.trim() || '(empty)',
    '```',
    '',
  ].join('\n');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const raw = await readFile(QUESTIONS_FILE, 'utf8');
  const parsed = JSON.parse(raw) as { questions: Question[] };
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    console.error('demo-preflight: no questions in scripts/demo-questions.json');
    process.exit(2);
  }

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  const isFresh = !(await fileExists(OUTPUT_FILE));
  if (isFresh) {
    await appendFile(
      OUTPUT_FILE,
      '# Demo question preflight responses\n\n' +
        'Appended each run of `scripts/demo-preflight.ts`. Compare across runs ' +
        'to spot regressions after batch additions of new claims.\n\n',
      'utf8',
    );
  }

  const runStarted = new Date();
  const header = `\n---\n\n## Run @ ${runStarted.toISOString()}\n\n`;
  await appendFile(OUTPUT_FILE, header, 'utf8');

  console.log(`demo-preflight: ${parsed.questions.length} question(s) → ${OUTPUT_FILE}`);
  for (const q of parsed.questions) {
    process.stdout.write(`  · ${q.label} … `);
    try {
      const result = await runQuestion(q);
      await appendFile(OUTPUT_FILE, formatResult(result), 'utf8');
      console.log(
        result.errored
          ? `ERROR (${result.errored})`
          : `${result.totalCitations} citations in ${result.durationMs}ms`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`THREW: ${msg}`);
      await appendFile(
        OUTPUT_FILE,
        `### ${q.label}\n\n_Request threw: ${msg}_\n\n`,
        'utf8',
      );
    }
  }
}

main().catch((err: Error) => {
  console.error(`demo-preflight: ${err.message}`);
  process.exit(1);
});
