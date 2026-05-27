// Monthly report fixture. Derived at module-load time from CLAIMS so the
// numbers stay honest if the fixture changes. Cached as a single export.
//
// Strategy:
//   - Group CLAIMS by area, pick the 5 areas with the most claims, build a
//     ReportTheme for each.
//   - frequency = sum of evidence_count in the area (more interesting than
//     claim count alone — rewards areas with deep evidence trails).
//   - trend = 'up' if the area's most-recent-evidence date falls in the last
//     ~60 days, otherwise 'flat'. No 'down' in this corpus.
//   - topClaimIds = up to 4 claims in the area, ranked by evidence_count then
//     recency (matches retrieval ordering in lib/retrieval.ts).
//   - Emerging issues are hand-curated from real claims with recent evidence
//     so the demo grounds even the "emerging" section in real data.

import type {
  AreaId,
  Claim,
  EmergingIssue,
  MonthlyReport,
  ProductId,
  ReportTheme,
} from '@grain/types';
import { CLAIMS, CLAIMS_BY_ID } from './claims.ts';

const THEME_META: Record<
  AreaId,
  { title: string; summary: string } | undefined
> = {
  onboarding: {
    title: 'Onboarding friction spans every version-control surface',
    summary:
      'New-hire setup runs weeks longer than planned across Helix Core, P4V, and Swarm. The same root causes — view spec configuration, wizard density, dashboard ambiguity — recur in every product.',
  },
  merge: {
    title: 'Resolve workflows are eating release-manager time',
    summary:
      'Syntactic-vs-semantic conflict noise, slow USD diff renders, and unfilterable Swarm review queues compound on every copy-up. Release managers report losing hours per merge.',
  },
  'workspace-setup': {
    title: 'Workspace creation still traps users before their first sync',
    summary:
      'Cloud-sync directories, opaque host-mismatch errors, and the free-text view editor produce a long tail of preventable failures concentrated at first-session users.',
  },
  branching: {
    title: 'Streams power-users have routed around the GUI',
    summary:
      'Stream-graph render times push tech leads to the CLI, and Swarm cannot surface release-blocking reviews — eroding the daylight benefits of the streams model the migration was meant to deliver.',
  },
  performance: {
    title: 'Perceived performance regressions accumulate across products',
    summary:
      'Swarm file-tree renders, P4V diff panes on USD scenes, and network-drive sync overhead all surfaced this period as named blockers in customer calls.',
  },
  'cli-ergonomics': {
    title: 'CLI ergonomics remain the senior-engineer escape hatch',
    summary:
      'Inconsistent flag semantics and missing GUI equivalents keep the CLI as the path of least resistance for power users — and the source of daily questions from juniors.',
  },
  permissions: {
    title: 'Protections precedence is the recurring incident pattern',
    summary:
      'Order-of-lines surprises in the protections table produce short-window cross-project exposure incidents. Neither P4V nor the CLI surface which line denied a sync.',
  },
  'api-integration': {
    title: 'Integration surfaces are workable but not first-class',
    summary:
      'Triggers and webhooks ship the right primitives, but no JSON protections API and thin Swarm payloads force customers to build brittle text-parsing pipelines.',
  },
};

function buildThemes(claims: Claim[]): ReportTheme[] {
  // Group by area.
  const byArea = new Map<AreaId, Claim[]>();
  for (const c of claims) {
    const bucket = byArea.get(c.area) ?? [];
    bucket.push(c);
    byArea.set(c.area, bucket);
  }

  // Rank areas by total evidence_count (preferred over claim count for demo).
  const ranked = [...byArea.entries()]
    .map(([area, list]) => ({
      area,
      list,
      totalEvidence: list.reduce((s, c) => s + c.evidence_count, 0),
    }))
    .sort((a, b) => b.totalEvidence - a.totalEvidence);

  const TOP_AREAS = 5;
  const top = ranked.slice(0, TOP_AREAS);

  return top.map(({ area, list, totalEvidence }) => {
    // Per-product breakdown.
    const productCounts = new Map<ProductId, number>();
    for (const c of list) {
      productCounts.set(c.product, (productCounts.get(c.product) ?? 0) + 1);
    }
    const byProduct = [...productCounts.entries()]
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count);

    // Top claims: rank by evidence_count, then recency.
    const topClaims = [...list]
      .sort(
        (a, b) =>
          b.evidence_count - a.evidence_count ||
          b.most_recent_evidence_at.localeCompare(a.most_recent_evidence_at),
      )
      .slice(0, 4);

    // Trend: 'up' if the most-recent evidence in this area is within ~60 days
    // of the report's generatedAt, else 'flat'. (No 'down' in this corpus.)
    const mostRecent = list
      .map((c) => c.most_recent_evidence_at)
      .sort()
      .reverse()[0]!;
    const ageDays =
      (Date.parse('2026-05-26') - Date.parse(mostRecent)) /
      (1000 * 60 * 60 * 24);
    const trend: ReportTheme['trend'] = ageDays <= 90 ? 'up' : 'flat';

    const meta = THEME_META[area];
    return {
      id: `theme-${area}`,
      area,
      title: meta?.title ?? area,
      summary: meta?.summary ?? '',
      frequency: totalEvidence,
      trend,
      byProduct,
      topClaimIds: topClaims.map((c) => c.id),
    };
  });
}

function buildEmerging(): EmergingIssue[] {
  // Hand-curated, but every issue points to a real claim id whose most-recent
  // evidence falls in the last ~3 months relative to 2026-05-26.
  const seeds: {
    claimId: string;
    title: string;
    summary: string;
    severity: 'high' | 'medium' | 'low';
  }[] = [
    {
      claimId: 'CL-0023',
      title: 'Swarm 2025.4 file-tree render regression',
      summary:
        'Multiple customers independently report 8-12s file-tree render times on reviews touching cinematic streams, up from 2-3s before the 2025.4 upgrade. Security fixes block rollback.',
      severity: 'high',
    },
    {
      claimId: 'CL-0040',
      title: 'Review-queue overhead eclipsing review-UX complaints',
      summary:
        'Release managers across film and games customers describe queue management — priority, ownership, blocker visibility — as a larger productivity drag than the review UI itself.',
      severity: 'medium',
    },
    {
      claimId: 'CL-0011',
      title: 'Resolve-dialog re-open rate up 6pp QoQ in P4V',
      summary:
        'Pendo shows 14% of monthly P4V users re-opening the resolve dialog 8+ times per session, strongly correlated with merge changelists over 50 files. Concentrated among tech leads.',
      severity: 'medium',
    },
    {
      claimId: 'CL-0014',
      title: 'Release-blocking Swarm reviews stuck behind unrelated work',
      summary:
        'Authors cannot mark a Swarm review release-critical in a way reviewers see. Release-eng team at Stellar Forge reports the queue is now the gating step for three releases in a row.',
      severity: 'high',
    },
    {
      claimId: 'CL-0030',
      title: 'P4V wizard abandonment skews to artist cohort (47%)',
      summary:
        'The artist / IC non-engineering cohort abandons the P4V workspace wizard at 47%, versus 41% overall. Concentrated at film and games customers where artists are the largest seat group.',
      severity: 'low',
    },
  ];

  return seeds.map((seed, i) => {
    const claim = CLAIMS_BY_ID[seed.claimId];
    if (!claim) {
      throw new Error(`reports.ts: unknown claim id ${seed.claimId}`);
    }
    return {
      id: `emerging-${(i + 1).toString().padStart(2, '0')}`,
      title: seed.title,
      summary: seed.summary,
      firstSeen: claim.evidence
        .map((e) => e.source_date)
        .sort()[0]!,
      product: claim.product,
      evidence_count: claim.evidence_count,
      severity: seed.severity,
    };
  });
}

function buildReport(): MonthlyReport {
  const themes = buildThemes(CLAIMS);
  const totalEvidence = CLAIMS.reduce((s, c) => s + c.evidence_count, 0);
  return {
    generatedAt: '2026-05-26T22:00:00Z',
    periodLabel: 'April 2026',
    totalClaims: CLAIMS.length,
    totalEvidence,
    themes,
    emerging: buildEmerging(),
  };
}

export const MONTHLY_REPORT: MonthlyReport = buildReport();
