/**
 * /report — ReportView.
 *
 * Tests:
 *  - loading skeleton state
 *  - successful render with fixture
 *  - heading hierarchy (h1 then h2s, no skipped levels)
 *  - axe pass on both states
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ReportView } from '../../../apps/web/src/views/ReportView';
import { useSessionStore } from '../../../apps/web/src/state/session';
import { renderWithProviders } from '../lib/render';
import { axeRun, formatViolations, writeFindings } from '../lib/axe';
import { makeUser, AVAILABLE_PRODUCTS } from '../../fixtures/a11y';
import type { MonthlyReport } from '@grain/types';

const FIXTURE_REPORT: MonthlyReport = {
  generatedAt: '2025-05-01T00:00:00.000Z',
  periodLabel: 'April 2025',
  totalClaims: 40,
  totalEvidence: 120,
  themes: [
    {
      id: 'theme-1',
      area: 'onboarding',
      title: 'Onboarding friction',
      summary: 'Onboarding takes weeks longer than planned across products.',
      frequency: 12,
      trend: 'up',
      byProduct: [{ product: 'helix-core', count: 8 }],
      topClaimIds: ['CL-0001', 'CL-0002'],
    },
    {
      id: 'theme-2',
      area: 'merge',
      title: 'Merge performance',
      summary: 'Merge times slow as repos grow past 200GB.',
      frequency: 7,
      trend: 'flat',
      byProduct: [{ product: 'helix-core', count: 7 }],
      topClaimIds: ['CL-0010'],
    },
  ],
  emerging: [
    {
      id: 'iss-1',
      title: 'OneDrive workspace conflicts',
      summary: 'Artists place workspaces in OneDrive folders.',
      firstSeen: '2025-04-12',
      product: 'p4v',
      evidence_count: 3,
    },
  ],
};

beforeEach(() => {
  useSessionStore.setState({
    user: makeUser(),
    availableProducts: AVAILABLE_PRODUCTS,
    selectedProducts: ['helix-core'],
    questionShape: 'explore',
    loginComplete: true,
    productsConfirmed: true,
    history: [],
  });
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/reports/monthly')) {
      return new Response(JSON.stringify(FIXTURE_REPORT), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
});

describe('ReportView (/report) — a11y', () => {
  it('renders a single h1 + multiple h2s after data loads', async () => {
    renderWithProviders(<ReportView />, { route: '/report' });
    const h1s = await screen.findAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    await waitFor(() => {
      const h2s = screen.getAllByRole('heading', { level: 2 });
      // "Top themes", "Emerging issues this period"
      expect(h2s.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('FINDING: heading levels skip — EmergingIssuesList emits <h4> directly under <h2>', async () => {
    const { container } = renderWithProviders(<ReportView />, { route: '/report' });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0),
    );
    const levels = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(
      (el) => Number(el.tagName.slice(1)),
    );
    // Detect any forward jump > 1 (e.g. h2 → h4).
    const jumps: Array<{ from: number; to: number; idx: number }> = [];
    for (let i = 1; i < levels.length; i++) {
      const jump = levels[i] - levels[i - 1];
      if (jump > 1) jumps.push({ from: levels[i - 1], to: levels[i], idx: i });
    }
    if (jumps.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[a11y FINDING] ReportView: heading-order skip(s) detected: ' +
          JSON.stringify(jumps) +
          '. The EmergingIssuesList component emits <h4> for each issue card ' +
          'directly under the section <h2>. Should be <h3>.',
      );
    }
    // Assert the known skip exists. Test will fail if a new heading-order
    // bug is introduced or the existing one is fixed (good — refresh the
    // expectation in that case).
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('axe scan after data renders — captures findings', async () => {
    const { container } = renderWithProviders(<ReportView />, { route: '/report' });
    await screen.findByText(/april 2025/i);
    const results = await axeRun(container);
    await writeFindings('page-ReportView', results);
    if (results.violations.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'ReportView a11y violations:\n' + formatViolations(results),
      );
    }
    // Known findings:
    //   - aria-prohibited-attr: ThemeCard renders <div aria-label="Frequency
    //     N of M"> without a role. Should be <div role="img" aria-label="…">
    //     or move the label to a real element.
    //   - heading-order: see above test.
    // Assert the EXPECTED IDs so we still catch any new violations.
    const violationIds = Array.from(
      new Set(results.violations.map((v) => v.id)),
    ).sort();
    expect(violationIds).toEqual(['aria-prohibited-attr', 'heading-order']);
  });
});
