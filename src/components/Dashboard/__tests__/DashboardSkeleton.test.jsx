import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSkeleton } from '../DashboardSkeleton';

/**
 * Helper: renders DashboardSkeleton with the given props.
 */
function renderSkeleton(props = {}) {
  return render(<DashboardSkeleton {...props} />);
}

describe('DashboardSkeleton', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing', () => {
    renderSkeleton();

    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('renders as a div element', () => {
    renderSkeleton();

    const el = screen.getByTestId('dashboard-skeleton');
    expect(el.tagName).toBe('DIV');
  });

  it('renders the DashboardLayout inside', () => {
    renderSkeleton();

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
  });

  // =========================================================================
  // Composes all sub-skeleton components
  // =========================================================================

  it('renders a CompanyBannerSkeleton', () => {
    renderSkeleton();

    expect(screen.getByTestId('company-banner-skeleton')).toBeTruthy();
  });

  it('renders default 3 MetricCardSkeletons', () => {
    renderSkeleton();

    const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
    expect(metricSkeletons.length).toBe(3);
  });

  it('renders custom number of MetricCardSkeletons', () => {
    renderSkeleton({ metricCount: 5 });

    const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
    expect(metricSkeletons.length).toBe(5);
  });

  it('renders one hero chart skeleton plus default 2 secondary chart skeletons', () => {
    renderSkeleton();

    // 1 hero + 2 secondary = 3 total
    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    expect(chartSkeletons.length).toBe(3);
  });

  it('renders custom number of secondary chart skeletons', () => {
    renderSkeleton({ secondaryChartCount: 4 });

    // 1 hero + 4 secondary = 5 total
    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    expect(chartSkeletons.length).toBe(5);
  });

  // =========================================================================
  // Height props
  // =========================================================================

  it('applies default hero chart height of 300px', () => {
    renderSkeleton();

    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    chartSkeletons.forEach((skeleton) => {
      expect(skeleton.style.height).toBe('300px');
    });
  });

  it('applies custom hero chart height', () => {
    renderSkeleton({ heroChartHeight: 500 });

    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    const heroChart = chartSkeletons.find(
      (skeleton) => skeleton.style.height === '500px',
    );
    expect(heroChart).toBeTruthy();
  });

  it('applies custom secondary chart height', () => {
    renderSkeleton({ secondaryChartHeight: 250 });

    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    const secondaryCharts = chartSkeletons.filter(
      (skeleton) => skeleton.style.height === '250px',
    );
    expect(secondaryCharts.length).toBe(2);
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  it('has role="status" on root element', () => {
    renderSkeleton();

    const el = screen.getByTestId('dashboard-skeleton');
    expect(el.getAttribute('role')).toBe('status');
  });

  it('has aria-busy="true" on root element', () => {
    renderSkeleton();

    const el = screen.getByTestId('dashboard-skeleton');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('has aria-label describing loading state', () => {
    renderSkeleton();

    const el = screen.getByLabelText('Loading dashboard');
    expect(el).toBeTruthy();
  });

  it('has sr-only text for screen readers', () => {
    const { container } = renderSkeleton();

    const srOnlyElements = container.querySelectorAll('.sr-only');
    const dashboardSrOnly = Array.from(srOnlyElements).find(
      (el) => el.textContent === 'Loading dashboard...',
    );
    expect(dashboardSrOnly).toBeTruthy();
  });

  it('has data-testid attribute', () => {
    renderSkeleton();

    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  // =========================================================================
  // className forwarding
  // =========================================================================

  it('forwards className to DashboardLayout', () => {
    renderSkeleton({ className: 'custom-dashboard' });

    const layout = screen.getByTestId('dashboard-layout');
    expect(layout.className).toContain('custom-dashboard');
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('renders with metricCount of 0', () => {
    renderSkeleton({ metricCount: 0 });

    expect(screen.queryAllByTestId('metric-card-skeleton').length).toBe(0);
  });

  it('renders with secondaryChartCount of 0', () => {
    renderSkeleton({ secondaryChartCount: 0 });

    // Only hero chart, no secondary
    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    expect(chartSkeletons.length).toBe(1);
  });

  it('renders with metricCount of 1', () => {
    renderSkeleton({ metricCount: 1 });

    const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
    expect(metricSkeletons.length).toBe(1);
  });

  // =========================================================================
  // Does NOT render real content
  // =========================================================================

  it('does not render any real company banner content', () => {
    renderSkeleton();

    expect(screen.queryByTestId('company-banner')).toBeNull();
  });

  it('does not render any real metric card content', () => {
    renderSkeleton();

    expect(screen.queryByTestId('metric-card')).toBeNull();
  });

  it('does not render any real chart container content', () => {
    renderSkeleton();

    expect(screen.queryByTestId('chart-container')).toBeNull();
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot with default props', () => {
    const { container } = renderSkeleton();

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with custom props', () => {
    const { container } = renderSkeleton({
      metricCount: 2,
      secondaryChartCount: 1,
      heroChartHeight: 400,
      secondaryChartHeight: 250,
    });

    expect(container.firstChild).toMatchSnapshot();
  });
});
