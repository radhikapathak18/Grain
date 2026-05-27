# Grain

One interface over scattered product research. Ask in your role's language, get attributed answers with calibrated trust signals across every product you work on.

Built as a 24-hour hackathon project at Perforce. Demo-grade — visible differentiation over architectural completeness.

## What it does

The 60-second demo flow:

1. **Log in** as a researcher with cross-product access (Helix Core, P4V, Akana).
2. **Pick a role** (PM, Designer, Engineer, Researcher) and the products to query.
3. **Pick a question shape** — Explore, Verify, or See trends.
4. **Ask** something like *"What are the top pain points across Helix Core and P4V?"*
5. **Watch the streamed answer** with synthesis, per-product attribution, and citation cards carrying three trust signals (source tier, evidence count, recency).
6. **Click a citation** — an evidence panel slides in showing the actual passage from the source (Gong call, Slack thread, Confluence page, etc.).
7. **Switch roles** — same claims, different framing.

A monthly auto-generated report view ships alongside the chat.

## Stack

- **Monorepo:** pnpm workspaces
- **Web:** [apps/web](apps/web) — Vite + React 19 + TypeScript + Tailwind v4, Zustand, TanStack Query, React Router
- **API:** [apps/api](apps/api) — Hono on Node, SSE streaming
- **Shared types:** [packages/types](packages/types) — `Claim`, `Evidence`, chat, and report contracts
- **LLM:** the API shells out to the local `claude` CLI binary (corporate IT blocks Anthropic API keys, so there is no cloud key in this project)

Fixture data (claims, sources, reports) lives under [apps/api/src/data](apps/api/src/data). No database, no vector store — everything is read from JSON/TS fixtures.

## Prerequisites

- Node.js `>= 20`
- pnpm `>= 8` (the repo pins `pnpm@11.3.0` via `packageManager`)
- The Claude Code CLI binary on disk. The default path is set in [apps/api/.env.example](apps/api/.env.example):
  ```
  CLAUDE_BIN=/Users/isathe/.vscode/extensions/anthropic.claude-code-<version>/resources/native-binary/claude
  ```
  Override `CLAUDE_BIN` if yours is elsewhere.

## Quickstart

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # adjust CLAUDE_BIN if needed
pnpm dev                                  # runs api + web in parallel
```

Then open http://localhost:5173.

- Web dev server: `http://localhost:5173`
- API: `http://localhost:3001` (proxied through the web server at `/api/*`)
- Login password: `demo` (no real auth)

### Individual apps

```bash
pnpm dev:web     # web only
pnpm dev:api     # api only
pnpm typecheck   # all workspaces
pnpm build       # all workspaces
```

### Demo launcher

For demo day, [scripts/start-demo.sh](scripts/start-demo.sh) frees ports 3001/5173, runs typecheck, boots both servers, and health-checks them. Ctrl+C tears it all down.

```bash
./scripts/start-demo.sh
```

Logs go to `/tmp/grain-api.log` and `/tmp/grain-web.log`.

## Project structure

```
apps/
  api/        Hono API — chat (SSE), claims, reports, sources, auth
  web/        React app — Login, ProductSelect, Chat, Report, Source views
packages/
  types/      Shared TS types (claims, chat, report)
scripts/
  start-demo.sh / stop-demo.sh
```

## What's intentionally not here

To keep the hackathon scope honest:

- No PostgreSQL / pgvector — claims are fixtures
- No real OAuth — email + password "demo"
- No human review queue, admin dashboard, or claims browser
- No production deploy — local dev mode is the demo machine

See [Docs/grain_24hr_hackathon_plan.md](../Docs/grain_24hr_hackathon_plan.md) for the full plan, cut list, and judge-question prep.
