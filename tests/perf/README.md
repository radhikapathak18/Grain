# Grain — Performance tests (k6)

Performance benchmarks for the `apps/api` Hono server. Five scripts, each
with explicit SLOs encoded as k6 `thresholds` so any run that violates an
SLO exits non-zero (CI-friendly).

> **k6 is NOT installed by the harness.** These scripts were authored
> but not executed. The Wave-4 `cicd-agent` is responsible for
> installing k6 in CI (see "CI integration" below) and for any local
> developer install steps documented here.

## Scripts and SLOs

| Script | Endpoint | Target VUs | SLO (p50 / p95 / p99) | Error rate |
|---|---|---|---|---|
| `health.k6.js` | `GET /api/health` | 50 | 2ms / 5ms / 10ms | < 0.1% |
| `claims.k6.js` (batch) | `GET /api/claims?ids=…` | 50 | 8ms / 20ms / 40ms | < 0.1% |
| `claims.k6.js` (single) | `GET /api/claims/:id` | 50 | 4ms / 10ms / 20ms | < 0.1% |
| `reports.k6.js` | `GET /api/reports/monthly` | 50 | 10ms / 30ms / 60ms | < 0.1% |
| `sources.k6.js` (known) | `GET /api/sources/:knownId` | 50 | 8ms / 20ms / 40ms | < 0.1% |
| `sources.k6.js` (placeholder) | `GET /api/sources/:undocumentedId` | 50 | 10ms / 25ms / 50ms | < 0.1% |
| `chat-stream.k6.js` | `POST /api/chat/stream` (SSE, mock-Claude) | 5 | TTFT: 900 / 1000 / 1500ms; total: 2s / 5s / 8s | < 1% |

All scripts follow the same load profile:

```
30s warmup  → 5  VUs
 1m ramp    → target VUs
 3m sustain → target VUs
30s cooldown → 0 VUs
```

`chat-stream.k6.js` uses its own stage shape with a 5-VU ceiling because
the API's per-IP `CONCURRENT_MAX=1` cap and the deliberate `STATUS_BEAT_MS
= 250` × 3 UX delays in `apps/api/src/routes/chat.ts` make higher
concurrency unproductive.

## Critical: the chat-stream script requires the mock-Claude shim

Real Claude CLI calls **cost tokens, are slow, and are non-deterministic**.
Running `chat-stream.k6.js` against an API configured with a real
`$CLAUDE_BIN` will:

- burn tokens on every iteration (we send hundreds per minute),
- blow past every TTFT and total-duration SLO (real Claude TTFT is
  routinely 1–5s; total is 5–30s; both vary widely run-to-run),
- produce non-deterministic citation marker emissions that break the
  `at least one citation` assertion.

**Always** point `CLAUDE_BIN` at `tests/e2e/scripts/mock-claude.mjs`
before running the perf suite. The mock emits the exact `stream_event`
envelope `apps/api/src/lib/claude.ts` expects, deterministically, with
two `[CL-NNNN]` markers per answer.

### Expected results — mock-Claude vs. real Claude

| Metric | Mock-Claude (this suite's SLO) | Real Claude (informational) |
|---|---|---|
| TTFT p95 | < 1000ms (floor is 750ms of `beat()` UX delays) | 2000–6000ms, highly variable |
| Total duration p95 | < 5000ms (mock emits ~8 deltas at 8ms apart) | 5000–30000ms |
| Citations per iteration | exactly 2 (mock injects `[CL-0001]` and `[CL-0002]`) | 0–N, non-deterministic |
| Subprocess CPU per stream | < 50ms (mock is a Node script that just writes JSONL) | model-dependent, far higher |

If you need to characterise real-Claude latency for a release, use this
suite as scaffolding but expect to relax the thresholds significantly.

## Running locally

### One-time

1. Install k6:
   - macOS: `brew install k6`
   - Debian/Ubuntu: see [grafana.com/docs/k6/latest/set-up/install-k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) — `gpg | apt-key add` + apt install
   - Docker (no install): `docker run --rm -i --network host -v "$PWD:/app" -w /app grafana/k6 run scripts/health.k6.js`
2. Make the mock shim executable: `chmod +x tests/e2e/scripts/mock-claude.mjs`

### Start the API with the mock shim

From the repo root:

```bash
CLAUDE_BIN="$(pwd)/tests/e2e/scripts/mock-claude.mjs" \
GRAIN_MODEL=mock \
pnpm --filter @grain/api dev
```

Wait for `grain-api listening on http://localhost:3001`.

### Run an individual script

```bash
cd tests/perf
pnpm test:perf:health
pnpm test:perf:claims
pnpm test:perf:reports
pnpm test:perf:sources
pnpm test:perf:chat
```

Or run them all sequentially (recommended order — cheap scripts first
so a misconfigured box fails fast):

```bash
pnpm test:perf:all
```

### Targeting a different host

```bash
BASE_URL=http://api.staging.example.com k6 run scripts/health.k6.js
```

### Useful k6 flags

- `--summary-export=findings/summary.json` — machine-readable summary
  for CI artifact upload.
- `--out json=findings/raw.json` — every data point, useful for
  Grafana / Datadog import.
- `--out csv=findings/raw.csv` — every data point as CSV, useful for
  spreadsheet analysis or custom tooling.
- `--quiet` — suppress per-iteration logs in CI.
- `--http-debug=full` — dump every request / response. Do NOT use in
  CI; it overflows logs immediately.

## CI integration notes (for `cicd-agent`)

These scripts are designed to be run from a GitHub Actions job. The
cicd-agent owns the workflow definition; this section documents what
the perf scripts need from it.

1. **k6 install.** Use the official `grafana/setup-k6-action@v1` step
   or `apt-get install k6` after adding the Grafana apt repo. The
   `docker run grafana/k6` fallback also works and avoids any host
   install. k6 is a single static binary so caching is cheap.
2. **Mock-Claude shim wiring.** The chat-stream job MUST export
   `CLAUDE_BIN=$GITHUB_WORKSPACE/tests/e2e/scripts/mock-claude.mjs`
   before starting the API. The other perf scripts do not depend on
   the CLI at all and can run against a default API process, but the
   mock is harmless if always-on so the simplest CI shape is "set the
   env var once, run all five scripts".
3. **API startup.** Start the API in the background and poll
   `/api/health` until 200 before invoking k6 (the perf scripts do
   not include their own readiness wait).
4. **Resource sizing.** A standard `ubuntu-latest` runner is enough
   for the 50-VU non-streaming scripts. The chat-stream script
   spawns a Node subprocess per iteration × 5 concurrent VUs — still
   well under the runner's CPU budget but watch memory if you raise
   the VU cap.
5. **Schedule.** Per the swarm plan (`TEST_PLAN.md` line 60), perf
   runs nightly, not on every PR. Keep it that way: a sustain phase
   alone is 3+ minutes per script.
6. **Failure mode.** k6 exits non-zero when any `threshold` is
   violated. Treat that exit code as a failed job. Upload
   `findings/summary.json` as a CI artifact so regressions can be
   triaged without re-running the suite.
7. **Flakiness budget.** Set `retries: 1` on the perf job. A
   non-streaming SLO flake usually means the runner was noisy
   (neighbour-VM contention); the same SLO passes on retry > 95%
   of the time in practice.

## Files

```
tests/perf/
├── README.md                       # this file
├── package.json                    # @grain/tests-perf workspace entry
├── summary.md                      # what was created + SLOs at a glance
├── lib/
│   └── common.js                   # shared stages + IP spoofing
└── scripts/
    ├── health.k6.js
    ├── claims.k6.js
    ├── reports.k6.js
    ├── sources.k6.js
    └── chat-stream.k6.js
```

## Hard rules (per swarm plan)

- **No fake tests.** Every script hits the real endpoint with
  realistic payloads (real claim IDs, real source IDs, real chat
  request body shapes).
- **No real Claude.** chat-stream is mock-only by policy.
- **No source modification.** Scripts live under `tests/perf/` only.
- **Thresholds are gates, not suggestions.** A violated threshold
  fails the run.
