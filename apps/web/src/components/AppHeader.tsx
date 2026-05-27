import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Database, LogOut } from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '@grain/types';
import { useSessionStore } from '../state/session';
import { GrainLogo } from './GrainLogo';
import { ThemeToggle } from './ThemeToggle';

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
    <header className="sticky top-0 z-30 border-b border-border/70 grain-glass-strong">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-md focus:bg-accent focus:text-accent-fg focus:text-sm"
      >
        Skip to content
      </a>
      <div className="w-full px-6 py-3 flex items-center gap-4">
        <Link
          to="/chat"
          className="flex items-center gap-2.5 group focus:outline-none rounded-lg"
        >
          <div className="relative w-8 h-8 rounded-lg bg-accent text-accent-fg flex items-center justify-center grain-shadow-soft group-hover:scale-[1.04] transition-transform duration-150">
            <GrainLogo size={20} />
          </div>
          <span className="grain-headline font-semibold text-fg tracking-tight">
            Grain
          </span>
        </Link>

        <nav className="flex items-center gap-1 ml-3">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-accent/15 ${
                isActive
                  ? 'bg-accent-subtle text-accent font-semibold'
                  : 'text-muted hover:text-fg hover:bg-surface/60'
              }`
            }
          >
            Chat
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-accent/15 ${
                isActive
                  ? 'bg-accent-subtle text-accent font-semibold'
                  : 'text-muted hover:text-fg hover:bg-surface/60'
              }`
            }
          >
            Report
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            to="/select"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface/70 text-xs text-fg hover:border-accent/40 hover:bg-surface transition-all duration-150 grain-shadow-soft"
            title={`Querying: ${fullList}`}
          >
            <Database size={12} aria-hidden="true" className="text-accent" />
            <span>
              <span className="text-muted">Querying</span>
              <span className="mx-1.5 text-subtle">·</span>
              <span className="font-medium">{productLabel}</span>
            </span>
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setRoleMenuOpen((v) => !v)}
              aria-expanded={roleMenuOpen}
              className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 bg-surface/70 border border-border rounded-full text-sm font-medium text-fg hover:border-accent/40 transition-all duration-150 grain-shadow-soft cursor-pointer"
            >
              <span
                className="inline-flex w-6 h-6 rounded-full bg-accent text-accent-fg items-center justify-center text-[10px] font-semibold"
                aria-hidden="true"
              >
                {ROLE_LABELS[user.role].slice(0, 1)}
              </span>
              <span>{ROLE_LABELS[user.role]}</span>
              <ChevronDown
                size={13}
                className={`text-muted transition-transform duration-150 ${
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
                <div className="absolute right-0 top-full mt-2 grain-glass-strong rounded-xl grain-shadow-elevated py-1.5 w-44 z-20">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => pickRole(r)}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded-md mx-1 transition-colors cursor-pointer ${
                        r === user.role
                          ? 'bg-accent-subtle text-fg font-medium'
                          : 'text-muted hover:bg-surface hover:text-fg'
                      }`}
                      style={{ width: 'calc(100% - 0.5rem)' }}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <ThemeToggle />

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15"
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
