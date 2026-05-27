// Unit tests for apps/web/src/components/CitationList.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CitationList } from '../../../../apps/web/src/components/CitationList.tsx';

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // Cards inside the list call useClaim → fetch. Stub with a pending
  // promise so the loading-state placeholder renders.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const TEN_IDS = Array.from({ length: 10 }, (_, i) => `CL-${String(i + 1).padStart(4, '0')}`);

describe('CitationList', () => {
  it('renders nothing when given an empty list', () => {
    const { container } = render(<CitationList citationIds={[]} />, {
      wrapper: Wrapper,
    });
    expect(container.firstChild).toBeNull();
  });

  it('shows the citation count in the header', () => {
    render(<CitationList citationIds={TEN_IDS} />, { wrapper: Wrapper });
    expect(screen.getByText(/Cited \(10\)/)).toBeInTheDocument();
  });

  it('shows a "Show all N" toggle when over defaultVisible', () => {
    render(<CitationList citationIds={TEN_IDS} defaultVisible={5} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByRole('button', { name: /Show all 10/ })).toBeInTheDocument();
  });

  it('hides the toggle when the count is at or below defaultVisible', () => {
    render(
      <CitationList citationIds={TEN_IDS.slice(0, 4)} defaultVisible={5} />,
      { wrapper: Wrapper },
    );
    expect(
      screen.queryByRole('button', { name: /Show all/ }),
    ).not.toBeInTheDocument();
  });

  it('expands to reveal all citations on click', () => {
    render(<CitationList citationIds={TEN_IDS} defaultVisible={3} />, {
      wrapper: Wrapper,
    });
    fireEvent.click(screen.getByRole('button', { name: /Show all 10/ }));
    expect(screen.getByRole('button', { name: /Show top 3/ })).toBeInTheDocument();
  });
});
