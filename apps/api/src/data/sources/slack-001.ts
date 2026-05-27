import type { SourceDocument } from './gong-001.ts';

export const SLACK_001: SourceDocument = {
  id: 'slack-release-eng-2026-02-18',
  type: 'slack',
  title: '#release-eng — Swarm review queue blowing up again',
  date: '2026-02-18',
  participants: [
    'mara.voss (Stellar Forge Games)',
    'tariq.hassan (Stellar Forge Games)',
    'kenji.ito (Stellar Forge Games)',
    'priya.nair (Stellar Forge Games)',
  ],
  body: `[2026-02-18 09:14] mara.voss: anyone else seeing Swarm reviews just sitting for 2+ days right now? release-2026.03 has 14 open and the oldest is from feb 10

[2026-02-18 09:15] mara.voss: this is the third release in a row where the review queue is what's gating us

[2026-02-18 09:22] tariq.hassan: yeah it's bad. half of mine are waiting on @kenji.ito and he's been deep in the renderer rewrite

[2026-02-18 09:24] kenji.ito: i know, sorry. swarm doesn't surface "this one is blocking a release" anywhere in my dashboard. it just shows me all 47 of my open reviews sorted by date. i'd actually pick up the release-blockers first if i could see them

[2026-02-18 09:25] kenji.ito: the project label is there but i can't sort by it. and there's no way to mark a review as "release-critical" that shows up on the reviewer's side

[2026-02-18 09:31] mara.voss: that's a real gap. i thought we filed a feature request for review priority?

[2026-02-18 09:32] tariq.hassan: we did, last june. no movement. there's a third party plugin someone built but it's not maintained

[2026-02-18 09:40] priya.nair: jumping in late — the other thing slowing me down is swarm's inline comment threads on long diffs. when a review has more than ~15 files, the comment indicator in the file tree stops being reliable. i've had 3 reviews where there were unresolved comments i didn't see because the badge didn't render

[2026-02-18 09:41] priya.nair: had to ctrl-F through the review activity log to find them. felt like 2014

[2026-02-18 09:45] mara.voss: ok i'm going to escalate to the perforce CSM today. between the priority gap and the comment badge bugs we are losing real days per release cycle. has anyone timed how much?

[2026-02-18 09:51] tariq.hassan: i did a rough count last sprint. across the 6 of us we spent ~11 hours total on "where is this review / who has it / is it blocking" overhead. that's per sprint.

[2026-02-18 09:52] tariq.hassan: 11 hours of release-engineer time is not nothing

[2026-02-18 10:03] kenji.ito: also — separate but related — the swarm web UI is kind of slow on this latest version? open a review with the cinematic-A stream changes and it takes 8-12 seconds before the file tree renders. used to be 2-3. anyone else?

[2026-02-18 10:04] mara.voss: yes. i blamed our VPN at first but it's the same on the office network. something regressed in 2025.4

[2026-02-18 10:11] tariq.hassan: i'll add the perf regression to the CSM email. we should at least get acknowledgement

[2026-02-18 10:30] mara.voss: ok draft is in the doc, will send after lunch. tagged kenji and tariq's points. priya the comment badge bug is in there too — can you screenshot one of the missed comment situations when you can? helps to have a concrete example

[2026-02-18 10:31] priya.nair: yep on it

[2026-02-18 11:48] mara.voss: email sent. let's see what comes back. in the meantime kenji you have 6 release-blocking reviews waiting on you, dropping the list in DM

[2026-02-18 11:49] kenji.ito: 🫡`,
  excerpts: [
    {
      passage:
        "swarm doesn't surface 'this one is blocking a release' anywhere in my dashboard. it just shows me all 47 of my open reviews sorted by date. i'd actually pick up the release-blockers first if i could see them",
      offset_hint: '09:24',
    },
    {
      passage:
        "when a review has more than ~15 files, the comment indicator in the file tree stops being reliable. i've had 3 reviews where there were unresolved comments i didn't see because the badge didn't render",
      offset_hint: '09:40',
    },
    {
      passage:
        'open a review with the cinematic-A stream changes and it takes 8-12 seconds before the file tree renders. used to be 2-3. anyone else?',
      offset_hint: '10:03',
    },
  ],
};
