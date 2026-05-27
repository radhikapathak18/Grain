// Unit tests for apps/web/src/components/EvidencePanel.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EvidencePanel } from '../../../../apps/web/src/components/EvidencePanel.tsx';
import { useEvidencePanelStore } from '../../../../apps/web/src/state/evidencePanel.ts';
import type { Claim } from '@grain/types';

const SAMPLE_CLAIM: Claim = {
  id: 'CL-0007',
  text: 'Workspace setup blocks the first commit on every new dev.',
  product: 'p4v',
  area: 'workspace-setup',
  persona: 'developer',
  sentiment: 'negative',
  evidence: [
    {
      source_id: 'gong-001',
      source_type: 'gong',
      passage: 'I needed thirty minutes to get my first workspace.',
      source_url: 'https://example.test/gong/001',
      source_date: '2026-01-15',
      customer: 'Acme',
    },
  ],
  evidence_count: 1,
  most_recent_evidence_at: '2026-01-15',
  trust_tier: 'T2',
};

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  useEvidencePanelStore.getState().closePanel();
});

afterEach(() => {
  vi.unstubAllGlobals();
  useEvidencePanelStore.getState().closePanel();
});

function mockedFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('EvidencePanel', () => {
  it('renders nothing when no claim is open', () => {
    render(<EvidencePanel />, { wrapper: Wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mounts on openPanel and shows the claim id', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ claims: [SAMPLE_CLAIM] }),
    );

    render(<EvidencePanel />, { wrapper: Wrapper });
    act(() => useEvidencePanelStore.getState().openPanel('CL-0007'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('CL-0007')).toBeInTheDocument();
  });

  it('renders the claim text and an evidence card once data loads', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ claims: [SAMPLE_CLAIM] }),
    );
    render(<EvidencePanel />, { wrapper: Wrapper });
    act(() => useEvidencePanelStore.getState().openPanel('CL-0007'));

    expect(await screen.findByText(SAMPLE_CLAIM.text)).toBeInTheDocument();
    expect(
      screen.getByText(SAMPLE_CLAIM.evidence[0]!.passage),
    ).toBeInTheDocument();
    // Evidence section heading + source-count badge (split into two
    // elements after the panel polish — assert both rather than a combined
    // "Evidence (1)" string).
    expect(
      screen.getByRole('heading', { name: 'Evidence' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 source/)).toBeInTheDocument();
  });

  it('closes on the X button', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ claims: [SAMPLE_CLAIM] }),
    );
    render(<EvidencePanel />, { wrapper: Wrapper });
    act(() => useEvidencePanelStore.getState().openPanel('CL-0007'));

    fireEvent.click(await screen.findByLabelText('Close evidence panel'));
    expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
  });

  it('closes on Escape', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ claims: [SAMPLE_CLAIM] }),
    );
    render(<EvidencePanel />, { wrapper: Wrapper });
    act(() => useEvidencePanelStore.getState().openPanel('CL-0007'));
    await screen.findByRole('dialog');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
  });

  it('closes on the backdrop click', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ claims: [SAMPLE_CLAIM] }),
    );
    const { container } = render(<EvidencePanel />, { wrapper: Wrapper });
    act(() => useEvidencePanelStore.getState().openPanel('CL-0007'));
    await screen.findByRole('dialog');

    // The backdrop is the first fixed inset-0 div.
    const backdrop = container.querySelector(
      'div[aria-hidden="true"]',
    ) as HTMLElement | null;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
  });
});
