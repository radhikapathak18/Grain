// LLM-as-judge runner.
//
// Reads `findings/last-run.json` (written by the eval harness), then
// for each row sends the answer + rubric to a judge model and parses
// the JSON verdict.
//
// MODES:
//   - default: writes a STUB verdict that gives every row 4/5 across
//     the board. Lets the script wire up and the baseline writer work
//     without burning tokens. Clearly marked `mode: 'stub'` in output.
//   - RUN_AI_EVALS=1: invokes the real Claude CLI (or whatever
//     $JUDGE_BIN points at). Each row costs ~1 model call. Run sparingly.
//
// Output: `findings/judge-scores.json`.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  buildJudgePrompt,
  parseJudgeOutput,
  avgScore,
  JUDGE_PASS_AVG,
  JUDGE_DIMENSIONS,
  type JudgeScore,
} from './rubric.ts';
import { retrieve } from '../../../apps/api/src/lib/retrieval.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAST_RUN_PATH = resolve(__dirname, '../findings/last-run.json');
const OUT_PATH = resolve(__dirname, '../findings/judge-scores.json');
const FINDINGS_DIR = resolve(__dirname, '../findings');

const REAL_MODE = process.env.RUN_AI_EVALS === '1';
const JUDGE_BIN = process.env.JUDGE_BIN ?? process.env.CLAUDE_BIN ?? 'claude';
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'sonnet';
const JUDGE_TIMEOUT_MS = 120_000;

type LastRunRow = {
  entryId: string;
  pair_id?: string;
  role: 'pm' | 'designer' | 'engineer' | 'researcher';
  shape: 'explore' | 'verify' | 'trends';
  products: ('helix-core' | 'p4v' | 'helix-swarm')[];
  question: string;
  fail_mode?: string;
  expectedClaimIds: string[];
  answer: string;
  emittedCitations: string[];
};

type LastRun = {
  mode: 'mock' | 'real';
  ranAt: string;
  results: LastRunRow[];
};

function loadLastRun(): LastRun {
  if (!existsSync(LAST_RUN_PATH)) {
    throw new Error(
      `findings/last-run.json missing. Run \`pnpm -F @grain/tests-ai-quality eval:dry\` first.`,
    );
  }
  return JSON.parse(readFileSync(LAST_RUN_PATH, 'utf8')) as LastRun;
}

async function callJudge(prompt: string): Promise<string> {
  return new Promise<string>((resolveP, reject) => {
    const proc = spawn(
      JUDGE_BIN,
      [
        '-p',
        '--model', JUDGE_MODEL,
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let out = '';
    let stderr = '';
    let buf = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t) as Record<string, unknown>;
          if (obj.type !== 'stream_event') continue;
          const ev = obj.event as Record<string, unknown> | undefined;
          if (!ev || ev.type !== 'content_block_delta') continue;
          const d = ev.delta as Record<string, unknown> | undefined;
          if (!d || d.type !== 'text_delta') continue;
          if (typeof d.text === 'string') out += d.text;
        } catch {
          // ignore non-JSON noise
        }
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (c) => {
      stderr += c;
    });
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`judge timed out after ${JUDGE_TIMEOUT_MS}ms`));
    }, JUDGE_TIMEOUT_MS);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolveP(out);
      else reject(new Error(`judge exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function stubScore(row: LastRunRow): JudgeScore {
  // Deterministic stub: negative-control rows score lower so the
  // aggregate distinguishes them. Real eval should override these.
  if (row.fail_mode === 'hallucinate-cite') {
    return {
      accuracy: 2,
      faithfulness: 2,
      role_framing: 3,
      citation_quality: 1,
      refusal_handling: 4,
      notes: 'stub: hallucinated citation id present in answer',
    };
  }
  if (row.fail_mode === 'hallucinate-quote') {
    return {
      accuracy: 2,
      faithfulness: 1,
      role_framing: 3,
      citation_quality: 3,
      refusal_handling: 4,
      notes: 'stub: fabricated verbatim quote',
    };
  }
  if (row.fail_mode === 'drop-citations') {
    return {
      accuracy: 3,
      faithfulness: 3,
      role_framing: 3,
      citation_quality: 1,
      refusal_handling: 4,
      notes: 'stub: zero citation markers',
    };
  }
  if (row.expectedClaimIds.length === 0) {
    return {
      accuracy: 5,
      faithfulness: 5,
      role_framing: 4,
      citation_quality: 5,
      refusal_handling: 5,
      notes: 'stub: empty-results refusal looks correct',
    };
  }
  return {
    accuracy: 4,
    faithfulness: 4,
    role_framing: 4,
    citation_quality: 4,
    refusal_handling: 4,
    notes: 'stub: nominal mock-mode pass',
  };
}

async function main(): Promise<void> {
  const lastRun = loadLastRun();
  if (REAL_MODE) {
    console.warn(
      [
        '',
        '╔══════════════════════════════════════════════════════════════╗',
        '║  RUN_AI_EVALS=1 — REAL judge mode.                            ║',
        `║  Will issue ${String(lastRun.results.length).padStart(2)} judge calls via ${JUDGE_BIN}.            ║`,
        '║  Token spend per call: ~1k-2k in + ~150 out. Budget mindfully.║',
        '╚══════════════════════════════════════════════════════════════╝',
        '',
      ].join('\n'),
    );
  } else {
    console.warn(
      '[judge] STUB MODE — no model calls. Set RUN_AI_EVALS=1 (and ensure JUDGE_BIN is on PATH) to score against a real model.',
    );
  }

  const scored: Array<{
    entryId: string;
    pair_id?: string;
    score: JudgeScore;
    avg: number;
    passes: boolean;
    rawOutput?: string;
    error?: string;
  }> = [];

  for (const row of lastRun.results) {
    const claims = retrieve(row.question, row.products, row.shape);
    const prompt = buildJudgePrompt({
      question: row.question,
      role: row.role,
      retrievedClaims: claims,
      answer: row.answer,
    });

    if (!REAL_MODE) {
      const s = stubScore(row);
      const a = avgScore(s);
      scored.push({
        entryId: row.entryId,
        pair_id: row.pair_id,
        score: s,
        avg: a,
        passes: a >= JUDGE_PASS_AVG,
      });
      continue;
    }

    try {
      const raw = await callJudge(prompt);
      const parsed = parseJudgeOutput(raw);
      if (!parsed) {
        scored.push({
          entryId: row.entryId,
          pair_id: row.pair_id,
          score: { accuracy: 0, faithfulness: 0, role_framing: 0, citation_quality: 0, refusal_handling: 0, notes: 'parse-failure' },
          avg: 0,
          passes: false,
          rawOutput: raw,
          error: 'judge output did not parse as the required JSON schema',
        });
        continue;
      }
      const a = avgScore(parsed);
      scored.push({
        entryId: row.entryId,
        pair_id: row.pair_id,
        score: parsed,
        avg: a,
        passes: a >= JUDGE_PASS_AVG,
        rawOutput: raw,
      });
    } catch (e) {
      scored.push({
        entryId: row.entryId,
        pair_id: row.pair_id,
        score: { accuracy: 0, faithfulness: 0, role_framing: 0, citation_quality: 0, refusal_handling: 0, notes: 'judge-error' },
        avg: 0,
        passes: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Per-dimension aggregate.
  const dimAvg: Record<string, number> = {};
  for (const d of JUDGE_DIMENSIONS) {
    const vals = scored.map((s) => s.score[d]).filter((n) => n > 0);
    dimAvg[d] =
      vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const overall =
    scored.reduce((a, b) => a + b.avg, 0) / Math.max(1, scored.length);

  mkdirSync(FINDINGS_DIR, { recursive: true });
  const payload = {
    mode: REAL_MODE ? 'real' : 'stub',
    ranAt: new Date().toISOString(),
    judgeBin: REAL_MODE ? JUDGE_BIN : null,
    judgeModel: REAL_MODE ? JUDGE_MODEL : null,
    passThreshold: JUDGE_PASS_AVG,
    overallAverage: Number(overall.toFixed(3)),
    dimensionAverages: Object.fromEntries(
      Object.entries(dimAvg).map(([k, v]) => [k, Number(v.toFixed(3))]),
    ),
    passRate:
      scored.filter((s) => s.passes).length / Math.max(1, scored.length),
    rows: scored,
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(
    `[judge] mode=${payload.mode} overallAvg=${payload.overallAverage.toFixed(2)} passRate=${(payload.passRate * 100).toFixed(0)}% → ${OUT_PATH}`,
  );
  if (payload.overallAverage < JUDGE_PASS_AVG) {
    console.warn(
      `[judge] overall average ${payload.overallAverage} below pass threshold ${JUDGE_PASS_AVG}`,
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
