# Chaos scenario: subprocess idle timeout

## Goal

Exercise the `IDLE_TIMEOUT_MS` (60 s) path in
`apps/api/src/lib/claude.ts`. The CLI subprocess never writes anything
to stdout. The wrapper should treat this as a wedged child, emit a
user-safe `error` SSE event, and kill the subprocess via
`killWithEscalation()`.

## Shim

`tests/chaos/shims/silent.mjs` — accepts stdin, never writes to stdout,
parks the event loop with a no-op interval. Exits on SIGTERM (we are
testing the idle path here, NOT the kill-escalation path; that has its
own scenario).

## Setup

No Toxiproxy. No source modification. Just point the API at the shim:

```bash
# From the repo root.
chmod +x tests/chaos/shims/silent.mjs
export CLAUDE_BIN="$(pwd)/tests/chaos/shims/silent.mjs"
export GRAIN_MODEL=mock
pnpm --filter @grain/api dev
```

In a second terminal, drive a request and watch the SSE feed. You must
log in first to get retrieval to return claims (otherwise the route's
early-exit empty-results branch runs instead of `streamClaude`).

```bash
curl -N -X POST http://localhost:3001/api/chat/stream \
  -H 'content-type: application/json' \
  -H 'x-forwarded-for: 127.0.0.99' \
  -d '{
    "question": "What patterns appear in workspace setup feedback?",
    "role": "pm",
    "shape": "explore",
    "products": ["helix-core"]
  }'
```

## Expected resilience behaviour

Timeline:

| t (seconds) | What happens                                                              |
|-------------|----------------------------------------------------------------------------|
| 0           | SSE opens. `status` events fire: searching → retrieved → synthesizing.    |
| 0           | API spawns `silent.mjs`. Idle timer armed.                                |
| 60          | Idle timer fires. `claude.ts` calls `emitError(ERR_IDLE_TIMEOUT, …)`.     |
| 60          | SSE emits `event: error data: {"message":"synthesis stalled; please try again"}`. |
| 60          | `killWithEscalation(proc)` runs. `silent.mjs` exits on SIGTERM. Stream ends. |
| 60          | Audit log line `chat.stream.end` written with `errorName` populated and `outcome:'error'`. |

## Pass criteria

1. SSE feed contains an `event: error` line with the exact message
   `"synthesis stalled; please try again"` (NOT a stack trace, NOT a
   path, NOT the literal `ERR_IDLE_TIMEOUT` symbol).
2. The error event arrives 60–62 s after the `status:synthesizing`
   event (60 s timeout + small SSE flush latency).
3. The child shim process is no longer in the process table 1 s after
   the error event.
4. The API process is still alive, still serving `/api/health`, no
   memory growth.
5. Server stdout contains a log line of the form
   `[claude] requestId=… synthesis stalled; please try again | idle 60s — killed`.

## Fail signals

- SSE feed silent past 65 s with no error event → idle timer never
  fired.
- Error event includes the string `idle` or `60s — killed` →
  diagnostic leak.
- Child shim still alive 5 s after error event → kill escalation
  broken.

## Notes

- This scenario takes 60 s of wall time. Run it serially, not in a
  Vitest matrix.
- Watch with `ps -ef | grep silent.mjs` in a third terminal to confirm
  the child is actually killed.
