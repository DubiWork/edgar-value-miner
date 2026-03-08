import PropTypes from 'prop-types';
import './MetricCardSkeleton.css';

/**
 * MetricCardSkeleton - Loading placeholder for MetricCard.
 *
 * Renders a shimmer skeleton that matches the shape and layout
 * of the MetricCard component (title, value, trend).
 *
 * Uses the shared .card class for consistent card styling
 * and CSS-only @keyframes shimmer animation.
 * Accessible with aria-busy and role="status".
 */
export function MetricCardSkeleton({ className = '' }) {
  return (
    <div
      className={`card metric-card-skeleton ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label="Loading metric"
      data-testid="metric-card-skeleton"
    >
      <div className="metric-card-skeleton__bone metric-card-skeleton__bone--title" />
      <div className="metric-card-skeleton__bone metric-card-skeleton__bone--value" />
      <div className="metric-card-skeleton__bone metric-card-skeleton__bone--trend" />
      <span className="sr-only">Loading metric...</span>
    </div>
  );
}

MetricCardSkeleton.propTypes = {
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default MetricCardSkeleton;
