# Manual code-security review

Generated: 2026-05-27 by security-audit-agent. Scope: high-risk modules under `apps/api/src/`.
Each finding lists `file:line`, OWASP/CWE tag, severity (info / low / medium / high / critical), description, and a concrete mitigation.

Severity counts: **0 critical, 0 high, 3 medium, 5 low, 3 info**.

---

## `apps/api/src/lib/claude.ts` — Claude CLI subprocess wrapper

### F-01 — `spawn(env.CLAUDE_BIN, args)` is operator-controlled, not request-controlled
- **Location:** `apps/api/src/lib/claude.ts:84`
- **Category:** CWE-78 (OS Command Injection) / OWASP A03:2021 — analyzed and **not vulnerable**.
- **Severity:** info
- **Description:** The first argument to `spawn` is `env.CLAUDE_BIN`, resolved at process startup from `process.env.CLAUDE_BIN` (default `"claude"`). No request payload influences the binary path or the argv array. The user-supplied question is written to **stdin** (line 209 `proc.stdin.write(input.userMessage)`) — not concatenated into a shell command, and `spawn` is called WITHOUT `shell: true`, so even a stdin payload containing shell metacharacters never reaches a shell parser. The system-prompt argument at line 81 is a server-built string from `buildSystemPrompt(...)` that interpolates fixture data, not raw user input.
- **Mitigation:** None required. Document in operator runbook that `CLAUDE_BIN` is a privileged config value — anyone who can set this env var can run arbitrary code as the API user. Treat it as a deployment-time secret-equivalent.

### F-02 — `MAX_QUESTION_CHARS = 2000` enforced BEFORE subprocess spawn — verified
- **Location:** `apps/api/src/routes/chat.ts:90` (validation) → `apps/api/src/routes/chat.ts:209` (retrieval) → `apps/api/src/routes/chat.ts:250` (`streamClaude` call).
- **Category:** OWASP A04:2021 (Insecure Design — resource limits).
- **Severity:** info (verified working as designed).
- **Description:** `validate()` rejects with HTTP 400 when `question.length > MAX_QUESTION_CHARS`. The function returns before `release()` is called for the success path but reaches `streamSSE` only after `v.ok === true`. So a 50KB question is rejected before the CLI is spawned and before model tokens are spent.
- **Mitigation:** None required. Consider an additional total-bytes-per-window quota in `rateLimit.ts` for future production deploys (e.g. cap aggregate question chars per IP per hour to slow a sustained-but-throttled DoS).

### F-03 — stderr never leaks to the client — verified
- **Location:** `apps/api/src/lib/claude.ts:110-113` (`emitError`); `apps/api/src/lib/claude.ts:194-206` (close handler).
- **Category:** CWE-209 (Information Exposure via Error Message) / OWASP A09:2021.
- **Severity:** info (verified, no leak).
- **Description:** stderr is buffered into `stderrBuf` (line 168) with a 16 KB ring (line 172). On non-zero exit, the last 500 chars of stderr are passed as `detail` to `emitError`, which logs to `console.error` AND pushes a `{ kind: 'error', message: safeMessage }` event where `safeMessage` is one of four constant strings (`ERR_SPAWN_FAILED`, `ERR_IDLE_TIMEOUT`, `ERR_ABSOLUTE_TIMEOUT`, `ERR_NONZERO_EXIT`). The route forwards `ev.message` verbatim (`apps/api/src/routes/chat.ts:268-272`); no codepath sends `detail` to the client.
- **Mitigation:** None. Pattern is correct — keep stderr server-side, surface only the four canned strings.

### F-04 — Spawn argv exposed via `ps`/`/proc` on the host
- **Location:** `apps/api/src/lib/claude.ts:81`
- **Category:** CWE-200 (Sensitive Information Disclosure).
- **Severity:** low
- **Description:** The full `systemPrompt` is passed as an argv element to `spawn`. On a multi-tenant host any local user can read `/proc/<pid>/cmdline` (Linux) or `ps -ef` (macOS) and capture the entire system prompt while the synthesis is running. The prompt is non-secret (it contains fixture claims, not credentials), so the operational risk is low — but on a hardened host, prefer passing the prompt via stdin alongside the question, or via a temp file with 0600 perms.
- **Mitigation:** For production hardening, switch to `--system-prompt-file <path>` or pipe via stdin. Hackathon-acceptable as-is.

---

## `apps/api/src/routes/chat.ts` — unauthenticated SSE synthesis endpoint

### F-05 — Endpoint is unauthenticated; protection relies entirely on IP-based rate limit + concurrency cap
- **Location:** `apps/api/src/routes/chat.ts:124-145`
- **Category:** OWASP A07:2021 (Identification & Authentication Failures) / OWASP A04:2021.
- **Severity:** medium (hackathon scope: low — flagged as a real blocker for production).
- **Description:** `chatRoutes.post('/stream')` carries no session check, no API key, no CSRF token. Anyone who can reach the server can spawn a Claude CLI subprocess and burn model tokens. Defense is `checkRate(getClientIp(c))`:
  - `RATE_MAX = 20` per `RATE_WINDOW_MS = 60_000` ms per IP.
  - `CONCURRENT_MAX = 1` simultaneous in-flight stream per IP.
  Both are enforced in-memory and reset on process restart. Effective ceiling against a single-IP attacker: 20 streams / minute × ABSOLUTE_TIMEOUT_MS = up to 100 minutes of CLI runtime per minute (impossible by wall clock — concurrency cap holds it to 1). So a single non-spoofing attacker can sustain ~20 question-sized model invocations per minute per IP. Across 1000 IPs (botnet, NAT, or `X-Forwarded-For` spoof — see F-08), that ceiling lifts by 1000×.
- **Mitigation:** For production: require auth (even a static bearer token signed by the gateway) before the rate-limit check, OR move the rate-limit decision behind a trust-proxy boundary that the API can verify. For the hackathon demo, the current limit is adequate.

### F-06 — In-memory rate-limit/concurrency state is per-process, doesn't survive restart, doesn't shard
- **Location:** `apps/api/src/lib/rateLimit.ts:17-19` (`windows`, `inflight`)
- **Category:** CWE-941 (Reliance on Client-Visible Cookies / state-not-distributed pattern).
- **Severity:** low
- **Description:** `windows` and `inflight` are module-scoped `Map`s. A restart, crash, or horizontal scale-out resets every counter. Attacker who triggers a crash regains a clean budget.
- **Mitigation:** For multi-node prod, back rate limit with Redis (the module's header comment already calls this out). No change needed for single-node demo.

### F-07 — `release()` not called if `streamSSE` callback throws before the `finally`
- **Location:** `apps/api/src/routes/chat.ts:148-152` (release closure), `apps/api/src/routes/chat.ts:294-305` (`finally` block).
- **Category:** CWE-772 (Missing Release of Resource).
- **Severity:** low
- **Description:** The `release` function is correctly invoked in `finally` after `streamSSE`. If `streamSSE` itself never starts (e.g. Hono throws inside the SSE setup before the callback runs), the `inflight` counter for that IP is incremented in `checkRate` but never decremented. The current code path makes this extremely unlikely (`streamSSE` is awaited and the `finally` is inside the async callback — Hono will invoke the callback unless the response is already aborted). Still worth a unit test.
- **Mitigation:** Add a unit test that forces `streamSSE` to throw during setup and asserts `inflight` returns to 0. Optional: move `release` into a `try {...} catch` around the entire SSE flow so even setup errors release the slot.

### F-08 — `getClientIp` blindly trusts `X-Forwarded-For` — rate-limit bypass
- **Location:** `apps/api/src/lib/rateLimit.ts:61-71`
- **Category:** CWE-290 (Authentication Bypass by Spoofing) / OWASP A04:2021.
- **Severity:** medium (hackathon scope: low — flagged as a real blocker for production).
- **Description:** Any client can set `X-Forwarded-For: 1.2.3.4` and `getClientIp` returns `1.2.3.4` with zero validation. The rate-limit map is keyed off this string, so an attacker incrementing the header value on every request gets a fresh 20-req-per-minute budget per fake IP. There is no `trust proxy` allowlist, no header-length cap, no validation that the request actually arrived through a known reverse proxy. The module's own comment (line 60) acknowledges this is single-node demo behavior.
- **Mitigation:**
  1. Production: introduce a `TRUSTED_PROXIES` allowlist env var. Only consult `X-Forwarded-For` when the immediate socket peer is in the allowlist; otherwise key off `socket.remoteAddress`.
  2. When the header IS trusted, take the rightmost untrusted hop, not the leftmost — the leftmost is attacker-controlled.
  3. Cap header length / number of commas to avoid an unbounded-string DoS on the `Map` key.

### F-09 — Citation regex over streamed text is unbounded per delta
- **Location:** `apps/api/src/routes/chat.ts:67-68` and `apps/api/src/routes/chat.ts:190-201` (`scanForCitations`).
- **Category:** CWE-1333 (ReDoS) — analyzed and not vulnerable.
- **Severity:** info
- **Description:** Regex is `/\[CL-\d{4}\]/g` — anchored literal + bounded `\d{4}` — no catastrophic backtracking possible. `cited` Set caps unique citations naturally (the corpus has < 100 claim IDs). Safe.
- **Mitigation:** None required.

---

## `apps/api/src/routes/sources.ts` — `GET /api/sources/:id`

### F-10 — `:id` parameter never touches the filesystem; no path traversal possible
- **Location:** `apps/api/src/routes/sources.ts:81-90`
- **Category:** CWE-22 (Path Traversal) — analyzed and **not vulnerable**.
- **Severity:** info
- **Description:** `id` is used only as:
  1. A key into `SOURCE_BY_ID` (an in-memory `Record<string, SourceDocument>`).
  2. A string comparison against `evidence.source_id` inside `synthesizePlaceholder` (loop over `CLAIMS` array).
  Neither codepath calls `fs.*`, `require`, `import`, or anything that resolves the string as a path. A request like `/api/sources/../../etc/passwd` returns 404 (`source not found`) because the literal string `'../../etc/passwd'` is not a key in `SOURCE_BY_ID` and is not any evidence's `source_id`.
- **Mitigation:** None required.

### F-11 — `:id` echoed into JSON response body (no log injection unless logged elsewhere)
- **Location:** `apps/api/src/routes/sources.ts:67-78` (`return { id, ... }`).
- **Category:** CWE-117 (Improper Output Neutralization for Logs) — analyzed.
- **Severity:** low
- **Description:** `id` is placed into the response JSON via `c.json()` which uses `JSON.stringify`, so newlines and quotes are escaped — no log-injection risk from the response. The route does not call `audit()` or `console.log()` for this endpoint, so `id` does not currently appear in any log line. If future code adds a `audit('source.fetched', { id })`, that audit helper already JSON-encodes its payload (see `apps/api/src/lib/audit.ts`), so log injection remains blocked.
- **Mitigation:** None required. If you ever switch from `audit(...)` (JSON) to plain `console.log(`source=${id}`)`, sanitize first.

### F-12 — No rate limit on `/api/sources/:id`
- **Location:** `apps/api/src/index.ts:20` and `apps/api/src/routes/sources.ts` (no `checkRate` call).
- **Category:** OWASP A04:2021 (Insecure Design — resource controls missing).
- **Severity:** low
- **Description:** Unlike `/api/chat/stream`, the sources route has no rate-limit middleware. Each request does an O(C×E) scan over CLAIMS in the placeholder path (40 claims × ~3 evidence ≈ 120 iterations) — negligible per request, but unbounded concurrency could still raise CPU under a flood. Hackathon-acceptable; flag for production.
- **Mitigation:** Apply a global Hono middleware that runs `checkRate` for any route, OR pre-compute `SOURCE_BY_ID` + a reverse index from `source_id → evidence[]` at module load so the placeholder path is O(1).

---

## `apps/api/src/routes/auth.ts` — login

### F-13 — No password verification, no session token, no CSRF — KNOWN hackathon scope
- **Location:** `apps/api/src/routes/auth.ts:8-34`
- **Category:** OWASP A07:2021 (Identification & Authentication Failures).
- **Severity:** low (hackathon-acknowledged); would be **critical** for production.
- **Description:** `POST /api/auth/login` requires only an email + role. It looks up the email in `SEEDED_USERS`, and if present returns the user object directly in the response. No password field is verified server-side (the README says "Login password: `demo` (no real auth)" and the frontend hint "Password is ignored for the demo." confirms it). No `Set-Cookie`, no session id, no JWT. The frontend persists the user in Zustand → localStorage and uses it as a client-side "logged in" flag with no server validation on subsequent requests.
- **Mitigation:** For any non-demo deployment, replace this entirely (OAuth or signed session cookie + per-request server-side validation). README explicitly scopes this out; documented and accepted as-is.

---

## `apps/api/src/index.ts` — CORS

### F-14 — CORS origin defaults to `http://localhost:5173`; missing env handled safely
- **Location:** `apps/api/src/index.ts:13` and `apps/api/src/env.ts:2`.
- **Category:** OWASP A05:2021 (Security Misconfiguration).
- **Severity:** medium for prod (low for dev).
- **Description:** `cors({ origin: env.WEB_ORIGIN })` where `WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173'`. If the env var is unset in prod, the API trusts `http://localhost:5173` — which means a browser running an attacker page hosted on `localhost:5173` (e.g. a local dev tool or another running app on the operator's box) could read cross-origin responses from the deployed API. Locally, the default is correct. The Hono `cors` middleware sets `Access-Control-Allow-Credentials` to false by default and reflects only the configured origin, so a same-origin browser on any other host (e.g. `https://attacker.com`) is rejected — good.
- **Mitigation:**
  1. Production: set `WEB_ORIGIN` explicitly to the deployed web origin, OR change the fallback to a value that fails closed (e.g. throw on missing env var in production mode).
  2. Add a runtime warning if `NODE_ENV === 'production'` and `WEB_ORIGIN` is the default.

---

## `apps/api/src/lib/audit.ts` — audit log

### F-15 — Audit log writes JSON to stdout — fine; review-only flag
- **Location:** `apps/api/src/lib/audit.ts`
- **Category:** OWASP A09:2021 (Logging Failures) — review.
- **Severity:** info
- **Description:** `audit()` writes a single JSON object per line to stdout. `chat.stream.start` includes `questionPreview: question.slice(0, 200)` (chat.ts:174) — first 200 chars of the user question. For a hackathon corpus this is fine; in production with a real user base, those previews could constitute PII and should run through a redaction step before persistence to an aggregator (Datadog, ELK, etc.).
- **Mitigation:** None for hackathon. For prod, gate `questionPreview` behind a flag, or hash it for correlation without content exposure.

---

## Findings I checked and refuted

| Hypothesis | Result |
|---|---|
| `CLAUDE_BIN` attacker-controllable via request? | **Refuted** — operator-controlled env var only (F-01). |
| `MAX_QUESTION_CHARS` enforced before spawn? | **Confirmed** (F-02). |
| `getClientIp` trusts `X-Forwarded-For` unconditionally? | **Confirmed** — F-08, medium. |
| Auth flow has no real authentication? | **Confirmed**; **known hackathon scope** (F-13). |
| `sources.ts :id` path traversal? | **Refuted** — no filesystem interaction (F-10). |
| CORS default safe? | **Conditionally** — fine in dev, needs hardening in prod (F-14). |
| stderr leak path to client? | **Refuted** — F-03 verified clean. |
