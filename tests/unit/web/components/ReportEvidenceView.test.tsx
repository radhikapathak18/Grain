// Unit tests for apps/web/src/views/ReportEvidenceView.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ReportEvidenceView } from '../../../../apps/web/src/views/ReportEvidenceView.tsx';
import { useEvidencePanelStore } from '../../../../apps/web/src/state/evidencePanel.ts';
import type { Claim } from '@grain/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLAIMS: Claim[] = [
  {
    id: 'CL-0001',
    text: 'Workspace setup is too slow.',
    product: 'helix-core',
    area: 'onboarding',
    persona: 'release-manager',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'zoom-001',
        source_type: 'zoom',
        passage: 'Workspace took three weeks.',
        source_url: '/source/zoom-001',
        source_date: '2025-11-04',
        customer: 'Acme Corp',
      },
      {
        source_id: 'gong-001',
        source_type: 'gong',
        passage: 'The setup process was painful.',
        source_url: '/source/gong-001',
        source_date: '2025-11-10',
      },
    ],
    evidence_count: 2,
    most_recent_evidence_at: '2025-11-10',
    trust_tier: 'T1',
  },
  {
    id: 'CL-0002',
    text: 'CLI ergonomics are unintuitive.',
    product: 'p4v',
    area: 'cli-ergonomics',
    persona: 'developer',
    sentiment: 'negative',
    evidence: [
      {
        source_id: 'slack-001',
        source_type: 'slack',
        passage: 'The CLI flags are really confusing.',
        source_url: '/source/slack-001',
        source_date: '2025-10-20',
        customer: 'BetaCo',
      },
    ],
    evidence_count: 1,
    most_recent_evidence_at: '2025-10-20',
    trust_tier: 'T3',
  },
];

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/report/evidence']}>{children}</MemoryRouter>
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

describe('ReportEvidenceView', () => {
  it('renders the page heading', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Evidence items',
    );
  });

  it('shows a count badge equal to the total evidence item count across all claims', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });
    // 2 from CL-0001 + 1 from CL-0002 = 3 total.
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('groups evidence by source type and renders a section header for each group', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    // Zoom group header.
    await waitFor(() => expect(screen.getByText('Zoom interview')).toBeInTheDocument());
    // Gong group header.
    expect(screen.getByText('Gong call')).toBeInTheDocument();
    // Slack group header.
    expect(screen.getByText('Slack thread')).toBeInTheDocument();
    // Pendo and Confluence should NOT appear (no data for them).
    expect(screen.queryByText('Pendo signal')).not.toBeInTheDocument();
    expect(screen.queryByText('Confluence doc')).not.toBeInTheDocument();
  });

  it('renders each evidence passage', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    await waitFor(() => {
      expect(screen.getByText('Workspace took three weeks.')).toBeInTheDocument();
      expect(screen.getByText('The setup process was painful.')).toBeInTheDocument();
      expect(screen.getByText('The CLI flags are really confusing.')).toBeInTheDocument();
    });
  });

  it('opens EvidencePanel when a claim ID chip is clicked', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    // Wait for evidence rows to render.
    await waitFor(() => expect(screen.getAllByText('CL-0001').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByText('CL-0001')[0]!);
    expect(useEvidencePanelStore.getState().openClaimId).toBe('CL-0001');
  });

  it('shows loading skeletons while data is pending', () => {
    mockedFetch().mockReturnValue(new Promise(() => undefined));
    const { container } = render(<ReportEvidenceView />, { wrapper: Wrapper });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders a back link pointing to /report', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    const backLink = screen.getByRole('link', { name: /report/i });
    expect(backLink).toHaveAttribute('href', '/report');
  });

  it('renders customer name and date in evidence metadata when present', async () => {
    mockedFetch().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/claims/all')) return jsonResponse({ claims: CLAIMS });
      return jsonResponse({});
    });

    render(<ReportEvidenceView />, { wrapper: Wrapper });
    await screen.findByRole('heading', { level: 1 });

    // 'Acme Corp' is the customer for the zoom evidence item.
    await waitFor(() => expect(screen.getByText(/Acme Corp/)).toBeInTheDocument());
  });
});
