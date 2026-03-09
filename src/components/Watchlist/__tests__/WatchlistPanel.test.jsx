import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WatchlistPanel } from '../WatchlistPanel';

// =============================================================================
// Mock WatchlistCard (isolate WatchlistPanel logic from child dependencies)
// =============================================================================

vi.mock('../WatchlistCard', () => ({
  WatchlistCard: ({ ticker, companyName, addedAt, onRemove, onSelect, style }) => (
    <div
      data-testid="watchlist-card"
      data-ticker={ticker}
      data-company={companyName}
      data-added-at={addedAt}
      style={style}
    >
      <span>{ticker}</span>
      <span>{companyName}</span>
      <button onClick={() => onRemove(ticker)} data-testid={`remove-${ticker}`}>Remove</button>
      <button onClick={() => onSelect(ticker)} data-testid={`select-${ticker}`}>Select</button>
    </div>
  ),
}));

// =============================================================================
// Helpers
// =============================================================================

const now = Date.now();

const sampleWatchlist = [
  { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: now - 3600000 },      // 1 hour ago
  { ticker: 'MSFT', companyName: 'Microsoft Corp.', addedAt: now - 1800000 },  // 30 min ago
  { ticker: 'GOOGL', companyName: 'Alphabet Inc.', addedAt: now - 7200000 },   // 2 hours ago
];

const defaultProps = {
  watchlist: sampleWatchlist,
  onRemove: vi.fn(),
  onSelect: vi.fn(),
  isFull: false,
};

function renderPanel(overrides = {}) {
  return render(<WatchlistPanel {...defaultProps} {...overrides} />);
}

// =============================================================================
// Tests
// =============================================================================

describe('WatchlistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Returns null when watchlist is empty (section hidden)
  // =========================================================================

  it('returns null when watchlist is empty', () => {
    const { container } = renderPanel({ watchlist: [] });

    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('watchlist-panel')).toBeNull();
  });

  // =========================================================================
  // 2. Renders "Your Watchlist" heading with h2
  // =========================================================================

  it('renders "Your Watchlist" heading as h2', () => {
    renderPanel();

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Your Watchlist');
  });

  // =========================================================================
  // 3. Renders count badge showing "N/3"
  // =========================================================================

  it('renders count badge showing "N/3"', () => {
    renderPanel();

    const badge = screen.getByTestId('watchlist-count-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('3/3');
  });

  // =========================================================================
  // 4. Renders count badge for partial watchlist
  // =========================================================================

  it('renders count badge showing "1/3" for single item', () => {
    renderPanel({
      watchlist: [{ ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: now }],
    });

    const badge = screen.getByTestId('watchlist-count-badge');
    expect(badge.textContent).toBe('1/3');
  });

  // =========================================================================
  // 5. Renders correct number of WatchlistCards
  // =========================================================================

  it('renders correct number of WatchlistCards', () => {
    renderPanel();

    const cards = screen.getAllByTestId('watchlist-card');
    expect(cards.length).toBe(3);
  });

  // =========================================================================
  // 6. Cards are in most-recently-added-first order
  // =========================================================================

  it('renders cards in most-recently-added-first order', () => {
    renderPanel();

    const cards = screen.getAllByTestId('watchlist-card');
    const tickers = cards.map((card) => card.getAttribute('data-ticker'));

    // MSFT (30 min ago) > AAPL (1 hour ago) > GOOGL (2 hours ago)
    expect(tickers).toEqual(['MSFT', 'AAPL', 'GOOGL']);
  });

  // =========================================================================
  // 7. Passes onRemove through to cards
  // =========================================================================

  it('passes onRemove through to WatchlistCards', () => {
    const onRemove = vi.fn();
    renderPanel({ onRemove });

    fireEvent.click(screen.getByTestId('remove-AAPL'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('AAPL');
  });

  // =========================================================================
  // 8. Passes onSelect through to cards
  // =========================================================================

  it('passes onSelect through to WatchlistCards', () => {
    const onSelect = vi.fn();
    renderPanel({ onSelect });

    fireEvent.click(screen.getByTestId('select-MSFT'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('MSFT');
  });

  // =========================================================================
  // 9. Shows upgrade prompt when isFull=true
  // =========================================================================

  it('shows upgrade prompt when isFull is true', () => {
    renderPanel({ isFull: true });

    const prompt = screen.getByTestId('watchlist-upgrade-prompt');
    expect(prompt).toBeTruthy();
    expect(prompt.textContent).toContain(
      'Tracking 3 of 3 companies. Upgrade to Basic for up to 10 companies.'
    );
  });

  // =========================================================================
  // 10. Hides upgrade prompt when isFull=false
  // =========================================================================

  it('hides upgrade prompt when isFull is false', () => {
    renderPanel({ isFull: false });

    expect(screen.queryByTestId('watchlist-upgrade-prompt')).toBeNull();
  });

  // =========================================================================
  // 11. Section has aria-label="Your research watchlist"
  // =========================================================================

  it('has aria-label="Your research watchlist" on the section', () => {
    renderPanel();

    const section = screen.getByTestId('watchlist-panel');
    expect(section.getAttribute('aria-label')).toBe('Your research watchlist');
    expect(section.tagName.toLowerCase()).toBe('section');
  });

  // =========================================================================
  // 12. Upgrade prompt has role="status"
  // =========================================================================

  it('upgrade prompt has role="status"', () => {
    renderPanel({ isFull: true });

    const prompt = screen.getByTestId('watchlist-upgrade-prompt');
    expect(prompt.getAttribute('role')).toBe('status');
  });

  // =========================================================================
  // 13. Upgrade CTA shows "Coming soon" alert
  // =========================================================================

  it('upgrade CTA triggers "Coming soon" alert', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderPanel({ isFull: true });

    const cta = screen.getByTestId('watchlist-upgrade-cta');
    expect(cta.textContent).toBe('Upgrade to Basic');

    fireEvent.click(cta);
    expect(alertSpy).toHaveBeenCalledWith('Coming soon');

    alertSpy.mockRestore();
  });
});
