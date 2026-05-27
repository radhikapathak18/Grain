// scripts/extract-claims.ts — given an already-anonymized document on
// stdin, emit a TypeScript snippet of `claim({...})` entries matching the
// shape used in apps/api/src/data/claims.ts. Wrapped in delimiters so
// downstream tooling (or a human) can splice cleanly.
//
// Usage:
//   pnpm tsx scripts/extract-claims.ts --source-type zoom < anonymized.txt
//
// The script does NOT mutate claims.ts. It prints to stdout. The human in
// the loop reviews, approves, and pastes.

import { readFile } from 'node:fs/promises';
import { callClaude, parseArgs, readStdin } from './lib/claude-cli.ts';
import { CLAIMS } from '../apps/api/src/data/claims.ts';

const PRODUCTS = ['helix-core', 'p4v', 'helix-swarm'] as const;
const AREAS = [
  'onboarding',
  'workspace-setup',
  'merge',
  'branching',
  'permissions',
  'cli-ergonomics',
  'performance',
  'api-integration',
] as const;
const PERSONAS = [
  'release-manager',
  'build-engineer',
  'tech-lead',
  'developer',
  'devops',
] as const;

// CL-#### → numeric, return the max so the model can continue from there.
function highestExistingClaimId(): number {
  let max = 0;
  for (const c of CLAIMS) {
    const m = /^CL-(\d+)$/.exec(c.id);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return max;
}

// Three representative existing claims so the model can match voice.
// Hardcoded slice rather than a runtime lookup; the file ids are stable.
const VOICE_EXAMPLES = `
claim({
  id: 'CL-0001',
  text: 'New artist onboarding to Helix Core routinely runs two to three weeks longer than planned at studios above 100 seats, driven by per-user view spec configuration that requires senior engineers to do white-glove setup.',
  product: 'helix-core',
  area: 'onboarding',
  persona: 'release-manager',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'gong-call-2025-11-04-stellar-forge',
      source_type: 'gong',
      passage: 'The onboarding for our two new studios took almost three weeks longer than we planned. The biggest piece was just getting the workspaces configured. ...',
      source_url: '/source/gong-call-2025-11-04-stellar-forge',
      source_date: '2025-11-04',
      customer: 'Stellar Forge Games',
    },
  ],
}),

claim({
  id: 'CL-0002',
  text: 'The P4V workspace creation wizard has a 41% abandonment rate among first-session users, with the cluster at step 3 ("Configure view lines") where users encounter a free-text editor and frequently hit validation errors.',
  product: 'p4v',
  area: 'onboarding',
  persona: 'developer',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
      source_type: 'pendo',
      passage: '41% of users in their first P4V session who reach the wizard abandon before completing it. The abandonment cluster is at step 3 of 5 ...',
      source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
      source_date: '2026-03-15',
    },
  ],
}),

claim({
  id: 'CL-0005',
  text: 'A recurring class of workspace failures stems from users pointing their workspace root at a cloud-sync directory (OneDrive, iCloud, Dropbox), causing phantom locked-file errors and silent corruption that Helix Core has no built-in defense against.',
  product: 'helix-core',
  area: 'workspace-setup',
  persona: 'devops',
  sentiment: 'negative',
  evidence: [
    { source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook', source_type: 'confluence', passage: '...', source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook', source_date: '2025-12-09' },
  ],
}),
`.trim();

function perSourceTypeRules(sourceType: 'zoom' | 'slack' | 'pendo'): string {
  if (sourceType === 'zoom') {
    return `Source-type rules (zoom):
- Generate 2-4 claims per document. Quality over quantity. Skip the doc
  if it does not contain at least 2 distinct claim-worthy threads.
- Per claim: 1-3 evidence items.
- source_type: 'zoom'
- source_id format: zoom-research-YYYY-MM-DD-{kebab-slug}
  where the slug is derived from the customer + the most salient role
  (e.g., zoom-research-2026-04-08-lumen-foundry-tech-lead).
- source_date: pick a plausible date in Jan-May 2026 if the document does
  not have one. If multiple evidence items reference the same document,
  reuse the same source_id and source_date for each.
- customer: include the (anonymized) customer name.`;
  }
  if (sourceType === 'slack') {
    return `Source-type rules (slack):
- Generate 2-4 claims per document.
- Per claim: 1-2 evidence items.
- source_type: 'slack'
- source_id format: slack-{channel}-YYYY-MM-DD-{kebab-slug}
  e.g., slack-cs-calls-2026-04-15-nimbus-priority-flag. Channel is your
  best guess from context (cs-calls, release-eng, customer-feedback,
  field, etc.).
- source_date: pick a plausible date in Jan-May 2026 if not stated.
- customer: include if the summary is about a specific customer; omit if
  the post discusses multiple or none.`;
  }
  return `Source-type rules (pendo):
- Generate 2-4 claims per document.
- Per claim: 1 evidence item (Pendo is one aggregation per metric).
- source_type: 'pendo'
- source_id format: pendo-export-YYYY-MM-DD-{kebab-slug}
  e.g., pendo-export-2026-04-30-p4v-resolve-dialog.
- source_date: pick a plausible date in Jan-May 2026.
- customer: usually omit (Pendo is product-wide). Include only if the
  export is filtered to a single customer.`;
}

function systemPromptFor(
  sourceType: 'zoom' | 'slack' | 'pendo',
  startId: number,
): string {
  return `You extract claims from anonymized customer research documents for the
Grain demo corpus. Output ONLY a TypeScript snippet of zero or more
claim({...}) blocks, in the exact shape used in apps/api/src/data/claims.ts.
Wrap the snippet in these literal delimiters on their own lines:

===CLAIMS_START===
... claim({...}), claim({...}), ...
===CLAIMS_END===

No prose, no markdown fences, no comments outside the delimiters. If the
document genuinely contains nothing claim-worthy, emit an empty block:

===CLAIMS_START===
===CLAIMS_END===

Claim schema (must match exactly):
- id: 'CL-XXXX' — continue numbering from CL-${String(startId + 1).padStart(4, '0')}.
- text: ONE sentence (or two short ones), declarative, specific, the way
  a senior researcher would phrase a finding. Match the voice of the
  examples below.
- product: one of ${PRODUCTS.map((p) => `'${p}'`).join(' | ')}.
- area: one of ${AREAS.map((a) => `'${a}'`).join(' | ')}. Reuse an
  existing area whenever possible — only invent a new one if no existing
  area genuinely fits, and even then prefer a near miss.
- persona: one of ${PERSONAS.map((p) => `'${p}'`).join(' | ')}.
- sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'.
- evidence: array of { source_id, source_type, passage, source_url,
  source_date, customer? }. passage is a verbatim quote from the
  anonymized document (or a tight paraphrase for pendo metrics).
  source_url is always '/source/' + source_id.

${perSourceTypeRules(sourceType)}

Voice examples (match this tone and specificity, NOT verbatim — write
about THIS document):

${VOICE_EXAMPLES}

Final reminders:
- Do not omit required fields. Every evidence item needs all of
  source_id, source_type, passage, source_url, source_date.
- Do not include evidence_count, most_recent_evidence_at, or trust_tier —
  the claim() helper derives those.
- Trailing comma after each claim({...}).
- Claim IDs must be unique and ascending starting from
  CL-${String(startId + 1).padStart(4, '0')}.`;
}

async function main(): Promise<void> {
  const { sourceType, file } = parseArgs(process.argv.slice(2));
  if (!sourceType) {
    console.error('usage: extract-claims --source-type zoom|slack|pendo [--file path]');
    process.exit(2);
  }

  const input = file ? await readFile(file, 'utf8') : await readStdin();
  if (!input.trim()) {
    console.error('extract-claims: empty input');
    process.exit(2);
  }

  const startId = highestExistingClaimId();
  const systemPrompt = systemPromptFor(sourceType, startId);
  const out = await callClaude({ systemPrompt, userMessage: input });

  const text = out.trim();
  // Light sanity check — the script does not parse the result, but if the
  // model fails to emit delimiters we want to know loudly.
  if (!text.includes('===CLAIMS_START===') || !text.includes('===CLAIMS_END===')) {
    console.error('extract-claims: model output missing delimiters; emitting raw output anyway');
  }
  process.stdout.write(text + '\n');
}

main().catch((err: Error) => {
  console.error(`extract-claims: ${err.message}`);
  process.exit(1);
});
