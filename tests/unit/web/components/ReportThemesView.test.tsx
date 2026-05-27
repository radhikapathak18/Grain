// Unit tests for apps/web/src/views/ReportThemesView.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ReportThemesView } from '../../../../apps/web/src/views/ReportThemesView.tsx';
import { useEvidencePanelStore } from '../../../../apps/web/src/state/evidencePanel.ts';
import type { MonthlyReport } from '@grain/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
      byProduct: [{ product: 'helix-core', count: 8 }],
      topClaimIds: ['CL-0001'],
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
// Wrapper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/report/themes']}>{children}</MemoryRouter>
    </QueryClientProvider>
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportThemesView', () => {
  it('renders the page heading', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
      return jsonResponse({});
    });

    render(<ReportThemesView />, { wrapper: Wrapper });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Themes');
  });

  it('shows a count badge equal to the number of themes', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
      return jsonResponse({});
    });

    render(<ReportThemesView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('renders a ThemeCard for each theme', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
      return jsonResponse({});
    });

    render(<ReportThemesView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    await waitFor(() => {
      expect(screen.getByText('Onboarding takes too long')).toBeInTheDocument();
      expect(screen.getByText('Merge performance at scale')).toBeInTheDocument();
    });
  });

  it('renders the descriptive paragraph', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
      return jsonResponse({});
    });

    render(<ReportThemesView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    expect(
      screen.getByText(/Research themes synthesised from claims this period/i),
    ).toBeInTheDocument();
  });

  it('shows loading skeletons while data is pending', () => {
    mockedFetch().mockReturnValue(new Promise(() => undefined));
    const { container } = render(<ReportThemesView />, { wrapper: Wrapper });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders a back link pointing to /report', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/reports/monthly')) return jsonResponse(FIXTURE_REPORT);
      return jsonResponse({});
    });

    render(<ReportThemesView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    const backLink = screen.getByRole('link', { name: /report/i });
    expect(backLink).toHaveAttribute('href', '/report');
  });
});
