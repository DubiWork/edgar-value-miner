import PropTypes from 'prop-types';
import { useStockQuote } from '../../hooks/useStockQuote';
import './WatchlistCard.css';

// =============================================================================
// Inline formatTimeAgo (will be refactored to shared utility in integration step)
// =============================================================================

/**
 * Formats a timestamp into a human-readable relative time string.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string (e.g., "2 hours ago")
 */
function formatTimeAgo(timestamp) {
  if (!timestamp || typeof timestamp !== 'number') {
    return 'Unknown';
  }

  const now = Date.now();
  const diffMs = now - timestamp;

  if (diffMs < 0) {
    return 'Just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// =============================================================================
// Price formatting (matching CompanyBanner pattern)
// =============================================================================

/**
 * Formats a numeric price to $XXX.XX display string.
 * @param {number|null|undefined} price
 * @returns {string}
 */
function formatPrice(price) {
  if (price === null || price === undefined) {
    return '--';
  }
  if (typeof price === 'number') {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return '--';
}

/**
 * Formats a change percentage with sign and fixed decimals.
 * @param {number|null|undefined} change
 * @returns {string}
 */
function formatChange(change) {
  if (change === null || change === undefined) {
    return '--';
  }
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Determines the trend direction from a change percentage.
 * @param {number|null|undefined} change
 * @returns {'up'|'down'|'neutral'}
 */
function getTrend(change) {
  if (change === null || change === undefined || change === 0) {
    return 'neutral';
  }
  return change > 0 ? 'up' : 'down';
}

// =============================================================================
// Component
// =============================================================================

/**
 * WatchlistCard - Displays a single watchlist entry with live price data.
 *
 * Features:
 * - Fetches live stock quote via useStockQuote hook
 * - Price formatted as $XXX.XX (CompanyBanner pattern)
 * - Change percentage with green/red color coding
 * - Relative timestamp via formatTimeAgo
 * - Shimmer loading state for price area
 * - "--" fallback when price unavailable
 * - Keyboard navigable (Enter/Space)
 * - WCAG-compliant remove button (44px min touch target)
 * - Entrance animation with stagger support
 */
export function WatchlistCard({
  ticker,
  companyName,
  addedAt,
  onRemove,
  onSelect,
  style,
}) {
  const { data, loading } = useStockQuote(ticker);

  const price = data?.price ?? null;
  const change = data?.changesPercentage ?? null;
  const trend = getTrend(change);

  const handleCardClick = () => {
    onSelect(ticker);
  };

  const handleRemoveClick = () => {
    onRemove(ticker);
  };

  return (
    <div
      className="card watchlist-card"
      data-testid="watchlist-card"
      role="group"
      aria-label={`${ticker} - ${companyName}`}
      style={style}
    >
      {/* Select button wraps all card content */}
      <button
        className="watchlist-card__select"
        type="button"
        onClick={handleCardClick}
        data-testid="watchlist-card-select"
      >
        {/* Header: ticker badge and company name */}
        <div className="watchlist-card__header">
          <span className="watchlist-card__ticker" data-testid="watchlist-ticker-badge">
            {ticker}
          </span>
          <span className="watchlist-card__name" title={companyName}>
            {companyName}
          </span>
        </div>

        {/* Body: price and change */}
        <div className="watchlist-card__body">
          {loading ? (
            <div className="watchlist-card__shimmer-group" data-testid="watchlist-shimmer">
              <div className="watchlist-card__shimmer watchlist-card__shimmer--price" />
              <div className="watchlist-card__shimmer watchlist-card__shimmer--change" />
            </div>
          ) : (
            <>
              <span
                className="watchlist-card__price"
                data-testid="watchlist-price"
                aria-label={price !== null ? `Stock price ${formatPrice(price)}` : 'Price unavailable'}
              >
                {formatPrice(price)}
              </span>
              <span
                className={`watchlist-card__change watchlist-card__change--${trend}`}
                data-testid="watchlist-change"
                role="img"
                aria-label={
                  change !== null
                    ? `Change ${formatChange(change)}`
                    : 'Change unavailable'
                }
              >
                {change !== null && (
                  <span className="watchlist-card__arrow" aria-hidden="true">
                    {trend === 'up' ? '\u25B2' : trend === 'down' ? '\u25BC' : '\u2014'}
                  </span>
                )}
                {formatChange(change)}
              </span>
            </>
          )}
        </div>

        {/* Footer: timestamp */}
        <div className="watchlist-card__footer">
          <span className="watchlist-card__timestamp" data-testid="watchlist-timestamp">
            Updated {formatTimeAgo(addedAt)}
          </span>
        </div>
      </button>

      {/* Remove button — sibling of select button */}
      <button
        className="watchlist-card__remove"
        type="button"
        onClick={handleRemoveClick}
        aria-label={`Remove ${ticker} from watchlist`}
        data-testid="watchlist-remove-btn"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M1 1L13 13M1 13L13 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

WatchlistCard.propTypes = {
  /** Stock ticker symbol (e.g., "AAPL") */
  ticker: PropTypes.string.isRequired,
  /** Full company name (e.g., "Apple Inc.") */
  companyName: PropTypes.string.isRequired,
  /** Timestamp (ms) when the stock was added to watchlist */
  addedAt: PropTypes.number,
  /** Callback when remove button is clicked. Receives ticker. */
  onRemove: PropTypes.func.isRequired,
  /** Callback when card is clicked. Receives ticker. */
  onSelect: PropTypes.func.isRequired,
  /** Inline styles (e.g., for --card-index custom property) */
  style: PropTypes.object,
};

export default WatchlistCard;
