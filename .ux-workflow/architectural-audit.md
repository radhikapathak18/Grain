# Grain — Architectural Audit Report

**Date:** 2026-05-27
**Auditor:** Code Auditor Agent
**Project root:** `apps/api` + `apps/web` + `packages/types`
**Stack:** Hono (Node) API · React 19 SPA (Vite + Tailwind v4) · pnpm workspaces
**Audit scope:** 10 architectural dimensions across all modified and created files on `dev_phase2`

---

## Executive Summary

The Grain codebase is a well-structured hackathon prototype with clear module boundaries and strong developer tooling. The primary architectural risk is **unauthenticated access to all data APIs** — the login screen exists in the UI, but every backend data endpoint (`/api/claims/*`, `/api/reports/*`, `/api/sources/*`) accepts requests with no auth token check. The in-memory rate limiter that compensates for this has a **header-spoofing bypass**: any caller can fake their IP via `X-Forwarded-For` and receive a fresh per-IP quota. These two findings together mean the data layer is effectively public.

Secondary risks concentrate in the state layer: chat history is persisted to `localStorage` in contradiction to documented intent, the single Zustand store is at 352 lines with no sign of planned splitting, and the frontend `tsconfig.app.json` does not inherit the base strict-mode settings that the API tsconfig correctly applies.

The streaming architecture, subprocess sandboxing, citation scanning, concurrency slot management, and CORS lockdown are all implemented correctly and represent genuine production quality for a demo-scale system.

**Total findings: 19** (Critical: 2 | Major: 6 | Minor: 7 | Advisory: 4)

---

## Findings by Dimension

---

### Dimension 1 — Monorepo / Workspace Architecture

**Assessment:** Well-structured. Three workspace roots (`apps/api`, `apps/web`, `packages/types`) with clear dependency direction: both apps depend on `packages/types`; neither app depends on the other. `tsconfig.base.json` establishes shared compiler settings. One structural gap exists in how the web app references that base.

#### Major

**M-1 — `apps/web/tsconfig.app.json` does not extend `tsconfig.base.json`**

`apps/web/tsconfig.app.json` is a standalone config that does not contain `"extends": "../../tsconfig.base.json"`. As a result, the web app silently omits `strict: true`, `noUncheckedIndexedAccess: true`, and `noImplicitOverride: true` — all three of which are set in `tsconfig.base.json` and inherited correctly by `apps/api/tsconfig.json`. The CI workflow runs a `verify-web-tsconfig` script (`package.json#scripts`) to detect this, confirming the team is aware of the gap, but the gap remains open.

- **Standard:** TypeScript project references — `tsconfig.base.json` is structurally inert unless all workspace tsconfigs extend it
- **File:** `apps/web/tsconfig.app.json`

#### Minor

**m-1 — `@grain/types` package.json exports TypeScript source, not compiled output**

`packages/types/package.json` sets `"main": "./src/index.ts"` and `"exports": { ".": "./src/index.ts" }`. This works inside the pnpm workspace because Vite and tsx resolve `.ts` imports directly, but the package is non-publishable to npm as-is (registries expect a compiled `dist/`). This is an acceptable constraint for a monorepo that will never publish this package, but the intent should be documented.

- **Standard:** npm package `exports` field convention — `exports` should point to the resolved entry point appropriate to the consumer
- **File:** `packages/types/package.json`

---

### Dimension 2 — API Architecture

**Assessment:** The Hono API is clean at the route level. Validation logic in `chat.ts` is thorough. The `onError` fallback in `chat.ts` prevents stack trace leakage. The gap is that `apps/api/src/index.ts` has no global auth middleware, which means route-level auth omissions become public endpoints by default.

#### Critical

**C-1 — All data API endpoints are unauthenticated**

`GET /api/claims/all`, `GET /api/claims?ids=`, `GET /api/claims/:id`, `GET /api/reports/monthly`, `GET /api/sources/:id` — none of these check for an authenticated session. The application has a login flow, but the login endpoint (`POST /api/auth/login`) issues no token, sets no cookie, and returns no session identifier. The client stores the user object in Zustand/localStorage but has no bearer credential to present to the API. Any unauthenticated HTTP client can call these endpoints directly and retrieve the full claims corpus, the monthly report, and all source documents.

- **Standard:** OWASP API Security Top 10 — API1:2023 Broken Object Level Authorization; OWASP Top 10 — A01:2021 Broken Access Control
- **Files:** `apps/api/src/routes/claims.ts` (lines 15–37), `apps/api/src/routes/sources.ts`, `apps/api/src/routes/reports.ts`, `apps/api/src/index.ts`

#### Major

**M-2 — No bounds on `GET /api/claims?ids=` batch parameter**

`claimRoutes.get('/')` splits the `ids` query parameter on commas with no length cap. An attacker (or misbehaving client) can supply an arbitrarily long comma-separated list, forcing the server to perform an unbounded number of `CLAIMS_BY_ID` lookups per request. The equivalent cap that exists for `POST /api/chat/stream` (`MAX_PRODUCTS`, `MAX_QUESTION_CHARS`) is absent here.

- **Standard:** OWASP API Security Top 10 — API4:2023 Unrestricted Resource Consumption
- **File:** `apps/api/src/routes/claims.ts` (lines 19–29)

#### Minor

**m-2 — `SSEEvent` type in `sse.ts` is missing the `status` variant**

`apps/api/src/lib/sse.ts` defines `SSEEvent` as a discriminated union that includes `delta | citation | done | error` but omits `status`. The `chat.ts` route emits `status` events (lines 184, 209, 217, 244). The type therefore does not model the full protocol it describes, making it misleading as documentation.

- **Standard:** TypeScript discriminated union completeness — every emitted variant should appear in the union
- **File:** `apps/api/src/lib/sse.ts`

---

### Dimension 3 — Data Layer

**Assessment:** The in-memory fixture pattern is appropriate and clearly intentional for this demo scale. The deterministic retrieval algorithm is clean. Two issues exist: a Map-based memory leak and an undocumented non-determinism in retrieval scoring.

#### Major

**M-3 — `windows` Map in `rateLimit.ts` grows without bound**

`apps/api/src/lib/rateLimit.ts` stores per-IP rate-limit windows in a `Map<string, Window>`. Expired windows are never cleaned up — the code only resets a window when the same IP is seen again after expiry (`if (!w || w.resetAt <= now)`). Under a load pattern with many unique source IPs (e.g. scanning bots, shared NATs cycling addresses), the `windows` Map grows monotonically and is never garbage-collected. The `inflight` Map does clean up on release but `windows` does not.

- **Standard:** Node.js memory management — unbounded Map growth in a long-running process constitutes a slow-bleed memory leak; relevant under the current `RATE_WINDOW_MS = 60_000` design where entries should naturally expire
- **File:** `apps/api/src/lib/rateLimit.ts` (lines 17–18, 27–31)

#### Minor

**m-3 — `retrieve()` uses `Date.now()` for recency scoring — non-deterministic in tests**

`apps/api/src/lib/retrieval.ts` uses `Date.now()` when computing recency scores for claims. This makes retrieval results dependent on when the test runs, not just on the input. The integration test suite mocks `streamClaude` but does not mock or freeze `Date.now()`, meaning claim ranking can shift between test runs if claim `date` fields straddle the boundary of the recency window.

- **Standard:** Test determinism principle — functions used in tests should be pure or their time-dependent side-effects mocked; Jest/Vitest convention `vi.setSystemTime()` is the standard fix
- **File:** `apps/api/src/lib/retrieval.ts`

---

### Dimension 4 — Auth / Authz

**Assessment:** Auth is intentionally minimal for the demo. The login flow validates email and role against a seeded user list. No session token is issued. The UI-side guards (`RequireSession`, `RequireProducts`) are logically correct. The critical gap is that API-side auth does not exist, detailed above as C-1. Two additional issues are noted here.

#### Critical

**C-2 — `X-Forwarded-For` header is trusted blindly, defeating per-IP rate limiting**

`getClientIp` in `apps/api/src/lib/rateLimit.ts` reads `c.req.header('x-forwarded-for')` and uses its first value as the key for rate limit and concurrency enforcement (lines 62–70). The comment acknowledges this is unsafe for production ("for production behind a real proxy, set a trust-proxy policy"). Because this is the *only* DoS defense for the unauthenticated `/api/chat/stream` endpoint, any caller can trivially bypass rate limiting by rotating arbitrary values in the `X-Forwarded-For` header. Each new value receives a fresh `RATE_MAX=20` / `CONCURRENT_MAX=10` quota.

- **Standard:** OWASP API Security Top 10 — API4:2023 Unrestricted Resource Consumption; CWE-290 Authentication Bypass by Spoofing
- **File:** `apps/api/src/lib/rateLimit.ts` (lines 61–71)

#### Minor

**m-4 — `POST /api/auth/login` accepts any role for a known email — role is not verified against user record**

`authRoutes.post('/login')` validates that `body.role` is a member of `ROLES` (the full role enum), but does not validate that the role the client claims matches the role recorded for that user in `SEEDED_USERS`. Line 28 of `auth.ts` uses `body.role` directly: `role: body.role`. A caller who knows a seeded email address can present themselves as any role regardless of what role the seeded user actually has.

- **Standard:** OWASP Top 10 — A01:2021 Broken Access Control; principle of least privilege — role should be determined server-side from the user record, not accepted from the client
- **File:** `apps/api/src/routes/auth.ts` (line 28)

#### Minor

**m-5 — `LoginView.tsx` hardcodes `isathe@perforce.com` in source code**

Line 15 of `apps/web/src/views/LoginView.tsx` hardcodes a specific person's Perforce email address as the dev-mode prefill: `import.meta.env.DEV ? 'isathe@perforce.com' : ''`. Although Vite strips this at production build time, the address is committed to source control and visible in the repository. This exposes a real employee's email in a potentially public codebase.

- **Standard:** OWASP Top 10 — A02:2021 Cryptographic Failures (PII exposure category); general principle: no PII in source code
- **File:** `apps/web/src/views/LoginView.tsx` (line 15)

---

### Dimension 5 — State Management

**Assessment:** The Zustand store is well-designed for this scale. `partialize` correctly controls what is persisted. The version/migration mechanism is present. Two structural concerns exist: the store has grown to a size that warrants splitting, and history persistence contradicts the documented architecture.

#### Major

**M-4 — Single Zustand store at 352 lines handles unrelated concerns without splitting**

`apps/web/src/state/session.ts` manages: authentication state (`user`, `loginComplete`, `productsConfirmed`), product selection (`availableProducts`, `selectedProducts`), conversation/tab management (`conversations`, `activeConversationId`, `tabs`, `activeTabId`), active chat history (`history`), and question framing (`questionShape`). These are four distinct concern domains in one store slice. At 352 lines the file exceeds the 200-line modularity threshold and any change to one concern requires understanding the entire store.

- **Standard:** Zustand documentation — separate stores per concern; Single Responsibility Principle (SOLID)
- **File:** `apps/web/src/state/session.ts`

#### Minor

**m-6 — Chat history IS persisted to `localStorage` — contradicts `GRAIN_OVERVIEW.md` documentation**

`apps/web/src/state/session.ts` `partialize` function (lines 337–349) explicitly includes `history: state.history`. The `GRAIN_OVERVIEW.md` architecture description states "Chat history excluded from persistence" under the localStorage persistence section. The implementation and the documentation are in direct conflict. Either the documentation is stale or the inclusion of `history` in `partialize` is unintentional. If intentional, the documentation should be updated; if unintentional, the `history` key should be removed from `partialize`.

- **Standard:** Architectural documentation must match implementation (governance principle); unexpected localStorage persistence of conversation content also raises OWASP A02 concerns about sensitive data at rest
- **File:** `apps/web/src/state/session.ts` (line 348) vs `GRAIN_OVERVIEW.md`

#### Advisory

**A-1 — `Tab.messages` and `history` are a dual source of truth for active conversation content**

The `SessionState` type carries both `history: ChatMessage[]` (the live stream target) and `conversations: Conversation[]` (each of which contains a `messages: ChatMessage[]` array). When a stream completes, history is promoted to `conversations` via `persistCurrentConversation`. During streaming, `history` is the live source and `Tab.messages` (inside `conversations`) are the archive. This dual-source design is functional but creates synchronisation surface: a bug in the promotion path leaves `history` and `conversations` out of sync permanently (since `partialize` persists both). No reconciliation logic runs on store hydration.

- **File:** `apps/web/src/state/session.ts`

---

### Dimension 6 — Concurrency / Streaming

**Assessment:** This is the strongest dimension in the codebase. The SSE streaming pipeline, subprocess lifecycle management, citation scanning, concurrency slot release, and AbortController integration are all correctly implemented. The `stream.onAbort(release)` addition from `tab_429_fix` correctly handles client-disconnect slot recovery. One operational-scale observation is noted.

#### Advisory

**A-2 — In-memory concurrency state is not shared across processes**

`rateLimit.ts` stores concurrency state (`inflight` Map) in the Node.js process heap. If the application is ever deployed with more than one process (PM2 cluster mode, Kubernetes replicas), each process maintains an independent concurrency counter. A user sending 10 requests across 10 processes would exceed `CONCURRENT_MAX=10` globally but each individual process would see count=1. This is acknowledged in the code comment ("Replace with a Redis-backed implementation when the app moves off a single Node process") — it is recorded here as a pre-deployment blocker for any multi-process deployment.

- **File:** `apps/api/src/lib/rateLimit.ts` (lines 1–7, comment)

---

### Dimension 7 — Frontend Routing

**Assessment:** React Router v7 with three-level guard hierarchy (`RedirectIfAuthed` → `RequireSession` → `RequireProducts`) is logically correct. The guard logic in `apps/web/src/routes/guards.tsx` is sound. The gap is architectural: all routes are eagerly imported with no code splitting.

#### Major

**M-5 — No code splitting — all route components are eagerly imported in `App.tsx`**

`apps/web/src/App.tsx` (lines 1–10) imports all view components statically: `LoginView`, `ProductSelectView`, `ChatView`, `ReportView`, `ReportClaimsView`, `ReportEvidenceView`, `ReportThemesView`, `ThemeDetailView`, `SourceView`. None use `React.lazy()`. Vite bundles all views into a single chunk, meaning a user accessing `/login` downloads the code for all report subviews, the chat streaming engine, and the evidence panel before the login form renders.

- **Standard:** React documentation — `React.lazy` and `Suspense` for route-level code splitting; Vite documentation — dynamic imports for automatic chunking; Web Vitals — Largest Contentful Paint (LCP) is directly affected by initial bundle weight
- **File:** `apps/web/src/App.tsx` (lines 1–15)

#### Minor

**m-7 — No React Error Boundary wrapping route content**

`App.tsx` has no `ErrorBoundary` component at or below the `BrowserRouter`. An unhandled render error in any view component (e.g. a malformed API response reaching a render function) will crash the entire React tree and display a blank white page. For a streaming application where API shapes evolve, error boundaries at the route or view level are a basic resilience requirement.

- **Standard:** React documentation — Error Boundaries; React 19 — `react-error-boundary` package is the standard library pattern
- **File:** `apps/web/src/App.tsx`

---

### Dimension 8 — Shared Types

**Assessment:** `packages/types` is well-typed. Discriminated unions, `const` arrays with `as const`, `typeof PRODUCTS[number]` derived types, and strict null handling are all used correctly throughout. One type exists that is structurally incomplete.

#### Minor

**m-8 — `ChatStreamEvent` shared type is unused by both the emitter and the consumer**

`packages/types/src/chat.ts` defines `ChatStreamEvent` as a discriminated union of SSE event shapes. This type is:
- Not imported by `apps/api/src/routes/chat.ts`, which writes SSE events with inline `JSON.stringify` calls and no type checking against `ChatStreamEvent`
- Not imported by `apps/web/src/hooks/useChatStream.ts`, which parses SSE events with inline casts (`data as StatusStep | null`, `data as { text?: string } | null`)

The type exists as documentation but does not provide compile-time safety for the wire protocol it describes. If the SSE protocol changes, the type will silently diverge from both the emitter and the consumer.

- **Standard:** TypeScript — types that describe a wire protocol should be used at both ends of that protocol to provide the safety guarantee the type system promises
- **Files:** `packages/types/src/chat.ts`, `apps/api/src/routes/chat.ts`, `apps/web/src/hooks/useChatStream.ts`

---

### Dimension 9 — Test Architecture

**Assessment:** The test suite is extensive and well-stratified: unit (Vitest + RTL), integration, E2E (Playwright), a11y (axe-playwright), compat (Firefox), responsive, visual, AI-quality eval, chaos, and perf (k6). The PR workflow only runs unit and typecheck — the broader suites run nightly/weekly. Two gaps exist.

#### Major

**M-6 — CI (`pr.yml`) runs `pnpm lint` not `pnpm lint:ci` — 4 ESLint baseline errors are permitted on every PR**

`.github/workflows/pr.yml` runs `pnpm lint` (non-strict mode). The project `package.json` defines a separate `lint:ci` script that enforces zero warnings/errors. The `lint` script permits up to 4 known baseline violations. This means PRs can pass CI while introducing ESLint errors, as long as the total count stays at or below 4.

- **Standard:** ESLint `--max-warnings 0` convention for CI; zero-tolerance lint gate is the standard for preventing gradual standards erosion
- **File:** `.github/workflows/pr.yml`

#### Advisory

**A-3 — `Date.now()` in `retrieve()` means integration test claim ordering is non-deterministic across calendar dates**

Addressed structurally in M-3 above. Noted here as a test-specific implication: `tests/integration/reports.test.ts` and `tests/integration/chat.test.ts` do not freeze system time via `vi.setSystemTime()`. Claims with `date` fields close to the recency window boundary may sort differently on different days, producing intermittent test failures for assertions that depend on claim order.

- **File:** `tests/integration/`

---

### Dimension 10 — Security Architecture

**Assessment:** The security posture is consistent with a demo-only system — appropriate controls exist for the streaming endpoint but are absent for the data endpoints. No secrets are committed. CORS is locked to `WEB_ORIGIN`. Subprocess execution does not use `shell: true`. Three findings complete the picture.

#### Minor

**m-9 — No `Content-Security-Policy` header configured**

`apps/api/src/index.ts` applies only `cors` middleware. There is no `helmet` or equivalent middleware setting `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` headers. For a browser-facing API serving an application that embeds user-generated research content (claim text, verbatim quotes), a CSP header is a baseline defence against future XSS injection vectors.

- **Standard:** OWASP Top 10 — A05:2021 Security Misconfiguration; Mozilla Observatory — CSP is required for a B rating or above
- **File:** `apps/api/src/index.ts`

#### Advisory

**A-4 — `MODULE_MAP.md` documents `CONCURRENT_MAX=1` but the implementation is `CONCURRENT_MAX=10`**

`MODULE_MAP.md` lists the rate limiter module with description text referencing `CONCURRENT_MAX=1`. The implementation in `apps/api/src/lib/rateLimit.ts` was updated to `CONCURRENT_MAX=10` as part of the `tab_429_fix` chain stage. The documentation is stale by one version. This is low severity — `MODULE_MAP.md` is an architectural reference document, not a spec — but stale architecture docs mislead future contributors.

- **File:** `MODULE_MAP.md` vs `apps/api/src/lib/rateLimit.ts` (line 13)

---

## Cross-cutting Concerns

### Trust boundary gap

The application's trust boundary is currently enforced entirely in the UI (React Router guards). The API has a single authenticated endpoint — `POST /api/auth/login` — and eleven unauthenticated endpoints. The frontend guards prevent UI-level navigation to protected views, but they do not protect the data. Any HTTP client (curl, Postman, scripted scraper) can access all research data without presenting credentials. This is the defining architectural gap of the current system.

### Documentation drift

Three separate documentation artifacts are measurably stale against the implementation:
- `GRAIN_OVERVIEW.md` states history is excluded from localStorage persistence (it is included — `session.ts` line 348)
- `GRAIN_OVERVIEW.md` lists `akana` as a product (`packages/types` exports `helix-swarm`)
- `MODULE_MAP.md` documents `CONCURRENT_MAX=1` (implementation is `10`)

The session-state chain records show the `tab_429_fix` and `report_subpages` changes were made rapidly in the last development cycle. The documentation was not updated in parallel.

### TypeScript strictness inconsistency

`apps/api` runs with `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. `apps/web` does not inherit these settings. The risk is asymmetric: the API (where security-relevant validation happens) is strictly typed; the UI (where data shapes are cast from API responses) is not. Null-safety holes in the UI layer are the most common source of runtime crashes in this class of application.

---

## Risk Heat Map

| Finding | Likelihood | Impact | Risk |
|---|---|---|---|
| C-1 — Unauthenticated data endpoints | High | High | CRITICAL |
| C-2 — X-Forwarded-For rate limit bypass | High | High | CRITICAL |
| M-1 — Web tsconfig missing strict mode | Medium | Medium | MAJOR |
| M-2 — Unbounded `ids` batch parameter | Medium | Medium | MAJOR |
| M-3 — `windows` Map memory leak | Low (demo) | Low (demo) | MAJOR (production) |
| M-4 — Single 352-line store | Low | Medium | MAJOR |
| M-5 — No code splitting | High | Low | MAJOR |
| M-6 — CI lint gate permits 4 baseline errors | High | Low | MAJOR |
| m-4 — Role accepted from client, not server record | Medium | Medium | MINOR |
| m-5 — PII (email) hardcoded in source | Low | Medium | MINOR |
| m-6 — History persistence vs docs conflict | Low | Low | MINOR |
| m-7 — No React Error Boundary | Medium | Medium | MINOR |
| m-8 — `ChatStreamEvent` type unused | Low | Low | MINOR |
| m-9 — No CSP headers | Low (demo) | Medium | MINOR |
| A-1 — Dual source of truth for messages | Low | Low | ADVISORY |
| A-2 — In-memory concurrency, single process only | Low (demo) | High (prod) | ADVISORY |
| A-3 — Non-deterministic retrieval in tests | Low | Low | ADVISORY |
| A-4 — Stale MODULE_MAP.md | Low | Low | ADVISORY |

---

## Recommended Actions — Priority Order

### P1 — Before any external or customer demo

1. **C-1** — Add a session token (even a simple signed cookie or a Bearer token returned from `/api/auth/login`) and verify it in a Hono middleware applied to all routes except `/api/auth/*`. Without this, all research data is publicly accessible.

2. **C-2** — If deploying behind Vite's dev proxy or a known reverse proxy, configure a trusted proxy IP list and only read `X-Forwarded-For` when the request originates from a trusted upstream. For a single-process demo with no proxy, fall back exclusively to the socket `remoteAddress`.

3. **m-4** — Role must be resolved from the user record server-side (`seeded.role`), not accepted from `body.role`. This is a one-line change in `auth.ts` line 28.

### P2 — Before internal team handoff or code review

4. **M-1** — Add `"extends": "../../tsconfig.base.json"` to `apps/web/tsconfig.app.json` and fix any new strict-mode errors surfaced.

5. **m-6** — Decide whether history persistence in `session.ts` is intentional and update `GRAIN_OVERVIEW.md` accordingly, or remove `history` from `partialize`.

6. **M-2** — Add a `MAX_IDS` constant (e.g. 50) to `claimRoutes.get('/')` and return `400` for oversized requests.

7. **M-5** — Wrap all view imports in `App.tsx` with `React.lazy()` and add a `<Suspense fallback>` at the router root.

8. **m-7** — Add a React Error Boundary at the `BrowserRouter` level.

### P3 — Before production deployment

9. **M-3** — Add a periodic cleanup pass or TTL eviction for expired entries in the `windows` Map in `rateLimit.ts`.

10. **M-6** — Switch `pr.yml` from `pnpm lint` to `pnpm lint:ci` to enforce zero ESLint errors on every PR.

11. **m-9** — Add Hono security headers middleware (or `@hono/secure-headers`) setting at minimum `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`.

12. **A-2** — If any multi-process deployment is planned, migrate rate limit and concurrency state to Redis.

### P4 — Documentation hygiene

13. Update `GRAIN_OVERVIEW.md` to reflect `helix-swarm` replacing `akana`, history persistence behaviour, and current `CONCURRENT_MAX` value.
14. Update `MODULE_MAP.md` to reflect `CONCURRENT_MAX=10`.
15. Use `ChatStreamEvent` from `packages/types` in both `chat.ts` (emitter) and `useChatStream.ts` (consumer) so the wire protocol type provides compile-time safety.
16. Add `"stream: true"` for `ReadableStream` to `apps/web/tsconfig.app.json` if not already present after the `extends` fix.

---

## What's Working Well

**Subprocess security** — `claude.ts` spawns the Claude binary using an args array (not `shell: true`), applies an idle timeout and an absolute timeout, bounds stderr ring to 16 KB, and uses `killWithEscalation` in a `finally` block. No shell injection surface and no resource leak on runaway processes.

**SSE streaming pipeline** — The `streamSSE` handler, `onAbort(release)` slot recovery, citation scanning with overlap window, and the client-side `AbortController` / re-use pattern in `useChatStream.ts` are all correctly implemented. The progressive citation emission (emitting `citation` events as the model writes them, not in a burst at the end) is notably good UX architecture.

**Input validation in `chat.ts`** — The `validate()` function enforces typed fields, size bounds (`MAX_QUESTION_CHARS = 2_000`, `MAX_PRODUCTS`), and allowlist validation for `role`, `shape`, and `products`. Error messages are generic strings; no internal detail reaches the browser.

**CORS lockdown** — CORS is applied globally in `index.ts` using `WEB_ORIGIN` from the environment, not a wildcard. The `apps/api/.env.example` documents the variable, and `.env` is correctly gitignored.

**Audit trail** — `apps/api/src/lib/audit.ts` provides structured JSON audit logging for every accepted, rejected, and completed chat stream request. This is production-quality observability for a hackathon project.

**Test breadth** — Ten distinct test categories (unit, integration, E2E, a11y, compat, responsive, visual, AI-quality, chaos, perf) with a rational split between PR-gate (unit + typecheck) and nightly/weekly (everything else) is architecturally sound and unusual for a codebase of this size.

**TypeScript strictness on the API** — `apps/api/tsconfig.json` correctly extends `tsconfig.base.json` with `strict: true` and `noUncheckedIndexedAccess: true`, making the security-sensitive validation and retrieval code fully null-safe at the compiler level.
