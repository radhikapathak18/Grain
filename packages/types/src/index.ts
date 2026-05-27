export const PRODUCTS = ['helix-core', 'p4v', 'helix-swarm'] as const;
export type ProductId = (typeof PRODUCTS)[number];

export type Product = {
  id: ProductId;
  displayName: string;
};

export const ROLES = ['pm', 'designer', 'engineer', 'researcher'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  pm: 'PM',
  designer: 'Designer',
  engineer: 'Engineer',
  researcher: 'Researcher',
};

export type User = {
  email: string;
  role: Role;
  products: ProductId[];
};

export const QUESTION_SHAPES = ['explore', 'verify', 'trends'] as const;
export type QuestionShape = (typeof QUESTION_SHAPES)[number];

export const QUESTION_SHAPE_LABELS: Record<QuestionShape, string> = {
  explore: 'Explore',
  verify: 'Verify',
  trends: 'See trends',
};

export type LoginRequest = {
  email: string;
  role: Role;
};

export type LoginResponse = {
  user: User;
  products: Product[];
};

export type ErrorResponse = { error: string };

export const HEALTH_OK = 'ok' as const;
export type HealthResponse = { status: typeof HEALTH_OK; service: string };

export * from './claims.ts';
export * from './chat.ts';
export * from './report.ts';
