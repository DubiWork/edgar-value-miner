/**
 * Additional edge case tests for ChartContainer component.
 *
 * Supplements the existing ChartContainer.test.jsx with edge cases
 * from the test plan that weren't covered.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartContainer } from '../ChartContainer';

describe('ChartContainer edge cases', () => {
  // =========================================================================
  // Transition from loading to content
  // =========================================================================

  it('transitions from loading to content correctly', () => {
    const { rerender } = render(
      <ChartContainer title="Revenue" loading={true}>
        <div data-testid="chart-content">My Chart</div>
      </ChartContainer>,
    );

    // Loading: shimmer shown, no children
    expect(screen.queryByTestId('chart-content')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();

    // Loaded: children shown, no shimmer
    rerender(
      <ChartContainer title="Revenue" loading={false}>
        <div data-testid="chart-content">My Chart</div>
      </ChartContainer>,
    );

    expect(screen.getByTestId('chart-content')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('transitions from content to loading (re-fetch)', () => {
    const { rerender } = render(
      <ChartContainer title="Revenue" loading={false}>
        <div data-testid="chart-content">My Chart</div>
      </ChartContainer>,
    );

    expect(screen.getByTestId('chart-content')).toBeTruthy();

    rerender(
      <ChartContainer title="Revenue" loading={true}>
        <div data-testid="chart-content">My Chart</div>
      </ChartContainer>,
    );

    expect(screen.queryByTestId('chart-content')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  // =========================================================================
  // Different heights
  // =========================================================================

  it('renders with very small height', () => {
    const { container } = render(
      <ChartContainer title="Mini" height={100}>
        <div>Small chart</div>
      </ChartContainer>,
    );

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.style.height).toBe('100px');
  });

  it('renders with very large height', () => {
    const { container } = render(
      <ChartContainer title="Huge" height={800}>
        <div>Big chart</div>
      </ChartContainer>,
    );

    const el = container.querySelector('[data-testid="chart-container"]');
    expect(el.style.height).toBe('800px');
  });

  // =========================================================================
  // Title variations
  // =========================================================================

  it('renders with empty string title (no header shown)', () => {
    const { container } = render(
      <ChartContainer title="">
        <div>Chart</div>
      </ChartContainer>,
    );

    // Empty string is falsy, so header should not be rendered
    const header = container.querySelector('.chart-container__header');
    expect(header).toBeNull();
  });

  it('renders with long title', () => {
    const longTitle = 'Revenue Growth Over 10 Years (Adjusted for Inflation)';
    render(
      <ChartContainer title={longTitle}>
        <div>Chart</div>
      </ChartContainer>,
    );

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe(longTitle);
  });

  // =========================================================================
  // Accessibility with different titles
  // =========================================================================

  it('aria-label updates when title changes', () => {
    const { rerender } = render(
      <ChartContainer title="Revenue">
        <div>Chart</div>
      </ChartContainer>,
    );

    expect(screen.getByLabelText('Revenue chart')).toBeTruthy();

    rerender(
      <ChartContainer title="Free Cash Flow">
        <div>Chart</div>
      </ChartContainer>,
    );

    expect(screen.getByLabelText('Free Cash Flow chart')).toBeTruthy();
    expect(screen.queryByLabelText('Revenue chart')).toBeNull();
  });

  // =========================================================================
  // Body container always present
  // =========================================================================

  it('body container is always present regardless of loading state', () => {
    const { container: loadingContainer } = render(
      <ChartContainer title="Test" loading={true} />,
    );
    expect(
      loadingContainer.querySelector('.chart-container__body'),
    ).toBeTruthy();

    const { container: contentContainer } = render(
      <ChartContainer title="Test" loading={false}>
        <div>Content</div>
      </ChartContainer>,
    );
    expect(
      contentContainer.querySelector('.chart-container__body'),
    ).toBeTruthy();
  });

  // =========================================================================
  // Complex children
  // =========================================================================

  it('renders nested children correctly', () => {
    render(
      <ChartContainer title="Complex">
        <div data-testid="wrapper">
          <div data-testid="inner-1">Line 1</div>
          <div data-testid="inner-2">Line 2</div>
        </div>
      </ChartContainer>,
    );

    expect(screen.getByTestId('wrapper')).toBeTruthy();
    expect(screen.getByTestId('inner-1')).toBeTruthy();
    expect(screen.getByTestId('inner-2')).toBeTruthy();
  });
});
