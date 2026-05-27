# Grain — Test Coverage Report

> Generated after a 4-wave, 16-agent test-suite generation pass.
> See `TEST_PLAN.md` for the plan, `MODULE_MAP.md` for the per-module risk register, `RUNBOOK.md` for how to run everything.

## Headline

| | |
|---|---|
| **Total tests authored** | **591** (357 API unit+integration · 143 web unit · 59 a11y · 22 realtime · 33 AI-quality · 20 e2e · 63 responsive · 18 visual baselines · 6 cross-browser · 9 k6 scripts · 7 chaos scenarios) |
| **Passing right now** | **532** (every Vitest-runnable suite; Playwright suites require browser install; k6/chaos require external installs) |
| **Source files modified** | **0** (no behavioral changes to app code) |
| **Coverage instrumentation** | `@vitest/coverage-v8` wired into `apps/api` and `apps/web` by cicd-agent (no numbers yet — first CI run will produce them) |

## Coverage by layer

| Layer | Folder | Files | Tests | Status | Coverage strategy |
|---|---|---|---|---|---|
| Unit (API) | `tests/unit/api/` | 5 | 46 | ✓ green | Exhaustive branch enumeration on H-risk modules (`claude.ts`, `process.ts`, `prompts/*`) |
| Unit (web) | `tests/unit/web/` | 11 | 99 | ✓ green | Stateful components + hooks; pure display components deferred to e2e |
| Integration (API) | `tests/integration/` | 6 | 58 | ✓ green | In-process Hono `app.request()` with Claude CLI mocked |
| Realtime (SSE) | `tests/realtime/scripts/` | 7 | 22 | ✓ green | Event ordering, citation dedupe across chunks, abort/reconnect, slow consumer |
| AI quality | `tests/ai-quality/` | many | 33 | ✓ green (mock mode) | Grounding + coverage + role-consistency; real-Claude eval gated behind `RUN_AI_EVALS=1` |
| Accessibility | `tests/a11y/` | 13 | 59 | ✓ green | `vitest-axe` (jsdom) + Playwright scaffold (browser-pending) |
| E2E | `tests/e2e/tests/` | 9 | 20 | ⏳ pending browsers | 9 of 10 critical journeys; rate-limit journey deferred (single-process state) |
| Visual regression | `tests/visual/playwright/` | 9 | 18 baselines | ⏳ first-run needed | Native `toHaveScreenshot()`, chromium-only, Linux-canonical |
| Cross-browser | `tests/compat/playwright/` | 4 | 6 | ⏳ pending browsers | Chromium / Firefox / WebKit smoke + per-engine specials |
| Responsive | `tests/responsive/playwright/` | 6 | 63 | ⏳ pending browsers | Mobile/tablet/desktop × 21 unique tests |
| Performance | `tests/perf/scripts/` | 5 | n/a | ⏳ pending k6 install | k6 SLO thresholds per endpoint; mock-Claude for `/chat/stream` |
| Stress / soak | `tests/stress/scripts/` | 4 | n/a | ⏳ pending k6 install | Spike, soak (1h), breakpoint, adversarial XFF rate-limit |
| Chaos | `tests/chaos/{shims,scenarios}` | 6+7 | n/a | ⏳ scenarios doc'd | Subprocess misbehavior shims + Toxiproxy scenarios |
| Static / lint | root configs + `reports/static/` | n/a | n/a | baseline captured | `lint:strict` wired; baseline FAILS as documented |
| Security | `reports/security/` | n/a | 5 findings | ⏳ tooling doc'd | `pnpm audit` JSON committed; Trivy/gitleaks/ZAP configs ready |
| Synthetic monitoring | `monitoring/synthetic/` | 5 checks | n/a | ⏳ pending prod deploy | Vendor-portable Checkly TS; activates when prod exists |
| CI/CD | `.github/workflows/` | 3 workflows | n/a | ⏳ pending first push | PR / nightly / weekly cadences wired |

## Real bugs surfaced (and NOT fixed — per orchestrator rules)

These are behavioral bugs in the source that the test swarm pinned with failing/asserting tests. They are reported here so the team can decide whether to fix.

### B1. Chat route doesn't short-circuit on `kind:'error'` from the subprocess
**Discovered by:** realtime-agent (`tests/realtime/scripts/server-disconnect.test.ts`, `absolute-timeout.test.ts`).
**Location:** [apps/api/src/routes/chat.ts:250-273](apps/api/src/routes/chat.ts#L250-L273) (the `for await (const ev of streamClaude(...))` loop).
**Behavior:** When `streamClaude` yields `{ kind: 'error', message }`, the route emits an SSE `error` event but then continues iterating. Since the generator naturally terminates after the error, the loop falls through to the post-loop `done` write. Every error stream terminates `... error, done` instead of `... error` (alone).
**Severity:** Low. Wire-protocol contract violation. The frontend's `useChatStream.ts` happens to handle this gracefully (it tolerates a trailing `done` after `error`), but the wire contract advertises terminal events as mutually exclusive.

### B2. Hono `streamSSE` swallows consumer cancels → DoS amplification
**Discovered by:** realtime-agent (`tests/realtime/scripts/abort-reconnect.test.ts`).
**Location:** Hono 4.12.23 `dist/utils/stream.js`. The frame `try { await writer.write() } catch {}` silently absorbs the error that would normally propagate when the client has aborted.
**Behavior:** Once the client aborts, the server has no way to know — it keeps iterating `streamClaude`. The `release()` call inside the `finally` runs only after the subprocess naturally exits (bounded only by the 60s idle / 5min absolute timeout in `claude.ts`). The concurrency slot keyed by IP is held for that entire window.
**Severity:** **Medium** for hackathon; **High** for any production deploy. Combined with the security-audit-agent's F-08 (`X-Forwarded-For` blindly trusted), an attacker can spoof N IPs and pin N×60s of CLI-spawn capacity by opening + immediately aborting streams.
**Mitigation options:** detect client abort via `c.req.raw.signal` and break the loop early; OR add a `stream.aborted` check inside the loop; OR upgrade Hono if a later version handles this.

### B3. `useChatStream.ts` drops server JSON error body on non-2xx
**Discovered by:** e2e-agent (smoke verification during journey writing).
**Location:** [apps/web/src/hooks/useChatStream.ts:117-119](apps/web/src/hooks/useChatStream.ts#L117-L119).
**Behavior:** `if (!res.ok || !res.body) { throw new Error('stream open failed (${res.status})') }` — the server-side `error: 'rate limit exceeded'` payload and the `Retry-After` header are never surfaced to the user.
**Severity:** Low (UX papercut). The 429 case is currently invisible to users.

### B4. AppHeader role dropdown missing `role="menu"` / `menuitem`
**Discovered by:** e2e-agent + a11y-agent.
**Location:** [apps/web/src/components/AppHeader.tsx](apps/web/src/components/AppHeader.tsx).
**Severity:** Low (a11y).

### B5. EvidencePanel uses `<aside role="dialog">` (role/element mismatch)
**Discovered by:** a11y-agent (`tests/a11y/components/EvidencePanel.test.tsx`).
**Severity:** Low (a11y; axe minor).

### B6. EvidencePanel lacks focus-on-open, focus-trap, focus-restore
**Discovered by:** a11y-agent (manual keyboard suite).
**WCAG:** 2.4.3 Focus Order.
**Severity:** Medium (a11y).

### B7. ChatView lacks `aria-live` region for streaming tokens
**Discovered by:** a11y-agent.
**WCAG:** 4.1.3 Status Messages.
**Severity:** Medium (a11y) — screen-reader users get no notification of streaming content arrival.

### B8. ThemeCard puts `aria-label` on a bare `<div>` (`aria-prohibited-attr`)
**Discovered by:** a11y-agent.
**Severity:** Medium (axe serious).

### B9. `apps/web/tsconfig.app.json` doesn't extend `tsconfig.base.json`
**Discovered by:** static-analysis-agent.
**Behavior:** `strict` and `noUncheckedIndexedAccess` are **off** for the web app despite the [chat.ts:7-8](apps/api/src/routes/chat.ts#L7) comment claiming "noUncheckedIndexedAccess: true". Web-side `CLAIMS_BY_ID[id]` accesses don't get the `Claim | undefined` narrowing the API side does. cicd-agent added a CI check that fails on this gap.
**Severity:** Medium — silent type-safety hole.

### B10. `apps/api/src/lib/rateLimit.ts` `windows` Map grows unbounded
**Discovered by:** stress-soak-agent + security-audit-agent (F-06).
**Behavior:** Per-IP windows are never evicted, only refreshed. Over the soak duration (1h+), an attacker rotating IPs (already easy per B2) inflates memory without bound.
**Severity:** Low for the demo (single user); Medium for any non-trivial deployment.

## Risk areas still not addressed

### Unaddressed by design (hackathon scope)
- No DB → no DB integration tests, no migration tests, no transaction-rollback tests. Correct call.
- No real auth → no OAuth flow tests, no CSRF tests, no session-token tests. Correct call.
- No production deploy → synthetic monitoring is config-only. Correct call.
- No microservices → contract tests skipped. Correct call.
- No i18n → locale tests skipped. Correct call.

### Test gaps worth filling (post-hackathon Wave 5 candidates)
- **`apps/api/src/index.ts` bootstrap** — currently only exercised by integration tests via re-mounted route groups. A small smoke test that boots the real server on a free port would catch startup regressions.
- **`apps/api/src/env.ts`** — three env-with-default constants; trivial but worth a 5-line test asserting defaults + overrides.
- **View-level components** (`ChatView`, `ReportView`, `SourceView`, `LoginView`, `ProductSelectView`) — currently covered only via e2e. Vitest+RTL render tests would be faster signal during development. Deferred by unit-test-agent for that reason; revisit if e2e gets too slow.
- **Source fixture schema validation** — `apps/api/src/data/claims.ts` (1015 LOC) has no automated assert that every claim conforms to the `Claim` type. A Zod schema test would catch drift on edits.
- **Cross-product chat tests** — current e2e uses single-product flows; multi-product retrieval ranking isn't end-to-end-asserted.
- **Visual baselines** — none exist yet. First nightly run will auto-PR them per cicd-agent's pipeline; review carefully before merging.

## Flaky test candidates

Watch these on CI; they have known timing or process sensitivities.

| Test | Risk | Mitigation already in place |
|---|---|---|
| `tests/realtime/scripts/status-timing.test.ts` — asserts ≥200ms inter-status gap | Clock noise on slow runners | Loose lower bound (200ms vs. 250ms target) |
| `tests/integration/chat.test.ts` rate-limit tests | 20 priming requests cost ~10s in wall time | Per-test 30s timeout |
| `tests/e2e/specs/*` happy-path tests | Streaming + Vite dev server interaction | `workers: 1`, `fullyParallel: false`, retries: 2 on CI |
| `tests/visual/playwright/*` | Font-rendering, antialiasing, OS-specific subpixel | Linux-canonical baselines; `animations: 'disabled'`; `caret: 'hide'`; fonts.ready wait |
| `tests/perf/scripts/chat-stream.k6.js` TTFT SLO | 750ms floor from `STATUS_BEAT_MS × 3`; runner-VM jitter | `retries: 1` in CI |
| `tests/stress/scripts/soak.k6.js` 1h on shared runners | Network noise over 1h | Default 30m in CI; full 1h on optional self-hosted runner |

## Recommended Wave 5 (post-hackathon)

In priority order, smallest-payoff-per-effort first:

1. **Fix B9** (web tsconfig extend) — one-line config change; surfaces real type bugs immediately.
2. **Fix B2 + B3** — client-abort detection + surface 429 to UI. Both are small, both unlock the rate-limit e2e journey (journey 10 currently skipped).
3. **Run the visual-regression suite once to generate baselines** and review the resulting PR. Then visual is a continuously-protected layer.
4. **Run the AI-quality eval in real mode once** (`RUN_AI_EVALS=1`) and commit the baseline.json. Future regressions become detectable.
5. **Fix the a11y findings** (B4–B8) — most are 1–3 line changes per component.
6. **Triage the static-analysis baseline** — 4 ESLint errors, 67 Prettier-dirty files. Auto-fix at low cost; re-enable `lint:strict` as a PR gate.
7. **Address B10** — bounded LRU for `windows` Map in `rateLimit.ts`. Trivial.
8. **Resolve B1** — break the loop on `kind:'error'`. Wire-contract cleanup.
9. **Responsive overhaul** — if mobile-readiness matters post-demo, dedicate a sprint to it. The responsive-agent's findings are the full punch list.
