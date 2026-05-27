# `tests/realtime` — SSE conformance for Grain

## What this suite owns

The Grain backend exposes exactly **one** realtime surface:

```
POST /api/chat/stream   →   Server-Sent Events
```

No WebSocket. No WebRTC. No long-polling. The frontend
(`apps/web/src/hooks/useChatStream.ts`) consumes the stream with
`fetch` + `response.body.getReader()` rather than the browser's
`EventSource` API — `EventSource` cannot POST a JSON body, and the
chat request needs one.

This suite pins the **client-side wire contract** of that stream:

| # | Spec | Invariant pinned |
|---|---|---|
| 1 | `scripts/ordering.test.ts` | `status` (×3, in `searching → retrieved → synthesizing` order) → `delta*` interleaved with `citation*` → `done` as the last event. |
| 2 | `scripts/status-timing.test.ts` | Consecutive status events are ≥200 ms apart (the route's deliberate 250 ms UX `beat()`). |
| 3 | `scripts/citation-dedupe.test.ts` | Each distinct `[CL-NNNN]` marker fires exactly one `citation` event — even when split across 2 / 3 / 9 chunks, and even when repeated within the stream. |
| 4 | `scripts/abort-reconnect.test.ts` | Client-side `AbortController.abort()` mid-stream releases the route's concurrency slot, so the next request from the same IP is not 429'd. |
| 5 | `scripts/server-disconnect.test.ts` | A user-safe `streamClaude` error is forwarded verbatim as an SSE `error` event; an unexpected exception is replaced by a generic `synthesis failed` message (raw exception text never reaches the wire). |
| 6 | `scripts/slow-consumer.test.ts` | A consumer that yields between reads still observes every event in order; SSE framing does not corrupt under back-pressure. |
| 7 | `scripts/absolute-timeout.test.ts` | When the wrapper's absolute timeout fires, the SSE `error` event carries the documented user-safe message and no diagnostic detail. |

## What this suite does NOT own

Subprocess and process-tree behaviour is the **chaos-agent**'s domain:

| Concern | Owner |
|---|---|
| `streamClaude` subprocess is reaped (SIGTERM → 2 s → SIGKILL) | `tests/chaos/` |
| Idle timeout fires after 60 s of stdout silence (uses `silent.mjs`) | `tests/chaos/` |
| Orphaned child processes after abort | `tests/chaos/` |
| Real `$CLAUDE_BIN` integration through the e2e stack | `tests/e2e/` |
| Throughput / latency under load on `/api/chat/stream` | `tests/perf/` |
| HTTP-layer validation, 400/429 responses, auditing | `tests/integration/chat.test.ts` |

We share `tests/e2e/scripts/mock-claude.mjs` as the canonical Claude
shim. When the realtime suite needs additional scripted behaviour
(per-character marker splits, gated streams) we mock `streamClaude`
in-process via `vi.doMock` rather than spawning a shim — faster,
deterministic, no subprocess flake.

The single shim this suite ships, `shims/slow.mjs`, exists so that
anyone wanting to run the absolute-timeout scenario against the
**real** Node API (instead of an in-process mock) has a Claude
stand-in that exits via `ABSOLUTE_TIMEOUT_MS`, not via
`IDLE_TIMEOUT_MS`. The default test does not exercise it (5 minutes
is too long for CI), but the file is referenced by the spec so the
escape hatch is visible.

## How it runs

- **Runner**: Vitest 2.1.x. Node environment (no jsdom). No browser.
- **Transport**: `Hono.app.request(path, init)` — returns a Web
  `Response` whose `.body` is a `ReadableStream<Uint8Array>`. We parse
  it with the same `event:` / `data:` block logic the frontend uses
  (see `lib/sseReader.ts`).
- **`streamClaude` mock**: `vi.doMock` inside `lib/loadApp.ts`. Each
  test seeds either a synchronous `ClaudeStreamEvent[]` or an async
  generator (for gated, mid-flight assertions).
- **Rate-limit isolation**: each test that does not need a shared
  bucket gets a unique `X-Forwarded-For` IP; tests that need the
  bucket (abort-reconnect) set it explicitly.
- **Timeouts**: per-spec `testTimeout: 20_000ms`. The status-timing
  tests deliberately wait for the route's 250 ms beats.

Run:

```bash
pnpm --filter @grain/tests-realtime test:realtime
```

## Notes for future extensions

- If `apps/api/src/lib/claude.ts` ever exposes `ABSOLUTE_TIMEOUT_MS`
  as an env-overridable constant, swap the in-process mock in
  `absolute-timeout.test.ts` for a real subprocess driven by
  `shims/slow.mjs` and assert end-to-end. Today the constant is
  hard-coded at 300_000 ms which makes that unfit for CI.
- If a real WebSocket surface is ever added, add a sibling
  `scripts/ws-*` set. The folder name `realtime` is transport-agnostic
  on purpose.
