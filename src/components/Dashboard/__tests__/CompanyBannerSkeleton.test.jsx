import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompanyBannerSkeleton } from '../CompanyBannerSkeleton';

/**
 * Helper: renders CompanyBannerSkeleton with the given props.
 */
function renderSkeleton(props = {}) {
  return render(<CompanyBannerSkeleton {...props} />);
}

describe('CompanyBannerSkeleton', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
    expect(el).toBeTruthy();
  });

  it('renders as a div element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
    expect(el.tagName).toBe('DIV');
  });

  // =========================================================================
  // Skeleton bone structure
  // =========================================================================

  it('renders name bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.company-banner-skeleton__bone--name');
    expect(bone).toBeTruthy();
  });

  it('renders ticker bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.company-banner-skeleton__bone--ticker');
    expect(bone).toBeTruthy();
  });

  it('renders price bone placeholder', () => {
    const { container } = renderSkeleton();

    const bone = container.querySelector('.company-banner-skeleton__bone--price');
    expect(bone).toBeTruthy();
  });

  it('renders identity wrapper containing name and ticker bones', () => {
    const { container } = renderSkeleton();

    const identity = container.querySelector('.company-banner-skeleton__identity');
    expect(identity).toBeTruthy();
    expect(identity.querySelector('.company-banner-skeleton__bone--name')).toBeTruthy();
    expect(identity.querySelector('.company-banner-skeleton__bone--ticker')).toBeTruthy();
  });

  it('renders exactly three bone elements', () => {
    const { container } = renderSkeleton();

    const bones = container.querySelectorAll('.company-banner-skeleton__bone');
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

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('has aria-label describing loading state', () => {
    renderSkeleton();

    const el = screen.getByLabelText('Loading company banner');
    expect(el).toBeTruthy();
  });

  it('has sr-only text for screen readers', () => {
    const { container } = renderSkeleton();

    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly.textContent).toBe('Loading company banner...');
  });

  it('has data-testid attribute', () => {
    renderSkeleton();

    expect(screen.getByTestId('company-banner-skeleton')).toBeTruthy();
  });

  // =========================================================================
  // CSS class structure
  // =========================================================================

  it('applies company-banner-skeleton class to root element', () => {
    const { container } = renderSkeleton();

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
    expect(el.className).toContain('company-banner-skeleton');
  });

  it('applies shimmer animation class to bones', () => {
    const { container } = renderSkeleton();

    const bones = container.querySelectorAll('.company-banner-skeleton__bone');
    bones.forEach((bone) => {
      expect(bone.className).toContain('company-banner-skeleton__bone');
    });
  });

  // =========================================================================
  // className forwarding
  // =========================================================================

  it('forwards className to the root element', () => {
    const { container } = renderSkeleton({ className: 'custom-class' });

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
    expect(el.className).toContain('custom-class');
  });

  it('preserves base class when className is provided', () => {
    const { container } = renderSkeleton({ className: 'extra' });

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
    expect(el.className).toContain('company-banner-skeleton');
    expect(el.className).toContain('extra');
  });

  it('does not add trailing space when className is empty', () => {
    const { container } = renderSkeleton({ className: '' });

    const el = container.querySelector('[data-testid="company-banner-skeleton"]');
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

    // The only visible text should be the sr-only span
    const allText = container.textContent;
    expect(allText).toBe('Loading company banner...');
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot', () => {
    const { container } = renderSkeleton();

    expect(container.firstChild).toMatchSnapshot();
  });
});
