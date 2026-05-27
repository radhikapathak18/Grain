// scripts/anonymize.ts — anonymize a real customer document for use in
// the Grain demo corpus. Reads stdin or a file, calls the local Claude
// CLI with source-type-specific rules, prints anonymized text.
//
// Usage:
//   pnpm tsx scripts/anonymize.ts --source-type zoom < doc.txt
//   pnpm tsx scripts/anonymize.ts --source-type slack --file doc.txt
//   pnpm tsx scripts/anonymize.ts --source-type pendo --file doc.txt

import { readFile } from 'node:fs/promises';
import { callClaude, parseArgs, readStdin } from './lib/claude-cli.ts';

const REUSED_NAMES = [
  'Stellar Forge Games',
  'Nimbus Studios',
  'Lumen Foundry',
  'Hexagon Pictures',
  'Apex Aeronautics',
  'Citadel Defense',
  'Drift Labs',
  'Mercury Robotics',
].join(', ');

const SHARED_RULES = `You are anonymizing a real customer document so it can be used in an
internal demo corpus. Output ONLY the anonymized text. No preamble, no
commentary, no markdown fences. Preserve paragraph breaks and the
overall shape of the document.

Naming conventions:
- Replace any real customer / company name with one of these reused
  names, picking the closest stylistic fit (game studio / VFX / animation
  / aerospace / defense / robotics): ${REUSED_NAMES}.
- If none fit and you must invent a new name, match that style — never
  use a real-world brand or a name that looks like one.
- Replace named individuals with role descriptors (e.g., "the tech lead",
  "the release manager", "the CS lead", "the EMEA account PM").
- Replace any internal codename, project name, or product nickname with
  a generic placeholder ("the cinematic project", "the engine team",
  "the build pipeline") unless it is a Perforce product name (Helix Core,
  P4V, Helix Swarm, P4 Code Review).
- Strip email addresses, phone numbers, exact URLs, and Slack/Zoom IDs.
- Preserve Perforce-specific terminology and CLI commands verbatim
  (p4 sync, view spec, stream graph, protections table, changelist, etc).
`;

const ZOOM_RULES = `Document type: research interview transcript (Zoom).

Specific rules:
- Preserve the conversational flow, pain points, exact workflows, and
  product feature names. The point is the language and the lived-in
  detail — keep those.
- Round any specific numeric figure to a plausible nearby value
  (e.g., "143 artists" → "about 140 artists"; "27 streams" → "around
  25 streams"). Do NOT zero out the numbers; the texture matters.
- Keep timestamps if present (e.g. "[00:18]") but round to the nearest
  whole minute.
- If the transcript names a person with a role (e.g., "Mara Voss
  (Release Engineering Lead)"), replace the proper name and keep the
  role.
- Keep direct quotes intact (rewording is fine but do not invent or
  embellish content the speaker did not say).
`;

const SLACK_RULES = `Document type: Slack-forwarded summary of a customer call (posted by
a CS or PM into an internal channel).

Specific rules:
- Preserve the "this is a summary of a call I had with X" framing — do
  NOT convert the summary into a fake transcript. It should still read
  as a forwarded internal recap.
- Anonymize the poster as a role descriptor: "the CS lead", "the PM
  covering EMEA accounts", "the AE on the gaming book", etc. Do not
  invent a Slack handle.
- Preserve the customer name replacement rule (reuse the canonical
  set).
- Preserve any quoted snippets from the customer; treat those quotes
  the same way as zoom transcript quotes (verbatim with name
  replacements only).
- Keep Slack-style casing and punctuation if present (lowercase
  starts, terse phrasing) — do not "clean it up" to sound formal.
`;

const PENDO_RULES = `Document type: Pendo analytics aggregation / metric export.

Specific rules:
- These are numbers, not quotes. Preserve the quantitative framing —
  percentages, session counts, MAU, cohort splits, deltas vs prior
  periods — but round each metric value to a plausible nearby number
  (e.g., 1,184 → "about 1,200"; 41.3% → "41%"; 6.2pp → "6pp").
- Preserve feature names, view names, telemetry event names, and the
  product they describe.
- If the export names a specific customer, replace it with one from the
  reused name set or generalize ("a games customer", "a film customer").
- Do not invent metrics that were not in the source. If the source had a
  number, keep its shape (with rounding); if it did not, do not add one.
- Strip any internal account IDs, dashboard URLs, or query strings.
`;

function rulesFor(sourceType: 'zoom' | 'slack' | 'pendo'): string {
  switch (sourceType) {
    case 'zoom': return ZOOM_RULES;
    case 'slack': return SLACK_RULES;
    case 'pendo': return PENDO_RULES;
  }
}

async function main(): Promise<void> {
  const { sourceType, file } = parseArgs(process.argv.slice(2));
  if (!sourceType) {
    console.error('usage: anonymize --source-type zoom|slack|pendo [--file path]');
    process.exit(2);
  }

  const input = file ? await readFile(file, 'utf8') : await readStdin();
  if (!input.trim()) {
    console.error('anonymize: empty input');
    process.exit(2);
  }

  const systemPrompt = `${SHARED_RULES}\n${rulesFor(sourceType)}`;
  const out = await callClaude({ systemPrompt, userMessage: input });
  process.stdout.write(out.trimEnd() + '\n');
}

main().catch((err: Error) => {
  console.error(`anonymize: ${err.message}`);
  process.exit(1);
});
