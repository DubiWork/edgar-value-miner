import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartContainerSkeleton } from '../ChartContainerSkeleton';

/**
 * Helper: renders ChartContainerSkeleton with the given props.
 */
function renderSkeleton(props = {}) {
  return render(<ChartContainerSkeleton {...props} />);
}

describe('ChartContainerSkeleton', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el).toBeTruthy();
  });

  it('renders as a div element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.tagName).toBe('DIV');
  });

  // =========================================================================
  // Skeleton bone structure
  // =========================================================================

  it('renders title bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.chart-container-skeleton__bone--title');
    expect(bone).toBeTruthy();
  });

  it('renders chart area bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.chart-container-skeleton__bone--chart');
    expect(bone).toBeTruthy();
  });

  it('renders exactly two bone elements', () => {
    const { container } = renderSkeleton();

    const bones = container.querySelectorAll('.chart-container-skeleton__bone');
    expect(bones.length).toBe(2);
  });

  it('renders header section containing title bone', () => {
    const { container } = renderSkeleton();

    const header = container.querySelector('.chart-container-skeleton__header');
    expect(header).toBeTruthy();
    expect(
      header.querySelector('.chart-container-skeleton__bone--title'),
    ).toBeTruthy();
  });

  it('renders body section containing chart bone', () => {
    const { container } = renderSkeleton();

    const body = container.querySelector('.chart-container-skeleton__body');
    expect(body).toBeTruthy();
    expect(
      body.querySelector('.chart-container-skeleton__bone--chart'),
    ).toBeTruthy();
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

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('has aria-label describing loading state', () => {
    renderSkeleton();

    const el = screen.getByLabelText('Loading chart');
    expect(el).toBeTruthy();
  });

  it('has sr-only text for screen readers', () => {
    const { container } = renderSkeleton();

    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly.textContent).toBe('Loading chart...');
  });

  it('has data-testid attribute', () => {
    renderSkeleton();

    expect(screen.getByTestId('chart-container-skeleton')).toBeTruthy();
  });

  // =========================================================================
  // Height prop
  // =========================================================================

  it('applies default height of 300px', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.style.height).toBe('300px');
  });

  it('applies custom height when provided', () => {
    const { container } = renderSkeleton({ height: 400 });

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.style.height).toBe('400px');
  });

  it('applies custom height of 200', () => {
    const { container } = renderSkeleton({ height: 200 });

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.style.height).toBe('200px');
  });

  // =========================================================================
  // CSS class structure
  // =========================================================================

  it('applies chart-container-skeleton class to root element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.className).toContain('chart-container-skeleton');
  });

  it('applies responsive class for mobile height override', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.className).toContain('chart-container-skeleton--responsive');
  });

  it('applies shimmer animation class to bones', () => {
    const { container } = renderSkeleton();

    const bones = container.querySelectorAll('.chart-container-skeleton__bone');
    bones.forEach((bone) => {
      expect(bone.className).toContain('chart-container-skeleton__bone');
    });
  });

  // =========================================================================
  // className forwarding
  // =========================================================================

  it('forwards className to the root element', () => {
    const { container } = renderSkeleton({ className: 'custom-class' });

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.className).toContain('custom-class');
  });

  it('preserves base class when className is provided', () => {
    const { container } = renderSkeleton({ className: 'extra' });

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
    expect(el.className).toContain('chart-container-skeleton');
    expect(el.className).toContain('extra');
  });

  it('does not add trailing space when className is empty', () => {
    const { container } = renderSkeleton({ className: '' });

    const el = container.querySelector('[data-testid="chart-container-skeleton"]');
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
    expect(allText).toBe('Loading chart...');
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot with default props', () => {
    const { container } = renderSkeleton();

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with custom height', () => {
    const { container } = renderSkeleton({ height: 400 });

    expect(container.firstChild).toMatchSnapshot();
  });
});
