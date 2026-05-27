# Chaos suite — summary

## Scope decision

Pumba / Docker-network chaos was not applicable: Grain is a single
Node process serving a single React SPA, no container topology. The
chaos discipline was redirected to two real risk surfaces:

1. **Subprocess lifecycle** in `apps/api/src/lib/claude.ts` — idle and
   absolute timeouts, SIGTERM→SIGKILL escalation, bounded stderr ring,
   generator `finally` cleanup. Each invariant gets a misbehaving shim
   that runs as a drop-in `CLAUDE_BIN`.
2. **Network boundary** — Toxiproxy slots between the Vite dev proxy
   (`:5173`) and the Hono server (`:3001`). No source change required.

## Deliverables

### Shims (`tests/chaos/shims/`)

| File              | Behaviour                                                | Exercises                              |
|-------------------|----------------------------------------------------------|----------------------------------------|
| `silent.mjs`      | Drains stdin, never writes stdout, parks forever.        | Initial idle timer arm fires.          |
| `slow.mjs`        | Emits a delta every 65 s (idle timer is 60 s).           | Idle timer re-arm gap path.            |
| `hang.mjs`        | Emits init / content_block_start, then goes silent.      | "Stdout activity but no text" path.    |
| `crash.mjs`       | 2 deltas, then `exit(1)` with one line of stderr.        | Non-zero exit + stderr tail logging.   |
| `noisy.mjs`       | 2 deltas + ~1 MB of stderr, then `exit(2)`.              | STDERR_MAX_BYTES ring buffer trim.     |
| `trap-term.mjs`   | Traps + ignores SIGTERM. Parks forever.                  | killWithEscalation SIGKILL escalation. |

All shims sanity-tested via stdin pipe at write time.

### Scenarios (`tests/chaos/scenarios/`)

| File                              | Tool        | Expected user-safe outcome                           |
|-----------------------------------|-------------|-------------------------------------------------------|
| `subprocess-idle-timeout.md`      | silent.mjs  | "synthesis stalled; please try again" after 60 s.    |
| `subprocess-crash.md`             | crash.mjs   | "synthesis subprocess exited unexpectedly".          |
| `subprocess-traps-sigterm.md`     | trap-term   | Child SIGKILLed 2 s after SIGTERM; api still serving.|
| `subprocess-stderr-flood.md`      | noisy.mjs   | Log tail ≤500 chars; api RSS flat across runs.       |
| `network-latency.md`              | Toxiproxy   | UI usable, status events in order, no false timeouts.|
| `network-down-midstream.md`       | Toxiproxy or kill | UI surfaces error, allows retry, no hung reader.|
| `client-disconnect.md`            | curl + kill | release() runs, child reaped, no 429 follow-up.      |

### Tooling

- `tests/chaos/toxiproxy/docker-compose.chaos.yml` — runs Toxiproxy in
  a container, exposes `:8474` (control) and `:3001` (proxied API).
  Zero host installs required.

## Coverage matrix — `claude.ts` invariants → scenario

| Code path in `apps/api/src/lib/claude.ts`                            | Covered by                              |
|----------------------------------------------------------------------|------------------------------------------|
| `IDLE_TIMEOUT_MS` initial arm                                        | subprocess-idle-timeout                 |
| `IDLE_TIMEOUT_MS` reset on stdout                                    | network-latency (indirectly)            |
| `IDLE_TIMEOUT_MS` re-arm gap fires                                   | slow.mjs available                      |
| `IDLE_TIMEOUT_MS` resets on non-text envelopes only                  | hang.mjs available                      |
| `ABSOLUTE_TIMEOUT_MS` (5 min)                                        | NOT covered — wall-clock prohibitive    |
| `STDERR_MAX_BYTES` ring buffer trim                                  | subprocess-stderr-flood                 |
| Non-zero exit branch + `slice(-500)` tail log                        | subprocess-crash                        |
| `emitError` user-safe / operator-detailed split                      | every scenario (assertion)              |
| Generator `finally` → killWithEscalation                             | client-disconnect                       |
| SIGTERM → 2 s → SIGKILL escalation (`process.ts`)                    | subprocess-traps-sigterm                |
| Hono route `finally` → `release()` (rate-limit)                      | client-disconnect                       |

## CI cadence recommendation

| Cadence             | What runs                                                                     |
|---------------------|--------------------------------------------------------------------------------|
| Per PR              | NOTHING from this folder. Unit + integration suites cover happy paths.        |
| Nightly             | `subprocess-crash`, `subprocess-stderr-flood`, `client-disconnect`.            |
|                     | ~3 minutes total. No Toxiproxy needed — pure shim swaps.                       |
| Weekly              | All nightly scenarios PLUS `subprocess-idle-timeout` (60 s) AND               |
|                     | `subprocess-traps-sigterm` (2 s × N reps).                                     |
| Quarterly / manual  | `network-latency`, `network-down-midstream` — require Toxiproxy.              |

The cicd-agent should map these into:

```
.github/workflows/chaos-nightly.yml  — 03:00 UTC, no toxiproxy
.github/workflows/chaos-weekly.yml   — Sunday 04:00 UTC, brings up toxiproxy
```

## Limitations & manual-run notes

- `ABSOLUTE_TIMEOUT_MS` (5 minutes) is not exercised in CI for wall-
  time reasons. Document as a manual scenario only.
- Toxiproxy scenarios are inherently semi-manual unless the runner
  has Docker available; the docker-compose file is provided to make
  installation a no-op on GHA `ubuntu-latest`.
- No assertion harness is included — scenarios are operator-grade
  runbooks. The unit suite covers the same invariants programmatically
  via `vi.mock('node:child_process')`. This folder validates behaviour
  against the real subprocess primitive, not the mock.

## Files created

- `tests/chaos/README.md`
- `tests/chaos/summary.md`
- `tests/chaos/package.json`
- `tests/chaos/shims/{silent,slow,hang,crash,noisy,trap-term}.mjs`
- `tests/chaos/scenarios/{subprocess-idle-timeout,subprocess-crash,subprocess-traps-sigterm,subprocess-stderr-flood,network-latency,network-down-midstream,client-disconnect}.md`
- `tests/chaos/toxiproxy/docker-compose.chaos.yml`
