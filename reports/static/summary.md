# Static Analysis — Setup & Baseline

Agent: **static-analysis-agent** (Wave 1)
Date: 2026-05-27

## Files created / modified

Tooling configuration (root):

- `eslint.config.js` — new root flat ESLint config covering `apps/api`, `apps/web`,
  `packages/types`, `scripts/`, `tests/`. Reuses the rule set the web workspace
  already shipped with (`@eslint/js` recommended + `typescript-eslint` recommended
  + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`). React rules are
  scoped to `apps/web/**`. Test files get a relaxed override.
- `.prettierrc` — single quotes, semis, `trailingComma: all`, `printWidth: 100`,
  `endOfLine: lf`. Stable defaults that match the existing source style.
- `.prettierignore` — excludes `node_modules`, `dist`, `*.tsbuildinfo`,
  `pnpm-lock.yaml`, `reports`, `docs`, `apps/web/public`.
- `package.json` (root) — added devDeps (eslint, typescript-eslint, prettier,
  eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @eslint/js)
  and scripts:
  - `pnpm lint`        → `eslint .`
  - `pnpm lint:ci`     → `eslint . --max-warnings 0`
  - `pnpm format`      → `prettier --check .`
  - `pnpm format:write`→ `prettier --write .` (manual, intentionally not in CI)
  - `pnpm lint:strict` → `pnpm lint:ci && pnpm format && pnpm typecheck`

Removed (consolidated into the root config):

- `apps/web/eslint.config.js` — deleted. The root flat config is picked up by
  `pnpm -F @grain/web lint` via ESLint's normal upward config search, so the
  existing workspace `lint` script continues to work unchanged (verified — still
  emits the same 3 errors it did before).

No source files under `apps/`, `packages/`, or `tests/` were modified.
No tsconfigs were modified (see "Blockers" below).

## `lint:strict` behavior

Runs three gates in sequence; all three must pass:

1. `eslint . --max-warnings 0` — fails on any warning OR error.
2. `prettier --check .` — fails if any tracked file would be reformatted.
3. `pnpm typecheck` — recursive `tsc --noEmit` across the three workspaces.

Today on `dev_phase2` `lint:strict` correctly fails fast at step 1 (4 ESLint
errors). Steps 2 and 3 were run independently and their baselines are captured
in this directory.

## Baseline counts (captured to `reports/static/`)

| Tool | Result | Output |
|---|---|---|
| ESLint   | **4 errors, 0 warnings** across 4 files | `eslint-baseline.txt` |
| Prettier | **67 files** would be reformatted        | `prettier-baseline.txt` |
| `tsc`    | **0 errors** — typecheck passes clean    | `typecheck-baseline.txt` |

### ESLint errors (the full list)

1. `apps/web/src/components/EvidencePanel.tsx:29:7` — `react-hooks/set-state-in-effect`.
2. `apps/web/src/components/MessageList.tsx:47:5` — `react-hooks/set-state-in-effect`.
3. `apps/web/src/views/SourceView.tsx:197:30` — `no-useless-assignment`.
4. `tests/integration/_sse-collect.ts:25:7` — `prefer-const`.

### Prettier deltas

67 files are non-canonical. Purely stylistic drift (no semantic changes).
I did NOT run `prettier --write` — running it now would touch the entire web
codebase plus all root-level test scaffolding and would obliterate `git blame`
right before the test waves land. Recommend running it as a single, isolated,
"style: apply prettier" commit AFTER the test waves merge.

## Recommended remediation order (do NOT auto-fix yet — ranked only)

1. `tests/integration/_sse-collect.ts:25` `prefer-const` — trivial 1-line fix.
2. `apps/web/src/views/SourceView.tsx:197` `no-useless-assignment` — dead-code, cheap.
3. `apps/web/src/components/MessageList.tsx:47` set-state-in-effect — refactor
   to `useLayoutEffect` or annotate the disable; current behavior is intentional.
4. `apps/web/src/components/EvidencePanel.tsx:29` set-state-in-effect — same
   prescription; slide-in animation is intentional.
5. Prettier sweep (67 files) — execute `pnpm format:write` as one commit after
   Wave 2 lands so it does not collide with E2E/visual baselines.

## Blocker for downstream waves: `apps/web` tsconfigs do NOT extend the base

`TEST_PLAN.md` and `chat.ts` comments claim `strict` + `noUncheckedIndexedAccess`
are on. They ARE on for `apps/api` and `packages/types` (both `extends`
`tsconfig.base.json`). They are NOT on for `apps/web`:

- `apps/web/tsconfig.app.json` and `apps/web/tsconfig.node.json` do not extend
  `tsconfig.base.json`. They are self-contained, with no `"strict": true` and
  no `"noUncheckedIndexedAccess": true`.
- This means web app code (including the high-risk `useChatStream.ts`,
  `session.ts`, `guards.tsx`) is typechecked in NON-strict mode.
- Per the agent rules I did NOT modify tsconfigs. Recommendation: a follow-up
  CR that either (a) makes the two web tsconfigs `extends:
  "../../tsconfig.base.json"`, or (b) inlines `"strict": true,
  "noUncheckedIndexedAccess": true` into them. Expect a small typecheck-error
  spill in `apps/web` once enabled (unverified — `tsc` currently reports clean
  only because strict is off).

This is the only blocker. ESLint, Prettier, and the `lint:strict` gate are
ready for the cicd-agent in Wave 4 to wire into the PR workflow.

## Side notes

- I intentionally did NOT enable typescript-eslint's `recommended-type-checked`
  preset. It requires `parserOptions.projectService` and adds ~5-10s to every
  lint invocation. The file header in `eslint.config.js` documents how to flip
  it on later if a typed-rule (e.g. `no-floating-promises`) becomes desirable.
- `husky` / `lint-staged` were intentionally skipped per the prompt (CI-only for
  now). The cicd-agent owns wiring `pnpm lint:strict` into PR checks.
- `pnpm install -w` was run once to install root devDeps; `pnpm-lock.yaml` was
  regenerated. No workspace `package.json` files other than root were modified.
