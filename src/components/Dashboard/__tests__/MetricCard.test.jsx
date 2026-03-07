import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';

/**
 * Helper: renders MetricCard with the given props.
 */
function renderCard(props = {}) {
  return render(<MetricCard title="Revenue" {...props} />);
}

describe('MetricCard', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing with only required props', () => {
    const { container } = renderCard();

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card).toBeTruthy();
    expect(card.className).toContain('card');
    expect(card.className).toContain('metric-card');
  });

  it('renders the title as an h3 heading', () => {
    renderCard({ title: 'Free Cash Flow' });

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Free Cash Flow');
  });

  // =========================================================================
  // Value display
  // =========================================================================

  it('renders a string value correctly', () => {
    renderCard({ value: '$394B' });

    const valueEl = screen.getByLabelText('Value: $394B');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('$394B');
  });

  it('renders a numeric value correctly', () => {
    renderCard({ value: 28.5 });

    const valueEl = screen.getByLabelText('Value: 28.5');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('28.5');
  });

  it('renders zero value correctly (not as placeholder)', () => {
    renderCard({ value: 0 });

    const valueEl = screen.getByLabelText('Value: 0');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('0');
  });

  // =========================================================================
  // Missing/undefined values — shows "--"
  // =========================================================================

  it('shows "--" when value is undefined', () => {
    renderCard({ value: undefined });

    const valueEl = screen.getByLabelText('Value: --');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('--');
  });

  it('shows "--" when value is null', () => {
    renderCard({ value: null });

    const valueEl = screen.getByLabelText('Value: --');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('--');
  });

  it('shows "--" when value is empty string', () => {
    renderCard({ value: '' });

    const valueEl = screen.getByLabelText('Value: --');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('--');
  });

  it('shows "--" when value prop is not provided', () => {
    renderCard();

    const valueEl = screen.getByLabelText('Value: --');
    expect(valueEl).toBeTruthy();
    expect(valueEl.textContent).toBe('--');
  });

  // =========================================================================
  // Unit display
  // =========================================================================

  it('renders unit next to the value', () => {
    const { container } = renderCard({ value: '28.5', unit: '%' });

    const unitEl = container.querySelector('.metric-card__unit');
    expect(unitEl).toBeTruthy();
    expect(unitEl.textContent).toBe('%');
    expect(unitEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not render unit element when unit is not provided', () => {
    const { container } = renderCard({ value: '$394B' });

    const unitEl = container.querySelector('.metric-card__unit');
    expect(unitEl).toBeNull();
  });

  it('includes unit in value aria-label when unit is present', () => {
    renderCard({ value: '28.5', unit: '%' });

    const valueEl = screen.getByLabelText('Value: 28.5 %');
    expect(valueEl).toBeTruthy();
  });

  // =========================================================================
  // Trend indicators
  // =========================================================================

  it('shows green up arrow for trend="up"', () => {
    const { container } = renderCard({ value: '$394B', trend: 'up' });

    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl).toBeTruthy();
    expect(trendEl.textContent).toBe('\u25B2');
    expect(trendEl.className).toContain('metric-card__trend--up');
    expect(trendEl.getAttribute('aria-label')).toBe('Trending up');
    expect(trendEl.getAttribute('role')).toBe('img');
  });

  it('shows red down arrow for trend="down"', () => {
    const { container } = renderCard({ value: '$394B', trend: 'down' });

    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl).toBeTruthy();
    expect(trendEl.textContent).toBe('\u25BC');
    expect(trendEl.className).toContain('metric-card__trend--down');
    expect(trendEl.getAttribute('aria-label')).toBe('Trending down');
  });

  it('shows neutral dash for trend="neutral"', () => {
    const { container } = renderCard({ value: '$394B', trend: 'neutral' });

    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl).toBeTruthy();
    expect(trendEl.textContent).toBe('\u2014');
    expect(trendEl.className).toContain('metric-card__trend--neutral');
    expect(trendEl.getAttribute('aria-label')).toBe('No change');
  });

  it('does not render trend indicator when trend is not provided', () => {
    const { container } = renderCard({ value: '$394B' });

    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl).toBeNull();
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  it('renders shimmer placeholders when loading is true', () => {
    const { container } = renderCard({ loading: true });

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card).toBeTruthy();
    expect(card.className).toContain('metric-card--loading');
    expect(card.getAttribute('role')).toBe('status');
    expect(card.getAttribute('aria-label')).toBe('Loading Revenue');
  });

  it('renders three shimmer elements when loading', () => {
    const { container } = renderCard({ loading: true });

    const shimmers = container.querySelectorAll('.metric-card__shimmer');
    expect(shimmers.length).toBe(3);
  });

  it('includes sr-only loading text when loading', () => {
    const { container } = renderCard({ loading: true });

    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly.textContent).toBe('Loading Revenue...');
  });

  it('does not render title, value, or trend when loading', () => {
    const { container } = renderCard({ loading: true, value: '$394B', trend: 'up' });

    expect(container.querySelector('.metric-card__title')).toBeNull();
    expect(container.querySelector('.metric-card__value')).toBeNull();
    expect(container.querySelector('.metric-card__trend')).toBeNull();
  });

  it('uses fallback "metric" in loading label when title is not provided', () => {
    const { container } = render(<MetricCard loading={true} title={undefined} />);

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card.getAttribute('aria-label')).toBe('Loading metric');
  });

  // =========================================================================
  // Accessibility (ARIA)
  // =========================================================================

  it('has heading role for the title', () => {
    renderCard({ value: '$394B' });

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe('Revenue');
  });

  it('trend indicator has role="img" with descriptive aria-label', () => {
    const { container } = renderCard({ value: '$394B', trend: 'up' });

    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl.getAttribute('role')).toBe('img');
    expect(trendEl.getAttribute('aria-label')).toBe('Trending up');
  });

  it('value element has an aria-label describing the value', () => {
    renderCard({ value: '$394B' });

    const valueEl = screen.getByLabelText('Value: $394B');
    expect(valueEl).toBeTruthy();
  });

  it('unit is hidden from screen readers (aria-hidden)', () => {
    const { container } = renderCard({ value: '28.5', unit: '%' });

    const unitEl = container.querySelector('.metric-card__unit');
    expect(unitEl.getAttribute('aria-hidden')).toBe('true');
  });

  // =========================================================================
  // className forwarding
  // =========================================================================

  it('forwards className to the card container', () => {
    const { container } = renderCard({ className: 'custom-metric' });

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card.className).toContain('custom-metric');
  });

  it('preserves base classes when className is provided', () => {
    const { container } = renderCard({ className: 'extra' });

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card.className).toContain('card');
    expect(card.className).toContain('metric-card');
    expect(card.className).toContain('extra');
  });

  it('does not add trailing space when className is empty', () => {
    const { container } = renderCard({ className: '' });

    const card = container.querySelector('[data-testid="metric-card"]');
    expect(card.className).not.toMatch(/\s$/);
  });

  // =========================================================================
  // All props together
  // =========================================================================

  it('renders correctly with all props provided', () => {
    const { container } = renderCard({
      title: 'Gross Margin',
      value: '42.3',
      unit: '%',
      trend: 'up',
    });

    // Title
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe('Gross Margin');

    // Value with unit in aria-label
    const valueEl = screen.getByLabelText('Value: 42.3 %');
    expect(valueEl.textContent).toBe('42.3');

    // Unit
    const unitEl = container.querySelector('.metric-card__unit');
    expect(unitEl.textContent).toBe('%');

    // Trend
    const trendEl = container.querySelector('.metric-card__trend');
    expect(trendEl.textContent).toBe('\u25B2');
    expect(trendEl.className).toContain('metric-card__trend--up');
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot for a fully populated card', () => {
    const { container } = renderCard({
      title: 'Revenue',
      value: '$394B',
      unit: 'USD',
      trend: 'up',
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for loading state', () => {
    const { container } = renderCard({
      title: 'Revenue',
      loading: true,
    });

    expect(container.firstChild).toMatchSnapshot();
  });
});
