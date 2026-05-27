# Chaos scenario: subprocess crash mid-stream

## Goal

Exercise the non-zero exit path in `apps/api/src/lib/claude.ts`. The
subprocess emits a couple of valid deltas, then dies with `exit(1)`.
The wrapper should detect the non-zero `close` code, log the bounded
stderr tail, emit a user-safe SSE `error` event, and clean up without
leaking child processes.

## Shim

`tests/chaos/shims/crash.mjs` — drains stdin, emits two
`content_block_delta.text_delta` lines, writes one line to stderr,
then `process.exit(1)`.

## Setup

```bash
chmod +x tests/chaos/shims/crash.mjs
export CLAUDE_BIN="$(pwd)/tests/chaos/shims/crash.mjs"
export GRAIN_MODEL=mock
pnpm --filter @grain/api dev
```

Drive a request (must select a product so retrieval returns claims):

```bash
curl -N -X POST http://localhost:3001/api/chat/stream \
  -H 'content-type: application/json' \
  -H 'x-forwarded-for: 127.0.0.100' \
  -d '{
    "question": "Where does workspace setup friction show up?",
    "role": "pm",
    "shape": "explore",
    "products": ["helix-core"]
  }'
```

## Expected resilience behaviour

| t (ms)  | What happens                                                     |
|---------|------------------------------------------------------------------|
| 0       | SSE opens. status events fire.                                   |
| ~50     | API spawns `crash.mjs`. Two `delta` events flow to the client.   |
| ~100    | `crash.mjs` exits with code 1. `close` handler fires.            |
| ~100    | `emitError(ERR_NONZERO_EXIT, "exit=1 stderr-tail=chaos: simulated CLI crash")` |
| ~100    | SSE emits `event: error data: {"message":"synthesis subprocess exited unexpectedly"}` |
| ~100    | `chat.stream.end` audit line written with `outcome:'error'`, `errorName` set. |

## Pass criteria

1. Client SSE feed receives at least one `delta` event before the
   `error` event (proves partial streaming was preserved).
2. Client error event message is exactly
   `"synthesis subprocess exited unexpectedly"` — no exit code, no
   stderr text, no file path leaked.
3. Server stdout contains a `[claude] requestId=…` log line that DOES
   include the stderr tail and exit code (operators need this).
4. `ps -ef | grep crash.mjs` returns no rows 1 s after the error
   event. No orphaned child.
5. The API can immediately accept a follow-up request — rate limiter
   release() ran, concurrency cap is back to 0.

## Fail signals

- Client error event includes `exit=1`, `chaos: simulated CLI crash`,
  or any file path → diagnostic leak.
- `chat.stream.end` audit line has `outcome:'ok'` → outcome bookkeeping
  wrong.
- Follow-up request returns 429 with reason `"too many concurrent
  requests"` → `release()` never ran.

## Notes

- Verifying release: send a second request with the same
  `x-forwarded-for` header within 200 ms of the error. It must return
  200 (or 200 then error, never 429-concurrent).
