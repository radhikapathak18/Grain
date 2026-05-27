// In-memory per-key rate limit + concurrency cap.
//
// Compensates for the chat-stream endpoint being unauthenticated: each
// caller (keyed by IP) is allowed at most RATE_MAX requests per
// RATE_WINDOW_MS and at most CONCURRENT_MAX simultaneous in-flight
// streams. Replace with a Redis-backed implementation when the app moves
// off a single Node process.

import type { Context } from 'hono';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const CONCURRENT_MAX = 1;

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const inflight = new Map<string, number>();

export type RateCheck =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'rate' | 'concurrency'; retryAfterMs?: number };

export function checkRate(key: string): RateCheck {
  const now = Date.now();

  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + RATE_WINDOW_MS };
    windows.set(key, w);
  }
  if (w.count >= RATE_MAX) {
    return { ok: false, reason: 'rate', retryAfterMs: w.resetAt - now };
  }

  const current = inflight.get(key) ?? 0;
  if (current >= CONCURRENT_MAX) {
    return { ok: false, reason: 'concurrency' };
  }

  w.count += 1;
  inflight.set(key, current + 1);

  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      const c = inflight.get(key) ?? 0;
      if (c <= 1) inflight.delete(key);
      else inflight.set(key, c - 1);
    },
  };
}

// Best-effort client IP. Trusts X-Forwarded-For when present (frontend
// proxy / Vite dev server forwards it), else falls back to the socket
// remote address. Single-node demo only — for production behind a real
// proxy, set a trust-proxy policy and validate the header chain.
export function getClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const env = c.env as
    | { incoming?: { socket?: { remoteAddress?: string } } }
    | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
}
