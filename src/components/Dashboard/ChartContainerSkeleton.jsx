import PropTypes from 'prop-types';
import './ChartContainerSkeleton.css';

/**
 * ChartContainerSkeleton - Loading placeholder for ChartContainer.
 *
 * Renders a shimmer skeleton that matches the shape and layout
 * of the ChartContainer component (title header + chart area).
 *
 * Prevents CLS by reserving a fixed height, same as ChartContainer.
 * Uses CSS-only @keyframes shimmer animation.
 * Accessible with aria-busy and role="status".
 *
 * @param {Object} props
 * @param {number} [props.height=300] - Fixed height in pixels
 * @param {string} [props.className] - Additional CSS classes
 */
export function ChartContainerSkeleton({ height = 300, className = '' }) {
  return (
    <div
      className={`chart-container-skeleton chart-container-skeleton--responsive ${className}`.trim()}
      style={{ height }}
      role="status"
      aria-busy="true"
      aria-label="Loading chart"
      data-testid="chart-container-skeleton"
    >
      <div className="chart-container-skeleton__header">
        <div className="chart-container-skeleton__bone chart-container-skeleton__bone--title" />
      </div>
      <div className="chart-container-skeleton__body">
        <div className="chart-container-skeleton__bone chart-container-skeleton__bone--chart" />
      </div>
      <span className="sr-only">Loading chart...</span>
    </div>
  );
}

ChartContainerSkeleton.propTypes = {
  /** Fixed height in pixels (default 300, 250 on mobile via CSS) */
  height: PropTypes.number,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default ChartContainerSkeleton;
