import PropTypes from 'prop-types';
import { DashboardLayout } from './DashboardLayout';
import { CompanyBannerSkeleton } from './CompanyBannerSkeleton';
import { MetricCardSkeleton } from './MetricCardSkeleton';
import { ChartContainerSkeleton } from './ChartContainerSkeleton';

/**
 * Default number of metric card skeletons to display.
 */
const DEFAULT_METRIC_COUNT = 3;

/**
 * Default number of secondary chart skeletons to display.
 */
const DEFAULT_SECONDARY_CHART_COUNT = 2;

/**
 * DashboardSkeleton - Full dashboard loading placeholder.
 *
 * Composes all individual skeleton components into the DashboardLayout,
 * providing a complete loading state that matches the shape of the
 * populated dashboard.
 *
 * Props:
 * - metricCount:         Number of MetricCardSkeleton to show (default 3)
 * - secondaryChartCount: Number of secondary ChartContainerSkeleton (default 2)
 * - heroChartHeight:     Height for the hero chart skeleton (default 300)
 * - secondaryChartHeight: Height for secondary chart skeletons (default 300)
 *
 * Accessibility:
 * - Root div has aria-busy="true" and role="status"
 * - Screen reader text announces loading state
 */
export function DashboardSkeleton({
  metricCount = DEFAULT_METRIC_COUNT,
  secondaryChartCount = DEFAULT_SECONDARY_CHART_COUNT,
  heroChartHeight = 300,
  secondaryChartHeight = 300,
  className = '',
}) {
  const metricSkeletons = Array.from({ length: metricCount }, (_, i) => (
    <MetricCardSkeleton key={`metric-skeleton-${i}`} />
  ));

  const secondaryChartSkeletons = Array.from(
    { length: secondaryChartCount },
    (_, i) => (
      <ChartContainerSkeleton
        key={`chart-skeleton-${i}`}
        height={secondaryChartHeight}
      />
    ),
  );

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
      data-testid="dashboard-skeleton"
    >
      <DashboardLayout
        className={className}
        banner={<CompanyBannerSkeleton />}
        metrics={metricSkeletons}
        heroChart={<ChartContainerSkeleton height={heroChartHeight} />}
        secondaryCharts={secondaryChartSkeletons}
      />
      <span className="sr-only">Loading dashboard...</span>
    </div>
  );
}

DashboardSkeleton.propTypes = {
  /** Number of metric card skeletons to display */
  metricCount: PropTypes.number,
  /** Number of secondary chart skeletons to display */
  secondaryChartCount: PropTypes.number,
  /** Height for the hero chart skeleton in pixels */
  heroChartHeight: PropTypes.number,
  /** Height for secondary chart skeletons in pixels */
  secondaryChartHeight: PropTypes.number,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default DashboardSkeleton;
