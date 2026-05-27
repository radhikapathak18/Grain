// Plain-English status strings rendered above the in-progress assistant
// bubble. Lifted out of the route so the strings stay independently
// testable and the route stays a thin controller.

import type { AreaId, Claim, Product, Role, StatusStep } from '@grain/types';
import { ROLE_LABELS } from '@grain/types';

function formatAreaList(claims: Claim[]): string {
  const counts = new Map<AreaId, number>();
  for (const c of claims) counts.set(c.area, (counts.get(c.area) ?? 0) + 1);
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area.replace(/-/g, ' '));
  if (sorted.length === 0) return '';
  if (sorted.length <= 3) return sorted.join(', ');
  const overflow = sorted.length - 3;
  return `${sorted.slice(0, 3).join(', ')}, and ${overflow} more area${overflow === 1 ? '' : 's'}`;
}

export function searchingStatus(products: Product[]): StatusStep {
  const names = products.map((p) => p.displayName).join(', ');
  return {
    phase: 'searching',
    message: `Searching customer research across ${names}…`,
  };
}

export function retrievedStatus(claims: Claim[]): StatusStep {
  const areaList = formatAreaList(claims);
  const claimLabel = `${claims.length} claim${claims.length === 1 ? '' : 's'}`;
  return {
    phase: 'retrieved',
    message: areaList
      ? `Found ${claimLabel} spanning ${areaList}.`
      : `Found ${claimLabel}.`,
  };
}

export function synthesizingStatus(role: Role): StatusStep {
  return {
    phase: 'synthesizing',
    message: `Synthesizing answer for a ${ROLE_LABELS[role]} audience…`,
  };
}
