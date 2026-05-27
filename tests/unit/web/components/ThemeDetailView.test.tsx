// Unit tests for apps/web/src/views/ThemeDetailView.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeDetailView } from '../../../../apps/web/src/views/ThemeDetailView.tsx';
import { useEvidencePanelStore } from '../../../../apps/web/src/state/evidencePanel.ts';
import type { Claim, MonthlyReport } from '@grain/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeClaim(overrides: Partial<Claim>): Claim {
  return {
    id: 'CL-0001',
    text: 'Default claim text.',
    product: 'helix-core',
    area: 'onboarding',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [],
    evidence_count: 0,
    most_recent_evidence_at: '2025-01-01',
    trust_tier: 'T3',
    ...overrides,
  };
}

const CLAIMS: Claim[] = [
  makeClaim({ id: 'CL-0001', text: 'Workspace setup is too slow.', product: 'helix-core', evidence_count: 5 }),
  makeClaim({ id: 'CL-0002', text: 'CLI ergonomics are unintuitive.', product: 'p4v', evidence_count: 3 }),
];

const FIXTURE_REPORT: MonthlyReport = {
  generatedAt: '2025-05-01T00:00:00.000Z',
  periodLabel: 'April 2025',
  totalClaims: 40,
  totalEvidence: 120,
  themes: [
    {
      id: 'theme-1',
      area: 'onboarding',
      title: 'Onboarding takes too long',
      summary: 'Onboarding is consistently called out as friction-heavy.',
      frequency: 12,
      trend: 'up',
      byProduct: [
        { product: 'helix-core', count: 8 },
        { product: 'p4v', count: 4 },
      ],
      topClaimIds: ['CL-0001', 'CL-0002'],
    },
    {
      id: 'theme-2',
      area: 'performance',
      title: 'Merge performance at scale',
      summary: 'Merge times slow at 200GB+.',
      frequency: 7,
      trend: 'flat',
      byProduct: [{ product: 'helix-core', count: 7 }],
      topClaimIds: [],
    },
  ],
  emerging: [],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

// Mounts the view inside a real Route with :id so useParams() works correctly.
function renderView(initialPath: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/report/themes/:id" element={<ThemeDetailView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  useEvidencePanelStore.getState().closePanel();
});

afterEach(() => {
  vi.unstubAllGlobals();
  useEvidencePanelStore.getState().closePanel();
  vi.restoreAllMocks();
});

function mockedFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function setupFetch() {
  mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
    if (url.includes('/api/claims')) return jsonResponse({ claims: CLAIMS });
    return jsonResponse({});
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThemeDetailView', () => {
  it('renders the theme title as the page heading', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Onboarding takes too long',
    );
  });

  it('renders the theme summary', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(
        screen.getByText(/Onboarding is consistently called out as friction-heavy/i),
      ).toBeInTheDocument(),
    );
  });

  it('renders a back link pointing to /report/themes', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    // Back link is present immediately — no need to wait for heading.
    const backLink = screen.getByRole('link', { name: /themes/i });
    expect(backLink).toHaveAttribute('href', '/report/themes');
  });

  it('renders product filter chips derived from theme.byProduct', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Helix Core' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'P4V' })).toBeInTheDocument();
    });
  });

  it('shows all-claims count badge', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('filters claims when a product chip is clicked', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'P4V' })).toBeInTheDocument(),
    );

    // Click P4V — only CL-0002 matches, count becomes 1.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'P4V' })));
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('shows empty state when filter produces no results', async () => {
    // Claims endpoint returns only a helix-core claim; the P4V chip still
    // appears (driven by byProduct), but clicking it yields zero results.
    const helixOnlyClaims = [
      makeClaim({ id: 'CL-0001', product: 'helix-core', evidence_count: 5 }),
    ];
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
      if (url.includes('/api/claims')) return jsonResponse({ claims: helixOnlyClaims });
      return jsonResponse({});
    });

    renderView('/report/themes/theme-1');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'P4V' })).toBeInTheDocument(),
    );

    act(() => fireEvent.click(screen.getByRole('button', { name: 'P4V' })));
    await waitFor(() =>
      expect(screen.getByText(/No claims match this filter/i)).toBeInTheDocument(),
    );
  });

  it('shows loading skeletons while data is pending', () => {
    mockedFetch().mockReturnValue(new Promise(() => undefined));
    const { container } = renderView('/report/themes/theme-1');
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
  });

  it('shows theme-not-found message for an unknown id', async () => {
    setupFetch();
    renderView('/report/themes/unknown-id');
    await waitFor(() =>
      expect(screen.getByText(/Theme not found/i)).toBeInTheDocument(),
    );
  });

  it('renders the trend badge for an up-trending theme', async () => {
    setupFetch();
    renderView('/report/themes/theme-1');
    await screen.findByRole('heading', { level: 1 });
    // theme-1 has trend: 'up'
    await waitFor(() => expect(screen.getByText('up')).toBeInTheDocument());
  });

  it('renders the trend badge for a flat theme', async () => {
    setupFetch();
    renderView('/report/themes/theme-2');
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(screen.getByText('flat')).toBeInTheDocument());
  });
});
