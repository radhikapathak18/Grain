# Chaos scenario: client disconnects mid-stream

## Goal

Verify the server's `finally` block in `apps/api/src/routes/chat.ts`
runs when the client closes the SSE connection mid-stream. Concretely:

1. `release()` is called — concurrency cap counter goes back to 0,
   the IP can immediately start a new stream.
2. The Claude subprocess is killed via the generator's `finally`
   block in `apps/api/src/lib/claude.ts`, which calls
   `killWithEscalation(proc)`.
3. No zombie child remains.
4. `chat.stream.end` audit line is written.

## Setup

Use a long-running shim so the disconnect happens well before the
subprocess would naturally end. Either `silent.mjs` or `slow.mjs`
works, but `slow.mjs` is more representative (emits at least one
delta before the abort).

```bash
chmod +x tests/chaos/shims/slow.mjs
export CLAUDE_BIN="$(pwd)/tests/chaos/shims/slow.mjs"
export GRAIN_MODEL=mock
pnpm --filter @grain/api dev &
API_PID=$!
sleep 2
```

## Run

```bash
# Start a stream, capture its PID.
curl -N -X POST http://localhost:3001/api/chat/stream \
  -H 'content-type: application/json' \
  -H 'x-forwarded-for: 127.0.0.50' \
  -d '{
    "question": "What patterns appear in workspace setup feedback?",
    "role": "pm",
    "shape": "explore",
    "products": ["helix-core"]
  }' > /tmp/grain-stream.out &
CURL_PID=$!

# Let some status events flow.
sleep 1

# Disconnect.
kill -INT $CURL_PID
wait $CURL_PID 2>/dev/null

# Allow the server's finally + killWithEscalation 2 s to run.
sleep 3

# Assertions.
echo "--- shim processes still alive (should be empty):"
ps -ef | grep -v grep | grep slow.mjs || echo "(none — good)"

echo "--- audit line:"
# Tail your API log; look for chat.stream.end with outcome:'error' or 'ok'.

echo "--- second request from same IP should NOT hit concurrency cap:"
curl -sN -X POST http://localhost:3001/api/chat/stream \
  -H 'content-type: application/json' \
  -H 'x-forwarded-for: 127.0.0.50' \
  -d '{
    "question": "Where does workspace setup friction show up?",
    "role": "pm",
    "shape": "explore",
    "products": ["helix-core"]
  }' --max-time 5 | head -c 500
echo
```

## Expected resilience behaviour

| Step                                                | Expected                                                    |
|-----------------------------------------------------|--------------------------------------------------------------|
| Client kills the curl request                       | TCP connection closes.                                       |
| Hono's stream callback throws / completes           | `finally` block runs.                                        |
| `release()` is called                               | Rate-limit concurrency counter decrements to 0.              |
| `streamClaude` generator's `finally` runs           | `killWithEscalation(proc)` issues SIGTERM, then SIGKILL ≤2s. |
| Audit line                                          | `chat.stream.end` with `outcome:'error'` (or `'ok'` if the route happened to be between the loop and the done event — both are acceptable). |
| Follow-up request from same IP                      | 200 (or 200 then mock stream completes) — NOT 429.           |
| Child process count for `slow.mjs`                  | 0 within ≤3 s of disconnect.                                 |

## Pass criteria

1. After the disconnect + 3 s grace period, `ps -ef | grep slow.mjs`
   returns no rows.
2. The follow-up curl is NOT rejected with HTTP 429 or
   `"too many concurrent requests"`.
3. The API server is still alive — `curl localhost:3001/api/health`
   returns 200.
4. API stdout contains a `chat.stream.end` audit line whose
   `requestId` matches the aborted stream.

## Fail signals

- `slow.mjs` process lingers indefinitely → `finally` block in
  `claude.ts` didn't run, or `killWithEscalation` didn't escalate.
- Follow-up request returns 429 with reason `concurrent` →
  `release()` was never called; rate-limit state leaked.
- API process crashes during cleanup → uncaught exception in
  `finally`.

## Notes

- The `slow.mjs` shim is intentionally cooperative on SIGTERM (it does
  not trap), so this scenario validates the cleanup path WITHOUT also
  testing escalation. Use the `trap-term.mjs` scenario for that.
- If you want the worst-case combined test, swap in `trap-term.mjs`
  here. The follow-up curl should still succeed in ~2 s once SIGKILL
  reaps the trapping child.
