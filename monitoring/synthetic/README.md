# Grain — Synthetic monitoring

> Status: **forward-looking config only.** Grain has no production
> deploy yet — the demo runs locally. This directory ships the
> probes that should turn on the moment there IS a production
> environment. Nothing here costs money, makes outbound calls, or
> registers an account.

## What "synthetic monitoring" means here

Synthetic checks are real user journeys run on a schedule from
neutral cloud regions, observed for failure. They're "synthetic"
because the traffic isn't a real user — it's a robot pretending to
be one. Unlike RUM (real user monitoring) they detect outages even
when nobody is using the product.

We define five checks:

| Check | Type | Cadence | What it proves |
|---|---|---|---|
| `login-and-ask.spec.ts` | Browser (Playwright) | 5 min | The whole golden path: web reachable → login → product select → ask → SSE stream emits deltas → citations render → evidence panel opens. **This is the only check that exercises the Claude CLI subprocess.** |
| `report-view.spec.ts` | Browser | 5 min | `/report` renders the MonthlyReport fixture and citation chips still open the evidence panel. |
| `source-detail.spec.ts` | Browser | 5 min | Direct navigation to `/source/:id` works (Vite SPA fallback configured correctly). |
| `api-health.ts` | HTTP | 5 min | `GET /api/health` → 200 in <500ms p95. Fastest pulse signal. |
| `api-claims.ts` | HTTP | 5 min | `GET /api/claims?ids=CL-0001,CL-0002` returns the expected batch. Catches fixture-schema drift after deploys. |

See `alerts.md` for thresholds and SLAs.

## Why this matters MORE for an AI app

The riskiest piece of production Grain — by a wide margin — is the
**Claude CLI subprocess** that the API spawns to synthesize answers
(see [`apps/api/src/lib/claude.ts`](../../apps/api/src/lib/claude.ts)).
That binary can fail silently in ways nothing else catches:

- Binary moved / not on `$PATH` on the prod server.
- Model id (`MODEL` env) deprecated.
- API key (consumed by the CLI) rotated.
- Idle timeout misconfigured → stream hangs forever.
- `node:child_process` permissions change after a host upgrade.

In all those scenarios `/api/health` keeps returning `{status: 'ok'}`
because it never touches the CLI. The web build keeps serving. Users
see a chat input that accepts text and produces nothing. **Only
`login-and-ask.spec.ts` can detect this class of failure.**

That's why it's the P1 check.

## How to activate (when there's a production deploy)

1. **Create a Checkly account.** Free tier is sufficient — see
   *Cost expectations* below.
2. **Install the CLI locally** (optional, for `checkly test` dry-runs):
   ```bash
   pnpm dlx checkly login
   pnpm dlx checkly --help
   ```
3. **Set environment variables in the Checkly project's "Environment
   variables" panel** (NOT this repo — they leak into the public
   monitoring config):
   ```
   GRAIN_PROD_URL                 https://grain.example.com
   GRAIN_PROD_API_URL             https://api.grain.example.com
   GRAIN_SYNTHETIC_USER_EMAIL     monitor@grain.example.com
   GRAIN_SYNTHETIC_USER_ROLE      researcher
   GRAIN_SYNTHETIC_SOURCE_ID      GONG-001
   GRAIN_SYNTHETIC_CLAIM_IDS      CL-0001,CL-0002
   GRAIN_ALERT_SLACK_WEBHOOK      https://hooks.slack.com/services/...
   GRAIN_ALERT_EMAIL              oncall@grain.example.com
   ```
4. **Deploy the project**:
   ```bash
   cd monitoring/synthetic
   pnpm dlx checkly deploy
   ```
5. **Verify in the Checkly UI**: each check should turn green on its
   first run from each location.

## Running probes locally for testing

You can dry-run the Playwright probes against a local dev stack
without touching Checkly at all:

```bash
# 1. In one shell, start Grain in dev mode (from repo root):
pnpm dev

# 2. In another shell, point the probes at localhost:
export GRAIN_PROD_URL=http://localhost:5173
export GRAIN_PROD_API_URL=http://localhost:3001
export GRAIN_SYNTHETIC_USER_EMAIL=isathe@perforce.com
export GRAIN_SYNTHETIC_USER_ROLE=researcher
export GRAIN_SYNTHETIC_SOURCE_ID=GONG-001

# 3. Dry-run with Checkly CLI:
pnpm dlx checkly test ./checks
```

Alternatively, since `./checks/*.spec.ts` are vanilla
`@playwright/test` files, you can run them with Playwright directly:

```bash
npx playwright test --config=./checks
```

## Synthetic user — auth model requirement

The probes log in as **`$GRAIN_SYNTHETIC_USER_EMAIL`**, the same
seeded user pattern the e2e suite uses (`isathe@perforce.com`).
For these probes to keep working in production, one of these must
be true:

1. **A real synthetic account exists.** The synthetic user is
   provisioned as a normal account in whatever real auth system
   replaces the current `SEEDED_USERS` lookup. The account has
   access to the smallest product set sufficient to exercise the
   golden path. *Recommended approach.*
2. **An API-key bypass exists.** The login route accepts a
   synthetic-only header (e.g. `x-synthetic-probe-token`) that
   skips OAuth. The token is rotated quarterly and stored only in
   the Checkly env panel. *Discouraged — it adds an auth bypass
   that has to be threat-modeled separately.*

Either way, **never reuse a real human's account** for synthetic
monitoring. The audit log noise alone makes it a bad idea, and
PR/security review will block it.

## Selector reuse from `tests/e2e/`

The probe scripts duplicate selectors from
[`tests/e2e/pages/`](../../tests/e2e/pages/) (LoginPage, ProductSelectPage,
ChatPage, ReportPage, SourcePage). They're inlined rather than
imported because:

- Checkly's Playwright runtime sandboxes scripts; cross-package
  imports add packaging steps for marginal benefit.
- The probes need to stay short and self-contained — anyone
  debugging an alert at 3am should be able to read one file end-to-end.

**Post-prod-deploy cleanup**: factor the Page Object classes into
`@grain/test-pages` and have both `tests/e2e/` and
`monitoring/synthetic/checks/` import from it. Until then, if
a selector changes in one place it MUST be updated in the other —
the e2e suite is canonical.

## Cost expectations

Checkly free tier ([as of 2026-05]):

- **10,000 API check runs / month** — we use ~17,500 (2 API checks
  × 2 locations × 288 runs/day × 30 days). **Over free tier by ~7.5K
  runs.** Either step API checks down to every 10 min (halves usage),
  or upgrade to the $20/mo "Hacker" plan which gives 100K runs.
- **1,500 browser check runs / month** — we use ~26,000 (3 browser
  checks × 2 locations × 288 runs/day × 30 days). **Over free tier.**
  Recommend either dropping browser cadence to every 15 min (cuts to
  ~8.6K) or starting on a paid plan.

**Recommended starting plan**: $20/mo Hacker tier, 5-min cadence on
all checks. The full P1 detection time (2 failures × 5 min) is 10
minutes — fast enough for a hackathon-grade product, well below the
free tier's effective cadence.

If you must stay free: API checks every 5 min, browser checks every
15 min. Detection time on the golden path becomes 30 min. Acceptable
for non-revenue-generating demos.

## Vendor portability

Everything except `checkly.config.ts` and the `ApiCheck` wrappers
in `api-*.ts` is vendor-neutral. To re-target:

- **Datadog Synthetics**: import the same `*.spec.ts` files as
  Browser Tests; create HTTP API tests with the same URL +
  assertions from `api-health.ts` / `api-claims.ts`.
- **GitHub Actions cron**: `.github/workflows/synthetic.yml` running
  `npx playwright test ./monitoring/synthetic/checks/*.spec.ts` on
  a `schedule:` trigger. Free; degraded UX (no per-region runners).
- **Homegrown**: a small Node script on a separate VPS that uses
  `fetch` + the inlined reference implementations in the
  `api-*.ts` files.

See `alerts.md` for the Checkly → Datadog → Pingdom concept map.
