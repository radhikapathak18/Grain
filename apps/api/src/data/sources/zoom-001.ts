import type { SourceDocument } from './gong-001.ts';

export const ZOOM_001: SourceDocument = {
  id: 'zoom-research-2026-04-08-lumen-foundry-tech-lead',
  type: 'zoom',
  title: 'Lumen Foundry — research interview, tech lead deep-dive',
  date: '2026-04-08',
  customer: 'Lumen Foundry',
  participants: [
    'Iris Bekova (Lumen Foundry, Senior Tech Lead — Engine team)',
    'Renata Ortiz (Perforce UX Research)',
    'Sam Chen (Perforce UX Research, note-taker)',
  ],
  body: `[00:00] Renata Ortiz: Thanks for sitting down with us, Iris. As I mentioned in the calendar invite, this is a research conversation, not a sales call. No product is being pitched. We want to understand your day-to-day with Helix Core, P4V, and Swarm from the tech-lead seat. Cool?

[00:18] Iris Bekova: Cool. Happy to.

[00:21] Renata Ortiz: Let's start with: what does a typical morning look like for you in terms of Perforce touch points?

[00:28] Iris Bekova: I open P4V first thing. I'm checking pending changelists from my team — usually four to six per morning. Then I open Swarm in the browser to see my review queue. Today I had eleven open reviews. Then I usually have to context-switch to a terminal to do anything that involves stream operations, because P4V's stream tooling is — I don't want to say bad, but it's slow enough that I avoid it.

[01:14] Renata Ortiz: When you say slow, can you describe what you mean?

[01:18] Iris Bekova: The stream graph view in P4V takes 8 to 12 seconds to render for our streams setup. We have 14 streams. After it renders, navigating to a different stream re-renders the whole graph again. I time-budget that — I will not open the stream graph unless I'm sure I need it. So I do everything I can from the CLI.

[02:03] Renata Ortiz: What about your team members? Do they all use the CLI like you do?

[02:08] Iris Bekova: No. About a third of my team are senior enough to use the CLI comfortably. The rest live in P4V. And the friction lands hardest on the in-between group: people who know enough to want to do something custom, but not enough to do it from the CLI confidently. They end up Slacking me to ask "what do I run for X."

[02:48] Renata Ortiz: Can you give an example of that kind of question?

[02:52] Iris Bekova: Sure. Last week one of my mid-level engineers asked how to find which changelists touched a specific file in the last 30 days. The answer is 'p4 changes -m 100 //depot/path/file -t' plus some grepping. There's no P4V equivalent — the file history view only shows revisions, not changelists, and the date filtering is buried. So this person is stuck either learning the CLI flag or asking me. That's a discoverability issue, not a missing-feature issue.

[03:41] Renata Ortiz: Got it. Shifting to Swarm — how are code reviews going?

[03:47] Iris Bekova: Honestly, Swarm is the part of the stack I have the most opinions about. The review primitive is good. The discussion threads are good. The integration with changelists is good. What I find hard is managing my own queue. I have 11 reviews open right now. Some are mine to review, some are mine that I posted and I'm waiting on others. Swarm shows them in one list. I have to read each title to remember which side I'm on.

[04:32] Renata Ortiz: When you imagine that working better, what does it look like?

[04:36] Iris Bekova: Two tabs. "Reviews waiting on me." "Reviews I'm waiting on." That's it. I don't need machine learning. I just need the basic distinction. Right now I'm using Swarm's URL filters as a workaround — I bookmarked two custom searches. Most people on my team haven't found those filters.

[05:21] Renata Ortiz: That's helpful. Going back to Helix Core specifically — anything where the product is doing something well that you'd lose sleep over if it changed?

[05:30] Iris Bekova: The atomic submit semantics. The file-level locking model. The fact that I can hand a junior engineer a changelist number and we can both look at the exact same thing. Those are non-negotiable. Whatever you change about the UI, do not change the underlying model.

[06:08] Renata Ortiz: Noted. What about pain points specific to Helix Core proper, not the GUIs?

[06:14] Iris Bekova: The 'p4' CLI is an artifact of its history. The flags are inconsistent across commands. 'p4 sync -f' means force; 'p4 print -f' means something different; 'p4 reconcile -f' is force again. I have a bash script that auto-completes flags but I had to write it myself. New hires copy it.

[06:51] Renata Ortiz: When you onboard a new engineer to your team, what's the rough timeline before they're productive in Perforce?

[06:57] Iris Bekova: Three weeks of "needs help daily." Six weeks of "needs help weekly." Three months before they stop pinging me about CLI flags. That's for someone who comes from a Git background. For someone with Perforce experience elsewhere, it's a week. The lift is the mental model and the CLI muscle memory.

[07:38] Renata Ortiz: Last question — if you had a magic wand and could change one thing in P4V, what would it be?

[07:44] Iris Bekova: Make the resolve flow smart. Tell me which conflicts are syntactic and which are real. I'd save four hours a week. The team would save more.

[08:02] Renata Ortiz: That's the second time we've heard that this week. Thank you, Iris. This was really useful.

[08:08] Iris Bekova: Glad it helps. Send me whatever you write up from these — I'll read it.`,
  excerpts: [
    {
      passage:
        'The stream graph view in P4V takes 8 to 12 seconds to render for our streams setup. We have 14 streams. After it renders, navigating to a different stream re-renders the whole graph again. I time-budget that — I will not open the stream graph unless I am sure I need it.',
      offset_hint: '01:18',
    },
    {
      passage:
        'I have 11 reviews open right now. Some are mine to review, some are mine that I posted and I am waiting on others. Swarm shows them in one list. I have to read each title to remember which side I am on. Two tabs. "Reviews waiting on me." "Reviews I am waiting on." That is it.',
      offset_hint: '03:47',
    },
    {
      passage:
        'The `p4` CLI is an artifact of its history. The flags are inconsistent across commands. `p4 sync -f` means force; `p4 print -f` means something different; `p4 reconcile -f` is force again. I have a bash script that auto-completes flags but I had to write it myself.',
      offset_hint: '06:14',
    },
  ],
};
