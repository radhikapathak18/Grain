import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Database, LogOut } from 'lucide-react';
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

  const activeProducts = availableProducts.filter((p) =>
    selectedProducts.includes(p.id),
  );
  const fullList = activeProducts.map((p) => p.displayName).join(', ');
  // M3: short form with count + tooltip so the header doesn't truncate on
  // narrow laptops. The product chip remains a link to /select.
  const productLabel =
    activeProducts.length === 1
      ? activeProducts[0]?.displayName ?? ''
      : `${activeProducts.length} products`;

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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-md focus:bg-accent focus:text-accent-fg focus:text-sm"
      >
        Skip to content
      </a>
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
              `px-3 py-1 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                isActive ? 'bg-surface text-fg' : 'text-muted hover:text-fg'
              }`
            }
          >
            Chat
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) =>
              `px-3 py-1 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 ${
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface text-xs text-fg hover:border-border-strong transition-colors"
            title={`Querying: ${fullList}`}
          >
            <Database size={12} aria-hidden="true" className="text-muted" />
            <span>
              <span className="text-muted">Querying:</span> {productLabel}
            </span>
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setRoleMenuOpen((v) => !v)}
              aria-expanded={roleMenuOpen}
              className="flex items-center gap-1 px-3 py-1 bg-surface border border-border rounded-md text-sm font-medium text-fg hover:border-border-strong transition-colors"
            >
              {ROLE_LABELS[user.role]}
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${
                  roleMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {roleMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setRoleMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-1 bg-bg border border-border rounded-md shadow-md py-1 w-36 z-20">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => pickRole(r)}
                      className={`w-full text-left px-3 py-1.5 text-sm ${
                        r === user.role
                          ? 'bg-accent-subtle text-fg font-medium'
                          : 'text-muted hover:bg-surface hover:text-fg'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-muted hover:text-fg hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40"
            title="Sign out"
          >
            <LogOut size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
