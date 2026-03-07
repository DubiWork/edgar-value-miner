import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompanyBanner } from '../CompanyBanner';

/**
 * Helper: renders CompanyBanner with the given props.
 */
function renderBanner(props = {}) {
  const defaultProps = {
    companyName: 'Apple Inc.',
    ticker: 'AAPL',
  };
  return render(<CompanyBanner {...defaultProps} {...props} />);
}

describe('CompanyBanner', () => {
  // =========================================================================
  // Basic rendering with all props
  // =========================================================================

  it('renders with all props provided', () => {
    renderBanner({ price: 178.5 });

    expect(screen.getByTestId('company-banner')).toBeTruthy();
    expect(screen.getByText('Apple Inc.')).toBeTruthy();
    expect(screen.getByText('AAPL')).toBeTruthy();
    expect(screen.getByText('$178.50')).toBeTruthy();
  });

  it('renders company name in an h1 element', () => {
    renderBanner();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Apple Inc.');
  });

  it('renders ticker in a badge element', () => {
    renderBanner();

    const ticker = screen.getByTestId('ticker-badge');
    expect(ticker).toBeTruthy();
    expect(ticker.textContent).toBe('AAPL');
  });

  // =========================================================================
  // Price display
  // =========================================================================

  it('displays formatted price when price prop is provided', () => {
    renderBanner({ price: 178.5 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('$178.50');
  });

  it('displays price with two decimal places', () => {
    renderBanner({ price: 200 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('$200.00');
  });

  it('formats large prices with comma separators', () => {
    renderBanner({ price: 1234.56 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('$1,234.56');
  });

  it('shows "--" when price is undefined', () => {
    renderBanner();

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('--');
  });

  it('shows "--" when price is null', () => {
    renderBanner({ price: null });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('--');
  });

  it('applies unavailable modifier class when price is missing', () => {
    renderBanner();

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.className).toContain('company-banner__price--unavailable');
  });

  it('does not apply unavailable modifier class when price is present', () => {
    renderBanner({ price: 150 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.className).not.toContain('company-banner__price--unavailable');
  });

  // =========================================================================
  // Truncation of long company names
  // =========================================================================

  it('renders long company names with title attribute for tooltip', () => {
    const longName = 'Berkshire Hathaway Inc. Class A Common Stock';
    renderBanner({ companyName: longName });

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe(longName);
    expect(heading.getAttribute('title')).toBe(longName);
  });

  it('applies truncation CSS class to company name', () => {
    renderBanner({ companyName: 'A Very Long Company Name That Should Be Truncated' });

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('company-banner__name');
  });

  // =========================================================================
  // Heading hierarchy (h1)
  // =========================================================================

  it('uses exactly one h1 element', () => {
    const { container } = renderBanner();

    const headings = container.querySelectorAll('h1');
    expect(headings.length).toBe(1);
  });

  it('h1 is the company name, not the ticker or price', () => {
    renderBanner({ price: 100 });

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Apple Inc.');
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  it('has aria-label on price indicating stock price value', () => {
    renderBanner({ price: 178.5 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.getAttribute('aria-label')).toBe('Stock price $178.50');
  });

  it('has aria-label indicating price unavailable when no price', () => {
    renderBanner();

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.getAttribute('aria-label')).toBe('Price unavailable');
  });

  it('has a data-testid on the root element', () => {
    renderBanner();

    expect(screen.getByTestId('company-banner')).toBeTruthy();
  });

  // =========================================================================
  // CSS class structure
  // =========================================================================

  it('applies company-banner class to root element', () => {
    renderBanner();

    const root = screen.getByTestId('company-banner');
    expect(root.className).toContain('company-banner');
  });

  it('applies company-banner__identity class to identity wrapper', () => {
    const { container } = renderBanner();

    const identity = container.querySelector('.company-banner__identity');
    expect(identity).toBeTruthy();
  });

  it('applies company-banner__ticker class to ticker element', () => {
    renderBanner();

    const ticker = screen.getByTestId('ticker-badge');
    expect(ticker.className).toContain('company-banner__ticker');
  });

  it('applies company-banner__price class to price element', () => {
    renderBanner({ price: 100 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.className).toContain('company-banner__price');
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('handles price of 0 correctly (not treated as unavailable)', () => {
    renderBanner({ price: 0 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('$0.00');
    expect(priceEl.className).not.toContain('company-banner__price--unavailable');
  });

  it('handles very small prices', () => {
    renderBanner({ price: 0.01 });

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('$0.01');
  });

  it('renders different company names and tickers', () => {
    renderBanner({
      companyName: 'Microsoft Corporation',
      ticker: 'MSFT',
      price: 415.2,
    });

    expect(screen.getByText('Microsoft Corporation')).toBeTruthy();
    expect(screen.getByText('MSFT')).toBeTruthy();
    expect(screen.getByText('$415.20')).toBeTruthy();
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot with price', () => {
    const { container } = renderBanner({ price: 178.5 });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot without price', () => {
    const { container } = renderBanner();

    expect(container.firstChild).toMatchSnapshot();
  });
});
