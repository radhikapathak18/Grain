/**
 * Render helper that wraps components in MemoryRouter + QueryClient since
 * many of them call `useNavigate`, `useLocation`, or `useQuery` at the top
 * level and will throw outside of providers.
 *
 * Tests that need to seed Zustand state should import the store directly
 * and call `setState` BEFORE calling `renderWithProviders`.
 */
import { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Options = RenderOptions & { route?: string };

export function renderWithProviders(ui: ReactNode, opts: Options = {}) {
  const { route = '/', ...renderOpts } = opts;
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
    renderOpts,
  );
}
