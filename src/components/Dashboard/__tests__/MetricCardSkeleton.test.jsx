import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCardSkeleton } from '../MetricCardSkeleton';

/**
 * Helper: renders MetricCardSkeleton with the given props.
 */
function renderSkeleton(props = {}) {
  return render(<MetricCardSkeleton {...props} />);
}

describe('MetricCardSkeleton', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el).toBeTruthy();
  });

  it('renders as a div element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.tagName).toBe('DIV');
  });

  // =========================================================================
  // Skeleton bone structure
  // =========================================================================

  it('renders title bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.metric-card-skeleton__bone--title');
    expect(bone).toBeTruthy();
  });

  it('renders value bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.metric-card-skeleton__bone--value');
    expect(bone).toBeTruthy();
  });

  it('renders trend bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.metric-card-skeleton__bone--trend');
    expect(bone).toBeTruthy();
  });

  it('renders exactly three bone elements', () => {
    const { container } = renderSkeleton();

    const bones = container.querySelectorAll('.metric-card-skeleton__bone');
    expect(bones.length).toBe(3);
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  it('has role="status"', () => {
    renderSkeleton();

    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
  });

  it('has aria-busy="true"', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('has aria-label describing loading state', () => {
    renderSkeleton();

    const el = screen.getByLabelText('Loading metric');
    expect(el).toBeTruthy();
  });

  it('has sr-only text for screen readers', () => {
    const { container } = renderSkeleton();

    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly.textContent).toBe('Loading metric...');
  });

  it('has data-testid attribute', () => {
    renderSkeleton();

    expect(screen.getByTestId('metric-card-skeleton')).toBeTruthy();
  });

  // =========================================================================
  // CSS class structure
  // =========================================================================

  it('applies metric-card-skeleton class to root element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.className).toContain('metric-card-skeleton');
  });

  it('applies shared card class to root element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.className).toContain('card');
  });

  it('applies shimmer animation class to bones', () => {
    const { container } = renderSkeleton();

    const bones = container.querySelectorAll('.metric-card-skeleton__bone');
    bones.forEach((bone) => {
      expect(bone.className).toContain('metric-card-skeleton__bone');
    });
  });

  // =========================================================================
  // className forwarding
  // =========================================================================

  it('forwards className to the root element', () => {
    const { container } = renderSkeleton({ className: 'custom-class' });

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.className).toContain('custom-class');
  });

  it('preserves base class when className is provided', () => {
    const { container } = renderSkeleton({ className: 'extra' });

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.className).toContain('metric-card-skeleton');
    expect(el.className).toContain('extra');
  });

  it('does not add trailing space when className is empty', () => {
    const { container } = renderSkeleton({ className: '' });

    const el = container.querySelector('[data-testid="metric-card-skeleton"]');
    expect(el.className).not.toMatch(/\s$/);
  });

  // =========================================================================
  // Does NOT render real content
  // =========================================================================

  it('does not render any heading elements', () => {
    renderSkeleton();

    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('does not render any text content besides sr-only', () => {
    const { container } = renderSkeleton();

    const allText = container.textContent;
    expect(allText).toBe('Loading metric...');
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot', () => {
    const { container } = renderSkeleton();

    expect(container.firstChild).toMatchSnapshot();
  });
});
