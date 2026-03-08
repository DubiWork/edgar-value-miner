import PropTypes from 'prop-types';
import './DashboardLayout.css';

/**
 * DashboardLayout - Main dashboard container using CSS Grid.
 *
 * Provides a responsive layout with named section slots:
 * - banner:          Full-width CompanyBanner area
 * - metrics:         Responsive grid of MetricCard components
 * - heroChart:       Full-width primary chart section
 * - secondaryCharts: 2-column grid of secondary charts
 * - valuation:       Full-width valuation section
 *
 * Breakpoints (mobile-first via DashboardLayout.css):
 * - Mobile  (< 768px):  single column, 1rem gap, compact padding
 * - Tablet  (768px+):   metrics 2-col, 1.5rem gap
 * - Desktop (1024px+):  metrics 3-col, charts 2-col
 */
export function DashboardLayout({
  banner,
  metrics,
  heroChart,
  secondaryCharts,
  valuation,
  className = '',
}) {
  const hasMetrics = Array.isArray(metrics) && metrics.length > 0;
  const hasSecondaryCharts =
    Array.isArray(secondaryCharts) && secondaryCharts.length > 0;

  return (
    <div
      className={`dashboard-layout max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`.trim()}
      data-testid="dashboard-layout"
    >
      <div className="dashboard-layout__grid">
        {/* Banner Section */}
        {banner && (
          <section aria-label="Company banner">
            {banner}
          </section>
        )}

        {/* Metrics Section */}
        {hasMetrics && (
          <section aria-label="Key metrics">
            <div className="dashboard-layout__metrics-grid">
              {metrics.map((metric, index) => (
                <article key={index} aria-label={`Metric ${index + 1}`}>
                  {metric}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Hero Chart Section */}
        {heroChart && (
          <section aria-label="Primary chart">
            {heroChart}
          </section>
        )}

        {/* Secondary Charts Section */}
        {hasSecondaryCharts && (
          <section aria-label="Secondary charts">
            <div className="dashboard-layout__charts-grid">
              {secondaryCharts.map((chart, index) => (
                <article key={index} aria-label={`Chart ${index + 1}`}>
                  {chart}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Valuation Section */}
        {valuation && (
          <section aria-label="Valuation">
            {valuation}
          </section>
        )}
      </div>
    </div>
  );
}

DashboardLayout.propTypes = {
  banner: PropTypes.node,
  metrics: PropTypes.arrayOf(PropTypes.node),
  heroChart: PropTypes.node,
  secondaryCharts: PropTypes.arrayOf(PropTypes.node),
  valuation: PropTypes.node,
  className: PropTypes.string,
};

export default DashboardLayout;
