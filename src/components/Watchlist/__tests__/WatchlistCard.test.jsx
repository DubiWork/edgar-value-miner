import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WatchlistCard } from '../WatchlistCard';

// =============================================================================
// Mock useStockQuote hook
// =============================================================================

const mockUseStockQuote = vi.fn();

vi.mock('../../../hooks/useStockQuote', () => ({
  useStockQuote: (...args) => mockUseStockQuote(...args),
}));

// =============================================================================
// Helpers
// =============================================================================

const defaultProps = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  addedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
  onRemove: vi.fn(),
  onSelect: vi.fn(),
};

function renderCard(overrides = {}) {
  return render(<WatchlistCard {...defaultProps} {...overrides} />);
}

// =============================================================================
// Tests
// =============================================================================

describe('WatchlistCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStockQuote.mockReturnValue({
      data: {
        price: 174.52,
        changesPercentage: 2.34,
        name: 'Apple Inc.',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  // =========================================================================
  // 1. Basic rendering: ticker badge, company name, remove button
  // =========================================================================

  it('renders ticker badge, company name, and remove button', () => {
    renderCard();

    const tickerBadge = screen.getByTestId('watchlist-ticker-badge');
    expect(tickerBadge).toBeTruthy();
    expect(tickerBadge.textContent).toBe('AAPL');

    const name = document.querySelector('.watchlist-card__name');
    expect(name).toBeTruthy();
    expect(name.textContent).toBe('Apple Inc.');

    const removeBtn = screen.getByTestId('watchlist-remove-btn');
    expect(removeBtn).toBeTruthy();
  });

  // =========================================================================
  // 2. Fetches and displays live price via useStockQuote
  // =========================================================================

  it('fetches and displays live price via useStockQuote', () => {
    renderCard();

    expect(mockUseStockQuote).toHaveBeenCalledWith('AAPL');

    const priceEl = screen.getByTestId('watchlist-price');
    expect(priceEl.textContent).toBe('$174.52');
  });

  // =========================================================================
  // 3. Shows positive change in green with up arrow
  // =========================================================================

  it('shows positive change in green with up arrow', () => {
    renderCard();

    const changeEl = screen.getByTestId('watchlist-change');
    expect(changeEl.textContent).toContain('+2.34%');
    expect(changeEl.className).toContain('watchlist-card__change--up');
    expect(changeEl.textContent).toContain('\u25B2');
  });

  // =========================================================================
  // 4. Shows negative change in red with down arrow
  // =========================================================================

  it('shows negative change in red with down arrow', () => {
    mockUseStockQuote.mockReturnValue({
      data: { price: 150.00, changesPercentage: -3.21, name: 'Apple Inc.' },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderCard();

    const changeEl = screen.getByTestId('watchlist-change');
    expect(changeEl.textContent).toContain('-3.21%');
    expect(changeEl.className).toContain('watchlist-card__change--down');
    expect(changeEl.textContent).toContain('\u25BC');
  });

  // =========================================================================
  // 5. Shows neutral state for 0% change
  // =========================================================================

  it('shows neutral state for 0% change', () => {
    mockUseStockQuote.mockReturnValue({
      data: { price: 174.52, changesPercentage: 0, name: 'Apple Inc.' },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderCard();

    const changeEl = screen.getByTestId('watchlist-change');
    expect(changeEl.textContent).toContain('0.00%');
    expect(changeEl.className).toContain('watchlist-card__change--neutral');
  });

  // =========================================================================
  // 6. Shows shimmer loading state while price fetches
  // =========================================================================

  it('shows shimmer loading state while price fetches', () => {
    mockUseStockQuote.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    renderCard();

    const shimmer = screen.getByTestId('watchlist-shimmer');
    expect(shimmer).toBeTruthy();

    const shimmerBars = shimmer.querySelectorAll('.watchlist-card__shimmer');
    expect(shimmerBars.length).toBe(2);

    // Price and change should not be rendered during loading
    expect(screen.queryByTestId('watchlist-price')).toBeNull();
    expect(screen.queryByTestId('watchlist-change')).toBeNull();
  });

  // =========================================================================
  // 7. Shows "--" when price unavailable
  // =========================================================================

  it('shows "--" when price unavailable', () => {
    mockUseStockQuote.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to fetch',
      refetch: vi.fn(),
    });

    renderCard();

    const priceEl = screen.getByTestId('watchlist-price');
    expect(priceEl.textContent).toBe('--');
    expect(priceEl.getAttribute('aria-label')).toBe('Price unavailable');
  });

  // =========================================================================
  // 8. Displays "Updated X ago" timestamp
  // =========================================================================

  it('displays "Updated X ago" timestamp', () => {
    renderCard();

    const timestamp = screen.getByTestId('watchlist-timestamp');
    expect(timestamp).toBeTruthy();
    expect(timestamp.textContent).toContain('Updated');
    expect(timestamp.textContent).toContain('ago');
  });

  // =========================================================================
  // 9. Card click calls onSelect(ticker)
  // =========================================================================

  it('card click calls onSelect(ticker)', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    const card = screen.getByTestId('watchlist-card');
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('AAPL');
  });

  // =========================================================================
  // 10. Remove button click calls onRemove(ticker) without triggering onSelect
  // =========================================================================

  it('remove button click calls onRemove(ticker) without triggering onSelect', () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    renderCard({ onRemove, onSelect });

    const removeBtn = screen.getByTestId('watchlist-remove-btn');
    fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('AAPL');
    expect(onSelect).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 11. Card is keyboard-navigable (Enter/Space)
  // =========================================================================

  it('card is keyboard-navigable with Enter and Space', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    const card = screen.getByTestId('watchlist-card');

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('AAPL');

    fireEvent.keyDown(card, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // 12. Remove button has aria-label
  // =========================================================================

  it('remove button has descriptive aria-label', () => {
    renderCard();

    const removeBtn = screen.getByTestId('watchlist-remove-btn');
    expect(removeBtn.getAttribute('aria-label')).toBe('Remove AAPL from watchlist');
  });

  // =========================================================================
  // 13. Truncates long company names with ellipsis
  // =========================================================================

  it('truncates long company names with ellipsis via CSS class', () => {
    renderCard({ companyName: 'A Very Long Company Name That Should Be Truncated With Ellipsis' });

    const nameEl = document.querySelector('.watchlist-card__name');
    expect(nameEl).toBeTruthy();
    expect(nameEl.title).toBe('A Very Long Company Name That Should Be Truncated With Ellipsis');

    // CSS-based truncation: verify the element has the BEM class that applies overflow/ellipsis
    expect(nameEl.className).toContain('watchlist-card__name');
  });

  // =========================================================================
  // 14. Hover lift effect matches MetricCard (CSS class present)
  // =========================================================================

  it('has card class for hover lift effect matching MetricCard', () => {
    renderCard();

    const card = screen.getByTestId('watchlist-card');
    expect(card.className).toContain('card');
    expect(card.className).toContain('watchlist-card');
  });

  // =========================================================================
  // 15. Handles missing addedAt gracefully
  // =========================================================================

  it('handles missing addedAt gracefully by showing "Updated Unknown"', () => {
    renderCard({ addedAt: undefined });

    const timestamp = screen.getByTestId('watchlist-timestamp');
    expect(timestamp.textContent).toBe('Updated Unknown');
  });
});
