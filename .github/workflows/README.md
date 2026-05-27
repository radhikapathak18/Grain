# Grain — CI/CD pipelines

Owner: `cicd-agent` (Wave 4). This folder is the single source of truth
for which test suites run when. Every workflow uses the shared composite
actions under `.github/actions/` to keep install + cache logic in one
place.

## Pipelines at a glance

| Workflow | Trigger | Wall-clock budget | What runs |
|---|---|---|---|
| [`pr.yml`](pr.yml) | `pull_request` + `push` to `main` / `dev_phase2` | **< 8 min** | lint, typecheck, tsconfig-strict-flag guard, unit + integration (api + web matrix), realtime SSE conformance, AI quality (dry / mocked), coverage upload |
| [`nightly.yml`](nightly.yml) | `cron: 0 7 * * *` + `workflow_dispatch` | **< 60 min** | everything in PR + a11y full + Playwright E2E + visual regression (auto-PRs new baselines) + cross-browser + responsive + k6 perf (5 scripts + rate-limit stress) + chaos subset + security (pnpm audit / Trivy / gitleaks). Manual dispatch can also run the real-Claude AI eval. |
| [`weekly.yml`](weekly.yml) | `cron: 0 2 * * 0` (Sun 02:00 UTC) + `workflow_dispatch` | **< 4 h** | k6 soak (30m default, env-overrideable to 1h), breakpoint, spike, full chaos including idle-timeout + trap-sigterm, real-Claude AI eval + judge + baseline comparison, security with hard fail. |

## Concurrency & cancellation

- `pr.yml` uses `cancel-in-progress: true` keyed on the head ref —
  force-pushing a PR cancels in-flight runs to save minutes.
- `nightly.yml` and `weekly.yml` set `cancel-in-progress: false` because
  cron runs should not be cancelled by manual dispatches.

## Gated jobs (do not run by default)

| Job | Where | Trigger |
|---|---|---|
| `ai-quality-real` | `nightly.yml` | `workflow_dispatch` + input `run_real_evals=true`. Requires `ANTHROPIC_API_KEY` secret + (optional) `ai-eval` GitHub environment with required reviewers. |
| `ai-quality-weekly` | `weekly.yml` | always-on weekly cron, but uses the `ai-eval` GitHub environment. If that environment requires reviewers, it blocks on approval. |
| `security-weekly` | `weekly.yml` | weekly cron. Configured to **fail** on HIGH/CRITICAL pnpm-audit / Trivy / gitleaks findings (nightly is report-only). |

The real-Claude eval is intentionally never on the PR or default nightly
schedule because every iteration burns Anthropic tokens.

## Composite actions

| Path | Purpose |
|---|---|
| [`../actions/setup-pnpm-node/action.yml`](../actions/setup-pnpm-node/action.yml) | pnpm 11.3.0 + Node 20 + `pnpm install --frozen-lockfile` with lockfile-keyed `~/.pnpm-store` cache. |
| [`../actions/setup-playwright/action.yml`](../actions/setup-playwright/action.yml) | Playwright browser install with `~/.cache/ms-playwright` cache keyed on `pnpm-lock.yaml`. Pass `browsers: "chromium firefox webkit"` for cross-browser jobs. |

## Scripts

- [`../scripts/verify-web-tsconfig.mjs`](../scripts/verify-web-tsconfig.mjs)
  — CI guard that the resolved `apps/web/tsconfig.app.json` actually has
  `strict` and `noUncheckedIndexedAccess`. The static-analysis-agent
  flagged that `tsconfig.app.json` does NOT extend `tsconfig.base.json`
  despite a code comment claiming the flags are on. The pr/nightly
  pipelines run this script so the gap surfaces.

## Lint policy

PR runs **`pnpm lint`** (not `pnpm lint:strict` and not `pnpm lint:ci`),
plus `pnpm typecheck`. Why:

- `pnpm lint:strict` chains `eslint --max-warnings 0 && prettier --check
  . && pnpm typecheck`. The static-analysis-agent intentionally left a
  baseline of **4 ESLint errors** and **67 Prettier-dirty files**
  pending cleanup. See `reports/static/summary.md`.
- We do NOT make CI green by auto-fixing — that would defeat the
  purpose of the baseline.
- Instead, the pr workflow runs Prettier with `--list-different` in a
  `continue-on-error: true` step and uploads the dirty list as the
  `prettier-dirty-files` artifact. Switch the lint step over to
  `pnpm lint:ci` once the baseline reaches zero.

TODO (tracked in `reports/static/summary.md`): zero the lint baseline,
then promote the PR lint step to `pnpm lint:strict`.

## Coverage

- `apps/api` and `apps/web` both have `@vitest/coverage-v8` as a
  devDependency (added by the cicd-agent, since the unit-test-agent's
  coverage script depends on it).
- The PR workflow runs `vitest run --coverage` per workspace and
  uploads `coverage-${short}` artifacts.
- Codecov upload is wired but optional — it runs only when the
  `CODECOV_TOKEN` secret is present. Forks and unconfigured repos skip
  silently.

## Browser caches

- Playwright browser binaries are cached under
  `~/.cache/ms-playwright`, keyed on `pnpm-lock.yaml` + the requested
  browser list. Cold-start cost on a CI runner is ~2 min; warm-start is
  ~5 s.
- k6 is installed via `grafana/setup-k6-action@v1` which caches the
  binary itself.

## Workers / concurrency caps

Playwright suites set `workers: 1` because Grain's `apps/api` enforces
in-process `CONCURRENT_MAX=1` rate-limit cap per IP. Parallel workers
would all share `127.0.0.1` and step on each other. Cross-browser is
also serialized per project. This is documented in
`tests/e2e/playwright.config.ts` and the agent summaries.

## Manual dispatch — how to trigger

```bash
# From the GitHub UI: Actions → Nightly → Run workflow → set
# run_real_evals = true.

# From the gh CLI:
gh workflow run nightly.yml -f run_real_evals=true
gh workflow run weekly.yml -f soak_duration=1h -f runs_on=ubuntu-latest
```

## Things the operator must do manually (one-time)

1. **Secrets to add in repo settings** (Settings → Secrets and
   variables → Actions):
   - `CODECOV_TOKEN` — optional. If absent, codecov upload is skipped.
   - `ANTHROPIC_API_KEY` — required for the gated AI quality real-eval
     jobs. The judge pass also uses it.
2. **GitHub Environment `ai-eval`** — optional but recommended.
   Configure required reviewers on it so the real-Claude jobs block on
   manual approval before they spend tokens.
3. **First-run visual baselines** — on the first nightly run after
   `tests/visual/` lands on `main`, the `visual` job will fail because
   there are no `*-linux.png` baselines committed. It will auto-open a
   PR (via `peter-evans/create-pull-request@v6`) with the freshly
   generated snapshots. Review and merge that PR; subsequent nightlies
   diff cleanly.
4. **Self-hosted runner for full 1h soak** — optional. The default
   `ubuntu-latest` survives the 30m default soak. If the team wants a
   1h soak weekly, register a self-hosted runner with label `grain-soak`
   and dispatch `weekly.yml` with `runs_on=self-hosted`,
   `soak_duration=1h`.
5. **Toxiproxy chaos scenarios** — remain quarterly / manual per the
   chaos-agent's summary. They require a Toxiproxy server which is not
   provisioned in any of the workflows here.

## Adjusting cadence

To move a layer between cadences, edit the relevant workflow file and
re-run. The agent summaries under `tests/*/summary.md` document each
layer's expected cadence so cross-reference there before promoting or
demoting a suite.
