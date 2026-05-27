import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchClaims,
  fetchMonthlyReport,
  fetchSource,
  login,
} from '../../src/lib/api';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockedFetch = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

describe('login', () => {
  it('POSTs JSON to /api/auth/login and returns the parsed body', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({
        user: { email: 'isathe@perforce.com', role: 'pm', products: ['helix-core'] },
        products: [{ id: 'helix-core', displayName: 'Helix Core' }],
      }),
    );
    const out = await login({ email: 'isathe@perforce.com', role: 'pm' });
    expect(out.user.email).toBe('isathe@perforce.com');
    expect(mockedFetch()).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );
    const call = mockedFetch().mock.calls[0]!;
    expect(JSON.parse(call[1].body)).toEqual({
      email: 'isathe@perforce.com',
      role: 'pm',
    });
  });

  it('throws with the server-supplied error message on non-2xx', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'unknown user' }, { status: 401 }),
    );
    await expect(login({ email: 'x@y.z', role: 'pm' })).rejects.toThrow('unknown user');
  });

  it('falls back to a status-based message when server returns no JSON', async () => {
    mockedFetch().mockResolvedValueOnce(
      new Response('not json', { status: 500 }),
    );
    await expect(login({ email: 'x@y.z', role: 'pm' })).rejects.toThrow(
      /request failed with status 500/,
    );
  });

  it('falls back to a status-based message when error body lacks "error" field', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ message: 'oops' }, { status: 400 }),
    );
    await expect(login({ email: 'x@y.z', role: 'pm' })).rejects.toThrow(
      /request failed with status 400/,
    );
  });
});

describe('fetchClaims', () => {
  it('returns an empty array WITHOUT calling fetch when no ids', async () => {
    const out = await fetchClaims([]);
    expect(out).toEqual([]);
    expect(mockedFetch()).not.toHaveBeenCalled();
  });

  it('encodes ids as a comma-separated query param', async () => {
    mockedFetch().mockResolvedValueOnce(jsonResponse({ claims: [] }));
    await fetchClaims(['CL-0001', 'CL-0002']);
    const url = mockedFetch().mock.calls[0]![0] as string;
    expect(url).toBe('/api/claims?ids=CL-0001%2CCL-0002');
  });

  it('returns the claims array from the response body', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ claims: [{ id: 'CL-0001' }, { id: 'CL-0002' }] }),
    );
    const out = await fetchClaims(['CL-0001', 'CL-0002']);
    expect(out.map((c) => c.id)).toEqual(['CL-0001', 'CL-0002']);
  });

  it('throws a status-coded error when the response is non-ok', async () => {
    mockedFetch().mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(fetchClaims(['CL-0001'])).rejects.toThrow(/fetchClaims failed: 500/);
  });
});

describe('fetchMonthlyReport', () => {
  it('GETs /api/reports/monthly and returns the parsed report', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({
        generatedAt: '2026-05-26T22:00:00Z',
        periodLabel: 'April 2026',
        totalClaims: 40,
        totalEvidence: 100,
        themes: [],
        emerging: [],
      }),
    );
    const out = await fetchMonthlyReport();
    expect(out.periodLabel).toBe('April 2026');
    expect(mockedFetch()).toHaveBeenCalledWith('/api/reports/monthly');
  });

  it('throws on server error', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'boom' }, { status: 500 }),
    );
    await expect(fetchMonthlyReport()).rejects.toThrow('boom');
  });
});

describe('fetchSource', () => {
  it('URL-encodes the source id (dashes, slashes, spaces)', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({
        id: 'gong-call-2025-11-04-stellar-forge',
        type: 'gong',
        title: 't',
        date: '2025-11-04',
        body: '',
        excerpts: [],
      }),
    );
    await fetchSource('gong-call/with space');
    expect(mockedFetch().mock.calls[0]![0]).toBe(
      '/api/sources/gong-call%2Fwith%20space',
    );
  });

  it('returns the parsed source on success', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({
        id: 'gong-001',
        type: 'gong',
        title: 'A call',
        date: '2026-01-01',
        body: 'transcript',
        excerpts: [{ passage: 'p', offset_hint: 'o' }],
      }),
    );
    const out = await fetchSource('gong-001');
    expect(out.id).toBe('gong-001');
    expect(out.type).toBe('gong');
  });

  it('throws "source not found" on 404', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'source not found' }, { status: 404 }),
    );
    await expect(fetchSource('nope')).rejects.toThrow('source not found');
  });
});
