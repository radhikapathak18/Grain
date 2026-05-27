import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS, ROLES, type Role } from '@grain/types';
import { login } from '../lib/api';
import { useSessionStore } from '../state/session';

export function LoginView() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);

  // Pre-fill Parth's email only in dev so the live demo isn't tied to one
  // person's address. Vite replaces `import.meta.env.DEV` at build time.
  const [email, setEmail] = useState(
    import.meta.env.DEV ? 'isathe@perforce.com' : '',
  );
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
    <div className="min-h-screen flex items-center justify-center p-8 bg-surface">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-bg border border-border rounded-lg p-8 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-accent text-accent-fg flex items-center justify-center font-semibold text-lg">
            G
          </div>
          <h1 className="text-2xl font-semibold text-fg">Grain</h1>
        </div>
        <p className="text-muted text-sm mb-6">
          Sign in to query Perforce customer research across products.
        </p>

        <label className="block mb-4">
          <span className="text-sm text-fg block mb-1">Work email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@perforce.com"
            className="w-full px-3 py-2 border border-border rounded-md text-fg bg-bg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="block mb-6">
          <span className="text-sm text-fg block mb-1">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full px-3 py-2 border border-border rounded-md text-fg bg-bg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div className="mb-4 text-sm text-error bg-error-bg border border-error/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-accent text-accent-fg rounded-md font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
