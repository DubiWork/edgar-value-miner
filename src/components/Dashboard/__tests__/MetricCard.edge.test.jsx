/**
 * Additional edge case tests for MetricCard component.
 *
 * Supplements the existing MetricCard.test.jsx with edge cases
 * from the test plan that weren't covered.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';

describe('MetricCard edge cases', () => {
  // =========================================================================
  // Negative values
  // =========================================================================

  it('renders negative numeric values correctly', () => {
    const { container } = render(
      <MetricCard title="Net Income" value="-$150.0M" trend="down" />,
    );

    const valueEl = screen.getByLabelText('Value: -$150.0M');
    expect(valueEl.textContent).toBe('-$150.0M');

    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl.className).toContain('metric-card__trend--down');
  });

  it('renders negative number value correctly', () => {
    render(<MetricCard title="FCF" value={-250} />);

    const valueEl = screen.getByLabelText('Value: -250');
    expect(valueEl.textContent).toBe('-250');
  });

  // =========================================================================
  // Large values as strings
  // =========================================================================

  it('renders very large formatted values without overflow', () => {
    render(<MetricCard title="Revenue" value="$383.0B" unit="USD" />);

    const valueEl = screen.getByLabelText('Value: $383.0B USD');
    expect(valueEl.textContent).toBe('$383.0B');
  });

  it('renders small formatted values', () => {
    render(<MetricCard title="Revenue" value="$50.0M" />);

    const valueEl = screen.getByLabelText('Value: $50.0M');
    expect(valueEl.textContent).toBe('$50.0M');
  });

  // =========================================================================
  // Special characters
  // =========================================================================

  it('renders special characters in title', () => {
    render(<MetricCard title="P/E Ratio" value="25.5" />);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe('P/E Ratio');
  });

  it('renders percentage values with unit', () => {
    render(<MetricCard title="Gross Margin" value="44.1" unit="%" />);

    const valueEl = screen.getByLabelText('Value: 44.1 %');
    expect(valueEl.textContent).toBe('44.1');

    const { container } = render(
      <MetricCard title="Net Margin" value="28.4" unit="%" trend="up" />,
    );
    const unitEl = container.querySelector('.metric-card__unit');
    expect(unitEl.textContent).toBe('%');
  });

  // =========================================================================
  // Transition from loading to value
  // =========================================================================

  it('loading state does not show previous value', () => {
    const { container, rerender } = render(
      <MetricCard title="Revenue" value="$394B" trend="up" />,
    );

    // Verify value is shown
    expect(screen.getByLabelText('Value: $394B')).toBeTruthy();

    // Switch to loading
    rerender(<MetricCard title="Revenue" loading={true} value="$394B" trend="up" />);

    // Value should be hidden, shimmer shown
    expect(container.querySelector('.metric-card__value')).toBeNull();
    expect(container.querySelectorAll('.metric-card__shimmer').length).toBe(3);
  });

  it('transition from loading to value shows correct data', () => {
    const { container, rerender } = render(
      <MetricCard title="Revenue" loading={true} />,
    );

    expect(container.querySelector('.metric-card--loading')).toBeTruthy();

    // Switch to loaded
    rerender(<MetricCard title="Revenue" value="$420B" trend="up" />);

    expect(container.querySelector('.metric-card--loading')).toBeNull();
    expect(screen.getByLabelText('Value: $420B')).toBeTruthy();
  });

  // =========================================================================
  // Multiple trend states
  // =========================================================================

  it('all three trend states render distinct indicators', () => {
    const { container: upContainer } = render(
      <MetricCard title="Rev" value="100" trend="up" />,
    );
    const { container: downContainer } = render(
      <MetricCard title="NI" value="50" trend="down" />,
    );
    const { container: neutralContainer } = render(
      <MetricCard title="FCF" value="75" trend="neutral" />,
    );

    const upTrend = upContainer.querySelector('.metric-card__trend');
    const downTrend = downContainer.querySelector('.metric-card__trend');
    const neutralTrend = neutralContainer.querySelector('.metric-card__trend');

    // All three should be different
    expect(upTrend.textContent).not.toBe(downTrend.textContent);
    expect(upTrend.textContent).not.toBe(neutralTrend.textContent);
    expect(downTrend.textContent).not.toBe(neutralTrend.textContent);

    // Each has the correct ARIA label
    expect(upTrend.getAttribute('aria-label')).toBe('Trending up');
    expect(downTrend.getAttribute('aria-label')).toBe('Trending down');
    expect(neutralTrend.getAttribute('aria-label')).toBe('No change');
  });

  // =========================================================================
  // Loading state with missing title
  // =========================================================================

  it('loading with empty string title uses fallback', () => {
    const { container } = render(<MetricCard title="" loading={true} />);

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card.getAttribute('aria-label')).toBe('Loading metric');
  });

  // =========================================================================
  // Combination props
  // =========================================================================

  it('renders with value, unit, and no trend', () => {
    const { container } = render(
      <MetricCard title="EPS" value="$6.42" unit="FY2024" />,
    );

    expect(screen.getByLabelText('Value: $6.42 FY2024')).toBeTruthy();
    expect(container.querySelector('.metric-card__trend')).toBeNull();
  });
});
