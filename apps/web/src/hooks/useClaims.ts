import { useQuery } from '@tanstack/react-query';
import { fetchClaims } from '../lib/api';
import type { Claim } from '@grain/types';

export function useClaims(ids: string[]) {
  return useQuery<Claim[]>({
    queryKey: ['claims', ...ids.slice().sort()],
    queryFn: () => fetchClaims(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClaim(id: string | null) {
  return useQuery<Claim | null>({
    queryKey: ['claim', id],
    queryFn: () => fetchClaims([id!]).then((arr) => arr[0] ?? null),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
