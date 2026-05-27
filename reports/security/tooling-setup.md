# Security tooling — config snippets (manual runs only)

This file documents recommended scanner configs. **Nothing here was executed against the running app**; each tool has the one-line how-to-run plus where the output should be written. Operators should run these manually in their dev environments or attach them to a CI workflow as the orchestrator schedules.

None of these tools were detected on the audit host (`gitleaks`, `trivy`, `zap.sh`, `snyk` — all `command not found`). Install via `brew install trivy gitleaks && brew install --cask zap` (or container images), or pull each as a one-off via `docker run`.

---

## 1. Trivy — filesystem vuln + secret scan

Trivy can scan the workspace's `package.json` / `pnpm-lock.yaml` for known CVEs as a second opinion against `pnpm audit`, and bundles a secret detector (gitleaks-derived rules) in the same pass.

**Install:** `brew install trivy` (macOS), or `docker pull aquasec/trivy:latest`.

**Run (high/critical only, lockfile + secrets):**

```bash
trivy fs \
  --severity HIGH,CRITICAL \
  --scanners vuln,secret \
  --format json \
  --output reports/security/trivy-fs.json \
  --skip-dirs node_modules \
  --skip-dirs .git \
  .
```

Optional human-readable summary:

```bash
trivy fs --severity HIGH,CRITICAL --skip-dirs node_modules . | tee reports/security/trivy-fs.txt
```

Where output goes: `reports/security/trivy-fs.json` (machine), `reports/security/trivy-fs.txt` (human).

What to do with results: triage HIGH/CRITICAL only — any LOW/MEDIUM from Trivy's lockfile mode duplicates what `pnpm audit` already reports.

---

## 2. gitleaks — secret-scan of git history

`pnpm audit` does not look at git history. `gitleaks` walks every commit and matches against a default ruleset (API keys, JWTs, private keys) plus any custom rules.

**Install:** `brew install gitleaks` or `docker pull zricethezav/gitleaks:latest`.

**Config file (`reports/security/gitleaks.toml`):**

```toml
title = "Grain repo gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Known-safe matches: hackathon demo password and Claude CLI references."
regexes = [
  '''Login password:\s*`demo`''',
  '''password\s*"demo"''',
  '''Password is ignored for the demo\.''',
  '''CLAUDE_BIN=''',
]
paths = [
  '''(?i)/?node_modules/''',
  '''(?i)/?pnpm-lock\.yaml$''',
]
```

**Run:**

```bash
gitleaks detect \
  --source . \
  --config reports/security/gitleaks.toml \
  --report-format json \
  --report-path reports/security/gitleaks.json \
  --no-banner
```

Where output goes: `reports/security/gitleaks.json` (always written, even on clean repos). Exit code 1 means findings present.

What to do with results: any non-allowlisted hit is a real concern. See `secrets-scan.md` for the current grep-based pre-audit (negative).

---

## 3. OWASP ZAP — baseline scan (manual only; DO NOT run in CI)

The orchestrator hard-rules this audit out of running ZAP. The script below is for an operator who:
- has the API and web running locally (`pnpm dev`),
- is explicitly authorized to scan their own dev box,
- wants a baseline security report against the SSE endpoint, auth route, and source route.

**Install:** `brew install --cask zap`, or pull `softwaresecurityproject/zap-stable`.

**Script (`scripts/security/zap-baseline.sh` — NOT created by this audit, for reference only):**

```bash
#!/usr/bin/env bash
# Run from repo root AFTER `pnpm dev` is up on localhost:5173/3001.
# Manual only — do not wire into CI without explicit auth from infra.

set -euo pipefail

TARGET=${TARGET:-http://localhost:3001}
OUT=reports/security/zap-baseline.html

docker run --rm \
  --network host \
  -v "$(pwd)/reports/security:/zap/wrk:rw" \
  softwaresecurityproject/zap-stable \
  zap-baseline.py \
    -t "$TARGET" \
    -r "zap-baseline.html" \
    -m 5 \
    -I            # ignore informational findings
```

Where output goes: `reports/security/zap-baseline.html`.

What to do with results: review WARN-level findings around CORS, missing security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`), and any reflected-input warnings on `/api/chat/stream`.

---

## 4. Snyk — config snippet (no token required to *write* the config)

Snyk is a managed-service option; this snippet documents the config you would commit if your org standardized on it. `snyk auth` and a free or paid account are required to RUN, but no token is needed to write the config.

**Config file (`.snyk` at repo root, NOT created by this audit):**

```yaml
version: v1.25.0
language-settings:
  javascript:
    packageManager: pnpm

ignore:
  # Dev-only Vite/esbuild moderates already tracked in dependency-audit.md.
  # Re-evaluate after `pnpm update vitest --recursive`.
  SNYK-JS-ESBUILD-8027233:
    - '*':
        reason: Dev-only path; remediation tracked in reports/security/dependency-audit.md
        expires: 2026-09-01
  SNYK-JS-VITE-9489624:
    - '*':
        reason: Dev-only path; remediation tracked in reports/security/dependency-audit.md
        expires: 2026-09-01

exclude:
  global:
    - node_modules/**
    - apps/**/dist/**
    - reports/**
```

**Run:**

```bash
snyk auth                                           # one-time, opens browser
snyk test --all-projects --severity-threshold=high \
  --json-file-output=reports/security/snyk.json
```

Where output goes: `reports/security/snyk.json`.

What to do with results: cross-reference HIGH/CRITICAL against `dependency-audit.md`. Snyk's advisory feed is independent of npm's, so it occasionally catches issues `pnpm audit` doesn't.
