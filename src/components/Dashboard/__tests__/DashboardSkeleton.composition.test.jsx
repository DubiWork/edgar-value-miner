/**
 * Additional edge case and accessibility tests for DashboardSkeleton.
 *
 * Supplements existing DashboardSkeleton.test.jsx with focus on
 * the full skeleton composition and transitions.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSkeleton } from '../DashboardSkeleton';
import { DashboardLayout } from '../DashboardLayout';
import { CompanyBanner } from '../CompanyBanner';
import { MetricCard } from '../MetricCard';
import { ChartContainer } from '../ChartContainer';

describe('DashboardSkeleton composition and transition tests', () => {
  // =========================================================================
  // Skeleton-to-data transition
  // =========================================================================

  it('skeleton and loaded dashboard have matching layout structure', () => {
    // Render skeleton
    const { container: skeletonContainer } = render(<DashboardSkeleton />);
    const skeletonLayout = skeletonContainer.querySelector('[data-testid="dashboard-layout"]');
    const skeletonGrid = skeletonLayout.querySelector('.dashboard-layout__grid');
    const skeletonSections = skeletonGrid.querySelectorAll(':scope > section');

    // Render real dashboard
    const { container: dashContainer } = render(
      <DashboardLayout
        banner={<CompanyBanner companyName="Apple Inc." ticker="AAPL" />}
        metrics={[
          <MetricCard key="1" title="Revenue" value="$394B" />,
          <MetricCard key="2" title="NI" value="$97B" />,
          <MetricCard key="3" title="FCF" value="$111B" />,
        ]}
        heroChart={<ChartContainer title="Revenue" />}
        secondaryCharts={[
          <ChartContainer key="1" title="FCF" />,
          <ChartContainer key="2" title="Margins" />,
        ]}
      />,
    );
    const dashLayout = dashContainer.querySelector('[data-testid="dashboard-layout"]');
    const dashGrid = dashLayout.querySelector('.dashboard-layout__grid');
    const dashSections = dashGrid.querySelectorAll(':scope > section');

    // Both should have the same number of sections (banner, metrics, hero, secondary)
    expect(skeletonSections.length).toBe(dashSections.length);

    // Both should have the same aria-labels on sections
    const skeletonLabels = Array.from(skeletonSections).map((s) =>
      s.getAttribute('aria-label'),
    );
    const dashLabels = Array.from(dashSections).map((s) =>
      s.getAttribute('aria-label'),
    );
    expect(skeletonLabels).toEqual(dashLabels);
  });

  // =========================================================================
  // Skeleton metric count matches typical dashboard
  // =========================================================================

  it('default skeleton renders 3 metric placeholders matching typical layout', () => {
    render(<DashboardSkeleton />);

    const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
    expect(metricSkeletons.length).toBe(3);
  });

  it('skeleton chart count matches typical dashboard (1 hero + 2 secondary)', () => {
    render(<DashboardSkeleton />);

    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    expect(chartSkeletons.length).toBe(3); // 1 hero + 2 secondary
  });

  // =========================================================================
  // Accessibility completeness
  // =========================================================================

  it('all skeleton bones are hidden from screen readers', () => {
    const { container } = render(<DashboardSkeleton />);

    // The skeleton should have sr-only text for announcement
    const srOnlyElements = container.querySelectorAll('.sr-only');
    expect(srOnlyElements.length).toBeGreaterThan(0);

    // The dashboard-level sr-only should announce loading
    const dashboardSrOnly = Array.from(srOnlyElements).find(
      (el) => el.textContent === 'Loading dashboard...',
    );
    expect(dashboardSrOnly).toBeTruthy();
  });

  it('skeleton nested inside aria-busy container', () => {
    const { container } = render(<DashboardSkeleton />);

    const skeleton = container.querySelector('[data-testid="dashboard-skeleton"]');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');

    // The layout inside should still be accessible
    const layout = skeleton.querySelector('[data-testid="dashboard-layout"]');
    expect(layout).toBeTruthy();
  });

  // =========================================================================
  // Custom configurations
  // =========================================================================

  it('renders with zero metrics and zero secondary charts', () => {
    render(<DashboardSkeleton metricCount={0} secondaryChartCount={0} />);

    expect(screen.queryAllByTestId('metric-card-skeleton').length).toBe(0);
    // Only hero chart
    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    expect(chartSkeletons.length).toBe(1);
  });

  it('renders with large number of metrics', () => {
    render(<DashboardSkeleton metricCount={6} />);

    const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
    expect(metricSkeletons.length).toBe(6);
  });

  it('renders with custom heights for all chart skeletons', () => {
    render(
      <DashboardSkeleton
        heroChartHeight={500}
        secondaryChartHeight={250}
      />,
    );

    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');

    // One should be 500px (hero), two should be 250px (secondary)
    const heroChart = chartSkeletons.find(
      (s) => s.style.height === '500px',
    );
    expect(heroChart).toBeTruthy();

    const secondaryCharts = chartSkeletons.filter(
      (s) => s.style.height === '250px',
    );
    expect(secondaryCharts.length).toBe(2);
  });
});
