// scripts/freeze-demo-state.ts — Ishani's "source of truth" snapshot.
//
// Parth runs this when he declares the code frozen. It captures:
//   - Total CLAIMS.length and breakdown by product / source_type
//   - Sample responses to each demo question (delegates to the preflight
//     script via spawn so the two stay aligned)
//   - The current monthly report (themes + emerging issues)
//   - Timestamp
//
// Output: docs/demo-state-snapshot.md (overwritten each run — the
// "snapshot" is the most recent freeze).
//
// Usage: pnpm tsx scripts/freeze-demo-state.ts

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Claim } from '@grain/types';
import { CLAIMS } from '../apps/api/src/data/claims.ts';
import { MONTHLY_REPORT } from '../apps/api/src/data/reports.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUTPUT_FILE = resolve(REPO, 'docs/demo-state-snapshot.md');
const PREFLIGHT_RESPONSES = resolve(REPO, 'docs/demo-question-responses.md');
const PREFLIGHT_SCRIPT = resolve(REPO, 'scripts/demo-preflight.ts');

function countBy<K extends string>(
  list: ReadonlyArray<Claim>,
  pick: (c: Claim) => K,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const c of list) {
    const k = pick(c);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function countEvidenceBySourceType(list: ReadonlyArray<Claim>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of list) {
    for (const e of c.evidence) {
      out[e.source_type] = (out[e.source_type] ?? 0) + 1;
    }
  }
  return out;
}

function asTableRows(obj: Record<string, number>): string {
  const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return '_none_';
  return rows.map(([k, v]) => `  - ${k}: ${v}`).join('\n');
}

// Run scripts/demo-preflight.ts as a subprocess so the two scripts stay
// in sync. The preflight script writes its own markdown — we then read
// the LAST section of that file (the section we just appended) and
// embed it under "Sample responses" in the snapshot.
async function runPreflight(): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn('pnpm', ['tsx', PREFLIGHT_SCRIPT], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => process.stdout.write(d));
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      process.stderr.write(d);
    });
    child.on('close', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`preflight exited ${code}: ${stderr.trim() || '<no stderr>'}`));
    });
    child.on('error', (e) => rejectP(e));
  });
}

// Read the file demo-preflight wrote and return only its most recent
// "## Run @ ..." section. If the file doesn't exist (preflight failed
// or the API wasn't up), return a note instead.
async function readLatestPreflightSection(): Promise<string> {
  try {
    const text = await readFile(PREFLIGHT_RESPONSES, 'utf8');
    const idx = text.lastIndexOf('## Run @ ');
    if (idx === -1) return '_preflight ran but wrote no run section._';
    return text.slice(idx);
  } catch {
    return '_preflight responses file missing — the API may not be running. Start it (`./scripts/start-demo.sh`) and re-run this script._';
  }
}

function formatReport(): string {
  const r = MONTHLY_REPORT;
  const themes = r.themes
    .map((t) => {
      const products = t.byProduct
        .map((bp) => `${bp.product}=${bp.count}`)
        .join(', ');
      return [
        `#### ${t.title}`,
        `- Area: ${t.area}`,
        `- Frequency: ${t.frequency} (evidence)   ·   Trend: ${t.trend}`,
        `- Products: ${products}`,
        `- Top claims: ${t.topClaimIds.join(', ')}`,
        '',
        t.summary,
      ].join('\n');
    })
    .join('\n\n');
  const emerging = r.emerging
    .map(
      (e) =>
        `- **${e.title}** (${e.product}, ${e.evidence_count} evidence, first seen ${e.firstSeen}) — ${e.summary}`,
    )
    .join('\n');
  return [
    `**Period:** ${r.periodLabel}    **Generated:** ${r.generatedAt}`,
    `**Totals:** ${r.totalClaims} claims · ${r.totalEvidence} evidence items`,
    '',
    '### Themes',
    '',
    themes,
    '',
    '### Emerging issues',
    '',
    emerging || '_none_',
  ].join('\n');
}

async function main(): Promise<void> {
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });

  const stampedAt = new Date().toISOString();
  const totalClaims = CLAIMS.length;
  const byProduct = countBy(CLAIMS, (c) => c.product);
  const bySourceType = countEvidenceBySourceType(CLAIMS);
  const byArea = countBy(CLAIMS, (c) => c.area);

  console.log('freeze-demo-state: running preflight against local API…');
  let preflightOk = true;
  try {
    await runPreflight();
  } catch (err) {
    preflightOk = false;
    console.warn(
      `freeze-demo-state: preflight failed (${err instanceof Error ? err.message : err}). Continuing — snapshot will note the gap.`,
    );
  }

  const preflightSection = preflightOk
    ? await readLatestPreflightSection()
    : '_preflight subprocess failed; sample responses not captured this freeze._';

  const md = [
    '# Demo state snapshot',
    '',
    `**Frozen at:** ${stampedAt}`,
    '',
    'Source of truth for Ishani\'s rehearsal. Re-running this script overwrites the file.',
    '',
    '---',
    '',
    '## Claim corpus',
    '',
    `- Total claims: **${totalClaims}**`,
    '- By product:',
    asTableRows(byProduct),
    '- By area:',
    asTableRows(byArea),
    '- Evidence items by source_type:',
    asTableRows(bySourceType),
    '',
    '---',
    '',
    '## Monthly report (current)',
    '',
    formatReport(),
    '',
    '---',
    '',
    '## Sample demo responses',
    '',
    preflightSection,
    '',
  ].join('\n');

  await writeFile(OUTPUT_FILE, md, 'utf8');
  console.log(`freeze-demo-state: wrote ${OUTPUT_FILE}`);
}

main().catch((err: Error) => {
  console.error(`freeze-demo-state: ${err.message}`);
  process.exit(1);
});
