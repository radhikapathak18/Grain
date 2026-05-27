// Unit tests for apps/web/src/components/CitationChip.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CitationChip } from '../../../../apps/web/src/components/CitationChip.tsx';
import { useEvidencePanelStore } from '../../../../apps/web/src/state/evidencePanel.ts';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  useEvidencePanelStore.getState().closePanel();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockedFetch() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe('CitationChip', () => {
  it('renders the claim id even before the claim has loaded', () => {
    // Never resolve the fetch — chip should still show the id.
    mockedFetch().mockReturnValue(new Promise(() => {}));
    render(<CitationChip claimId="CL-0007" />, { wrapper: makeWrapper() });
    expect(screen.getByText('CL-0007')).toBeInTheDocument();
  });

  it('opens the evidence panel on click', () => {
    mockedFetch().mockReturnValue(new Promise(() => {}));
    render(<CitationChip claimId="CL-0042" />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByRole('button'));
    expect(useEvidencePanelStore.getState().openClaimId).toBe('CL-0042');
  });

  it('renders the first 5 words of the claim text once loaded', async () => {
    mockedFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          claims: [
            {
              id: 'CL-0001',
              text: 'Workspace setup blocks the first commit on every new dev.',
              product: 'p4v',
              area: 'workspace-setup',
              persona: 'developer',
              sentiment: 'negative',
              evidence: [],
              evidence_count: 1,
              most_recent_evidence_at: '2026-01-01',
              trust_tier: 'T2',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    render(<CitationChip claimId="CL-0001" />, { wrapper: makeWrapper() });
    // The first five words (joined with '…') should appear.
    expect(
      await screen.findByText('Workspace setup blocks the first…'),
    ).toBeInTheDocument();
  });
});
