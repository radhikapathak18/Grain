import type { Product } from '@grain/types';

export const PRODUCTS: Product[] = [
  { id: 'helix-core', displayName: 'Helix Core' },
  { id: 'p4v', displayName: 'P4V' },
  { id: 'helix-swarm', displayName: 'P4 Code Review (Helix Swarm)' },
];

export const PRODUCT_BY_ID = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p]),
) as Record<Product['id'], Product>;
