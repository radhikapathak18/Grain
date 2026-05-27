import type {
  Claim,
  LoginRequest,
  LoginResponse,
  MonthlyReport,
} from '@grain/types';

export type SourceDocument = {
  id: string;
  type: 'gong' | 'confluence' | 'slack' | 'pendo' | 'zoom';
  title: string;
  date: string;
  customer?: string;
  participants?: string[];
  body: string;
  excerpts: { passage: string; offset_hint: string }[];
  // When true, no full anonymized document exists for this source_id —
  // only the cited passages. SourceView renders a source-type specific
  // placeholder notice instead of a body / "full transcript" block.
  placeholder?: boolean;
};

async function jsonOr<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return jsonOr<LoginResponse>(res);
}

export async function fetchClaims(ids: string[]): Promise<Claim[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.join(',') });
  const res = await fetch(`/api/claims?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`fetchClaims failed: ${res.status}`);
  }
  const data = (await res.json()) as { claims: Claim[] };
  return data.claims;
}

export async function fetchMonthlyReport(): Promise<MonthlyReport> {
  const res = await fetch('/api/reports/monthly');
  return jsonOr<MonthlyReport>(res);
}

export async function fetchSource(id: string): Promise<SourceDocument> {
  const res = await fetch(`/api/sources/${encodeURIComponent(id)}`);
  return jsonOr<SourceDocument>(res);
}
