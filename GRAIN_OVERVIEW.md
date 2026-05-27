# Grain — Hackathon Presentation Brief

> A single-document brief explaining Grain as it stands today (post-Phase 8 expanded scope), the features it ships with, the use cases it unlocks, its current limitations, and the future roadmap.
>
> Built for a teammate to hand to a copilot/LLM to turn into hackathon presentation slides. Sections are deliberately self-contained — each one is a slide candidate.

---

## 1. The one-line pitch

**Grain is one interface over scattered product research. Ask in your role's language, get attributed answers with calibrated trust signals across every product you work on.**

It was built as a 24-hour Perforce hackathon project, then extended in a Phase 8 follow-on window to inject anonymized real customer research alongside the original fixture corpus.

---

## 2. The problem

Product teams at Perforce drown in research. Customer insights scatter across Confluence pages, Slack threads, Gong call recordings, Pendo analytics dashboards, and Zoom research transcripts. By the time a PM, Designer, or Engineer needs them, they're buried.

The result: **teams ignore ~90% of the research they collect.** Decisions get made on the loudest recent voice, not the strongest evidence. And cross-product patterns (the same pain point showing up in both Helix Core and P4V) stay invisible because no one searches two product channels at once.

Existing tools — Notion AI, Glean, generic enterprise search — return documents. They don't return **attributed claims with calibrated trust**, and they don't speak to the role asking the question.

---

## 3. What Grain does — the 60-second demo flow

1. **Log in** as a researcher with cross-product access (Helix Core, P4V, Akana).
2. **Pick a role** — PM, Designer, Engineer, or Researcher.
3. **Pick a question shape** — Explore, Verify, or See trends.
4. **Ask** something like *"What are the top pain points across Helix Core and P4V?"*
5. **Watch a streamed answer** that includes:
   - A synthesis sentence ("Across Helix Core and P4V, three recurring themes…")
   - **Per-product attribution** ("In Helix Core, users report… In P4V, similar patterns appear as…")
   - **Citation chips** (`[CL-0007]`) parsed inline and rendered as cards
   - **Three trust signals** on every citation: source tier (T1/T2/T3), evidence count, and recency
6. **Click a citation** — a slide-in evidence panel shows the actual passage from the underlying Gong call / Slack thread / Confluence page / Pendo aggregation / Zoom interview.
7. **Switch roles** — same claims, different framing. PMs get frequency framing; Designers get direct quotes and emotion language; Engineers get scoped technical detail.
8. **Brief mention** — Grain also auto-generates a monthly report and the roadmap exposes it as an MCP server so Claude Code, Figma, and slide tools can pull insights directly.

---

## 4. The five strategic moves (what makes Grain visibly different)

Grain is intentionally narrow. Every feature traces to one of these five differentiators:

| # | Move | What it looks like on stage |
|---|---|---|
| 1 | **Cross-product attribution** | Synthesis explicitly names each product and what it contributes to the answer |
| 2 | **Role-aware synthesis** | Same data, four distinct framings — PM, Designer, Engineer, Researcher |
| 3 | **Three question shapes** | Explore (open-ended), Verify (yes/no with evidence), See trends (time-bucketed) |
| 4 | **Trust signals as first-class** | Tier + evidence count + recency on every citation; styled like financial-app trust indicators, not a generic confidence percentage |
| 5 | **Claim-to-evidence provenance** | One click reveals the raw customer passage behind any synthesized statement |

None of Notion AI, Glean, or generic RAG tools ship any of these five together.

---

## 5. Architecture at a glance

- **Monorepo:** pnpm workspaces
- **Web:** Vite + React 19 + TypeScript + Tailwind v4, Zustand state, TanStack Query, React Router
- **API:** Hono on Node with SSE streaming
- **Shared types:** a `@grain/types` package owning the `Claim`, `Evidence`, chat, and report contracts
- **LLM:** the API shells out to the local `claude` CLI binary (corporate IT blocks Anthropic API keys, so there is no cloud key in this project — important credibility point)
- **Data:** fixture-first. ~40 hand-authored claims plus appended real anonymized claims (Phase 8) live in `apps/api/src/data/`. No PostgreSQL, no vector store.

### The data spine — `Claim` and `Evidence`

```ts
type Claim = {
  id: string;                       // 'CL-0001'…
  text: string;                     // the claim statement
  product: 'helix-core' | 'p4v' | 'akana';
  area: string;                     // cross-product join key
  persona: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  evidence: Evidence[];
  evidence_count: number;
  most_recent_evidence_at: string;
  trust_tier: 'T1' | 'T2' | 'T3';   // derived from highest-tier source
};

type Evidence = {
  source_id: string;
  source_type: 'gong' | 'confluence' | 'slack' | 'pendo' | 'zoom';
  passage: string;
  source_url: string;
  source_date: string;
  customer?: string;
};
```

**Source-tier mapping** (the basis of T1/T2/T3 trust badges):

- Zoom research transcripts → **T1** (highest trust — direct researcher-mediated user voice)
- Gong calls + Pendo aggregations → **T2** (moderated, real, but secondhand or quantitative)
- Confluence pages + Slack messages → **T3** (lowest — internal interpretation, easily stale)

---

## 6. Feature inventory (what ships today)

### Identity & context
- Email + role login (password is `demo`; no real auth — internal pilot only)
- Multi-product selection at login; pre-checked based on the user's role
- Persistent session via `localStorage` (history excluded from persistence by design)
- Route guards on every protected view

### Chat surface
- SSE-streaming chat with status events (`searching` → `retrieved` → `synthesizing`)
- Question-shape selector (Explore / Verify / See trends) above the input
- Inline `[CL-NNNN]` citation chips parsed from the streamed answer
- Citation cards below each message with the three trust badges
- Slide-in evidence panel (Esc / backdrop closes; focus management included)
- Full source-detail page for all five source types
- Graceful "no matching research" empty state

### Trust surfaces
- Source-tier badge per citation (T1 / T2 / T3) with tooltip explaining the tier
- Evidence-count pill (1 of 1 vs. 5 of 5 reads very differently to a judge)
- Recency badge with traffic-light coloring (fresh / aging / stale)
- A per-source-type caption on each evidence card ("Research interview" / "Customer call" / "Call summary via Slack" / "Pendo metric" / "Internal doc") so source-type diversity reads at a glance

### Auxiliary
- Auto-generated monthly report view with theme cards (frequency bars) and emerging issues
- All citation chips on the report open the same evidence panel as in chat
- Graceful fallback for citations whose source documents aren't bundled (real anonymized data) — renders a source-type-specific placeholder with cited passages, never fabricated content

### Production-leaning hygiene (above hackathon baseline)
- Per-IP sliding-window rate limit (20 requests/min) + a hard concurrency cap of 1 stream per IP
- Single-line JSON audit log on every chat request
- Idle and absolute timeouts on the Claude subprocess; SIGTERM→SIGKILL escalation
- Demo launcher (`scripts/start-demo.sh`) that frees ports, typechecks, boots both servers, health-checks them
- Comprehensive test suite: unit, integration, a11y, e2e, visual, perf, chaos, AI quality, compat, stress, responsive

### Phase 8 additions (expanded scope after the 24-hour build)
- **Anonymization pipeline** (`scripts/anonymize.ts`) — takes a real customer document and an `--source-type`, calls the local Claude CLI with source-type-specific rules, returns anonymized text using a canonical fictional studio set (Stellar Forge, Nimbus, Lumen Foundry, Hexagon Pictures, Apex Aeronautics, Citadel Defense, Drift Labs, Mercury Robotics)
- **Claims extraction pipeline** (`scripts/extract-claims.ts`) — takes the anonymized doc and emits TypeScript `claim({...})` blocks ready to append to `claims.ts`
- **Real-data injection** into `claims.ts` under three sub-comments: `// REAL RESEARCH (anonymized, May 2026)`, `// REAL CS/PM CALL SUMMARIES (via Slack)`, `// REAL PENDO ANALYTICS`. Existing CL-0001..CL-0040 are frozen — real data is **appended**, never substituted
- **Demo-question preflight script** (`scripts/demo-preflight.ts`) — exercises a JSON list of questions against the live API, captures responses + citation IDs + retrieved-claim counts, appends each run to a markdown log so regressions are visible across runs
- **Frozen-state snapshot script** (`scripts/freeze-demo-state.ts`) — captures `CLAIMS.length`, the breakdown by product/source_type/area, the current monthly report, and sample preflight responses into a single markdown source-of-truth for rehearsal

---

## 7. Use cases — who Grain helps and how

### Primary internal use cases

1. **PM weekly planning.** "What are users complaining about most in P4V right now, and is it the same as Helix Core?" — Grain returns a ranked synthesis with per-product attribution and trust-calibrated language. The PM cites the claim IDs in their planning doc, not their gut.

2. **Designer kickoff for a redesign.** A designer about to rework workspace onboarding asks the same question in their role's framing — Grain returns direct customer quotes, journey/emotion language, and the specific Gong moments to listen to. They walk into the design review with raw user voice, not synthesized bullets.

3. **Engineer scoping a fix.** An engineer triaging a recurring issue asks "Is there evidence that release managers struggle with branch switching across both products?" in Verify shape. Grain returns a yes/no first sentence, then the specific claims and their trust tier, so the engineer knows whether this is a one-call complaint or a five-Gong-call pattern.

4. **Researcher synthesizing for a leadership readout.** A researcher with cross-product access asks for emerging themes; Grain's monthly-report view doubles as a draft synthesis, with every theme card backed by clickable citations the researcher can verify before quoting.

### Secondary / vision use cases

5. **Slide generation via MCP.** Once Grain exposes itself as an MCP server (roadmap), a Claude-Code-driven slide builder pulls insights directly into a deck — every bullet on the slide is already an attributed claim with a citation tail, no manual copy-paste.

6. **Figma research panels.** A designer in Figma asks Grain "what does our research say about this onboarding screen?" via an MCP plugin and gets a panel of evidence pinned next to the artboard.

7. **Quarterly board-deck inputs.** Strategic narrative built top-down from the strongest tier-1 evidence across all products, with provenance preserved end-to-end so an executive can ask "where did this come from?" and get a real passage in two clicks.

---

## 8. Limitations — honest scoping (these are deliberate, not accidental)

Grain is a hackathon-grade demo. The following are explicitly *not* in the build, and were cut to keep the scope honest:

- **No real database.** Claims live in TypeScript fixtures (`apps/api/src/data/claims.ts`). No PostgreSQL, no pgvector. Acceptable up to ~500k claims; the architecture plan deliberately defers Postgres adoption until then.
- **No real OAuth.** Email + password "demo." Internal pilot only; no external traffic.
- **No real MCP connectors yet.** The pipeline that ingests from Gong / Slack / Confluence / Pendo / Zoom is a roadmap item. Today the corpus is hand-curated fixtures plus appended anonymized real research (Phase 8) — *not* live ingest.
- **No human review queue.** Low-confidence claims aren't gated; they flow straight into synthesis with their source-tier-derived trust badge.
- **No computed confidence score.** Trust tier today is rule-based (the highest source tier on a claim's evidence). It does not factor evidence-count distribution, cross-source agreement, or contradiction.
- **No two-layer entity model.** Customer names like "Stellar Forge Games" / "Stellar Forge" / "SFG" would today be three different strings; v1 controls fixture spelling so this is artificially absent.
- **Cross-product join is exact-match on `area`.** No embedding-similarity bridging — "view-spec setup" in Helix Core won't auto-link to "workspace wizard" in P4V unless the area string is identical.
- **Only four tagging axes are used** (product, area, persona, sentiment). The architecture plan called for eight; the other four (stakeholder type, life-cycle stage, etc.) wait for a filtered-query UI that doesn't exist yet.
- **Multi-product context is set once at login.** No mid-session narrowing/broadening; clicking the product chip in the header is informational only.
- **No admin dashboard, no claims browser.** If you want to inspect the corpus, you read `claims.ts`.
- **No production deploy.** Local dev mode on the demo laptop is the demo machine. Backup video is the failure plan.

Every one of these is a *deliberate* cut documented in `docs/v1.5-backlog.md` and the Phase 0 decisions log, with explicit "promote-to-v1.5 if you see this signal in pilot use" criteria.

---

## 9. Future plan — the v1.5 backlog and beyond

The promotion test for every backlog item is the same: *during v1 pilot usage, do we see a behavior that the missing capability would have prevented or unlocked?* If yes → v1.5. If the signal is theoretical → v2.

### v1.5 candidates (each is one item; full rationale in `docs/v1.5-backlog.md`)

1. **Cross-product taxonomy bridging via embedding similarity** — surface latent links between differently-named areas (Helix Core "view-spec setup" ↔ P4V "workspace wizard"). Promote if PMs repeatedly ask follow-ups that imply two area buckets should be the same.
2. **Live Pendo querying at synthesis time** — fan out a live Pendo query when synthesis needs a quantitative datum that isn't already in the claim store. Promote if pilot users start asking "what's the abandonment rate *this week*?"
3. **Two-layer entity model (canonical + extracted)** — deduplicate "Stellar Forge Games" / "Stellar Forge" / "SFG" to one entity. Promote once real connectors land and we see the same customer spelled multiple ways.
4. **Human review queue** — gate low-confidence extractions before they ship into synthesis. Promote when a pilot user flags a claim as "this isn't what the customer said."
5. **Computed confidence score** — factor evidence count, recency, cross-source agreement, and contradiction into a real score rather than a rule-based tier. Promote when users treat a tier-1-with-one-evidence claim the same as a tier-1-with-five.
6. **Full eight-axis tagging** — adds stakeholder type, life-cycle stage, and two more axes for filtered queries. Promote when pilot users ask question shapes the four current axes can't slice.
7. **Real MCP connectors (Gong first, then Slack / Confluence / Pendo / Zoom)** — replace fixture loading with live ingest. Promote the moment a stakeholder asks "can I point this at our actual Gong?"
8. **Hybrid context inheritance** — let a session's product context propagate down from a parent question to narrowed follow-ups while still allowing broadening mid-thread.
9. **Multi-product context narrowing/broadening mid-session via the header chip** — make the context chip writeable rather than read-only.

### v2 and platform questions

These are explicitly *not* v1.5 questions — they wait for a different signal:

- **PostgreSQL + pgvector adoption** — only when claim volume crosses ~500k. Fixtures carry us until then.
- **Real OAuth / SSO** — only when Grain leaves internal pilot.
- **Elasticsearch / full-text search infrastructure** — only when retrieval latency or recall on the SQL path becomes the bottleneck.

### The MCP-server vision (the long bet)

The strategic endgame is to expose Grain as an **MCP server** so that Claude Code, Figma plugins, slide-generation tools, and any future Claude-driven product surface can pull insights *directly into the work* — not into yet another tool to search. Grain becomes a piece of infrastructure, not a destination.

This is the answer to the "what's the business case?" judge question: *insights flow into the tools where work happens*, not into another tool to search.

---

## 10. Demo failure modes & mitigations (for the rehearsal / presentation prep slide)

| Risk | Mitigation |
|---|---|
| Claude gives a generic answer mid-demo | Each demo question is pre-tested; recovery line + backup question ready |
| Role responses don't visibly differentiate | Caught in pre-flight; role prompts are aggressively distinct on PM vs. Designer |
| Cross-product attribution doesn't fire | Synthesis prompt has an explicit cross-product rule; tested per run |
| Citation parsing breaks | Fallback: render citations as a plain list under the answer |
| Wifi fails | Backup demo video uploaded unlisted; URL bookmarked on both laptops |
| Live deploy chokes | Local dev mode on demo laptop is the canonical demo machine |

---

## 11. Judge-question cheat sheet

- **How is this different from Notion AI or Glean?** Role-aware framing + cross-product attribution + trust signals as first-class. None of those tools have any of these.
- **How does the extraction work?** Claude extracts structured claims from each source passage with multi-axis tagging. For the demo, the corpus is pre-extracted (40 hand-curated + a Phase 8 batch of anonymized real research). The Phase 8 pipeline shows the extraction path is real and runnable.
- **How do you handle privacy?** Internal-only, runs in Perforce infra, real data is anonymized through a Claude-CLI pipeline before it ever lands in the corpus, and a four-lever access model is on the strategic roadmap.
- **What's the business case?** MCP server — Grain becomes infrastructure that Claude Code, Figma, and slide generators pull from. Insights flow into the tools where work happens.
- **What's the scaling story?** Fixtures until ~500k claims, then PostgreSQL + pgvector, then Elasticsearch. Real connectors arrive one at a time, Gong first.
- **What if claims are wrong?** Human review queue is a v1.5 backlog item with a clear promotion signal. Audit trail on every extraction is already in. Trust badges tell users when to be skeptical.

---

## 12. The 30-second pitch (for the opening slide voiceover)

> *Product teams drown in research. Insights scatter across Confluence, Slack, Gong, Pendo. By the time a PM needs them, they're buried. Most teams ignore 90% of what they collect.*
>
> *Grain is one interface over all of it. Ask in your role's language. Get attributed answers with calibrated trust signals across every product you work on.*
>
> *(demo)*
>
> *And because Grain is built to expose itself as an MCP server, Claude Code, Figma, and slide generation can pull insights directly into the work. Insights flow into the tools where work happens — not into another tool to search.*

---

## Appendix — file pointers for the copilot

If the copilot needs to deepen any section, point it at these:

- Top-level overview & quickstart: [README.md](README.md)
- Module-by-module map (every file, with a risk tier): [MODULE_MAP.md](MODULE_MAP.md)
- The original 24-hour plan, judge-question prep, cut list: [../Docs/grain_24hr_hackathon_plan.md](../Docs/grain_24hr_hackathon_plan.md)
- The eight-phase execution plan including Phase 8 (real-data injection): [../Docs/grain_execution_plan.md](../Docs/grain_execution_plan.md)
- v1.5 backlog with promotion criteria per item: [docs/v1.5-backlog.md](docs/v1.5-backlog.md)
- Phase 0 locked decisions (the "no" list): [../Docs/phase_0_decisions.md](../Docs/phase_0_decisions.md)
- Rehearsal-prep notes: [../Docs/demo_rehearsal.md](../Docs/demo_rehearsal.md)
- Verification checklist: [../Docs/verification.md](../Docs/verification.md)
- The claim corpus itself (40 hand-authored + appended real-anonymized): [apps/api/src/data/claims.ts](apps/api/src/data/claims.ts)
- Source fixtures (one full doc per source type): [apps/api/src/data/sources/](apps/api/src/data/sources/)
- Role prompts (the killer-moment file for the role-switch demo): [apps/api/src/prompts/](apps/api/src/prompts/)
