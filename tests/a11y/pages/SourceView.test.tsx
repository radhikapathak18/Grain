/**
 * /source/:id — SourceView.
 *
 * Three variants tested:
 *  - gong (full transcript with excerpts)
 *  - slack (full thread with excerpts)
 *  - placeholder (zoom, no body — only excerpts)
 *
 * a11y contract:
 *  - one h1 (the title), h2s for sub-sections
 *  - <blockquote> + <ul>/<li> for excerpt list (semantic)
 *  - <mark> elements get associated ids for deep-linking
 *  - Back button is a real button with accessible name
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { SourceView } from '../../../apps/web/src/views/SourceView';
import { useSessionStore } from '../../../apps/web/src/state/session';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations, writeFindings } from '../lib/axe';
import { makeUser, AVAILABLE_PRODUCTS } from '../../fixtures/a11y';
import type { SourceDocument } from '../../../apps/web/src/lib/api';

const GONG_DOC: SourceDocument = {
  id: 'gong-call-2025-11-04-stellar-forge',
  type: 'gong',
  title: 'Stellar Forge Games — Helix Core onboarding review',
  date: '2025-11-04',
  customer: 'Stellar Forge Games',
  participants: ['Mara Voss (Stellar Forge)', 'Erik Lindgren (Perforce)'],
  body: 'Mara Voss: Yeah, honestly the onboarding for our two new studios took almost three weeks longer than we planned.',
  excerpts: [
    {
      passage: 'the onboarding for our two new studios took almost three weeks longer than we planned',
      offset_hint: '0:18',
    },
  ],
};

const SLACK_DOC: SourceDocument = {
  id: 'slack-perforce-customer-channel-week-44',
  type: 'slack',
  title: '#perforce-customers — week 44',
  date: '2025-10-31',
  body: 'mara.voss: every artist needs their own view spec — this should not be 2025-state',
  excerpts: [
    { passage: 'every artist needs their own view spec', offset_hint: 'msg-1' },
  ],
};

const ZOOM_PLACEHOLDER: SourceDocument = {
  id: 'zoom-research-interview-2025-10-research-2',
  type: 'zoom',
  title: 'Research interview 2 (anonymized)',
  date: '2025-10-22',
  body: '',
  excerpts: [
    { passage: 'It took us three weeks longer.', offset_hint: 'interview-1' },
  ],
  placeholder: true,
};

function stubFetchForSource(doc: SourceDocument) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes(`/api/sources/${encodeURIComponent(doc.id)}`)) {
      return new Response(JSON.stringify(doc), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  useSessionStore.setState({
    user: makeUser(),
    availableProducts: AVAILABLE_PRODUCTS,
    selectedProducts: ['helix-core'],
    questionShape: 'explore',
    loginComplete: true,
    productsConfirmed: true,
    history: [],
  });
});

function renderAt(doc: SourceDocument) {
  return renderWithProviders(
    <Routes>
      <Route path="/source/:id" element={<SourceView />} />
    </Routes>,
    { route: `/source/${doc.id}` },
  );
}

describe('SourceView — gong variant — a11y', () => {
  beforeEach(() => stubFetchForSource(GONG_DOC));

  it('renders the title as h1', async () => {
    renderAt(GONG_DOC);
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/stellar forge/i);
  });

  it('Back button has accessible name', async () => {
    renderAt(GONG_DOC);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('button', { name: /back/i }).length).toBeGreaterThan(0);
  });

  it('axe scan — captures findings', async () => {
    const { container } = renderAt(GONG_DOC);
    await screen.findAllByText(/stellar forge/i);
    await waitFor(() => expect(screen.queryAllByText(/onboarding/i).length).toBeGreaterThan(0));
    const results = await axeRun(container);
    await writeFindings('page-SourceView-gong', results);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'SourceView [gong] a11y violations:\n' + formatViolations(results),
      );
    }
    // Known FINDING: SourceContent renders its title inside a bare <header>
    // sibling to AppHeader's <header>. Axe reports two banner landmarks
    // (landmark-no-duplicate-banner + landmark-unique). Should be a
    // <section> or have aria-labelledby/role override.
    const violationIds = Array.from(
      new Set(results.violations.map((v) => v.id)),
    ).sort();
    expect(violationIds).toEqual(
      expect.arrayContaining(['landmark-no-duplicate-banner']),
    );
  });
});

describe('SourceView — slack variant — a11y', () => {
  beforeEach(() => stubFetchForSource(SLACK_DOC));

  it('renders slack title', async () => {
    renderAt(SLACK_DOC);
    expect(await screen.findByText(/perforce-customers/i)).toBeInTheDocument();
  });

  it('axe scan — captures findings', async () => {
    const { container } = renderAt(SLACK_DOC);
    await screen.findByText(/perforce-customers/i);
    const results = await axeRun(container);
    await writeFindings('page-SourceView-slack', results);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'SourceView [slack] a11y violations:\n' + formatViolations(results),
      );
    }
    const violationIds = Array.from(
      new Set(results.violations.map((v) => v.id)),
    ).sort();
    expect(violationIds).toEqual(
      expect.arrayContaining(['landmark-no-duplicate-banner']),
    );
  });
});

describe('SourceView — zoom placeholder variant — a11y', () => {
  beforeEach(() => stubFetchForSource(ZOOM_PLACEHOLDER));

  it('placeholder doc renders the notice instead of a fake transcript', async () => {
    renderAt(ZOOM_PLACEHOLDER);
    await screen.findByText(/research interview 2/i);
    expect(screen.getByText(/research interview transcript/i)).toBeInTheDocument();
  });

  it('axe scan: placeholder — captures findings', async () => {
    const { container } = renderAt(ZOOM_PLACEHOLDER);
    await screen.findByText(/research interview 2/i);
    const results = await axeRun(container);
    await writeFindings('page-SourceView-placeholder', results);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'SourceView [placeholder] a11y violations:\n' + formatViolations(results),
      );
    }
    const violationIds = Array.from(
      new Set(results.violations.map((v) => v.id)),
    ).sort();
    expect(violationIds).toEqual(
      expect.arrayContaining(['landmark-no-duplicate-banner']),
    );
  });
});
