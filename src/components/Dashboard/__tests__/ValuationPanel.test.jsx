import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ValuationPanel } from '../ValuationPanel';

// =============================================================================
// Helpers
// =============================================================================

/** Default valid props for rendering. */
const defaultProps = {
  eps: 6.97,
  currentPrice: 175,
  companyName: 'Apple Inc.',
  loading: false,
};

/** Renders ValuationPanel with merged props. */
function renderPanel(overrides = {}) {
  return render(<ValuationPanel {...defaultProps} {...overrides} />);
}

describe('ValuationPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Basic rendering
  // ===========================================================================

  it('renders without crashing with valid props', () => {
    const { container } = renderPanel();

    const panel = container.querySelector('[data-testid="valuation-panel"]');
    expect(panel).toBeTruthy();
  });

  it('renders as a section with card class', () => {
    const { container } = renderPanel();

    const panel = container.querySelector('[data-testid="valuation-panel"]');
    expect(panel.tagName).toBe('SECTION');
    expect(panel.className).toContain('card');
    expect(panel.className).toContain('valuation-panel');
  });

  it('has accessible aria-label with company name', () => {
    const { container } = renderPanel();

    const panel = container.querySelector('[data-testid="valuation-panel"]');
    expect(panel.getAttribute('aria-label')).toBe('P/E Fair Value analysis for Apple Inc.');
  });

  // ===========================================================================
  // Fair value calculation display
  // ===========================================================================

  it('displays correct fair value at default P/E 15', () => {
    renderPanel();

    // fairValue = 6.97 * 15 = 104.55
    expect(screen.getByText('$104.55')).toBeTruthy();
  });

  it('displays current price', () => {
    renderPanel();

    expect(screen.getByText('$175.00')).toBeTruthy();
  });

  it('displays the P/E label next to fair value', () => {
    renderPanel();

    expect(screen.getByText(/at 15\.0 P\/E/)).toBeTruthy();
  });

  // ===========================================================================
  // Margin of safety display
  // ===========================================================================

  it('displays margin of safety percentage', () => {
    renderPanel();

    // MoS = (104.55 - 175) / 104.55 * 100 = -67.4% (rounded)
    // Actually: (104.55 - 175) / 104.55 * 100 = -70.45 / 104.55 * 100 = ~-67.4
    // Let's check: calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 })
    // fairValue = 104.55, MoS = (104.55 - 175) / 104.55 * 100 = -67.4
    expect(screen.getByText(/-67\.4%/)).toBeTruthy();
  });

  // ===========================================================================
  // Status badge — triple redundancy (color + text + icon)
  // ===========================================================================

  it('shows correct valuation status text', () => {
    // MoS = -67.4%, which is < -10%, so "Overvalued"
    const { container } = renderPanel();

    const badge = container.querySelector('.valuation-panel__status');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Overvalued');
  });

  it('shows correct valuation icon for overvalued', () => {
    const { container } = renderPanel();

    const badge = container.querySelector('.valuation-panel__status');
    // Overvalued icon is \u2191 (up arrow)
    expect(badge.textContent).toContain('\u2191');
  });

  it('applies correct CSS modifier class for overvalued status', () => {
    const { container } = renderPanel();

    const badge = container.querySelector('.valuation-panel__status');
    expect(badge.className).toContain('valuation-panel__status--overvalued');
  });

  it('shows undervalued status for cheap stock', () => {
    // eps=10, price=100, P/E=15 => fairValue=150, MoS=(150-100)/150*100=33.3%
    const { container } = renderPanel({ eps: 10, currentPrice: 100 });

    const badge = container.querySelector('.valuation-panel__status');
    expect(badge.textContent).toContain('Undervalued');
    expect(badge.textContent).toContain('\u2193'); // down arrow icon
    expect(badge.className).toContain('valuation-panel__status--undervalued');
  });

  it('shows fair value status for fairly priced stock', () => {
    // eps=10, price=140, P/E=15 => fairValue=150, MoS=(150-140)/150*100=6.7%
    const { container } = renderPanel({ eps: 10, currentPrice: 140 });

    const badge = container.querySelector('.valuation-panel__status');
    expect(badge.textContent).toContain('Fair Value');
    expect(badge.textContent).toContain('\u2194'); // left-right arrow icon
    expect(badge.className).toContain('valuation-panel__status--fair');
  });

  it('has all three redundancy elements: color class, text, and icon', () => {
    const { container } = renderPanel({ eps: 10, currentPrice: 100 });

    const badge = container.querySelector('.valuation-panel__status');
    // Color: CSS class present
    expect(badge.className).toContain('valuation-panel__status--undervalued');
    // Text: label present
    expect(badge.textContent).toContain('Undervalued');
    // Icon: arrow present
    expect(badge.textContent).toContain('\u2193');
  });

  // ===========================================================================
  // Slider — default, range, interaction
  // ===========================================================================

  it('renders slider with default P/E of 15', () => {
    renderPanel();

    const slider = screen.getByRole('slider');
    expect(slider).toBeTruthy();
    expect(slider.value).toBe('15');
  });

  it('slider has correct range: min 5, max 50', () => {
    renderPanel();

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('min')).toBe('5');
    expect(slider.getAttribute('max')).toBe('50');
  });

  it('slider has step of 0.5', () => {
    renderPanel();

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('step')).toBe('0.5');
  });

  it('slider updates calculation when moved', () => {
    renderPanel();

    const slider = screen.getByRole('slider');

    act(() => {
      fireEvent.change(slider, { target: { value: '20' } });
      vi.advanceTimersByTime(50); // debounce
    });

    // fairValue = 6.97 * 20 = 139.40
    expect(screen.getByText('$139.40')).toBeTruthy();
    expect(screen.getByText(/at 20\.0 P\/E/)).toBeTruthy();
  });

  it('slider displays current value label', () => {
    renderPanel();

    // The slider output/label should show the current value
    expect(screen.getByText('15.0')).toBeTruthy();
  });

  // ===========================================================================
  // Slider accessibility
  // ===========================================================================

  it('slider has aria-label for screen readers', () => {
    renderPanel();

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-label')).toBe('Target P/E ratio');
  });

  it('slider has aria-valuemin, aria-valuemax, aria-valuenow', () => {
    renderPanel();

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('5');
    expect(slider.getAttribute('aria-valuemax')).toBe('50');
    expect(slider.getAttribute('aria-valuenow')).toBe('15');
  });

  it('slider aria-valuenow updates when slider moves', () => {
    renderPanel();

    const slider = screen.getByRole('slider');

    act(() => {
      fireEvent.change(slider, { target: { value: '25' } });
      vi.advanceTimersByTime(50);
    });

    expect(slider.getAttribute('aria-valuenow')).toBe('25');
  });

  it('has aria-live region for valuation announcements', () => {
    const { container } = renderPanel();

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('debounces aria-live announcements at 500ms', () => {
    const { container } = renderPanel();

    const slider = screen.getByRole('slider');
    const liveRegion = container.querySelector('[aria-live="polite"]');

    // Change slider
    act(() => {
      fireEvent.change(slider, { target: { value: '20' } });
      vi.advanceTimersByTime(50); // calculation debounce fires
    });

    // At 50ms, the announcement should not have updated yet (500ms debounce)
    expect(liveRegion.textContent).toBe('');

    // Advance to 500ms
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Now the announcement should appear
    expect(liveRegion.textContent).not.toBe('');
    expect(liveRegion.textContent).toContain('Fair value');
  });

  // ===========================================================================
  // Edge case: Negative/Zero EPS
  // ===========================================================================

  it('shows N/A message when EPS is negative', () => {
    renderPanel({ eps: -2.5 });

    expect(screen.getByText(/P\/E requires positive earnings/)).toBeTruthy();
  });

  it('disables slider when EPS is negative', () => {
    renderPanel({ eps: -2.5 });

    const slider = screen.getByRole('slider');
    expect(slider.disabled).toBe(true);
  });

  it('shows N/A message when EPS is zero', () => {
    renderPanel({ eps: 0 });

    expect(screen.getByText(/P\/E requires positive earnings/)).toBeTruthy();
  });

  it('disables slider when EPS is zero', () => {
    renderPanel({ eps: 0 });

    const slider = screen.getByRole('slider');
    expect(slider.disabled).toBe(true);
  });

  // ===========================================================================
  // Edge case: No price data
  // ===========================================================================

  it('shows price unavailable when currentPrice is null', () => {
    renderPanel({ currentPrice: null });

    expect(screen.getByText(/Price data unavailable/)).toBeTruthy();
  });

  it('shows price unavailable when currentPrice is undefined', () => {
    renderPanel({ currentPrice: undefined });

    expect(screen.getByText(/Price data unavailable/)).toBeTruthy();
  });

  // ===========================================================================
  // Loading state
  // ===========================================================================

  it('renders shimmer when loading is true', () => {
    const { container } = renderPanel({ loading: true });

    const panel = container.querySelector('[data-testid="valuation-panel"]');
    expect(panel.className).toContain('valuation-panel--loading');
    expect(panel.getAttribute('role')).toBe('status');
    expect(panel.getAttribute('aria-label')).toContain('Loading');
  });

  it('shows shimmer placeholders when loading', () => {
    const { container } = renderPanel({ loading: true });

    const shimmers = container.querySelectorAll('.valuation-panel__shimmer');
    expect(shimmers.length).toBeGreaterThan(0);
  });

  it('does not render slider or values when loading', () => {
    renderPanel({ loading: true });

    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('includes sr-only text when loading', () => {
    const { container } = renderPanel({ loading: true });

    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly.textContent).toContain('Loading');
  });

  // ===========================================================================
  // 2-column grid layout
  // ===========================================================================

  it('renders a 2-column grid container', () => {
    const { container } = renderPanel();

    const grid = container.querySelector('.valuation-panel__grid');
    expect(grid).toBeTruthy();
  });

  it('has left column with price displays', () => {
    const { container } = renderPanel();

    const priceSection = container.querySelector('.valuation-panel__price');
    const fairValueSection = container.querySelector('.valuation-panel__fair-value');
    expect(priceSection).toBeTruthy();
    expect(fairValueSection).toBeTruthy();
  });

  it('has right column with margin of safety', () => {
    const { container } = renderPanel();

    const marginSection = container.querySelector('.valuation-panel__margin');
    expect(marginSection).toBeTruthy();
  });

  // ===========================================================================
  // prefers-reduced-motion support
  // ===========================================================================

  it('applies valuation-panel class that carries entrance animation', () => {
    const { container } = renderPanel();

    const panel = container.querySelector('[data-testid="valuation-panel"]');
    expect(panel.className).toContain('valuation-panel');
    // The CSS handles prefers-reduced-motion via media query — component just needs the class
  });

  // ===========================================================================
  // Snapshot
  // ===========================================================================

  it('matches snapshot for a fully populated panel', () => {
    const { container } = renderPanel();

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for loading state', () => {
    const { container } = renderPanel({ loading: true });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for negative EPS', () => {
    const { container } = renderPanel({ eps: -2.5 });

    expect(container.firstChild).toMatchSnapshot();
  });
});
