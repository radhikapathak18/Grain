import type { Claim, Evidence, TrustTier } from '@grain/types';
import { SOURCE_TIER } from '@grain/types';

// Derive trust_tier from the highest-tier source in the evidence array.
// T1 > T2 > T3 (T1 is highest confidence).
function deriveTrustTier(evidence: Evidence[]): TrustTier {
  const tiers = evidence.map((e) => SOURCE_TIER[e.source_type]);
  if (tiers.includes('T1')) return 'T1';
  if (tiers.includes('T2')) return 'T2';
  return 'T3';
}

function mostRecent(evidence: Evidence[]): string {
  return evidence
    .map((e) => e.source_date)
    .sort()
    .reverse()[0]!;
}

// Helper to build a claim with derived fields.
function claim(input: Omit<Claim, 'evidence_count' | 'most_recent_evidence_at' | 'trust_tier'>): Claim {
  return {
    ...input,
    evidence_count: input.evidence.length,
    most_recent_evidence_at: mostRecent(input.evidence),
    trust_tier: deriveTrustTier(input.evidence),
  };
}

export const CLAIMS: Claim[] = [
  // ============================================================
  // ONBOARDING (cross-product: helix-core, p4v, helix-swarm)
  // ============================================================
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
        passage:
          'The onboarding for our two new studios took almost three weeks longer than we planned. The biggest piece was just getting the workspaces configured. We have about 140 artists between the two teams and every single one needed a per-user view spec that mapped their depot paths to their local SSD layout.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'gong-call-2026-02-03-nimbus',
        source_type: 'gong',
        passage:
          'We budgeted two weeks for the new hires to be productive. It took five. Most of that delta was workspace and view spec setup. The new engineers came from Git so the mental model was foreign and the tooling did not meet them halfway.',
        source_url: '/source/gong-call-2026-02-03-nimbus',
        source_date: '2026-02-03',
        customer: 'Nimbus Studios',
      },
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'Three weeks of needs help daily. Six weeks of needs help weekly. Three months before they stop pinging me about CLI flags. That is for someone who comes from a Git background.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
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
        passage:
          '41% of users in their first P4V session who reach the wizard abandon before completing it. The abandonment cluster is at step 3 of 5 — "Configure view lines" — where the user is presented with a free-text editor and a "validate" button.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'The default workspace setup wizard in P4V hides three of the four things a new artist actually needs to know, and surfaces two things they will never touch. The first-run experience is just dense. We made a 12-minute internal video for new hires because we could not get them through the wizard without one.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
    ],
  }),
  claim({
    id: 'CL-0003',
    text: 'New developers cannot easily reconcile their open Swarm reviews with their assigned work because the dashboard shows "reviews I posted" and "reviews assigned to me" in a single undifferentiated list, blocking productive onboarding for tech leads with high review volume.',
    product: 'helix-swarm',
    area: 'onboarding',
    persona: 'tech-lead',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'I have 11 reviews open right now. Some are mine to review, some are mine that I posted and I am waiting on others. Swarm shows them in one list. I have to read each title to remember which side I am on. Two tabs. "Reviews waiting on me." "Reviews I am waiting on." That is it.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),
  claim({
    id: 'CL-0004',
    text: 'Tech leads spend a recurring fraction of their week answering basic CLI flag questions from mid-level engineers because the equivalent action in P4V is either missing or deeply buried, making the GUI a partial onboarding path rather than a complete one.',
    product: 'p4v',
    area: 'onboarding',
    persona: 'tech-lead',
    sentiment: 'mixed',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'Last week one of my mid-level engineers asked how to find which changelists touched a specific file in the last 30 days. The answer is `p4 changes -m 100` plus some grepping. There is no P4V equivalent — the file history view only shows revisions, not changelists, and the date filtering is buried. So this person is stuck either learning the CLI flag or asking me.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),

  // ============================================================
  // WORKSPACE-SETUP (cross-product: helix-core, p4v)
  // ============================================================
  claim({
    id: 'CL-0005',
    text: 'A recurring class of workspace failures stems from users pointing their workspace root at a cloud-sync directory (OneDrive, iCloud, Dropbox), causing phantom locked-file errors and silent corruption that Helix Core has no built-in defense against.',
    product: 'helix-core',
    area: 'workspace-setup',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          "P4V's workspace creation wizard does not warn when the root is inside a known cloud-sync directory. Three field engineers have asked product for a 'this looks like OneDrive — are you sure?' warning. No ETA.",
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'The wizard does not catch the common mistake of pointing the workspace root at OneDrive or iCloud. We had three artists do that in the first month at the new studios. Once your workspace is in OneDrive, every sync is a fight.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'gong-call-2026-02-03-nimbus',
        source_type: 'gong',
        passage:
          'One of our seniors found three different engineers had their workspace in OneDrive in a single afternoon. We added it to the IT laptop image — Perforce workspace root must be `~/perforce`, full stop — and the support tickets dropped to zero.',
        source_url: '/source/gong-call-2026-02-03-nimbus',
        source_date: '2026-02-03',
        customer: 'Nimbus Studios',
      },
    ],
  }),
  claim({
    id: 'CL-0006',
    text: 'Building a narrowed P4V client view requires hand-editing view lines in a free-text editor; there is no UI for browsing the depot tree and selecting paths to include, forcing customers to write external scripts that generate client specs from spreadsheets.',
    product: 'p4v',
    area: 'workspace-setup',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          'There is no UI in P4V for building a view spec by browsing the depot tree. Users must hand-edit the view lines, and the syntax (especially the `-//depot/...` exclusion lines) is not intuitive.',
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'We tried using a template client and it half-worked. The artists kept ending up with the entire depot synced to their machines, like 4 terabytes worth, because the view lines were not narrowing the way we expected. We ended up writing a Python script to generate the client specs from a spreadsheet.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
    ],
  }),
  claim({
    id: 'CL-0007',
    text: 'Stale client spec host bindings after laptop replacement produce an opaque "Client X can only be used from host Y" error with no in-product remediation path, requiring CLI knowledge that new developers do not have.',
    product: 'helix-core',
    area: 'workspace-setup',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          "User gets a new laptop, copies their .p4config, and the old client spec is still pointed at the old machine's hostname. `p4 sync` says 'Client foo can only be used from host old-mac-name.' P4V does not detect host mismatch on first connection and offer to update.",
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
    ],
  }),

  // ============================================================
  // MERGE (cross-product: p4v, helix-core, helix-swarm)
  // ============================================================
  claim({
    id: 'CL-0008',
    text: "P4V's resolve dialog does not distinguish syntactic conflicts (formatting, line-ending, USD timeSample reordering) from semantic conflicts, forcing release managers to click through every flagged file on large merge changelists and adding 30+ minutes to routine copy-ups.",
    product: 'p4v',
    area: 'merge',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          "P4V's resolve dialog does not distinguish 'this is the same intent rewritten' from 'this is a real semantic conflict.' So our release managers end up clicking through every single one to verify.",
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          'The resolve panel in P4V opens the file diff in a separate pane each time. On the cinematic shot files, which are gigantic USD scenes, that diff takes 4 to 7 seconds to render. Multiply by 30 files and you have lost half an hour just to one merge.',
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'Make the resolve flow smart. Tell me which conflicts are syntactic and which are real. I would save four hours a week. The team would save more.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          'The "auto-resolve safe" button is clicked in only 23% of resolve sessions despite being the documented happy path. Users either don\'t know it\'s there or don\'t trust it.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),
  claim({
    id: 'CL-0009',
    text: 'The `p4 resolve -am` aggressive auto-merge has silently dropped USD sublayers in production at film customers, including one case that shipped to dailies, eroding trust in the resolve toolchain for binary-adjacent formats.',
    product: 'helix-core',
    area: 'merge',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          'We end up using `-am` which is more aggressive and we have had two cases where the merge silently dropped a sublayer. Once it shipped to dailies. That was a bad week.',
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
    ],
  }),
  claim({
    id: 'CL-0010',
    text: 'Swarm reviews on merge changelists show 600+ files with no way to filter to "files that required a human resolve," so reviewers cannot find the changes that actually need scrutiny and either rubber-stamp or miss real issues.',
    product: 'helix-swarm',
    area: 'merge',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          'Swarm reviews on merge changelists are where it gets really painful. When I post a merge changelist to Swarm for the cinematic-A team to sign off, Swarm shows me 600 files. About 540 of those are the auto-merged copy-up. The reviewers do not know which ones to actually look at.',
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
    ],
  }),
  claim({
    id: 'CL-0011',
    text: 'Repeated opens of the P4V resolve dialog within a single session correlate strongly with merge changelists over 50 files, and 14% of monthly P4V users hit this friction event each month — concentrated among tech leads.',
    product: 'p4v',
    area: 'merge',
    persona: 'tech-lead',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          'Resolve dialog opened > 8 times in one session: 1,184 sessions affected, 14% of MAU, up 6pp vs Q4 2025. Strongly correlated with merge changelists > 50 files. Median time in resolve dialog per file is 14 seconds; long-tail users spend > 90 seconds per file.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),

  // ============================================================
  // BRANCHING (cross-product: helix-core, p4v, helix-swarm)
  // ============================================================
  claim({
    id: 'CL-0012',
    text: 'Release managers struggle to switch between active streams in P4V because the stream graph takes 8-12 seconds to render at customers with more than 10 streams, leading power users to abandon the GUI and operate exclusively from the CLI.',
    product: 'p4v',
    area: 'branching',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'The stream graph view in P4V takes 8 to 12 seconds to render for our streams setup. We have 14 streams. After it renders, navigating to a different stream re-renders the whole graph again. I time-budget that — I will not open the stream graph unless I am sure I need it.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          'Stream switcher opened then cancelled: 612 sessions affected, 7% of MAU. Cohort: release managers report this friction event in 31% of their sessions.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),
  claim({
    id: 'CL-0013',
    text: 'Release managers report that branching strategy migrations from long-lived release branches to streams land cleanly at the structural level, but daily inter-stream merges expose tooling gaps that erase the migration win.',
    product: 'helix-core',
    area: 'branching',
    persona: 'release-manager',
    sentiment: 'mixed',
    evidence: [
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          'We moved from a long-lived release branch model to streams in October. We have 11 active streams right now across the two cinematics projects and the engine work. The migration itself was clean enough. What is been hard is the day-to-day merging between streams when shot work needs to pick up an engine change.',
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
    ],
  }),
  claim({
    id: 'CL-0014',
    text: 'Helix Swarm cannot mark a review as release-critical from the author side in a way that surfaces on the reviewer side, so release-blocking reviews sit waiting behind unrelated work in reviewer queues for days.',
    product: 'helix-swarm',
    area: 'branching',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          "swarm doesn't surface 'this one is blocking a release' anywhere in my dashboard. it just shows me all 47 of my open reviews sorted by date. i'd actually pick up the release-blockers first if i could see them",
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          'anyone else seeing Swarm reviews just sitting for 2+ days right now? release-2026.03 has 14 open and the oldest is from feb 10. this is the third release in a row where the review queue is what is gating us',
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'I have 11 reviews open right now. Some are mine to review, some are mine that I posted and I am waiting on others. Swarm shows them in one list. I have to read each title to remember which side I am on.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),
  claim({
    id: 'CL-0015',
    text: 'There is no admin-side report in Helix Core that surfaces which users in a streams-enabled depot are still on classic clients, leaving hybrid configurations to fester silently after migrations.',
    product: 'helix-core',
    area: 'branching',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          'There is no admin-side report of "which of my users are still on classic clients in a streams-enabled depot." Has been requested.',
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
    ],
  }),

  // ============================================================
  // PERMISSIONS (cross-product: helix-core, p4v)
  // ============================================================
  claim({
    id: 'CL-0016',
    text: 'The Helix Core protections table is the only line of defense for NDA boundaries between concurrent projects, and the precedence rules for protection lines are non-obvious enough that misconfigurations regularly expose one project\'s assets to another team for short windows.',
    product: 'helix-core',
    area: 'permissions',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'Setting up the protections table for that took us four tries because the precedence rules for the lines are not obvious. We had an artist on the Drift Labs collab accidentally syncing the Hexagon Pictures cinematic assets for about thirty minutes before someone caught it.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'The protections syntax should not be the only line of defense for NDA boundaries between projects. The product made it really easy to misconfigure.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          'After admin grants a user access to a project depot, the user runs `p4 sync` and gets "no permission for operation on file(s)". Almost always a protections table issue. The user is in two groups with conflicting protections and order matters.',
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
    ],
  }),
  claim({
    id: 'CL-0017',
    text: 'When a sync fails with a protection error, neither P4V nor the CLI explains which specific protection line caused the denial, leaving developers to run `p4 protects -u` and parse dense output that mid-level engineers cannot read confidently.',
    product: 'p4v',
    area: 'permissions',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          'There is no UI surfaceable explanation of why a sync failed with a protection error. The CLI error is the only diagnostic and it does not name the offending protection line.',
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          'Help link clicked from Protections view: 941 sessions affected, 11% of MAU, flat vs Q4 2025.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),
  claim({
    id: 'CL-0018',
    text: 'Group membership precedence collisions in the protections table are a recurring class of permission incident, with field engineers reporting that order-of-lines surprises bite even experienced admins.',
    product: 'helix-core',
    area: 'permissions',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          'Common causes: the `=write` line for the user\'s group is below an `=` deny line and the deny is winning. The user is in two groups with conflicting protections and order matters. The host pattern in the protection line does not match the user\'s machine name.',
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
    ],
  }),

  // ============================================================
  // CLI-ERGONOMICS (helix-core mostly; helix-swarm bit)
  // ============================================================
  claim({
    id: 'CL-0019',
    text: 'The `p4` CLI flag set is inconsistent across commands — the same letter flag means different things in `p4 sync`, `p4 print`, and `p4 reconcile` — forcing tech leads to maintain hand-written shell completion scripts that they pass to new hires informally.',
    product: 'helix-core',
    area: 'cli-ergonomics',
    persona: 'tech-lead',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'The `p4` CLI is an artifact of its history. The flags are inconsistent across commands. `p4 sync -f` means force; `p4 print -f` means something different; `p4 reconcile -f` is force again. I have a bash script that auto-completes flags but I had to write it myself.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'CLI ergonomics for the build pipeline are still a sore point — the build engineers complain that p4 sync flags vary between commands and you cannot tell from the help text which flags compose with which.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'gong-call-2024-09-12-citadel-defense',
        source_type: 'gong',
        passage:
          'The CLI flag inconsistency was a daily ask in the first month for our new engineers. We have a wiki page that is just "flag glossary" and it is the most-visited page on our team site.',
        source_url: '/source/gong-call-2024-09-12-citadel-defense',
        source_date: '2024-09-12',
        customer: 'Citadel Defense',
      },
    ],
  }),
  claim({
    id: 'CL-0020',
    text: 'Build engineers and DevOps users prefer the `p4` CLI for streams operations specifically because the equivalent P4V views are too slow at scale, creating a two-tier user experience where power users avoid the GUI entirely.',
    product: 'helix-core',
    area: 'cli-ergonomics',
    persona: 'build-engineer',
    sentiment: 'mixed',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'I usually have to context-switch to a terminal to do anything that involves stream operations, because P4V stream tooling is — I do not want to say bad, but it is slow enough that I avoid it.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),
  claim({
    id: 'CL-0021',
    text: 'Build engineers report that the streams documentation has improved over the last two release cycles and streams setup specifically is now smooth, even as adjacent CLI ergonomics remain rough — a rare positive signal in the Helix Core corpus.',
    product: 'helix-core',
    area: 'cli-ergonomics',
    persona: 'build-engineer',
    sentiment: 'positive',
    evidence: [
      {
        source_id: 'gong-call-2025-11-04-stellar-forge',
        source_type: 'gong',
        passage:
          'Streams setup for our build engineers was actually smooth this time. The streams documentation has improved.',
        source_url: '/source/gong-call-2025-11-04-stellar-forge',
        source_date: '2025-11-04',
        customer: 'Stellar Forge Games',
      },
    ],
  }),
  claim({
    id: 'CL-0022',
    text: 'The CLI overhead of finding "which changelists touched this file in the last 30 days" requires multi-flag knowledge plus shell piping; the P4V file history view does not offer changelist-level grouping or date filtering, so this common question has no GUI answer.',
    product: 'helix-core',
    area: 'cli-ergonomics',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'The answer is `p4 changes -m 100 //depot/path/file -t` plus some grepping. There is no P4V equivalent — the file history view only shows revisions, not changelists, and the date filtering is buried.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),

  // ============================================================
  // PERFORMANCE (cross-product: p4v, helix-swarm, helix-core)
  // ============================================================
  claim({
    id: 'CL-0023',
    text: 'Helix Swarm 2025.4 introduced a perceptible web UI regression where reviews touching cinematic-stream changes take 8-12 seconds to render the file tree, up from 2-3 seconds in prior versions.',
    product: 'helix-swarm',
    area: 'performance',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          'open a review with the cinematic-A stream changes and it takes 8-12 seconds before the file tree renders. used to be 2-3. anyone else?',
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          'yes. i blamed our VPN at first but it is the same on the office network. something regressed in 2025.4',
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'gong-call-2026-04-22-drift-labs',
        source_type: 'gong',
        passage:
          'Our Swarm load times got noticeably worse around the 2025.4 upgrade. We did not roll back because the security fixes in 2025.4 are required for our customer audits, but we have an open ticket on the perf regression.',
        source_url: '/source/gong-call-2026-04-22-drift-labs',
        source_date: '2026-04-22',
        customer: 'Drift Labs',
      },
    ],
  }),
  claim({
    id: 'CL-0024',
    text: 'The P4V file diff pane on large USD scene files takes 4-7 seconds per file to render in the resolve flow, multiplying through 30+ files per merge to consume half an hour of release-manager time on a single copy-up.',
    product: 'p4v',
    area: 'performance',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          'The resolve panel in P4V opens the file diff in a separate pane each time. On the cinematic shot files, which are gigantic USD scenes, that diff takes 4 to 7 seconds to render. Multiply by 30 files and you have lost half an hour just to one merge.',
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
    ],
  }),
  claim({
    id: 'CL-0025',
    text: 'Workspaces placed on network drives — common at IT-managed shops with backup mandates — turn 30-second `p4 sync` operations into 8-12 minute syncs, and there is no warning at workspace-creation time about storage class.',
    product: 'helix-core',
    area: 'performance',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
        source_type: 'confluence',
        passage:
          'Some IT-managed shops put the workspace on a network drive for backup purposes. This works but is slow. `p4 sync` operations that should take 30 seconds take 8-12 minutes. The P4V wizard does not check the storage class of the chosen workspace root.',
        source_url: '/source/confluence-internal-2025-12-09-workspace-setup-runbook',
        source_date: '2025-12-09',
      },
    ],
  }),
  claim({
    id: 'CL-0026',
    text: 'Stream graph rendering in P4V is the single most-time-budgeted operation among tech leads, who explicitly avoid opening the view unless necessary — eroding the discoverability benefits of the visual stream model for the users most likely to teach others.',
    product: 'p4v',
    area: 'performance',
    persona: 'tech-lead',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'I time-budget that — I will not open the stream graph unless I am sure I need it. So I do everything I can from the CLI.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),

  // ============================================================
  // API-INTEGRATION (helix-core, helix-swarm)
  // ============================================================
  claim({
    id: 'CL-0027',
    text: 'Customers automating Helix Core protections from external identity providers (Okta, Entra) work around the absence of a structured permissions API by parsing and editing the protections spec as plain text, which is brittle and a known source of incidents.',
    product: 'helix-core',
    area: 'api-integration',
    persona: 'devops',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2026-03-11-apex-aeronautics',
        source_type: 'gong',
        passage:
          'Our Okta integration writes the protections spec back to Perforce as a text blob. There is no JSON API for protections. If a line is malformed, the whole spec rejects. We have had two outages from this in the last year — both human errors in our scripting, not Perforce, but the API surface is what made the error possible.',
        source_url: '/source/gong-call-2026-03-11-apex-aeronautics',
        source_date: '2026-03-11',
        customer: 'Apex Aeronautics',
      },
    ],
  }),
  claim({
    id: 'CL-0028',
    text: 'Helix Swarm webhooks fire reliably on review events but the payload does not include the changelist diff or file list, requiring downstream automation to make a second API call per event and contributing to integration latency for CI systems.',
    product: 'helix-swarm',
    area: 'api-integration',
    persona: 'build-engineer',
    sentiment: 'mixed',
    evidence: [
      {
        source_id: 'gong-call-2026-03-11-apex-aeronautics',
        source_type: 'gong',
        passage:
          'The Swarm webhooks land fine. The issue is the payload is thin — we have to call back for the file list every time. For our CI pipeline that doubles our round-trip per review event. Not a blocker, just friction we could do without.',
        source_url: '/source/gong-call-2026-03-11-apex-aeronautics',
        source_date: '2026-03-11',
        customer: 'Apex Aeronautics',
      },
    ],
  }),
  claim({
    id: 'CL-0029',
    text: 'P4 triggers remain the dominant extensibility surface for Helix Core but are difficult to test in isolation; build engineers describe a development loop of "edit trigger, deploy to staging server, observe in production logs" rather than a local unit-test path.',
    product: 'helix-core',
    area: 'api-integration',
    persona: 'build-engineer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'gong-call-2025-09-18-mercury-robotics',
        source_type: 'gong',
        passage:
          "P4 triggers are how we enforce changelist-description format, branch policies, and a few other things. Testing them is a slog. There is no local emulator. We end up editing the trigger, deploying to staging, submitting a fake change, and reading the trigger output from the server log. The loop is five minutes per change. We have triggers we have not touched in two years because nobody wants to risk the loop.",
        source_url: '/source/gong-call-2025-09-18-mercury-robotics',
        source_date: '2025-09-18',
        customer: 'Mercury Robotics',
      },
    ],
  }),

  // ============================================================
  // ADDITIONAL CLAIMS to round out distribution
  // ============================================================

  // p4v — onboarding (second one, distinct angle)
  claim({
    id: 'CL-0030',
    text: 'Pendo telemetry shows the artist / IC (non-engineering) cohort abandons the P4V workspace wizard at 47% — substantially higher than the overall 41% — concentrated at film and games customers where artists are the largest seat group.',
    product: 'p4v',
    area: 'onboarding',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          "Artist / IC (non-engineering) — Workspace creation wizard abandoned (47% of cohort). The artist cohort's wizard abandonment is the standout. We see the same pattern in P4V telemetry for film and games customers specifically.",
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),

  // helix-swarm — performance (separate angle)
  claim({
    id: 'CL-0031',
    text: "Swarm's inline comment-badge indicator on the file tree stops being reliable for reviews over ~15 files, leading reviewers to miss unresolved comments and search the activity log manually as a workaround.",
    product: 'helix-swarm',
    area: 'performance',
    persona: 'tech-lead',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          "when a review has more than ~15 files, the comment indicator in the file tree stops being reliable. i've had 3 reviews where there were unresolved comments i didn't see because the badge didn't render. had to ctrl-F through the review activity log to find them. felt like 2014",
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
    ],
  }),

  // helix-swarm — workspace-setup analog (review-setup)
  claim({
    id: 'CL-0032',
    text: 'Release-engineering teams report 11 hours per sprint of overhead just managing "where is this review / who has it / is it blocking" across Swarm — a quantified productivity tax that compounds across the team.',
    product: 'helix-swarm',
    area: 'workspace-setup',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          'i did a rough count last sprint. across the 6 of us we spent ~11 hours total on "where is this review / who has it / is it blocking" overhead. that is per sprint. 11 hours of release-engineer time is not nothing',
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
    ],
  }),

  // helix-core — performance (a second angle)
  claim({
    id: 'CL-0033',
    text: 'The atomic submit semantics and file-level locking model in Helix Core are repeatedly named by tech leads as non-negotiable strengths — the underlying model is trusted even when the UI on top of it is criticized.',
    product: 'helix-core',
    area: 'performance',
    persona: 'tech-lead',
    sentiment: 'positive',
    evidence: [
      {
        source_id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_type: 'zoom',
        passage:
          'The atomic submit semantics. The file-level locking model. The fact that I can hand a junior engineer a changelist number and we can both look at the exact same thing. Those are non-negotiable. Whatever you change about the UI, do not change the underlying model.',
        source_url: '/source/zoom-research-2026-04-08-lumen-foundry-tech-lead',
        source_date: '2026-04-08',
        customer: 'Lumen Foundry',
      },
    ],
  }),

  // p4v — submit / general (workspace-setup adjacent)
  claim({
    id: 'CL-0034',
    text: 'P4V does not auto-sync on submit, leading to "file out of date" rejections that account for 44% of all submit failures captured in product telemetry — concentrated among new users who do not yet know to sync first.',
    product: 'p4v',
    area: 'workspace-setup',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          '"File out of date" rejections suggest users are not running sync before submit. P4V does not run an auto-sync-on-submit; users have to know to do it. New users especially get caught. 44% of submit rejections fall in this bucket.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),

  // helix-swarm — permissions (review-permissions, slightly stretched but useful)
  claim({
    id: 'CL-0035',
    text: 'Swarm review priority and "release-critical" flagging have been requested by customers since at least mid-2025 with no roadmap movement, prompting one customer team to attempt a third-party plugin that is no longer maintained.',
    product: 'helix-swarm',
    area: 'cli-ergonomics',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          "we did, last june. no movement. there's a third party plugin someone built but it's not maintained",
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
    ],
  }),

  // helix-swarm — branching (review threading on long diffs)
  claim({
    id: 'CL-0036',
    text: 'Swarm comment threads on the files that did require manual resolution are praised by release managers as best-in-class — the discussion primitive itself works, it is the *finding* of those files in a noisy review that breaks.',
    product: 'helix-swarm',
    area: 'merge',
    persona: 'release-manager',
    sentiment: 'positive',
    evidence: [
      {
        source_id: 'gong-call-2026-01-22-hexagon-pictures',
        source_type: 'gong',
        passage:
          'The Swarm comment threads on the manual-resolve files are excellent. That part works. It is the *finding* of those files in a sea of routine merges that is broken.',
        source_url: '/source/gong-call-2026-01-22-hexagon-pictures',
        source_date: '2026-01-22',
        customer: 'Hexagon Pictures',
      },
    ],
  }),

  // p4v — performance / right-click discoverability
  claim({
    id: 'CL-0037',
    text: 'Repeated right-click menu opens on the same file in P4V — a heuristic for "user is hunting for an action they cannot find" — affect 7% of monthly active users and cluster on the changelist pending list and depot tree views.',
    product: 'p4v',
    area: 'cli-ergonomics',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          'Right-click menu opened > 12 times on same file: 587 sessions affected, 7% of MAU. Heuristic for "user is looking for an action they can\'t find." Top three files where this happens: changelist pending list, depot tree view, workspace tree view.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),

  // helix-core — onboarding (older claim to test recency badges, mentions AAA studio)
  claim({
    id: 'CL-0038',
    text: 'Engineers coming from a Git background describe a months-long period of mental-model adjustment to Helix Core — the lift is the model and the CLI muscle memory, not any individual feature.',
    product: 'helix-core',
    area: 'onboarding',
    persona: 'developer',
    sentiment: 'mixed',
    evidence: [
      {
        source_id: 'gong-call-2024-09-12-citadel-defense',
        source_type: 'gong',
        passage:
          'Our backend engineers came in from a Git shop. Even the ones who had used Subversion 10 years ago needed three months before they stopped tripping over the workspace model. The CLI flag inconsistency was a daily ask in the first month.',
        source_url: '/source/gong-call-2024-09-12-citadel-defense',
        source_date: '2024-09-12',
        customer: 'Citadel Defense',
      },
    ],
  }),

  // helix-core — branching (one more cross-product to ensure 3 in branching area)
  claim({
    id: 'CL-0039',
    text: 'The reconcile-offline-work flow in Helix Core surfaces friction as a rage-click pattern in P4V telemetry, with 17% of monthly users repeating the action — suggesting the dialog does not give users a confident signal of what changed.',
    product: 'p4v',
    area: 'branching',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'pendo-export-2026-03-15-p4v-feature-usage',
        source_type: 'pendo',
        passage:
          'Repeated retry of "Reconcile Offline Work": 1,402 sessions affected, 17% of MAU, up 2pp vs Q4 2025.',
        source_url: '/source/pendo-export-2026-03-15-p4v-feature-usage',
        source_date: '2026-03-15',
      },
    ],
  }),

  // helix-swarm — api-integration (already had CL-0028, add one more for trends)
  claim({
    id: 'CL-0040',
    text: 'In recent months Swarm review-queue management has surfaced as a top productivity drag for release managers across both games and film customers, eclipsing earlier complaints about review UX itself — a shift in where the friction lives.',
    product: 'helix-swarm',
    area: 'api-integration',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-release-eng-2026-02-18',
        source_type: 'slack',
        passage:
          'between the priority gap and the comment badge bugs we are losing real days per release cycle',
        source_url: '/source/slack-release-eng-2026-02-18',
        source_date: '2026-02-18',
        customer: 'Stellar Forge Games',
      },
      {
        source_id: 'gong-call-2026-04-22-drift-labs',
        source_type: 'gong',
        passage:
          'A year ago our complaint about Swarm was the diff renderer. Now the diff renderer is fine and the new complaint is queue management. We have made the review itself comfortable enough that the surrounding workflow is what hurts.',
        source_url: '/source/gong-call-2026-04-22-drift-labs',
        source_date: '2026-04-22',
        customer: 'Drift Labs',
      },
    ],
  }),
];

export const CLAIMS_BY_ID: Record<string, Claim> = Object.fromEntries(
  CLAIMS.map((c) => [c.id, c]),
);
