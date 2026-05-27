import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-accent/15"
    >
      {isDark ? (
        <Sun size={16} aria-hidden="true" />
      ) : (
        <Moon size={16} aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
