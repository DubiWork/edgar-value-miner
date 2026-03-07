import PropTypes from 'prop-types';
import { ShimmerChart } from '../LoadingStates';
import './ChartContainer.css';

/**
 * ChartContainer - Fixed-height wrapper for chart sections.
 *
 * Prevents CLS (Cumulative Layout Shift) by reserving a fixed height
 * before chart data loads. Shows a shimmer placeholder during loading.
 *
 * Props:
 * - title:    Section heading displayed above the chart
 * - loading:  When true, renders ShimmerChart instead of children
 * - children: Chart content to render when not loading
 * - height:   Fixed height in pixels (default 300, 250 on mobile)
 *
 * Accessibility:
 * - aria-label derived from title for screen readers
 * - Section element for semantic structure
 */
export function ChartContainer({
  title,
  loading = false,
  children,
  height = 300,
}) {
  const ariaLabel = title ? `${title} chart` : 'Chart section';

  return (
    <section
      className="chart-container chart-container--responsive"
      style={{ height }}
      aria-label={ariaLabel}
      data-testid="chart-container"
    >
      {title && (
        <div className="chart-container__header">
          <h3 className="chart-container__title">{title}</h3>
        </div>
      )}

      <div className="chart-container__body">
        {loading ? (
          <ShimmerChart height={height - 60} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

ChartContainer.propTypes = {
  title: PropTypes.string,
  loading: PropTypes.bool,
  children: PropTypes.node,
  height: PropTypes.number,
};

export default ChartContainer;
