import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Product, User } from '@grain/types';
import {
  RequireSession,
  RequireProducts,
  RedirectIfAuthed,
} from '../../src/routes/guards';
import { useSessionStore } from '../../src/state/session';

const USER: User = {
  email: 'isathe@perforce.com',
  role: 'pm',
  products: ['helix-core', 'p4v', 'helix-swarm'],
};

const PRODUCTS: Product[] = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

function withRouter(initial: string, element: React.ReactNode) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/select" element={<div>SELECT_PAGE</div>} />
        <Route path="/chat" element={<div>CHAT_PAGE</div>} />
        <Route element={element}>
          <Route path="/guarded" element={<div>GUARDED_CONTENT</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

afterEach(() => {
  useSessionStore.getState().reset();
});

describe('<RequireSession />', () => {
  it('redirects to /login when not authenticated', () => {
    render(withRouter('/guarded', <RequireSession />));
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('GUARDED_CONTENT')).not.toBeInTheDocument();
  });

  it('renders the outlet when loginComplete is true', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    render(withRouter('/guarded', <RequireSession />));
    expect(screen.getByText('GUARDED_CONTENT')).toBeInTheDocument();
  });
});

describe('<RequireProducts />', () => {
  it('redirects to /login when not authenticated', () => {
    render(withRouter('/guarded', <RequireProducts />));
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
  });

  it('redirects to /select when authed but products not confirmed', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    render(withRouter('/guarded', <RequireProducts />));
    expect(screen.getByText('SELECT_PAGE')).toBeInTheDocument();
  });

  it('renders the outlet when both gates pass', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    render(withRouter('/guarded', <RequireProducts />));
    expect(screen.getByText('GUARDED_CONTENT')).toBeInTheDocument();
  });
});

describe('<RedirectIfAuthed />', () => {
  it('renders the outlet (e.g. the /login page) when fully unauthenticated', () => {
    render(withRouter('/guarded', <RedirectIfAuthed />));
    expect(screen.getByText('GUARDED_CONTENT')).toBeInTheDocument();
  });

  it('redirects to /select when logged in but products not confirmed', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    render(withRouter('/guarded', <RedirectIfAuthed />));
    expect(screen.getByText('SELECT_PAGE')).toBeInTheDocument();
  });

  it('redirects to /chat when fully authed and products confirmed', () => {
    useSessionStore.getState().setSession(USER, PRODUCTS);
    useSessionStore.getState().confirmProducts();
    render(withRouter('/guarded', <RedirectIfAuthed />));
    expect(screen.getByText('CHAT_PAGE')).toBeInTheDocument();
  });
});
