# Grain — Test Suite Runbook

> How to run every test category locally and in CI. See `TEST_COVERAGE_REPORT.md` for what each layer covers and `TEST_PLAN.md` for design decisions.

## Prerequisites (one time)

```bash
# from repo root
pnpm install                                       # installs all workspaces

# Playwright browsers (heavy, ~500MB)
pnpm -F @grain/tests-e2e        install:browsers   # chromium only
pnpm -F @grain/tests-a11y       install:browsers   # chromium
pnpm -F @grain/tests-visual     install:browsers   # chromium
pnpm -F @grain/tests-compat     install:browsers   # chromium + firefox + webkit
pnpm -F @grain/tests-responsive install:browsers   # chromium

# k6 (for perf and stress)
brew install k6                                    # macOS — or see grafana.com/docs/k6
```

For real-Claude AI evals (optional, costs tokens):
```bash
export CLAUDE_BIN=/path/to/claude-binary            # see apps/api/.env.example
```

For chaos (optional):
```bash
brew install toxiproxy                              # or use the provided docker-compose
```

## Layer-by-layer

### Lint, format, typecheck (the static layer)

```bash
pnpm lint                  # ESLint
pnpm typecheck             # tsc --noEmit across all workspaces
pnpm format                # prettier --check . (list-different exits non-zero on drift)
pnpm format:write          # prettier --write . (DO NOT run blindly; reviews the 67-file diff first)
pnpm lint:strict           # all three combined — currently FAILS on baseline (see reports/static/summary.md)
```

### Unit + integration (Vitest)

```bash
# API workspace (includes integration tests):
pnpm -F @grain/api test                     # 357 tests
pnpm -F @grain/api test --coverage          # requires @vitest/coverage-v8 (already in devDeps)

# Web workspace:
pnpm -F @grain/web test                     # 143 tests
pnpm -F @grain/web test --coverage

# Or via root:
pnpm test:unit                              # both workspaces
pnpm test:unit:coverage                     # both with coverage
```

### Realtime (SSE invariants)

```bash
pnpm -F @grain/tests-realtime test:realtime   # 22 tests, ~7s
```

### AI quality

```bash
# Mock mode — safe, deterministic, no token cost:
pnpm -F @grain/tests-ai-quality eval:dry      # 33 tests, ~8s

# Real Claude mode — gated by env flag:
RUN_AI_EVALS=1 pnpm -F @grain/tests-ai-quality eval:real
RUN_AI_EVALS=1 pnpm -F @grain/tests-ai-quality eval:judge
```

### Accessibility

```bash
pnpm -F @grain/tests-a11y test                # jsdom component scans, fast
pnpm -F @grain/tests-a11y test:playwright     # full-page scans (needs chromium)
```

Findings (axe JSON) land in `tests/a11y/findings/`.

### E2E (Playwright)

```bash
# starts api+web with mock-Claude, runs all 9 specs in chromium:
pnpm -F @grain/tests-e2e test:e2e             # 20 tests, ~30–60s

# headed mode for debugging:
pnpm -F @grain/tests-e2e test:e2e --headed --debug
```

The mock-Claude shim lives at `tests/e2e/scripts/mock-claude.mjs`. The launcher script at `tests/e2e/scripts/start-e2e.sh` exports `CLAUDE_BIN=` pointing at it.

### Visual regression

**First run (creates baselines):**
```bash
pnpm -F @grain/tests-visual test:update       # populates tests/visual/__screenshots__/
# review the new baselines, commit them
```

**Subsequent runs (compares against baselines):**
```bash
pnpm -F @grain/tests-visual test
```

Diffs land in `tests/visual/findings/`.

### Cross-browser

```bash
pnpm -F @grain/tests-compat test               # all three engines
pnpm -F @grain/tests-compat test:chromium
pnpm -F @grain/tests-compat test:firefox
pnpm -F @grain/tests-compat test:webkit
```

### Responsive

```bash
pnpm -F @grain/tests-responsive test           # all 3 viewports, 63 tests
```

### Performance (k6)

```bash
# Start api+web with mock-Claude first:
bash tests/e2e/scripts/start-e2e.sh &

# Then run any k6 script:
k6 run tests/perf/scripts/health.k6.js
k6 run tests/perf/scripts/claims.k6.js
k6 run tests/perf/scripts/reports.k6.js
k6 run tests/perf/scripts/sources.k6.js
k6 run tests/perf/scripts/chat-stream.k6.js    # uses mock-Claude
```

All scripts respect `BASE_URL` env (default `http://localhost:3001`). Summaries write to `tests/perf/findings/`.

### Stress / soak

```bash
k6 run tests/stress/scripts/spike.k6.js
SOAK_DURATION=5m k6 run tests/stress/scripts/soak.k6.js     # CI smoke
SOAK_DURATION=1h k6 run tests/stress/scripts/soak.k6.js     # full
k6 run tests/stress/scripts/breakpoint.k6.js
k6 run tests/stress/scripts/rate-limit-stress.k6.js          # adversarial XFF
```

### Chaos

```bash
# Subprocess shim scenarios:
CLAUDE_BIN=$(realpath tests/chaos/shims/silent.mjs)   pnpm -F @grain/api dev   # → idle timeout
CLAUDE_BIN=$(realpath tests/chaos/shims/crash.mjs)    pnpm -F @grain/api dev   # → non-zero exit
CLAUDE_BIN=$(realpath tests/chaos/shims/trap-term.mjs) pnpm -F @grain/api dev  # → SIGTERM→SIGKILL
# ... see tests/chaos/scenarios/ for the full set

# Network chaos (Toxiproxy):
docker compose -f tests/chaos/toxiproxy/docker-compose.chaos.yml up
# Then run the network-* scenarios from tests/chaos/scenarios/
```

### Security

```bash
# Dependency audit:
pnpm audit
pnpm audit --json > reports/security/raw-pnpm-audit.json

# Trivy (filesystem):
trivy fs --severity HIGH,CRITICAL .

# gitleaks:
gitleaks detect

# OWASP ZAP baseline (requires app running):
zap.sh -cmd -quickurl http://localhost:3001 -quickprogress
```

All configs and runbooks are in `reports/security/tooling-setup.md`.

### Synthetic monitoring

Activates only when there's a production deploy.

```bash
# Local probe test (against your dev server):
cd monitoring/synthetic
GRAIN_PROD_URL=http://localhost:5173 \
GRAIN_PROD_API_URL=http://localhost:3001 \
GRAIN_SYNTHETIC_USER_EMAIL=isathe@perforce.com \
npx checkly test

# Deploy to Checkly:
npx checkly deploy
```

See `monitoring/synthetic/README.md` for the full activation checklist.

## CI

Three workflows under `.github/workflows/`:

| Workflow | Triggers | Budget | What it runs |
|---|---|---|---|
| `pr.yml` | PR + push to main/dev_phase2 | < 8 min | lint + typecheck + tsconfig-strict guard + unit (api+web w/ coverage) + realtime + AI dry |
| `nightly.yml` | `0 7 * * *` + dispatch | < 60 min | PR set + a11y full + e2e + visual (auto-PRs new baselines) + cross-browser + responsive + k6 perf + chaos subset + security (report-only) |
| `weekly.yml` | `0 2 * * 0` + dispatch | < 4 hr | soak (30m default) + breakpoint + spike + full chaos + real-Claude eval + security hard-fail |

Manual dispatch options:
- `nightly.yml workflow_dispatch` with `run_real_evals: true` → triggers real Claude eval (gated by GitHub Environment `ai-eval`).

Secrets the team must add:
- `CODECOV_TOKEN` (optional)
- `ANTHROPIC_API_KEY` (required for real-Claude jobs)
- GitHub Environment `ai-eval` with required reviewers

## Troubleshooting

| Symptom | Fix |
|---|---|
| `claude: command not found` during a test | Set `CLAUDE_BIN` to the mock shim: `export CLAUDE_BIN=$(realpath tests/e2e/scripts/mock-claude.mjs)` |
| `Error: browserType.launch: Executable doesn't exist` | Run the appropriate `install:browsers` script (see Prerequisites) |
| Visual tests fail on a Mac after CI passed on Linux | Baselines are Linux-canonical. Either regenerate locally (`test:update`) and DON'T commit, or rely on CI as the authority |
| `pnpm install` fails frozen-lockfile after cicd-agent change | Run `pnpm install` once locally to materialize the new `@vitest/coverage-v8` dep, commit the updated lockfile |
| Rate-limit tests slow | Expected — 20 priming requests + 1 blocked. Each request is gated by 750ms of status `beat()` calls |
| k6 chat-stream SLOs fail | Confirm you're running against the mock-Claude shim. Real Claude blows past every chat SLO |
| `EvidencePanel` keyboard suite fails | This is a real a11y bug (B6 in TEST_COVERAGE_REPORT.md). Pass requires source fix |
