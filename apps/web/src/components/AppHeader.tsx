import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '@grain/types';
import { useSessionStore } from '../state/session';

export function AppHeader() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const setRole = useSessionStore((s) => s.setRole);
  const availableProducts = useSessionStore((s) => s.availableProducts);
  const selectedProducts = useSessionStore((s) => s.selectedProducts);
  const reset = useSessionStore((s) => s.reset);

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  if (!user) return null;

  const productLabels = availableProducts
    .filter((p) => selectedProducts.includes(p.id))
    .map((p) => p.displayName)
    .join(', ');

  function pickRole(r: Role) {
    setRole(r);
    setRoleMenuOpen(false);
  }

  function logout() {
    reset();
    navigate('/login');
  }

  return (
    <header className="border-b border-border bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
        <Link to="/chat" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent text-accent-fg flex items-center justify-center font-semibold text-sm">
            G
          </div>
          <span className="font-semibold text-fg">Grain</span>
        </Link>

        <nav className="flex items-center gap-1 ml-2">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `px-3 py-1 rounded-md text-sm transition-colors ${
                isActive ? 'bg-surface text-fg' : 'text-muted hover:text-fg'
              }`
            }
          >
            Chat
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) =>
              `px-3 py-1 rounded-md text-sm transition-colors ${
                isActive ? 'bg-surface text-fg' : 'text-muted hover:text-fg'
              }`
            }
          >
            Report
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/select"
            className="text-xs text-muted hover:text-fg max-w-xs truncate"
            title="Change selected products"
          >
            Querying: <span className="text-fg">{productLabels}</span>
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setRoleMenuOpen((v) => !v)}
              className="flex items-center gap-1 px-3 py-1 bg-surface border border-border rounded-md text-sm font-medium text-fg hover:border-border-strong"
            >
              {ROLE_LABELS[user.role]}
              <ChevronDown size={14} />
            </button>
            {roleMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-bg border border-border rounded-md shadow-md py-1 w-32 z-10">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => pickRole(r)}
                    className={`w-full text-left px-3 py-1.5 text-sm ${
                      r === user.role
                        ? 'bg-accent-subtle text-fg'
                        : 'text-muted hover:bg-surface'
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="text-muted hover:text-fg"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
