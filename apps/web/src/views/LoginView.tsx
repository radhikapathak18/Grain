import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS, ROLES, type Role } from '@grain/types';
import { login } from '../lib/api';
import { useSessionStore } from '../state/session';
import { GrainLogo } from '../components/GrainLogo';
import { ThemeToggle } from '../components/ThemeToggle';

export function LoginView() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);

  // Dev-only prefill — remove before public release
  const [email, setEmail] = useState(
    import.meta.env.DEV ? 'demo@example.com' : '',
  );
  const [password, setPassword] = useState(import.meta.env.DEV ? 'demo' : '');
  const [role, setRole] = useState<Role>('researcher');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user, products } = await login({ email, role });
      setSession(user, products);
      navigate('/select');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grain-aurora min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        {/* Editorial hero — visible on large screens; hidden under the
            form on mobile so the action stays primary. */}
        <section className="hidden lg:flex flex-col gap-6 grain-fade-up">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl grain-gradient-brand text-accent-fg grain-shadow-hero">
            <span className="grain-glow-halo" aria-hidden="true" />
            <GrainLogo size={36} />
          </div>
          <h1 className="grain-display text-5xl xl:text-6xl font-semibold text-fg">
            One interface over{' '}
            <span className="grain-gradient-text">scattered research.</span>
          </h1>
          <p className="text-lg text-muted max-w-xl leading-relaxed">
            Ask in your role's language. Get attributed answers with calibrated
            trust signals across every product you work on.
          </p>
          <ul className="flex flex-wrap gap-2 mt-2">
            {[
              'Cross-product attribution',
              'Role-aware synthesis',
              'Trust signals first-class',
            ].map((label, i) => {
              const tagStyles = [
                'bg-indigo-400/20 text-indigo-600 border border-indigo-600/20 dark:bg-indigo-400/15 dark:text-indigo-400 dark:border-indigo-400/30',
                'bg-violet-500/20 text-violet-600 border border-violet-600/20 dark:bg-violet-400/15 dark:text-violet-400 dark:border-violet-400/30',
                'bg-cyan-400/20 text-cyan-600 border border-cyan-600/20 dark:bg-cyan-400/15 dark:text-cyan-400 dark:border-cyan-400/30',
              ];
              return (
                <li
                  key={label}
                  className={`grain-fade-up grain-fade-up-delay-${i + 1} text-xs font-semibold px-2 py-0.5 rounded-sm grain-shadow-card-raised ${tagStyles[i]}`}
                >
                  {label}
                </li>
              );
            })}
          </ul>
        </section>

        <form
          onSubmit={onSubmit}
          className="grain-fade-up grain-fade-up-delay-2 w-full max-w-md mx-auto lg:mx-0 grain-glass-strong rounded-2xl p-8 grain-shadow-hero"
        >
          <div className="flex items-center gap-3 mb-1 lg:hidden">
            <div className="w-11 h-11 rounded-xl bg-accent text-accent-fg flex items-center justify-center grain-shadow-soft">
              <GrainLogo size={24} />
            </div>
            <h1 className="grain-headline text-2xl font-semibold text-fg">
              Grain
            </h1>
          </div>

          <h2 className="grain-headline text-xl font-semibold text-fg mt-1">
            Sign in
          </h2>
          <p className="text-muted text-sm mt-1 mb-6">
            Query Perforce customer research across products.
          </p>

          <label className="block mb-4">
            <span className="text-xs uppercase tracking-wide text-muted block mb-1.5">
              Work email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@perforce.com"
              className="w-full px-3.5 py-2.5 border border-border rounded-lg text-fg bg-bg placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-[box-shadow,border-color] duration-150"
            />
          </label>

          <label className="block mb-1">
            <span className="text-xs uppercase tracking-wide text-muted block mb-1.5">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="demo"
              className="w-full px-3.5 py-2.5 border border-border rounded-lg text-fg bg-bg placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-[box-shadow,border-color] duration-150"
            />
          </label>
          <p className="text-xs text-subtle mb-5 mt-1.5">
            Password is ignored for the demo.
          </p>

          <label className="block mb-6">
            <span className="text-xs uppercase tracking-wide text-muted block mb-1.5">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3.5 py-2.5 border border-border rounded-lg text-fg bg-bg focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-[box-shadow,border-color] duration-150"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div className="mb-4 text-sm text-error bg-error-bg border border-error/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-fg rounded-lg font-medium grain-shadow-soft disabled:opacity-60 disabled:cursor-not-allowed transition-[background-color,transform] duration-150 active:scale-[0.99]"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
