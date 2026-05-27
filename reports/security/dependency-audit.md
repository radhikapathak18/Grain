# Dependency audit — `pnpm audit`

Generated: 2026-05-27 by security-audit-agent.

## How to reproduce

```bash
pnpm audit --json > reports/security/raw-pnpm-audit.json
pnpm list --depth 0 -r  > reports/security/pnpm-list.txt
pnpm outdated -r        > reports/security/pnpm-outdated.txt
```

Raw JSON output: [`raw-pnpm-audit.json`](./raw-pnpm-audit.json).

## Severity rollup

| Severity | Count |
|---|---:|
| critical | 0 |
| high     | 0 |
| moderate | 2 |
| low      | 0 |
| info     | 0 |

Total dependencies inspected: 401 (15 prod, 386 dev, 119 optional).

**Headline:** no critical or high findings. Both moderate findings are dev-only (Vite / esbuild bundled inside Vitest). Neither can reach a production build artifact because `apps/api` runs `tsx` directly and `apps/web`'s production bundle does not include the dev server.

## Findings — moderate

### 1. esbuild dev-server SSRF — `GHSA-67mh-4wv8-2f99` (CWE-346)

- **Package:** `esbuild@0.21.5` (six paths, all under `vitest > vite > esbuild`).
- **Vulnerable:** `<=0.24.2`. **Patched:** `>=0.24.3`.
- **Impact:** Any website a developer visits while `vitest --ui` / Vite dev server is running can issue requests to the dev server and read responses. Local-developer-only; not present in a deployed artifact.
- **Recommended fix:** `pnpm update vitest --recursive` (Vitest 4.x pulls in Vite 6+ which carries esbuild >= 0.24.3). Do NOT run as part of this audit.

### 2. Vite path traversal in optimized-deps `.map` handling — `GHSA-4w7w-66w2-5vf9` (CWE-22, CWE-200)

- **Package:** `vite@5.4.21` (six paths, all transitive under `vitest`).
- **Vulnerable:** `<=6.4.1`. **Patched:** `>=6.4.2`.
- **Impact:** Crafted request to a running Vite dev server can read files outside the project root via `.map` URL handling. Dev-server-only; same caveat as above.
- **Recommended fix:** same `pnpm update vitest --recursive`. Web project's direct `vite@8.0.14` is already patched — only the Vitest-bundled copy is stale.

## Top 5 critical CVEs by impact

None. There are no critical or high findings in the current lockfile.

## Outdated (informational, not vulnerable)

From `pnpm outdated -r`:

| Package | Current | Latest | Notes |
|---|---|---|---|
| `@hono/node-server` | 1.19.14 | 2.0.4   | Major bump. Review changelog before upgrade. |
| `@types/node` (dev) | 24.12.4 | 25.9.1  | Type-only. Low risk. |
| `jsdom` (dev)       | 25.0.1  | 29.1.1  | Test-only. Bundled by Vitest. |
| `vitest` (dev)      | 2.1.9   | 4.1.7   | Picking up Vite/esbuild patches — addresses both moderates above. |
| `lucide-react`      | 0.475.0 | 1.16.0  | Major; verify icon API. |

## Recommended actions (DOC ONLY — do not auto-apply)

1. `pnpm update vitest --recursive` — closes both moderates in one move (dev-only impact today, but worth keeping clean).
2. `pnpm update @hono/node-server` — production dep; review breaking changes first.
3. Wire `pnpm audit --prod --audit-level=high` into the PR workflow (see `tooling-setup.md` for the CI snippet). Production-scope audits will currently return zero findings.

## Network notes

`pnpm audit` reached the npm registry successfully (no network errors in stderr). `pnpm outdated` logged six 10–12s registry latency warnings but completed. If a future run cannot reach the registry, fall back to `pnpm list --depth 0 -r` to capture a manifest snapshot and resolve advisories from the GitHub Advisory Database manually using package@version pairs.
