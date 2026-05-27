# Grain — stress + soak test suite

Owner: `stress-soak-agent` (Wave 3). Coordinates with `performance-agent`
(folder `tests/perf/`). No overlap with performance budgets — this suite
is **adversarial**, designed to find the failure mode rather than measure
the steady state.

> These scripts are NOT run by this agent. They are deliverables. CI
> cadence and operator instructions are below.

## Files

| File | Purpose | Run time | Profile |
|---|---|---|---|
| `scripts/spike.k6.js` | 10x sudden burst against cached endpoints. Reveal connection-pool / event-loop fragility. | ~2m 30s | 10 → 100 → 10 VU |
| `scripts/soak.k6.js` | Sustained load for 1h. Expose memory / FD / Map-growth leaks. | 1h default, env-overrideable | 30 VU constant |
| `scripts/breakpoint.k6.js` | Linear ramp until thresholds fire. Locate the hard ceiling. | up to 10m (aborts early on fail) | 10 → 1000 VU |
| `scripts/rate-limit-stress.k6.js` | Adversarial test: 50 spoofed `X-Forwarded-For` IPs against `/api/chat/stream`. Verifies `lib/rateLimit.ts` under sustained load and exposes the XFF trust gap. | 2m | 50 VU constant |

## Prerequisites

1. **k6** installed locally (`brew install k6` on macOS, or see grafana.com/docs/k6).
2. **API running** with the mock-Claude shim:
   ```bash
   # From repo root
   ./tests/e2e/scripts/start-e2e.sh
   ```
   This launches `apps/api` with `CLAUDE_BIN` pointed at
   `tests/e2e/scripts/mock-claude.mjs` so the rate-limit-stress test
   never hits real Anthropic infra.
3. **File descriptor limit** raised for the breakpoint test. macOS
   default is 1024; bump it before running:
   ```bash
   ulimit -n 65535
   ```
4. For **soak**, a dedicated machine (not the dev laptop you also use
   for Slack / browser tabs). The test runs for an hour. A noisy
   neighbor will pollute the latency-drift signal.

## Running

```bash
# Default targets http://localhost:3001
k6 run tests/stress/scripts/spike.k6.js
k6 run tests/stress/scripts/breakpoint.k6.js
k6 run tests/stress/scripts/rate-limit-stress.k6.js

# Soak — full hour
k6 run tests/stress/scripts/soak.k6.js

# Soak — 5-minute smoke (for CI)
SOAK_DURATION=5m k6 run tests/stress/scripts/soak.k6.js

# Override target
BASE_URL=http://staging.grain.local k6 run tests/stress/scripts/spike.k6.js
```

## Memory / FD instrumentation (for soak only)

k6 measures the client side. It cannot tell you whether the server is
leaking RSS. Run one of these alongside the soak:

### Option A — `process.memoryUsage()` poller

Create a temporary `mem-poll.mjs`:

```js
import http from 'node:http';
import fs from 'node:fs';
const csv = fs.createWriteStream('soak-mem.csv');
csv.write('ts,rss,heapTotal,heapUsed,external,arrayBuffers\n');
setInterval(() => {
  // Hit a debug endpoint on the API that prints process.memoryUsage()
  // — or run this as a side-script INSIDE the API process by adding a
  // small `setInterval(() => console.log(process.memoryUsage()), 30000)`
  // to apps/api/src/index.ts for the duration of the soak.
}, 30_000);
```

The pragmatic approach for the hackathon: add a temporary one-liner
inside `apps/api/src/index.ts` for the duration of the soak run:

```ts
setInterval(() => console.log(JSON.stringify({
  t: Date.now(), mem: process.memoryUsage()
})), 30_000);
```

Then redirect API stdout to a file and post-process. **Remove the line
before merging.** Do not commit memory instrumentation to `apps/api/`.

### Option B — `node --inspect` + Chrome DevTools

```bash
PORT=3001 CLAUDE_BIN=$PWD/tests/e2e/scripts/mock-claude.mjs \
  node --inspect $(pnpm --filter @grain/api exec node --print 'require.resolve("./dist/index.js")')
```

Open `chrome://inspect`, take heap snapshots at t=0, t=30m, t=1h.
Compare retained-size grouping for `Window` (from `rateLimit.ts`) and
`Claim` (from `claims.ts`).

### Option C — `lsof` for file descriptors

```bash
# In a separate shell
while true; do
  echo "$(date +%s),$(lsof -p $(pgrep -f 'apps/api') | wc -l)" >> fds.csv
  sleep 30
done
```

If FD count grows monotonically, the SSE plumbing or HTTP keepalive is
leaking.

## Expected outcomes

### Spike (`spike.k6.js`)

- **Pass:** `http_req_failed < 1%`. p95 latency on the 100-VU segment
  stays under 250ms. Recovery segment returns to baseline within 30s.
- **Fail:** 5xx during the spike (event-loop starvation), OR p95 stays
  elevated after the spike ends (leak / pool exhaustion).

### Soak (`soak.k6.js`)

- **Pass:** `http_req_failed < 0.5%`. p95 in the final 10% of the run
  is within 1.5× of p95 in the first 10%. Server RSS sawtooths but
  does not climb monotonically.
- **Fail:** Latency drifts upward, OR errors begin appearing after N
  minutes, OR RSS / FD count climbs monotonically. The `Map<string,
  Window>` in `rateLimit.ts` is the prime suspect — it has no
  eviction, only replacement.

### Breakpoint (`breakpoint.k6.js`)

- **Pass (worrying):** The full 10m ramp to 1000 VU completes with no
  threshold breach. This almost certainly means k6 isn't actually
  saturating the network path — investigate.
- **Pass (expected):** k6 aborts somewhere between 200 and 800 VU when
  `http_req_failed > 5%` OR `p95 > 2s` fires. The VU count at abort is
  the breakpoint. Recorded in `breakpoint-summary.json`.
- **Note:** the rate-limited chat endpoint has a *much* lower
  operational ceiling (CONCURRENT_MAX=1 per IP). The breakpoint number
  here only describes the fixture-endpoint ceiling.

### Rate-limit stress (`rate-limit-stress.k6.js`)

- **Pass (current behavior):** No 5xx. No transport errors. Per-IP
  acceptance roughly bounded by RATE_MAX=20 per 60s window. Aggregate
  acceptance over 2 minutes ≈ 50 IPs × 40 = ~2000 successful streams.
  **This is the bug-by-design** that security-audit-agent flagged: by
  spoofing 50 XFF headers, a single attacker bypasses the per-IP cap
  by 50×. The test proves the gap with a number.
- **Fail:** Any 5xx (limiter / route threw). OR per-IP acceptance
  >> 20 in any 60s window (limiter is leaky, not just XFF-spoofable).
  OR 0 rate-limit rejections at all (limiter never fired — most
  likely `getClientIp` returned 'unknown' for every request because
  the test rig didn't actually set XFF correctly).

## Threats this suite does NOT cover

- Real Claude CLI subprocess load. We use the mock shim. Chaos-agent
  owns the subprocess-kill scenarios.
- Server-side CPU profile. Use `clinic doctor` or `0x` separately.
- DB / connection-pool exhaustion — there is no DB.

## CI cadence (recommended)

| Test | Cadence | Where |
|---|---|---|
| `spike.k6.js` | Nightly | `.github/workflows/nightly.yml` (owned by cicd-agent) |
| `soak.k6.js` (5m smoke) | Nightly | `.github/workflows/nightly.yml` |
| `soak.k6.js` (full 1h) | Weekly | `.github/workflows/weekly.yml` |
| `breakpoint.k6.js` | Weekly | `.github/workflows/weekly.yml` |
| `rate-limit-stress.k6.js` | Weekly + on PR touching `apps/api/src/lib/rateLimit.ts` or `apps/api/src/routes/chat.ts` | `.github/workflows/weekly.yml` + path-filtered PR job |

Soak runs MUST be on a dedicated runner with no other jobs scheduled
on the same hardware. GitHub-hosted runners are acceptable for 5m
smoke; the full 1h soak should run on a self-hosted runner if one is
available.
