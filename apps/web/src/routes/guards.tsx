import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../state/session';

export function RequireSession() {
  const loginComplete = useSessionStore((s) => s.loginComplete);
  if (!loginComplete) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireProducts() {
  const productsConfirmed = useSessionStore((s) => s.productsConfirmed);
  const loginComplete = useSessionStore((s) => s.loginComplete);
  if (!loginComplete) return <Navigate to="/login" replace />;
  if (!productsConfirmed) return <Navigate to="/select" replace />;
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const loginComplete = useSessionStore((s) => s.loginComplete);
  const productsConfirmed = useSessionStore((s) => s.productsConfirmed);
  if (loginComplete && productsConfirmed) return <Navigate to="/chat" replace />;
  if (loginComplete) return <Navigate to="/select" replace />;
  return <Outlet />;
}
