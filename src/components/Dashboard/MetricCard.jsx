import PropTypes from 'prop-types';
import './MetricCard.css';

/**
 * Trend arrow characters and their ARIA descriptions.
 */
const TREND_CONFIG = {
  up: { symbol: '\u25B2', label: 'Trending up', className: 'metric-card__trend--up' },
  down: { symbol: '\u25BC', label: 'Trending down', className: 'metric-card__trend--down' },
  neutral: { symbol: '\u2014', label: 'No change', className: 'metric-card__trend--neutral' },
};

/**
 * Formats a display value, handling null/undefined gracefully.
 * @param {*} value - The metric value.
 * @returns {string} The formatted value or "--" placeholder.
 */
function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  return String(value);
}

/**
 * MetricCard - A reusable card that displays a single key metric.
 *
 * Features:
 * - Displays title, value with optional unit, and trend indicator
 * - Green up arrow for positive trend, red down arrow for negative
 * - Graceful handling of missing/undefined values (shows "--")
 * - Shimmer loading state
 * - Full ARIA support: heading, value, trend description
 * - Uses existing .card CSS class and semantic CSS variables
 *
 * @param {Object} props
 * @param {string} props.title - Metric label (e.g., "Revenue")
 * @param {string|number} props.value - Metric value (e.g., "$394B")
 * @param {string} [props.unit] - Optional unit label (e.g., "USD", "%")
 * @param {'up'|'down'|'neutral'} [props.trend] - Trend direction
 * @param {boolean} [props.loading=false] - Whether to show loading shimmer
 * @param {string} [props.className] - Additional CSS classes
 * @param {Object} [props.style] - Inline styles (e.g., for --card-index custom property)
 */
export function MetricCard({
  title,
  value,
  unit,
  trend,
  loading = false,
  className = '',
  style,
}) {
  if (loading) {
    return (
      <div
        className={`card metric-card metric-card--loading ${className}`.trim()}
        role="status"
        aria-label={`Loading ${title || 'metric'}`}
        data-testid="metric-card"
        style={style}
      >
        <div className="metric-card__shimmer metric-card__shimmer--title" />
        <div className="metric-card__shimmer metric-card__shimmer--value" />
        <div className="metric-card__shimmer metric-card__shimmer--trend" />
        <span className="sr-only">Loading {title || 'metric'}...</span>
      </div>
    );
  }

  const displayValue = formatValue(value);
  const trendConfig = trend ? TREND_CONFIG[trend] : null;

  // Build the accessible description for the card
  const valueDescription = unit
    ? `${displayValue} ${unit}`
    : displayValue;

  return (
    <div
      className={`card metric-card ${className}`.trim()}
      data-testid="metric-card"
      style={style}
    >
      <h3 className="metric-card__title">{title}</h3>

      <div className="metric-card__value-row">
        <span
          className="metric-card__value"
          aria-label={`Value: ${valueDescription}`}
        >
          {displayValue}
        </span>
        {unit && (
          <span className="metric-card__unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>

      {trendConfig && (
        <span
          className={`metric-card__trend ${trendConfig.className}`}
          role="img"
          aria-label={trendConfig.label}
        >
          {trendConfig.symbol}
        </span>
      )}
    </div>
  );
}

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  unit: PropTypes.string,
  trend: PropTypes.oneOf(['up', 'down', 'neutral']),
  loading: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default MetricCard;
