import type { SourceType } from '@grain/types';

export type SourceDocument = {
  id: string;
  type: SourceType;
  title: string;
  date: string;
  customer?: string;
  participants?: string[];
  body: string;
  excerpts: { passage: string; offset_hint: string }[];
};

export const GONG_001: SourceDocument = {
  id: 'gong-call-2025-11-04-stellar-forge',
  type: 'gong',
  title: 'Stellar Forge Games — Helix Core onboarding review (QBR follow-up)',
  date: '2025-11-04',
  customer: 'Stellar Forge Games',
  participants: [
    'Mara Voss (Stellar Forge Games, Release Engineering Lead)',
    'Devon Patel (Stellar Forge Games, IT Ops)',
    'Erik Lindgren (Perforce, Account Executive)',
    'Priya Shah (Perforce, Solutions Engineer)',
  ],
  body: `[00:02] Erik Lindgren: Thanks for making the time, Mara. Wanted to walk through how the onboarding of the two new studios went and where you hit walls.

[00:18] Mara Voss: Yeah, honestly the onboarding for our two new studios took almost three weeks longer than we planned. The biggest piece was just getting the workspaces configured. We have about 140 artists between the two teams and every single one needed a per-user view spec that mapped their depot paths to their local SSD layout. The Helix Core admin guide assumes you already know what a client view looks like, and our IT ops people had not seen one before.

[01:04] Devon Patel: We tried using a template client and it half-worked. The artists kept ending up with the entire depot synced to their machines, like 4 terabytes worth, because the view lines were not narrowing the way we expected. We ended up writing a Python script to generate the client specs from a spreadsheet of who works on what project. That should not be the answer in 2025.

[01:38] Priya Shah: Was there documentation that would have helped, or is this a UX gap?

[01:44] Mara Voss: It is a UX gap. The docs are fine if you already know Perforce. There is no guided "new artist onboarding" path in P4V or in any admin tool. We had three of our senior engineers basically doing white-glove setup for two weeks. They are not cheap people to have doing that.

[02:21] Devon Patel: The other thing was permissions. We have NDAs with two of the publishers we are working with, so the artists on one project must not see the depot paths for the other. Setting up the protections table for that took us four tries because the precedence rules for the lines are not obvious. We had an artist on the Drift Labs collab accidentally syncing the Hexagon Pictures cinematic assets for about thirty minutes before someone caught it.

[03:08] Erik Lindgren: That's a serious one. Did you log it?

[03:11] Mara Voss: We logged it internally. We did not raise it with you because we knew it was our misconfiguration, not a product defect. But the product made it really easy to misconfigure. The protections syntax should not be the only line of defense for NDA boundaries between projects.

[03:48] Priya Shah: What about P4V specifically — how is the experience there for new artists once they are set up?

[03:55] Mara Voss: P4V is fine once they know it. Getting there is rough. The default workspace setup wizard in P4V hides three of the four things a new artist actually needs to know, and surfaces two things they will never touch. The first-run experience is just dense. We made a 12-minute internal video for new hires because we could not get them through the wizard without one.

[04:30] Devon Patel: And the wizard does not catch the common mistake of pointing the workspace root at OneDrive or iCloud. We had three artists do that in the first month at the new studios. Once your workspace is in OneDrive, every sync is a fight.

[05:02] Mara Voss: Honestly if I could ask for one thing in the next release, it would be a guided onboarding flow for individual contributors that is opinionated. Pick from a list of project types, name your machine, point at a local SSD, done. We do not need configurability at the per-artist level. We need defaults that work.

[05:48] Erik Lindgren: That is helpful. Anything on the build/CI side?

[05:54] Devon Patel: Streams setup for our build engineers was actually smooth this time. The streams documentation has improved. CLI ergonomics for the build pipeline are still a sore point — the build engineers complain that p4 sync flags vary between commands and you cannot tell from the help text which flags compose with which. But that is a smaller fish than the artist onboarding piece.

[06:31] Priya Shah: Got it. We will take this back. The IC onboarding wizard idea — would you be willing to do a co-design session if we prototype something?

[06:42] Mara Voss: Yes. Pull in Devon and one of our tech leads. We will make time.

[07:01] Erik Lindgren: Perfect. Same time next month?

[07:04] Mara Voss: Works for me. Thanks both.`,
  excerpts: [
    {
      passage:
        'The onboarding for our two new studios took almost three weeks longer than we planned. The biggest piece was just getting the workspaces configured. We have about 140 artists between the two teams and every single one needed a per-user view spec that mapped their depot paths to their local SSD layout.',
      offset_hint: '00:18',
    },
    {
      passage:
        'The default workspace setup wizard in P4V hides three of the four things a new artist actually needs to know, and surfaces two things they will never touch. The first-run experience is just dense. We made a 12-minute internal video for new hires because we could not get them through the wizard without one.',
      offset_hint: '03:55',
    },
    {
      passage:
        'Setting up the protections table for that took us four tries because the precedence rules for the lines are not obvious. We had an artist on the Drift Labs collab accidentally syncing the Hexagon Pictures cinematic assets for about thirty minutes before someone caught it.',
      offset_hint: '02:21',
    },
  ],
};
