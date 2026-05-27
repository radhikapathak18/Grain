# Grain — Comprehensive Test Suite Plan

> Orchestrator: multi-agent swarm. This document is the single source of truth for
> framework choices, conventions, and which agents apply (vs. are skipped).

## Application snapshot

- **Type:** Hackathon-grade monorepo demo. No DB, no real auth, no production deploy.
- **Stack:** pnpm workspaces — `apps/api` (Hono + Node SSE), `apps/web` (Vite + React 19 + TS), `packages/types` (shared contracts).
- **AI surface:** API shells out to a local Claude CLI binary; streams JSONL → forwards as SSE.
- **Realtime surface:** Server-Sent Events from `/api/chat/stream`. No WebRTC, no WebSocket.
- **Existing test infra:**
  - `vitest@2.1.9` already wired in `apps/api` and `apps/web`.
  - `apps/web/vitest.config.ts` is jsdom + `@testing-library/react`, with a `tests/setup.ts` setup hook.
  - `apps/api/vitest.config.ts` is node environment.
  - ESLint configured on web only; no Prettier; no CI workflow; no coverage tooling.

## Framework choices (REUSE existing where present)

| Layer | Framework | Rationale |
|---|---|---|
| Unit (api + web) | **Vitest** | Already installed in both workspaces. |
| Web component tests | **Vitest + @testing-library/react + jsdom** | Already present in `apps/web` devDeps. |
| Integration (api routes) | **Vitest + Hono `app.request()` / `app.fetch`** | Hono apps are directly invocable in-process — no Supertest server needed. |
| E2E | **Playwright** | New install. Web is a single Vite SPA on localhost:5173. |
| Visual regression | **Playwright `toHaveScreenshot()`** | No Percy budget needed; native diffing is sufficient. |
| Cross-browser | **Playwright projects** (chromium, firefox, webkit) | Same install. |
| Responsive | **Playwright viewport projects** | Same install. |
| Accessibility | **@axe-core/playwright** | Plays into the Playwright runner. |
| Performance | **k6** | Top API endpoint perf, especially `/api/chat/stream`. |
| Stress / soak | **k6 scenarios** (spike, soak, breakpoint) | Same install. |
| Chaos | **Toxiproxy** between web ↔ api in docker-compose | Documents resilience expectations. |
| AI quality | **Custom Vitest eval harness** with ground-truth dataset placeholder + LLM-as-judge | Real Claude CLI calls are gated behind `RUN_AI_EVALS=1`. |
| Realtime (SSE) | **Vitest + Node `EventSource` polyfill (`eventsource`)** | Tests SSE event ordering, reconnect, abort. |
| Static analysis | **ESLint (existing) + TS `--strict` + Prettier + `tsc --noEmit`** | Add a `lint:strict` script. |
| Security | **`pnpm audit`, Trivy (filesystem), `gitleaks`, OWASP ZAP baseline** | Findings reported, no auto-remediation. |
| CI/CD | **GitHub Actions** | Standard for open-source/hackathon repos. |
| Synthetic monitoring | **Playwright `@playwright/test` in cron form** with Checkly-compatible config | Skip Datadog/Checkly cloud — produce config only. |

## Swarm composition — applicability decisions

| Agent | Wave | Status | Notes |
|---|---|---|---|
| unit-test-agent | 1 | **ACTIVE** | API libs (`retrieval`, `keywords`, `rateLimit`, `claude` wrapper, `process`, `audit`), web hooks/state/components. |
| integration-test-agent | 1 | **ACTIVE** | All Hono routes (`auth`, `chat`, `claims`, `reports`, `sources`) via `app.request()`. |
| contract-test-agent | 1 | **SKIPPED** | No microservices, no provider/consumer relationships, no external HTTP APIs Grain owns. The Claude CLI subprocess is the only external dep and is mocked. |
| static-analysis-agent | 1 | **ACTIVE** | Configure ESLint strict, Prettier, `tsc --noEmit`. Add root `lint:strict`. |
| security-audit-agent | 1 | **ACTIVE** | `pnpm audit`, Trivy fs, gitleaks; document findings in `reports/security/`. ZAP baseline script (manual run only). |
| accessibility-agent | 1 | **ACTIVE** | axe-core scans on Login, ProductSelect, Chat, Report, Source views + key components. |
| e2e-agent | 2 | **ACTIVE** | 5–10 critical journeys: login → select → ask → cite → source detail → role switch → report view → empty-results → error toast → cancel/retry stream. |
| visual-regression-agent | 2 | **ACTIVE** | Baseline screenshots for each route + key states (streaming, citation panel open, empty state). |
| cross-browser-agent | 2 | **ACTIVE** | Smoke top journey on chromium / firefox / webkit. |
| responsive-agent | 2 | **ACTIVE** | Mobile (375×667), tablet (768×1024), desktop (1440×900). Touch events. |
| i18n-agent | 2 | **SKIPPED** | No i18n library, no locale switching, no translated strings. |
| performance-agent | 3 | **ACTIVE** | k6 against `/api/claims`, `/api/reports/monthly`, `/api/sources/:id`. `/api/chat/stream` measured with mocked CLI (no real Claude). SLOs documented. |
| stress-soak-agent | 3 | **ACTIVE** | Spike test (10x), 1h soak on non-AI endpoints, breakpoint on `/api/claims`. |
| chaos-agent | 3 | **ACTIVE** | Toxiproxy latency / drop scenarios between web ↔ api; CLI subprocess kill simulation. |
| ai-quality-agent | 3 | **ACTIVE** | Eval harness for synthesis: ground-truth dataset placeholder, LLM-as-judge rubric, regression baseline. WER skipped (no ASR). Gated behind env flag. |
| realtime-agent | 3 | **ACTIVE** | SSE event ordering, citation marker dedupe, abort/reconnect behavior, status-event timing tolerance. |
| cicd-agent | 4 | **ACTIVE** | `.github/workflows/`: PR (lint + unit + integration), nightly (E2E + perf + security), weekly (chaos + soak). Cache, parallelize, fail fast. |
| synthetic-monitoring-agent | 4 | **ACTIVE** | Checkly TS config + Playwright probe scripts for top 3 flows. No live deploy; config is the deliverable. |

## Conventions

1. **Folder ownership is strict.** Each agent writes only to its assigned folder under `tests/`, `reports/`, `monitoring/`, or `.github/workflows/`. Shared fixtures go in `tests/fixtures/` (the only shared write location).
2. **No fake tests.** Every test exercises real code paths. Trivial assertions are forbidden. If a meaningful test cannot be written, document why in the agent's `summary.md`.
3. **AAA pattern** for unit tests. One source module → one test file.
4. **Real subprocess mocking:** the Claude CLI binary is mocked via dependency injection or `vi.mock('node:child_process')`. Never spawn a real binary in CI unit/integration tests.
5. **Real fixtures:** Use `apps/api/src/data/claims.ts` / `apps/api/src/data/sources/*.ts` as the canonical fixture corpus. Synthesize narrower fixtures under `tests/fixtures/` only when needed.
6. **Determinism:** retrieval is deterministic by contract. Time-dependent code paths (recency sort, status `beat()`) use injectable clocks or `vi.useFakeTimers()`.
7. **Coverage targets:**
   - Statement: ≥80% on high-risk modules (`claude.ts`, `chat.ts` route, `retrieval.ts`, `rateLimit.ts`, `useChatStream.ts`).
   - Statement: ≥60% on rest of `apps/api/src/`.
   - Web components: smoke-rendered, focused tests on stateful components only (no DOM snapshot churn).
8. **Reports go to `reports/<agent>/`. Tests go to `tests/<layer>/`. CI configs go to `.github/workflows/`. Synthetic configs go to `monitoring/synthetic/`.**

## Risk register

| Area | Risk | Mitigation |
|---|---|---|
| `apps/api/src/lib/claude.ts` | Subprocess management, idle/abs timeouts, kill escalation, JSONL parsing of partial messages | Unit + chaos + realtime tests; SIGTERM/SIGKILL escalation must be observable. |
| `apps/api/src/routes/chat.ts` | SSE framing, citation marker dedupe across deltas, rate-limit + concurrency cap | Integration + realtime tests; chaos for client disconnect. |
| `apps/api/src/lib/rateLimit.ts` | In-memory state, IP-based key, release leaks | Unit + integration tests; stress test for concurrent caller. |
| `apps/api/src/lib/retrieval.ts` | Determinism contract: role MUST NOT affect retrieval | Unit test asserting role-equivalence directly. |
| `apps/web/src/hooks/useChatStream.ts` | SSE reader buffer state machine, abort handling, phantom message cleanup | Unit + realtime + e2e tests. |
| `apps/web/src/state/session.ts` | Zustand `persist` middleware, partialize, restore on reload | Unit + e2e tests with localStorage. |
| `apps/web/src/routes/guards.tsx` | Auth state machine across reloads | E2E tests for redirect chains. |
| `apps/api/src/data/claims.ts` (1,015 LOC fixture) | Schema drift | Static schema validation (zod / type-narrowing) in unit test. |

## Out-of-scope decisions

- **No DB tests.** No DB.
- **No OAuth flow tests.** No OAuth.
- **No production observability tests.** No production.
- **Pact and other contract testing.** No microservices.
- **WER for ASR / multimodal evals.** No ASR.

## Approval

Per the original prompt, plan mode is required between waves. Auto mode is active, so the orchestrator proceeds wave-by-wave without pausing and reports outcomes via `summary.md` per agent.
