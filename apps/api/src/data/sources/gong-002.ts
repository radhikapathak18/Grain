import type { SourceDocument } from './gong-001.ts';

export const GONG_002: SourceDocument = {
  id: 'gong-call-2026-01-22-hexagon-pictures',
  type: 'gong',
  title: 'Hexagon Pictures — branching strategy and merge pain',
  date: '2026-01-22',
  customer: 'Hexagon Pictures',
  participants: [
    'Jules Romero (Hexagon Pictures, VFX Pipeline Lead)',
    'Sana Khalil (Hexagon Pictures, Release Manager)',
    'Tom Becker (Perforce, Customer Success)',
  ],
  body: `[00:00] Tom Becker: Sana, Jules, thanks for the time. I want to focus this call on the branching strategy you adopted last quarter and how the merges are landing in practice.

[00:11] Sana Khalil: Sure. Quick context: we moved from a long-lived release branch model to streams in October. We have 11 active streams right now across the two cinematics projects and the engine work. The migration itself was clean enough. What's been hard is the day-to-day merging between streams when shot work needs to pick up an engine change.

[00:48] Jules Romero: The pattern that keeps biting us is: an engine programmer lands a fix in main, our shot artists need it in the cinematic-A stream, and the copy-up from main to cinematic-A flags 30 conflicts that are not real conflicts. They are formatting, line-ending, or USD ASCII reordering. P4V's resolve dialog does not distinguish "this is the same intent rewritten" from "this is a real semantic conflict." So our release managers end up clicking through every single one to verify.

[01:32] Sana Khalil: And the clicking through is slow. The resolve panel in P4V opens the file diff in a separate pane each time. On the cinematic shot files, which are gigantic USD scenes, that diff takes 4 to 7 seconds to render. Multiply by 30 files and you have lost half an hour just to one merge.

[02:08] Tom Becker: Have you tried the auto-resolve flags from the CLI side? 'p4 resolve -as' for safe merges?

[02:14] Sana Khalil: Yes. The '-as' flag works for genuinely safe merges, but the issue is that our shot files are getting flagged as conflicting even when the changes are non-overlapping byte ranges, because of how USD serializes timeSamples. So '-as' does not pick those up — it sees them as conflicts. We end up using '-am' which is more aggressive and we have had two cases where the merge silently dropped a sublayer. Once it shipped to dailies. That was a bad week.

[03:01] Jules Romero: The branching model itself is fine. The information we need *during* a merge is wrong. We need to see "is this a content conflict or a format conflict" before we open the file. P4V does not surface that. The badge on the file in the resolve list is just a generic yellow triangle.

[03:38] Tom Becker: What about Helix Swarm reviews on top of the merges? Are those landing okay?

[03:44] Sana Khalil: Swarm reviews on merge changelists are where it gets really painful. When I post a merge changelist to Swarm for the cinematic-A team to sign off, Swarm shows me 600 files. About 540 of those are the auto-merged copy-up. The reviewers do not know which ones to actually look at. We tried tagging the changelist description but nobody reads descriptions. The review interface should hide the routine copy-ups and surface the resolves that needed human judgment. That is the actual review surface.

[04:31] Jules Romero: And the Swarm comment threads on the manual-resolve files are excellent. That part works. It is the *finding* of those files in a sea of routine merges that is broken.

[05:02] Tom Becker: Got it. Sana, are your build engineers in this loop, or is it staying with the release managers?

[05:08] Sana Khalil: It stays with me and one other release manager. The build engineers do not touch the merges. They get involved if a merge breaks the engine build, but that is downstream.

[05:24] Tom Becker: Last question — if you had to name the single change that would save your team the most time on merges, what would it be?

[05:31] Sana Khalil: Smart resolve. Show me which conflicts are syntactic versus semantic before I open the file. Let me bulk-accept the syntactic ones. That is the whole problem.

[05:48] Jules Romero: Agreed. And in Swarm, let me filter the merge changelist file list to "files with human resolves only."

[06:02] Tom Becker: Both noted. I will get these in front of the product team this week.`,
  excerpts: [
    {
      passage:
        "P4V's resolve dialog does not distinguish 'this is the same intent rewritten' from 'this is a real semantic conflict.' So our release managers end up clicking through every single one to verify.",
      offset_hint: '00:48',
    },
    {
      passage:
        'Swarm reviews on merge changelists are where it gets really painful. When I post a merge changelist to Swarm for the cinematic-A team to sign off, Swarm shows me 600 files. About 540 of those are the auto-merged copy-up. The reviewers do not know which ones to actually look at.',
      offset_hint: '03:44',
    },
    {
      passage:
        'The branching model itself is fine. The information we need during a merge is wrong. We need to see "is this a content conflict or a format conflict" before we open the file. P4V does not surface that.',
      offset_hint: '03:01',
    },
  ],
};
