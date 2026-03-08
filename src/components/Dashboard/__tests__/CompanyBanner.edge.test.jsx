/**
 * Additional edge case tests for CompanyBanner component.
 *
 * Supplements the existing CompanyBanner.test.jsx with edge cases
 * from the test plan that weren't covered.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompanyBanner } from '../CompanyBanner';

describe('CompanyBanner edge cases', () => {
  // =========================================================================
  // Very long company names
  // =========================================================================

  it('handles extremely long company names (75+ chars)', () => {
    const longName =
      'The Very Long International Holding Corporation of Americas and Europe Ltd.';
    render(<CompanyBanner companyName={longName} ticker="LONG" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe(longName);
    expect(heading.getAttribute('title')).toBe(longName);
    expect(heading.className).toContain('company-banner__name');
  });

  // =========================================================================
  // Special characters in company name
  // =========================================================================

  it('renders company name with ampersand correctly', () => {
    render(<CompanyBanner companyName="AT&T Inc." ticker="T" />);

    expect(screen.getByText('AT&T Inc.')).toBeTruthy();
  });

  it('renders company name with special characters', () => {
    render(
      <CompanyBanner
        companyName="Berkshire Hathaway Inc. (Class A)"
        ticker="BRK.A"
      />,
    );

    expect(screen.getByText('Berkshire Hathaway Inc. (Class A)')).toBeTruthy();
    expect(screen.getByText('BRK.A')).toBeTruthy();
  });

  // =========================================================================
  // Price edge cases
  // =========================================================================

  it('handles very large price values', () => {
    render(
      <CompanyBanner
        companyName="Berkshire Hathaway"
        ticker="BRK.A"
        price={695000}
      />,
    );

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.textContent).toBe('$695,000.00');
  });

  it('handles fractional price values', () => {
    render(
      <CompanyBanner companyName="Penny Corp" ticker="PCOR" price={0.005} />,
    );

    const priceEl = screen.getByTestId('price-display');
    // toLocaleString with maximumFractionDigits: 2
    expect(priceEl.textContent).toBe('$0.01');
  });

  it('handles negative price (edge case)', () => {
    render(
      <CompanyBanner companyName="Test Corp" ticker="TEST" price={-5.0} />,
    );

    const priceEl = screen.getByTestId('price-display');
    // Price is a number, so it formats as a negative
    expect(priceEl.textContent).toContain('-');
  });

  // =========================================================================
  // Structure validation
  // =========================================================================

  it('identity wrapper contains both name and ticker', () => {
    const { container } = render(
      <CompanyBanner companyName="Apple Inc." ticker="AAPL" price={178} />,
    );

    const identity = container.querySelector('.company-banner__identity');
    expect(identity).toBeTruthy();

    const name = identity.querySelector('.company-banner__name');
    expect(name).toBeTruthy();
    expect(name.textContent).toBe('Apple Inc.');

    const ticker = identity.querySelector('.company-banner__ticker');
    expect(ticker).toBeTruthy();
    expect(ticker.textContent).toBe('AAPL');
  });

  // =========================================================================
  // Semantic structure
  // =========================================================================

  it('uses only one h1 for the company name', () => {
    const { container } = render(
      <CompanyBanner companyName="Apple Inc." ticker="AAPL" price={178} />,
    );

    const h1Elements = container.querySelectorAll('h1');
    expect(h1Elements.length).toBe(1);
    expect(h1Elements[0].textContent).toBe('Apple Inc.');
  });

  it('ticker is not inside an h1', () => {
    render(<CompanyBanner companyName="Apple Inc." ticker="AAPL" />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Apple Inc.');
    // Ticker badge should be a separate element
    expect(h1.textContent).not.toContain('AAPL');
  });

  // =========================================================================
  // ARIA accessibility
  // =========================================================================

  it('price element has descriptive aria-label with formatted price', () => {
    render(
      <CompanyBanner companyName="Apple Inc." ticker="AAPL" price={1234.56} />,
    );

    const priceEl = screen.getByTestId('price-display');
    expect(priceEl.getAttribute('aria-label')).toBe('Stock price $1,234.56');
  });
});
