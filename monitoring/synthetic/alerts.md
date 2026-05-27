# Grain synthetic alerts — thresholds & routing

Per-check configuration. All values match `checkly.config.ts` and the
individual probe files under `./checks/`.

## Global defaults

- **Frequency**: every 5 minutes
- **Locations**: `us-east-1` + `eu-west-1` (cross-region to catch
  regional outages independently of app failure)
- **Failure threshold**: 2 consecutive failures before alerting
  (absorbs single-flap noise from cold-start, transient TLS handshake
  drops, CDN re-routes)
- **Reminder cadence**: none — one alert per incident; ack required
- **Alert channels**:
  - Slack: `$GRAIN_ALERT_SLACK_WEBHOOK` (incoming webhook URL,
    routes to the on-call channel)
  - Email: `$GRAIN_ALERT_EMAIL` (rotation alias —
    e.g. `oncall@grain.example.com`)

The two env vars above MUST be set in the Checkly project's
Environment Variables panel before any check is "activated".

---

## Browser checks

### `login-and-ask.spec.ts` — top-priority check

| Field | Value |
|---|---|
| Frequency | every 5 min |
| Locations | `us-east-1`, `eu-west-1` |
| Failure threshold | 2 consecutive failures |
| Timeout | 60s (full SSE stream wait) |
| SLA | **99% uptime** (browser flow + Claude CLI dependency) |
| Severity | P1 — pages on-call |

Why P1: this is the only check that exercises the Claude CLI
subprocess on the production server. A failure here means either
the binary is gone, the model id is deprecated, or the API key
has rotated — none of which any other monitor detects.

### `report-view.spec.ts`

| Field | Value |
|---|---|
| Frequency | every 5 min |
| Locations | `us-east-1`, `eu-west-1` |
| Failure threshold | 2 consecutive failures |
| Timeout | 30s |
| SLA | **99% uptime** |
| Severity | P2 — Slack-only, no page |

### `source-detail.spec.ts`

| Field | Value |
|---|---|
| Frequency | every 5 min |
| Locations | `us-east-1`, `eu-west-1` |
| Failure threshold | 2 consecutive failures |
| Timeout | 30s |
| SLA | **99% uptime** |
| Severity | P2 — Slack-only |

---

## API checks

### `api-health.ts` — fastest signal

| Field | Value |
|---|---|
| Frequency | every 5 min |
| Locations | `us-east-1`, `eu-west-1` |
| Failure threshold | 2 consecutive failures |
| Response time | degraded > 500ms, fail > 1000ms |
| SLA | **99.5% uptime** (highest — this should always be green) |
| Severity | P1 — pages on-call |

### `api-claims.ts`

| Field | Value |
|---|---|
| Frequency | every 5 min |
| Locations | `us-east-1`, `eu-west-1` |
| Failure threshold | 2 consecutive failures |
| Response time | degraded > 800ms, fail > 2000ms |
| SLA | **99.5% uptime** |
| Severity | P1 — pages on-call (a green-/api/health + red-/api/claims combination almost always means fixture schema drift after a bad deploy) |

---

## Maintenance windows

When a deploy is in progress, pause the synthetic project via the
Checkly API or UI for the deploy window. Alternative: bump the
"failure threshold" temporarily from 2 → 4 to absorb the rolling
restart blip.

Recommended deploy hook (post-prod-deploy work):
1. CI deploy job pauses checks via `checkly trigger --pause`.
2. Smoke deploy.
3. Run `checkly test` from CI to confirm probes still pass.
4. Re-enable checks.

## Cross-vendor mapping

If you migrate off Checkly:

| Checkly concept | Datadog Synthetics equivalent | Pingdom equivalent |
|---|---|---|
| Browser check (Playwright) | Browser test (script) | Transaction check |
| API check | HTTP API test | Uptime / transaction check |
| Multi-location | "Public locations" multi-select | "Probe servers" |
| Failure threshold | "Alert after N failures" | "Sensitivity" knob |
| Alert channel = Slack webhook | Monitor notification → Slack integration | Integration → Slack |

The probe SCRIPTS (`./checks/*.spec.ts`) port directly to Datadog
because both run `@playwright/test`. The Checkly-specific shape
lives entirely in `checkly.config.ts` and the `ApiCheck` wrappers
in `api-*.ts`.
