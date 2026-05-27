# Grain — Chaos test suite

> Wave 3 deliverable from the chaos-agent. Owner folder: `tests/chaos/`.
> Read-only with respect to the rest of the repo — no source modifications.

## What this folder is for

Grain is a single-process Node + browser app. Classic Pumba-style
Docker chaos doesn't apply — there is no container topology. Instead,
the chaos discipline is adapted to what is genuinely fragile in this
codebase:

1. **The Claude CLI subprocess wrapper** in `apps/api/src/lib/claude.ts`.
   It owns idle timeouts, an absolute ceiling, SIGTERM → SIGKILL kill
   escalation, and a bounded stderr ring. Each of those invariants has
   a dedicated misbehaving mock binary under `shims/`.
2. **The web ↔ api network boundary**. The Vite dev server proxies
   `/api/*` to the Hono server at `:3001`. Insert Toxiproxy at `:3001`
   and move the real Hono server to a different port; you can now
   inject latency, slicer, bandwidth, or `down` toxics without
   modifying source.
3. **SSE disconnect cleanup**. The server's `finally` block in
   `apps/api/src/routes/chat.ts` must release the rate-limit slot and
   the generator's `finally` must escalate-kill the child.

## Layout

```
tests/chaos/
├── README.md                                  # you are here
├── shims/                                     # misbehaving CLAUDE_BIN replacements
│   ├── silent.mjs                             # never writes stdout
│   ├── slow.mjs                               # 65s between deltas
│   ├── hang.mjs                               # init events then silence
│   ├── crash.mjs                              # 2 deltas then exit(1)
│   ├── noisy.mjs                              # 1 MB stderr flood
│   └── trap-term.mjs                          # ignores SIGTERM
├── scenarios/                                 # one md file per scenario
│   ├── subprocess-idle-timeout.md             # silent.mjs
│   ├── subprocess-crash.md                    # crash.mjs
│   ├── subprocess-traps-sigterm.md            # trap-term.mjs
│   ├── subprocess-stderr-flood.md             # noisy.mjs
│   ├── network-latency.md                     # Toxiproxy latency
│   ├── network-down-midstream.md              # Toxiproxy down / kill api
│   └── client-disconnect.md                   # curl abort mid-stream
├── toxiproxy/
│   └── docker-compose.chaos.yml               # containerised Toxiproxy
└── summary.md                                 # CI cadence + status matrix
```

## Quickstart

### Run a shim-based scenario

```bash
# From repo root:
chmod +x tests/chaos/shims/*.mjs
export CLAUDE_BIN="$(pwd)/tests/chaos/shims/crash.mjs"
export GRAIN_MODEL=mock
pnpm --filter @grain/api dev
```

Now drive a request (any HTTP client) against
`POST /api/chat/stream`. See the scenario doc for the exact body and
expected SSE timeline.

### Install Toxiproxy (one of):

```bash
# macOS — Homebrew (installs `toxiproxy-server` + `toxiproxy-cli`)
brew install toxiproxy

# Docker (no host install, no Homebrew)
docker compose -f tests/chaos/toxiproxy/docker-compose.chaos.yml up -d

# Linux binary
curl -L https://github.com/Shopify/toxiproxy/releases/download/v2.9.0/toxiproxy-server-linux-amd64 \
  -o /usr/local/bin/toxiproxy-server && chmod +x /usr/local/bin/toxiproxy-server
curl -L https://github.com/Shopify/toxiproxy/releases/download/v2.9.0/toxiproxy-cli-linux-amd64 \
  -o /usr/local/bin/toxiproxy-cli && chmod +x /usr/local/bin/toxiproxy-cli
```

Start it and create the proxy:

```bash
toxiproxy-server &                          # listens on :8474
PORT=3101 pnpm --filter @grain/api dev &    # move real API off :3001
toxiproxy-cli create grain-api -l 127.0.0.1:3001 -u 127.0.0.1:3101
```

The Vite dev server still talks to `http://localhost:3001`, but that
port is now Toxiproxy in front of the API. Add a latency toxic:

```bash
toxiproxy-cli toxic add grain-api -t latency -a latency=2000
```

Remove all toxics:

```bash
for n in $(toxiproxy-cli inspect grain-api | awk '/toxics/{flag=1;next}flag&&/^[a-zA-Z]/{print $1}'); do
  toxiproxy-cli toxic remove grain-api -n "$n"
done
```

## How each shim maps to a `claude.ts` path

| Shim             | Code path exercised in `apps/api/src/lib/claude.ts`                                    |
|------------------|----------------------------------------------------------------------------------------|
| `silent.mjs`     | `IDLE_TIMEOUT_MS` initial-arm fires (no stdout EVER). `ERR_IDLE_TIMEOUT` emitted.      |
| `slow.mjs`       | `IDLE_TIMEOUT_MS` re-arm gap — proves the reset path resets correctly.                 |
| `hang.mjs`       | `armIdleTimer` resets on non-delta envelopes, then fires once they stop.               |
| `crash.mjs`      | `close` handler, non-zero exit branch. `ERR_NONZERO_EXIT` + stderr tail.               |
| `noisy.mjs`      | `STDERR_MAX_BYTES` ring buffer trim. `slice(-500)` tail logging.                       |
| `trap-term.mjs`  | `killWithEscalation()` SIGTERM → 2 s → SIGKILL path in `apps/api/src/lib/process.ts`.  |

## Why this is not in CI by default

- Chaos scenarios are slow (`subprocess-idle-timeout.md` takes ≥60 s).
- Several require Toxiproxy installed locally or in the runner.
- They are intended as a weekly safety net, not a per-PR gate.

See `summary.md` for the recommended CI cadence and gating rules.

## When to add a new chaos scenario

Add one when you discover a new failure mode the wrapper should
recover from — e.g. a real-world Claude CLI bug, a kernel-level pipe
saturation, a vite proxy quirk. Each new scenario must include:

1. A standalone shim under `shims/` OR a documented Toxiproxy
   configuration.
2. A markdown doc under `scenarios/` with goal, setup, run command,
   expected behaviour, pass/fail criteria.
3. An update to `summary.md`.

## Hard rules

- No source modifications in this folder. Resilience is tested against
  the existing implementation.
- Shims must be runnable as a Node `CLAUDE_BIN` replacement (executable
  bit set; `#!/usr/bin/env node` shebang; reads stdin; writes stdout).
- Scenario docs must be deterministic — an operator should be able to
  follow them without help.
