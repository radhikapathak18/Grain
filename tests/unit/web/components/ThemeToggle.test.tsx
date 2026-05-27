// Unit tests for apps/web/src/components/ThemeToggle.tsx
// and the useTheme hook it depends on.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeToggle } from '../../../../apps/web/src/components/ThemeToggle.tsx';

// JSDOM does not implement window.matchMedia. Install a minimal stub so the
// hook's SSR-safe guard passes cleanly and returns 'light' by default.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Reset the dark class on <html> and localStorage before each test so state
// from one test cannot bleed into the next.
beforeEach(() => {
  document.documentElement.classList.remove('dark');
  localStorage.clear();
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('renders a button with aria-label "Switch to dark mode" in light mode (default)', () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    ).toBeInTheDocument();
  });

  it('does not apply the dark class to <html> on first render when localStorage has no preference', () => {
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies the dark class and updates aria-label after one click', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: 'Switch to dark mode' });
    fireEvent.click(btn);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    ).toBeInTheDocument();
  });

  it('removes the dark class and restores light aria-label after a second click', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: 'Switch to dark mode' });

    fireEvent.click(btn); // → dark
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' })); // → light

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    ).toBeInTheDocument();
  });

  it('persists "dark" to localStorage after toggling to dark', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem('grain-theme')).toBe('dark');
  });

  it('persists "light" to localStorage after toggling back to light', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' })); // → dark
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' })); // → light
    expect(localStorage.getItem('grain-theme')).toBe('light');
  });

  it('initialises to dark when localStorage has "dark" stored', async () => {
    localStorage.setItem('grain-theme', 'dark');
    await act(async () => {
      render(<ThemeToggle />);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    ).toBeInTheDocument();
  });

  it('initialises to light when localStorage has "light" stored', async () => {
    localStorage.setItem('grain-theme', 'light');
    await act(async () => {
      render(<ThemeToggle />);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    ).toBeInTheDocument();
  });
});
