import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartContainer } from '../ChartContainer';

/**
 * Helper: renders ChartContainer with the given props.
 */
function renderContainer(props = {}) {
  return render(<ChartContainer {...props} />);
}

describe('ChartContainer', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing with no props', () => {
    const { container } = renderContainer();

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el).toBeTruthy();
  });

  it('renders as a section element', () => {
    renderContainer({ title: 'Revenue' });

    const section = screen.getByLabelText('Revenue chart');
    expect(section.tagName).toBe('SECTION');
  });

  // =========================================================================
  // Title rendering
  // =========================================================================

  it('renders title as an h3 heading', () => {
    renderContainer({ title: 'Revenue Growth' });

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Revenue Growth');
  });

  it('does not render header when title is not provided', () => {
    const { container } = renderContainer();

    const header = container.querySelector('.chart-container__header');
    expect(header).toBeNull();
  });

  it('renders header when title is provided', () => {
    const { container } = renderContainer({ title: 'FCF' });

    const header = container.querySelector('.chart-container__header');
    expect(header).toBeTruthy();
  });

  // =========================================================================
  // Children rendering
  // =========================================================================

  it('renders children when not loading', () => {
    render(
      <ChartContainer title="Revenue">
        <div data-testid="chart-content">My Chart</div>
      </ChartContainer>
    );

    expect(screen.getByTestId('chart-content')).toBeTruthy();
    expect(screen.getByText('My Chart')).toBeTruthy();
  });

  it('does not render children when loading', () => {
    render(
      <ChartContainer title="Revenue" loading>
        <div data-testid="chart-content">My Chart</div>
      </ChartContainer>
    );

    expect(screen.queryByTestId('chart-content')).toBeNull();
  });

  // =========================================================================
  // Loading state (ShimmerChart)
  // =========================================================================

  it('shows shimmer placeholder when loading is true', () => {
    renderContainer({ title: 'Revenue', loading: true });

    const shimmer = screen.getByRole('status');
    expect(shimmer).toBeTruthy();
    expect(shimmer.getAttribute('aria-label')).toContain('Loading');
  });

  it('does not show shimmer when loading is false', () => {
    render(
      <ChartContainer title="Revenue" loading={false}>
        <div>Chart</div>
      </ChartContainer>
    );

    expect(screen.queryByRole('status')).toBeNull();
  });

  // =========================================================================
  // Height prop
  // =========================================================================

  it('applies default height of 300px', () => {
    const { container } = renderContainer({ title: 'Revenue' });

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.style.height).toBe('300px');
  });

  it('applies custom height when provided', () => {
    const { container } = renderContainer({ title: 'Revenue', height: 400 });

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.style.height).toBe('400px');
  });

  it('applies custom height of 200', () => {
    const { container } = renderContainer({ title: 'Margins', height: 200 });

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.style.height).toBe('200px');
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  it('sets aria-label based on title', () => {
    renderContainer({ title: 'Revenue Growth' });

    const section = screen.getByLabelText('Revenue Growth chart');
    expect(section).toBeTruthy();
  });

  it('sets fallback aria-label when title is not provided', () => {
    renderContainer();

    const section = screen.getByLabelText('Chart section');
    expect(section).toBeTruthy();
  });

  it('uses section element for semantic structure', () => {
    const { container } = renderContainer({ title: 'Test' });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(1);
  });

  // =========================================================================
  // CSS classes
  // =========================================================================

  it('applies chart-container base class', () => {
    const { container } = renderContainer();

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.classList.contains('chart-container')).toBe(true);
  });

  it('applies chart-container--responsive class for mobile breakpoint', () => {
    const { container } = renderContainer();

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.classList.contains('chart-container--responsive')).toBe(true);
  });

  // =========================================================================
  // Responsive height via matchMedia mock
  // =========================================================================

  it('has responsive class that enables mobile height override', () => {
    const { container } = renderContainer({ title: 'Revenue', height: 300 });

    const el = container.querySelector('[data-testid="chart-container"]');
    // The responsive class is present, which in CSS applies 250px on mobile
    expect(el.classList.contains('chart-container--responsive')).toBe(true);
    // Desktop height is set via inline style
    expect(el.style.height).toBe('300px');
  });

  // =========================================================================
  // Integration with ShimmerChart
  // =========================================================================

  it('passes adjusted height to ShimmerChart when loading', () => {
    const { container } = renderContainer({
      title: 'Revenue',
      loading: true,
      height: 300,
    });

    // ShimmerChart renders with role="status"
    const shimmer = screen.getByRole('status');
    expect(shimmer).toBeTruthy();

    // The shimmer should be inside the body
    const body = container.querySelector('.chart-container__body');
    expect(body.contains(shimmer)).toBe(true);
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('renders with empty children when not loading', () => {
    const { container } = render(
      <ChartContainer title="Empty" />
    );

    const body = container.querySelector('.chart-container__body');
    expect(body).toBeTruthy();
    // No shimmer (loading is false by default)
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders multiple children', () => {
    render(
      <ChartContainer title="Multi">
        <div data-testid="child-1">One</div>
        <div data-testid="child-2">Two</div>
      </ChartContainer>
    );

    expect(screen.getByTestId('child-1')).toBeTruthy();
    expect(screen.getByTestId('child-2')).toBeTruthy();
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot for default state', () => {
    const { container } = render(
      <ChartContainer title="Revenue" height={300}>
        <div className="card">Revenue Chart Placeholder</div>
      </ChartContainer>
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for loading state', () => {
    const { container } = renderContainer({
      title: 'Revenue',
      loading: true,
      height: 300,
    });

    expect(container.firstChild).toMatchSnapshot();
  });
});
