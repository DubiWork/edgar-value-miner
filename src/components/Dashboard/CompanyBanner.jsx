import PropTypes from 'prop-types';
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
 */
export function CompanyBanner({ companyName, ticker, price }) {
  const hasPriceValue = price !== undefined && price !== null;

  const formattedPrice = hasPriceValue
    ? typeof price === 'number'
      ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${price}`
    : '--';

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
      <span
        className={`company-banner__price${!hasPriceValue ? ' company-banner__price--unavailable' : ''}`}
        data-testid="price-display"
        aria-label={hasPriceValue ? `Stock price ${formattedPrice}` : 'Price unavailable'}
      >
        {formattedPrice}
      </span>
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
};

export default CompanyBanner;
