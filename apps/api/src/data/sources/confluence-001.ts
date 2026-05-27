import type { SourceDocument } from './gong-001.ts';

export const CONFLUENCE_001: SourceDocument = {
  id: 'confluence-internal-2025-12-09-workspace-setup-runbook',
  type: 'confluence',
  title: 'Workspace setup runbook — common pitfalls (internal field notes)',
  date: '2025-12-09',
  body: `# Workspace setup runbook — common pitfalls

**Owner:** Field Engineering · **Last updated:** 2025-12-09 · **Status:** Draft (community-edited)

This page captures the workspace setup issues we keep seeing on customer go-lives, ordered by frequency. It is field anecdote, not formal product documentation. Use as a starting point when troubleshooting; do not cite to customers as official guidance.

## 1. Workspace root pointed at a cloud-sync folder

By far the most common issue. New users — especially individual contributors moving from Git — point their workspace root at OneDrive, iCloud Drive, Dropbox, or Google Drive. Every Perforce operation then races with the cloud sync agent. Symptoms: phantom "file is open by another user" errors, sync operations that hang for minutes, files that appear modified without the user editing them.

**Fix:** instruct new users to use a local, non-synced path (e.g., '~/perforce/<workspace>' on macOS, 'C:\\perforce\\<workspace>' on Windows). Add to your onboarding checklist.

**Tooling gap:** P4V's workspace creation wizard does not warn when the root is inside a known cloud-sync directory. Three field engineers have asked product for a "this looks like OneDrive — are you sure?" warning. No ETA.

## 2. View specs that sync the entire depot

The default client view is '//depot/... //workspace/...' which syncs everything. New artists at large studios — particularly games and film — end up with multi-terabyte syncs because nobody narrowed the view.

**Fix:** template the client spec for each project type. Provide narrowed view lines like '//depot/projectA/main/... //workspace/projectA/...' and exclude binary asset roots the artist does not need.

**Tooling gap:** there is no UI in P4V for building a view spec by browsing the depot tree. Users must hand-edit the view lines, and the syntax (especially the '-//depot/...' exclusion lines) is not intuitive. Field engineers report customers writing Python scripts to generate view specs from spreadsheets. This is happening at three customers we know of including Stellar Forge Games.

## 3. Stream vs. classic client confusion

Customers migrating from classic depots to streams ask their build engineers to set up streams, but the artists' workspaces stay classic. The resulting hybrid is hard to support.

**Fix:** during migration, set a target date and convert all workspaces — admin, build, and IC — at the same time. Use 'p4 client -s -S //stream/main' to re-target an existing classic client to a stream.

**Tooling gap:** there is no admin-side report of "which of my users are still on classic clients in a streams-enabled depot." Has been requested.

## 4. Permission denied on first sync (protections table)

After admin grants a user access to a project depot, the user runs 'p4 sync' and gets "no permission for operation on file(s)". Almost always a protections table issue.

**Common causes:**
- The '=write' line for the user's group is below an '=' deny line and the deny is winning.
- The user is in two groups with conflicting protections and order matters.
- The host pattern in the protection line doesn't match the user's machine name.

**Fix:** run 'p4 protects -u <username>' to see the effective protections. The output is dense but tells you which line is winning.

**Tooling gap:** there is no UI surfaceable explanation of *why* a sync failed with a protection error. The CLI error is the only diagnostic and it does not name the offending protection line.

## 5. Workspace on a network drive

Some IT-managed shops put the workspace on a network drive for backup purposes. This works but is slow. 'p4 sync' operations that should take 30 seconds take 8-12 minutes.

**Fix:** workspaces on local SSDs. Back up the changelist history, not the workspace.

**Tooling gap:** the P4V wizard does not check the storage class of the chosen workspace root. A warning when the path is on a network filesystem would catch this.

## 6. Stale client specs after machine replacement

User gets a new laptop, copies their '.p4config', and the old client spec is still pointed at the old machine's hostname. 'p4 sync' says "Client 'foo' can only be used from host 'old-mac-name'."

**Fix:** edit the client spec to update the 'Host:' field, or remove the 'Host:' restriction if your security model permits.

**Tooling gap:** P4V does not detect host mismatch on first connection and offer to update.

---

**Notes from contributors:**

- This list reflects what *field engineers see*. Product analytics (Pendo) may show a different distribution. Cross-reference before quoting in customer-facing materials.
- Several items here are workarounds for product gaps that have been filed as feature requests. We are not the authoritative source on the roadmap.
- If you find a new pattern that bites three or more customers, add a section here. Keep it concrete: include the symptom, the fix, and whether there is a product gap.`,
  excerpts: [
    {
      passage:
        "P4V's workspace creation wizard does not warn when the root is inside a known cloud-sync directory. Three field engineers have asked product for a 'this looks like OneDrive — are you sure?' warning. No ETA.",
      offset_hint: 'Section 1',
    },
    {
      passage:
        'There is no UI in P4V for building a view spec by browsing the depot tree. Users must hand-edit the view lines, and the syntax (especially the `-//depot/...` exclusion lines) is not intuitive.',
      offset_hint: 'Section 2',
    },
    {
      passage:
        'There is no UI surfaceable explanation of why a sync failed with a protection error. The CLI error is the only diagnostic and it does not name the offending protection line.',
      offset_hint: 'Section 4',
    },
  ],
};
