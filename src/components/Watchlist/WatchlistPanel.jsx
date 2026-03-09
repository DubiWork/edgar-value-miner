import PropTypes from 'prop-types';
import { WatchlistCard } from './WatchlistCard';
import './WatchlistPanel.css';

// =============================================================================
// Constants
// =============================================================================

/** Free-tier watchlist capacity. */
const FREE_TIER_LIMIT = 3;

// =============================================================================
// Component
// =============================================================================

/**
 * WatchlistPanel - Container that renders WatchlistCards in a responsive grid.
 *
 * Features:
 * - Hidden when watchlist is empty (returns null)
 * - "Your Watchlist" heading with count badge (N/3)
 * - Cards sorted by most-recently-added first (addedAt descending)
 * - Inline upgrade prompt when at free-tier capacity
 * - Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
 * - WCAG aria-label on section, role="status" on upgrade prompt
 */
export function WatchlistPanel({ watchlist, onRemove, onSelect, isFull = false }) {
  if (!watchlist || watchlist.length === 0) {
    return null;
  }

  // Sort cards by addedAt descending (most recently added first)
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    const timeA = a.addedAt ?? 0;
    const timeB = b.addedAt ?? 0;
    return timeB - timeA;
  });

  const handleUpgradeClick = () => {
    window.alert('Coming soon');
  };

  return (
    <section
      className="watchlist-panel"
      aria-label="Your research watchlist"
      data-testid="watchlist-panel"
    >
      {/* Header: title + count badge */}
      <div className="watchlist-panel__header">
        <h2 className="watchlist-panel__title">Your Watchlist</h2>
        <span
          className="watchlist-panel__count"
          data-testid="watchlist-count-badge"
        >
          {watchlist.length}/{FREE_TIER_LIMIT}
        </span>
      </div>

      {/* Card grid */}
      <div className="watchlist-panel__grid" data-testid="watchlist-grid">
        {sortedWatchlist.map((item, index) => (
          <WatchlistCard
            key={item.ticker}
            ticker={item.ticker}
            companyName={item.companyName}
            addedAt={item.addedAt}
            onRemove={onRemove}
            onSelect={onSelect}
            style={{ '--card-index': index }}
          />
        ))}
      </div>

      {/* Upgrade prompt (only when at capacity) */}
      {isFull && (
        <div
          className="watchlist-panel__upgrade-prompt"
          role="status"
          data-testid="watchlist-upgrade-prompt"
        >
          <p className="watchlist-panel__upgrade-text">
            Tracking {FREE_TIER_LIMIT} of {FREE_TIER_LIMIT} companies. Upgrade to Basic for up to 10 companies.
          </p>
          <button
            type="button"
            className="watchlist-panel__upgrade-link"
            onClick={handleUpgradeClick}
            data-testid="watchlist-upgrade-cta"
          >
            Upgrade to Basic
          </button>
        </div>
      )}
    </section>
  );
}

WatchlistPanel.propTypes = {
  /** Array of watchlist items */
  watchlist: PropTypes.arrayOf(
    PropTypes.shape({
      ticker: PropTypes.string.isRequired,
      companyName: PropTypes.string.isRequired,
      addedAt: PropTypes.number,
    })
  ).isRequired,
  /** Callback when a card's remove button is clicked. Receives ticker. */
  onRemove: PropTypes.func.isRequired,
  /** Callback when a card is clicked. Receives ticker. */
  onSelect: PropTypes.func.isRequired,
  /** Whether the watchlist is at free-tier capacity (3/3). */
  isFull: PropTypes.bool,
};

export default WatchlistPanel;
