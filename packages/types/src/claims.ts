import type { ProductId } from './index.ts';

export const AREAS = [
  'onboarding',
  'workspace-setup',
  'merge',
  'branching',
  'permissions',
  'cli-ergonomics',
  'performance',
  'api-integration',
] as const;
export type AreaId = (typeof AREAS)[number];

export const AREA_LABELS: Record<AreaId, string> = {
  onboarding: 'Onboarding',
  'workspace-setup': 'Workspace setup',
  merge: 'Merge',
  branching: 'Branching',
  permissions: 'Permissions',
  'cli-ergonomics': 'CLI ergonomics',
  performance: 'Performance',
  'api-integration': 'API integration',
};

export const PERSONAS = [
  'release-manager',
  'build-engineer',
  'tech-lead',
  'developer',
  'devops',
] as const;
export type PersonaId = (typeof PERSONAS)[number];

export const PERSONA_LABELS: Record<PersonaId, string> = {
  'release-manager': 'Release manager',
  'build-engineer': 'Build engineer',
  'tech-lead': 'Tech lead',
  developer: 'Developer',
  devops: 'DevOps',
};

export const SOURCE_TYPES = ['gong', 'confluence', 'slack', 'pendo', 'zoom'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export type TrustTier = 'T1' | 'T2' | 'T3';

export const SOURCE_TIER: Record<SourceType, TrustTier> = {
  zoom: 'T1',
  gong: 'T2',
  pendo: 'T2',
  confluence: 'T3',
  slack: 'T3',
};

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export type Evidence = {
  source_id: string;
  source_type: SourceType;
  passage: string;
  source_url: string;
  source_date: string; // ISO date
  customer?: string;
};

export type Claim = {
  id: string; // 'CL-0001' through 'CL-0040'
  text: string;
  product: ProductId; // SINGULAR — cross-product attribution is via shared `area`, not via multi-product claims
  area: AreaId;
  persona: PersonaId;
  sentiment: Sentiment;
  evidence: Evidence[];
  evidence_count: number;
  most_recent_evidence_at: string;
  trust_tier: TrustTier;
};
