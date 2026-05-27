import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// rateLimit holds module-level state (windows + inflight maps), so each
// test must import it fresh.
async function loadRateLimit() {
  vi.resetModules();
  return await import('../../src/lib/rateLimit.ts');
}

describe('checkRate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('happy path', () => {
    it('allows the first call and returns a release()', async () => {
      const { checkRate } = await loadRateLimit();
      const r = checkRate('1.1.1.1');
      expect(r.ok).toBe(true);
      if (r.ok) expect(typeof r.release).toBe('function');
    });

    it('decrements concurrency on release()', async () => {
      const { checkRate } = await loadRateLimit();
      const first = checkRate('ip-A');
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      first.release();
      const second = checkRate('ip-A');
      expect(second.ok).toBe(true);
    });
  });

  describe('concurrency cap', () => {
    it('blocks a second simultaneous in-flight request from the same IP', async () => {
      const { checkRate } = await loadRateLimit();
      const a = checkRate('ip-B');
      const b = checkRate('ip-B');
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(false);
      if (!b.ok) expect(b.reason).toBe('concurrency');
    });

    it('allows another request once the first releases', async () => {
      const { checkRate } = await loadRateLimit();
      const a = checkRate('ip-C');
      if (!a.ok) throw new Error('first should succeed');
      a.release();
      const b = checkRate('ip-C');
      expect(b.ok).toBe(true);
    });

    it('release() is idempotent — calling twice does not free a phantom slot', async () => {
      const { checkRate } = await loadRateLimit();
      const a = checkRate('ip-D');
      if (!a.ok) throw new Error();
      a.release();
      a.release();
      const b = checkRate('ip-D');
      const c = checkRate('ip-D');
      expect(b.ok).toBe(true);
      expect(c.ok).toBe(false);
    });

    it('isolates concurrency between different IPs', async () => {
      const { checkRate } = await loadRateLimit();
      const a = checkRate('ip-E');
      const b = checkRate('ip-F');
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
    });
  });

  describe('rate window (20/min)', () => {
    it('allows up to 20 requests within a window', async () => {
      const { checkRate } = await loadRateLimit();
      for (let i = 0; i < 20; i++) {
        const r = checkRate('ip-G');
        expect(r.ok).toBe(true);
        if (r.ok) r.release();
      }
    });

    it('rejects the 21st request with reason=rate and a retryAfterMs', async () => {
      const { checkRate } = await loadRateLimit();
      for (let i = 0; i < 20; i++) {
        const r = checkRate('ip-H');
        if (r.ok) r.release();
      }
      const blocked = checkRate('ip-H');
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.reason).toBe('rate');
        expect(blocked.retryAfterMs).toBeGreaterThan(0);
        expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
      }
    });

    it('resets after the 60s window elapses', async () => {
      const { checkRate } = await loadRateLimit();
      for (let i = 0; i < 20; i++) {
        const r = checkRate('ip-I');
        if (r.ok) r.release();
      }
      expect(checkRate('ip-I').ok).toBe(false);
      vi.advanceTimersByTime(60_000 + 1);
      const after = checkRate('ip-I');
      expect(after.ok).toBe(true);
    });

    it('keys rate limits per-IP', async () => {
      const { checkRate } = await loadRateLimit();
      for (let i = 0; i < 20; i++) {
        const r = checkRate('ip-J');
        if (r.ok) r.release();
      }
      const blockedJ = checkRate('ip-J');
      const freshK = checkRate('ip-K');
      expect(blockedJ.ok).toBe(false);
      expect(freshK.ok).toBe(true);
    });
  });

  describe('rate-vs-concurrency precedence', () => {
    it('reports rate exhaustion before concurrency once the window is full', async () => {
      const { checkRate } = await loadRateLimit();
      for (let i = 0; i < 20; i++) {
        const r = checkRate('ip-L');
        if (r.ok) r.release();
      }
      // 21st: in-flight count is 0 (all released). Either reason is valid
      // per the implementation order — but it must NOT be `ok`.
      const r = checkRate('ip-L');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('rate');
    });
  });
});

describe('getClientIp', () => {
  it('parses a single X-Forwarded-For value', async () => {
    const { getClientIp } = await loadRateLimit();
    const c = {
      req: { header: (k: string) => (k === 'x-forwarded-for' ? '5.5.5.5' : undefined) },
      env: undefined,
    } as unknown as Parameters<typeof getClientIp>[0];
    expect(getClientIp(c)).toBe('5.5.5.5');
  });

  it('takes the leftmost IP from a comma-separated XFF chain', async () => {
    const { getClientIp } = await loadRateLimit();
    const c = {
      req: {
        header: (k: string) =>
          k === 'x-forwarded-for' ? '1.2.3.4, 10.0.0.1, 192.168.1.1' : undefined,
      },
      env: undefined,
    } as unknown as Parameters<typeof getClientIp>[0];
    expect(getClientIp(c)).toBe('1.2.3.4');
  });

  it('trims whitespace from the XFF token', async () => {
    const { getClientIp } = await loadRateLimit();
    const c = {
      req: {
        header: (k: string) => (k === 'x-forwarded-for' ? '  9.9.9.9   ,1.1.1.1' : undefined),
      },
      env: undefined,
    } as unknown as Parameters<typeof getClientIp>[0];
    expect(getClientIp(c)).toBe('9.9.9.9');
  });

  it('falls back to socket.remoteAddress when XFF is absent', async () => {
    const { getClientIp } = await loadRateLimit();
    const c = {
      req: { header: () => undefined },
      env: { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
    } as unknown as Parameters<typeof getClientIp>[0];
    expect(getClientIp(c)).toBe('127.0.0.1');
  });

  it('returns "unknown" when both XFF and socket are missing', async () => {
    const { getClientIp } = await loadRateLimit();
    const c = {
      req: { header: () => undefined },
      env: undefined,
    } as unknown as Parameters<typeof getClientIp>[0];
    expect(getClientIp(c)).toBe('unknown');
  });

  it('does not treat an empty XFF header as a valid IP', async () => {
    const { getClientIp } = await loadRateLimit();
    const c = {
      req: { header: (k: string) => (k === 'x-forwarded-for' ? '' : undefined) },
      env: { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
    } as unknown as Parameters<typeof getClientIp>[0];
    expect(getClientIp(c)).toBe('127.0.0.1');
  });
});
