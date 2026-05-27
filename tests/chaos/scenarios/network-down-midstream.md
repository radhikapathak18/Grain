# Chaos scenario: api goes down mid-stream

## Goal

Verify the browser surfaces a clean error (not a frozen UI) when the
api process disappears while an SSE stream is open. Verify the user
can retry without a page reload.

## Tooling

Two options:

1. **Toxiproxy `down` toxic** — clean: cuts the TCP connection at the
   proxy layer; the api process stays up.
2. **`kill` the api process** — brute: tests both the SSE consumer
   path AND the server-side `finally` cleanup (release()).

Both are useful. Run both.

## Setup A: Toxiproxy `down`

Set up Toxiproxy per `network-latency.md`, then start a request and
toggle the proxy down:

```bash
toxiproxy-cli create grain-api -l 127.0.0.1:3001 -u 127.0.0.1:3101
toxiproxy-cli toggle grain-api    # disables proxy → all conns drop
# After observing client behaviour:
toxiproxy-cli toggle grain-api    # re-enables
```

## Setup B: kill the api

```bash
chmod +x tests/e2e/scripts/mock-claude.mjs
export CLAUDE_BIN="$(pwd)/tests/e2e/scripts/mock-claude.mjs"
export GRAIN_MODEL=mock
PORT=3001 pnpm --filter @grain/api dev &
API_PID=$!

# Start the web app, login, ask a slow question
pnpm --filter @grain/web dev -- --port 5173 --strictPort &

# In a browser: open localhost:5173, login, send a question that
# triggers the mock CLI's multi-chunk path (any question works).

# Mid-stream:
kill -KILL $API_PID
```

## Expected resilience behaviour

| Surface             | Expected                                                |
|---------------------|---------------------------------------------------------|
| Browser fetch       | `reader.read()` rejects (`TypeError: network error`).   |
| `useChatStream`     | Catches in its try/finally, sets `error` state.         |
| UI                  | Shows a generic error message; `streaming` flips false. |
| Input field         | Re-enables — the user can type and retry.               |
| Citation chips      | Whatever was already received stays visible.            |
| Phantom empty bubble | Cleanup branch removes a 0-content assistant bubble.   |
| Page reload needed? | NO.                                                     |

Server side (only for Setup B — kill):

- The api is dead, so there is no `finally` to verify. But once
  restarted, a fresh request must succeed immediately — there must be
  no left-over rate-limit state (in-memory state died with the
  process; that is acceptable).

## Pass criteria

1. The UI does not freeze. Within 2 s of the disconnect, an error
   message appears.
2. The user can send a new question after re-starting the api (or
   re-enabling Toxiproxy).
3. No console exception cascades — `useChatStream`'s catch handler
   contains the error.
4. If any partial answer text was already on screen, it remains
   readable (we do not wipe partial state).

## Fail signals

- Streaming indicator stuck on forever → reader rejection not caught.
- Browser tab unresponsive → likely a tight retry loop or unhandled
  promise.
- Reload-required to send another question → state machine wedged.

## Notes

- Setup A (Toxiproxy down) is the right tool for CI: deterministic
  control, no process management. Setup B (kill) is the better
  manual smoke test because it also exercises restart behaviour.
- This scenario specifically validates the
  `apps/web/src/hooks/useChatStream.ts` error path that the realtime
  agent's tests assert in isolation.
