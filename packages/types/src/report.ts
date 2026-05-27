import type { ProductId, AreaId } from './index.ts';

export type ReportTheme = {
  id: string;
  area: AreaId;
  title: string;
  summary: string;
  frequency: number;
  trend: 'up' | 'down' | 'flat';
  byProduct: { product: ProductId; count: number }[];
  topClaimIds: string[];
};

export type EmergingIssue = {
  id: string;
  title: string;
  summary: string;
  firstSeen: string;
  product: ProductId;
  evidence_count: number;
  severity: 'high' | 'medium' | 'low';
};

export type MonthlyReport = {
  generatedAt: string;
  periodLabel: string;
  totalClaims: number;
  totalEvidence: number;
  themes: ReportTheme[];
  emerging: EmergingIssue[];
};
