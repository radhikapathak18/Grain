# Accessibility test suite — summary

Wave 1 deliverable from the **accessibility-agent**. Audit run on 2026-05-27
against `apps/web` source on branch `dev_phase2`.

## Approach

**Component- and page-level axe scans in jsdom (vitest), plus a Playwright
scaffold for browser-only checks.** I chose both layers because:

- **Vitest + `vitest-axe` + `axe-core`** is fast, deterministic, and already
  matches the existing `apps/web` test infrastructure. It covers semantic
  ARIA, landmark structure, accessible names, role validity, heading order,
  and prohibited-attribute rules — the bulk of WCAG 2.1 A/AA.
- **jsdom cannot evaluate Tailwind-generated computed styles**, so axe's
  `color-contrast` rule is unreliable here. I disabled it in the shared
  runner (`tests/a11y/lib/axe.ts`) and scaffolded **`@axe-core/playwright`**
  to run the same rule set in a real chromium against each of the five
  routes — that's where contrast violations will surface.

The Playwright config (`tests/a11y/playwright.config.ts`) plus the mock API
(`tests/a11y/playwright/api-mock.mjs`) are in place but **chromium is NOT
pre-installed** in this session per the orchestrator's instruction. To
activate:

    pnpm --filter @grain/tests-a11y exec playwright install chromium
    pnpm --filter @grain/tests-a11y test:pw

## Test inventory

| Layer | File | Tests | Status |
|---|---|---:|---|
| Component | components/CitationChip.test.tsx | 4 | PASS |
| Component | components/MessageInput.test.tsx | 3 | PASS |
| Component | components/QuestionShapeSelector.test.tsx | 3 | PASS |
| Component | components/AppHeader.test.tsx | 5 | PASS |
| Component | components/MessageBubble.test.tsx | 7 | PASS |
| Component | components/EvidencePanel.test.tsx | 7 | PASS (1 documents known violation) |
| Page (jsdom) | pages/LoginView.test.tsx | 5 | PASS |
| Page (jsdom) | pages/ProductSelectView.test.tsx | 5 | PASS |
| Page (jsdom) | pages/ChatView.test.tsx | 6 | PASS (1 documents missing live region) |
| Page (jsdom) | pages/ReportView.test.tsx | 3 | PASS (2 document known violations) |
| Page (jsdom) | pages/SourceView.test.tsx | 7 | PASS (3 document known violations) |
| Keyboard | keyboard/LoginKeyboard.test.tsx | 2 | PASS |
| Keyboard | keyboard/EvidencePanelKeyboard.test.tsx | 2 | PASS |
| Page (browser, scaffold only) | playwright/routes.a11y.spec.ts | 8 | NOT RUN (needs `playwright install chromium`) |

**Totals (vitest layer):** 13 files, **59 tests, 0 failures.**

Tests that hit a real a11y bug do NOT pass silently — they assert the
*expected violation ID set* so the suite will fail if the bug is fixed
(prompting an expectation update) OR if a new violation is introduced.

## Findings (axe violations + manual checks)

Raw axe JSON reports are written to
`tests/a11y/findings/<label>.json` on every run that yields violations.

### Critical / serious

1. **ReportView — `aria-prohibited-attr` (serious, WCAG 4.1.2)** —
   `ThemeCard` renders `<div class="flex gap-[2px]" aria-label="Frequency N
   of 20">` with no `role`. `aria-label` is prohibited on a bare `<div>`.
   Fix: add `role="img"` (it's a sparkline-style visual), or move the label.
   Source: `apps/web/src/components/ThemeCard.tsx`.
   Artifact: `findings/page-ReportView.json`.

### Moderate

2. **SourceView (all variants) — `landmark-no-duplicate-banner` +
   `landmark-unique` (moderate, WCAG 1.3.1 best-practice)** —
   `SourceContent` renders a bare `<header>` for the source title that
   becomes a second top-level banner landmark sibling to `AppHeader`'s
   `<header>`. Two banners is invalid; both also lack an `aria-label`.
   Fix options: change the inner `<header>` to a `<section>` with
   `aria-labelledby`, add `role="presentation"`, or wrap inside `<main>`.
   Source: `apps/web/src/views/SourceView.tsx` (lines 323-342).
   Artifacts: `findings/page-SourceView-{gong,slack,placeholder}.json`.

3. **EvidencePanel — `aria-allowed-role` (minor → effectively moderate
   for AT users, WCAG 4.1.2)** —
   `<aside role="dialog" aria-modal="true">` — `role="dialog"` is not in
   the allowed-role list for `<aside>`. Some screen readers fall back to
   treating it as a complementary landmark.
   Fix: change `<aside>` to `<div role="dialog">`, or move the role to a
   child element.
   Source: `apps/web/src/components/EvidencePanel.tsx` (line 78).
   Artifact: `findings/component-EvidencePanel.json`.

### Heading order

4. **ReportView — `heading-order` (moderate)** —
   `EmergingIssuesList` renders `<h4>` per emerging-issue card, sitting
   directly under the parent section's `<h2>`. Skipped `<h3>`.
   Fix: change `<h4>` → `<h3>` (or restructure to introduce an
   intermediate `<h3>`).
   Source: `apps/web/src/components/EmergingIssuesList.tsx`.
   Artifact: `findings/page-ReportView.json`.

### Dialog pattern gaps (manual, not catchable by axe alone)

5. **EvidencePanel — focus is NOT moved into the dialog on open, and
   focus is NOT trapped (WCAG 2.4.3, APG dialog pattern).**
   Pressing Tab inside the open panel will eventually escape to elements
   underneath the modal. `aria-modal="true"` is declared but no
   focus-management code is present.
   Fix: focus the close button on open; install a focus trap.
   Documented in `components/EvidencePanel.test.tsx` and
   `keyboard/EvidencePanelKeyboard.test.tsx`.

### Streaming UX

6. **ChatView — no `aria-live` region wraps the assistant message stream
   (WCAG 4.1.3 Status Messages).**
   Screen-reader users will not hear streamed tokens or the synthesis
   "status trail". Fix: add `role="log"` or `aria-live="polite"` to
   `MessageList` (or to the assistant bubble while streaming).
   Documented in `pages/ChatView.test.tsx`.

### Non-findings (worth noting as confirmations)

- `AppHeader` ships a working skip-to-content link (`href="#main"`); the
  main views all set `id="main"` on `<main>`. Verified.
- `ProductSelectView` correctly uses `role="checkbox"` + `aria-checked`
  with a `role="group" aria-label="Products"` wrapper.
- `QuestionShapeSelector` uses `role="tablist"` / `role="tab"` with
  `aria-selected` (note: no associated `role="tabpanel"`, unconventional
  but not an axe failure here).
- All icon-only buttons (`CitationChip`, copy, ask-again, panel close,
  sign-out) have `aria-label` or visible text.
- Login form fields use implicit `<label>` wrapping; `email` has
  `type="email" required`.

## Top 5 issues to fix (priority order)

1. **ReportView `aria-prohibited-attr` on ThemeCard frequency bar** —
   serious, single-file fix.
2. **SourceView double-banner** — moderate, two-line fix, affects every
   source detail page.
3. **EvidencePanel `<aside role="dialog">` mismatch** — single-line fix;
   blocks AT recognition of the modal.
4. **EvidencePanel focus management** — bigger lift but mandatory for any
   keyboard-only user. Add focus-on-open + focus-trap + focus-restore.
5. **ChatView aria-live region on streaming output** — critical for
   screen-reader-driven demos; without it the streaming UX is invisible
   to AT.

## Required next steps

- **Install Playwright browsers** in CI (and locally) before
  `routes.a11y.spec.ts` can run:
  `pnpm --filter @grain/tests-a11y exec playwright install chromium`.
  Once installed, the page-level scans add **color-contrast** coverage
  (jsdom cannot do this) and validate the findings above against the real
  rendered DOM, including Tailwind-applied styles.
- **Wire `@grain/tests-a11y` into CI** alongside the existing per-workspace
  test runs. Suggested command for the CICD agent (Wave 4):
  `pnpm --filter @grain/tests-a11y test`.
- **Decide on fix vs. defer for the Top-5** — this agent only documents;
  the source-mod fixes belong to a separate PR.

## Files created

    tests/a11y/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── playwright.config.ts
    ├── setup.ts
    ├── summary.md                 ← this file
    ├── lib/
    │   ├── axe.ts                 ← shared axe runner + findings writer
    │   └── render.tsx             ← MemoryRouter + QueryClient wrapper
    ├── components/
    │   ├── AppHeader.test.tsx
    │   ├── CitationChip.test.tsx
    │   ├── EvidencePanel.test.tsx
    │   ├── MessageBubble.test.tsx
    │   ├── MessageInput.test.tsx
    │   └── QuestionShapeSelector.test.tsx
    ├── pages/
    │   ├── ChatView.test.tsx
    │   ├── LoginView.test.tsx
    │   ├── ProductSelectView.test.tsx
    │   ├── ReportView.test.tsx
    │   └── SourceView.test.tsx
    ├── keyboard/
    │   ├── EvidencePanelKeyboard.test.tsx
    │   └── LoginKeyboard.test.tsx
    ├── playwright/
    │   ├── api-mock.mjs           ← Hono-shaped mock for browser scans
    │   └── routes.a11y.spec.ts    ← 8 page-level scans (chromium)
    └── findings/                  ← axe violation JSON, written on each run
        ├── component-EvidencePanel.json
        ├── page-ReportView.json
        ├── page-SourceView-gong.json
        ├── page-SourceView-slack.json
        └── page-SourceView-placeholder.json

    tests/fixtures/
    └── a11y.ts                    ← shared user / message / claim builders

Workspace additions:

- Added `tests/a11y` to `pnpm-workspace.yaml`.
- New package `@grain/tests-a11y` (private workspace project).

No source modifications under `apps/` or `packages/`.
