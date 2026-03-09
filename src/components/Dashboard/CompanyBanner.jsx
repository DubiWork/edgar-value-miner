import PropTypes from 'prop-types';
import { Star } from 'lucide-react';
import './CompanyBanner.css';

/**
 * CompanyBanner - Displays company name, ticker symbol, and price.
 *
 * Designed to slot into the DashboardLayout `banner` prop.
 * Uses semantic CSS variable tokens for dark/light theme support.
 *
 * Features:
 * - h1 heading for company name (correct heading hierarchy)
 * - Ticker displayed as a styled badge
 * - Price with "--" fallback when unavailable
 * - Long company names truncated with ellipsis
 * - Responsive: stacks vertically on mobile
 * - Optional star toggle for watchlist (backward compatible)
 */
export function CompanyBanner({
  companyName,
  ticker,
  price,
  isWatchlisted,
  onToggleWatchlist,
  watchlistFull,
}) {
  const hasPriceValue = price !== undefined && price !== null;

  const formattedPrice = hasPriceValue
    ? typeof price === 'number'
      ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${price}`
    : '--';

  const showWatchlistButton = typeof onToggleWatchlist === 'function';
  const isDisabled = watchlistFull && !isWatchlisted;

  return (
    <div className="company-banner" data-testid="company-banner">
      <div className="company-banner__identity">
        <h1 className="company-banner__name" title={companyName}>
          {companyName}
        </h1>
        <span className="company-banner__ticker" data-testid="ticker-badge">
          {ticker}
        </span>
      </div>
      <div className="company-banner__actions">
        <span
          className={`company-banner__price${!hasPriceValue ? ' company-banner__price--unavailable' : ''}`}
          data-testid="price-display"
          aria-label={hasPriceValue ? `Stock price ${formattedPrice}` : 'Price unavailable'}
        >
          {formattedPrice}
        </span>
        {showWatchlistButton && (
          <button
            type="button"
            className={`company-banner__watchlist-btn${isWatchlisted ? ' company-banner__watchlist-btn--active' : ''}`}
            onClick={onToggleWatchlist}
            disabled={isDisabled}
            aria-pressed={isWatchlisted}
            aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            data-testid="watchlist-toggle"
          >
            <Star
              size={20}
              fill={isWatchlisted ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </div>
  );
}

CompanyBanner.propTypes = {
  /** The full company name (e.g., "Apple Inc.") */
  companyName: PropTypes.string.isRequired,
  /** The ticker symbol (e.g., "AAPL") */
  ticker: PropTypes.string.isRequired,
  /** Current stock price. Shows "--" when undefined/null. */
  price: PropTypes.number,
  /** Whether the company is currently in the watchlist. */
  isWatchlisted: PropTypes.bool,
  /** Callback to toggle watchlist membership. Star button only renders when provided. */
  onToggleWatchlist: PropTypes.func,
  /** Whether the watchlist is at capacity (disables add when true). */
  watchlistFull: PropTypes.bool,
};

export default CompanyBanner;
