# Chaos scenario: network latency between web and api

## Goal

Verify the browser-side SSE consumer (`apps/web/src/hooks/useChatStream.ts`)
remains usable when the network introduces high latency. Document any
client-side or operator-set timeouts. Confirm Vite's dev proxy does
not introduce its own ceiling.

## Tool

[Toxiproxy](https://github.com/Shopify/toxiproxy) — a TCP-layer fault
injection proxy. We insert it between the web (`:5173`) and the API.
The API runs on a non-standard port and Toxiproxy listens on `:3001`
(the port the Vite dev proxy is configured to call).

## Setup

### Install Toxiproxy

```bash
# macOS (Homebrew)
brew install toxiproxy

# OR Docker (no host install)
docker run --rm -d --name toxiproxy \
  -p 8474:8474 -p 3001:3001 \
  ghcr.io/shopify/toxiproxy:2.9.0

# OR see tests/chaos/toxiproxy/docker-compose.chaos.yml
docker compose -f tests/chaos/toxiproxy/docker-compose.chaos.yml up -d
```

`toxiproxy-cli` (or the HTTP API on `:8474`) is the control plane.

### Wire web → toxiproxy → api

The Vite dev proxy targets `http://localhost:3001` by default. To
insert Toxiproxy without modifying source, move the real API to
`:3101` and have Toxiproxy listen on `:3001`:

```bash
# 1. Run the API on a non-default port.
chmod +x tests/e2e/scripts/mock-claude.mjs
export CLAUDE_BIN="$(pwd)/tests/e2e/scripts/mock-claude.mjs"
export GRAIN_MODEL=mock
PORT=3101 pnpm --filter @grain/api dev &

# 2. Create the Toxiproxy proxy: listen on :3001, forward to :3101.
toxiproxy-cli create grain-api -l 127.0.0.1:3001 -u 127.0.0.1:3101

# 3. Inject a latency toxic — 2 s downstream (api → web).
toxiproxy-cli toxic add grain-api -t latency -a latency=2000

# 4. Start web normally. Its proxy still talks to :3001, now Toxiproxy.
pnpm --filter @grain/web dev -- --port 5173 --strictPort
```

Open `http://localhost:5173`, log in, ask a question.

### Variations to run

| Toxic            | CLI                                                         | What it tests                                  |
|------------------|--------------------------------------------------------------|-------------------------------------------------|
| latency 500ms    | `toxic add grain-api -t latency -a latency=500`              | Mild — first byte time, status events visible. |
| latency 2000ms   | `toxic add grain-api -t latency -a latency=2000`             | Aggressive — status events still visible.      |
| slicer           | `toxic add grain-api -t slicer -a average_size=8 -a delay=5` | SSE chunked in tiny pieces. Tests parser.      |
| bandwidth 1KB/s  | `toxic add grain-api -t bandwidth -a rate=1`                 | SSE stream stays open but trickles. UI patience. |

Remove a toxic with `toxiproxy-cli toxic remove grain-api -n <name>`.

## Expected resilience behaviour

1. The web app's `useChatStream` hook uses `fetch()` against
   `/api/chat/stream`. Browser `fetch` has **no default timeout**, so
   under 2 s latency the request simply takes 2 s longer to start.
2. Status events (`searching`, `retrieved`, `synthesizing`) arrive
   2 s late but still in order.
3. The streaming cursor remains visible — `streaming` state stays
   `true` until the `done` event arrives.
4. Under the `slicer` toxic, the SSE reader in
   `useChatStream` (manual buffer split on `\n\n`) must reassemble
   chunks correctly. Citation markers split across chunks are still
   deduped by the server's `CITATION_SCAN_OVERLAP` window.

## Pass criteria

1. The chat answer renders fully and correctly (text + citation chips).
2. Status step UI is in correct order.
3. No "Network error" or "synthesis failed" message appears for
   anything below 60 s of added latency. (Above 60 s, the server's
   own idle timer fires legitimately.)
4. The cursor / streaming indicator never gets stuck on after `done`.

## Fail signals

- The web shows "synthesis failed; please try again" under simple
  latency → there is a hidden client-side timeout we did not know
  about; document it.
- The SSE feed breaks under the `slicer` toxic → the manual buffer
  split in `useChatStream` does not handle small chunk boundaries.
- Citation chips appear duplicated under `slicer` → marker dedupe
  has a sliding-window bug.

## Operator-set timeouts to be aware of

- Vite dev proxy: uses `http-proxy` internally. No default timeout
  on proxy responses. Configurable via
  `vite.config.ts → server.proxy['/api'].timeout`. Currently
  unset → no ceiling.
- Hono `streamSSE`: no internal timeout.
- Browser `fetch`: no default timeout.
- Browser `EventSource` (NOT used here — useChatStream uses fetch +
  reader): no default timeout.
- Server idle timer in `claude.ts`: 60 s. Above this, latency masks
  as a stalled subprocess.

## Notes

- If you cannot install Toxiproxy in CI, this scenario is documented
  as **manual / operator-run**. The shim/idle-timeout suite is the
  automatable portion.
