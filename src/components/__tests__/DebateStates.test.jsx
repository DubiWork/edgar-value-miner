/**
 * Tests for Debate Loading, Error, and Rate Limit States
 *
 * UT-DEBATE-STATES-01 through UT-DEBATE-STATES-12
 * Covers acceptance criteria for #157:
 *  - Loading skeleton: 3 cards, company name, time estimate
 *  - Error states: network, server, timeout, invalid ticker (distinct messages + retry)
 *  - Rate limit: usage count, upgrade message, CTA link, analytics event
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebatePanelConnected } from '../DebatePanelConnected';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../hooks/useDebate', () => ({
  useDebate: vi.fn(),
}));

import { useDebate } from '../../hooks/useDebate';

// =============================================================================
// Helpers
// =============================================================================

function renderWithState(overrides = {}) {
  const defaults = {
    debate: null,
    loading: false,
    error: null,
    isRateLimited: false,
    rateLimitInfo: null,
    refresh: vi.fn(),
    errorCode: null,
  };
  useDebate.mockReturnValue({ ...defaults, ...overrides });
}

// =============================================================================
// Tests
// =============================================================================

describe('Debate Loading State', () => {
  beforeEach(() => vi.clearAllMocks());

  // UT-DEBATE-STATES-01: Loading skeleton renders 3 card-shaped bones
  it('renders 3 skeleton cards in loading state', () => {
    renderWithState({ loading: true });
    render(<DebatePanelConnected ticker="AAPL" />);
    const skeleton = screen.getByTestId('debate-loading');
    expect(skeleton).toBeTruthy();
    // Bull skeleton, Bear skeleton, Synthesis skeleton
    const bones = skeleton.querySelectorAll('[data-testid^="debate-skeleton-card"]');
    expect(bones.length).toBe(3);
  });

  // UT-DEBATE-STATES-02: Loading message shows company name context
  it('shows loading message with company name when ticker is provided', () => {
    renderWithState({ loading: true });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('debate-loading-message')).toBeTruthy();
    expect(screen.getByTestId('debate-loading-message').textContent).toMatch(/AAPL/);
  });

  // UT-DEBATE-STATES-03: Loading state shows time estimate
  it('shows time estimate in loading state', () => {
    renderWithState({ loading: true });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('debate-loading-time-estimate')).toBeTruthy();
    expect(screen.getByTestId('debate-loading-time-estimate').textContent).toMatch(/10.?15 second/i);
  });
});

describe('Debate Error States', () => {
  beforeEach(() => vi.clearAllMocks());

  // UT-DEBATE-STATES-04: Network error shows specific message
  it('shows network-specific error message', () => {
    renderWithState({
      error: 'Unable to connect. Check your internet connection and try again.',
      errorCode: 'network',
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const errorEl = screen.getByTestId('debate-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toMatch(/connection|internet/i);
  });

  // UT-DEBATE-STATES-05: Server error shows specific message
  it('shows server-specific error message', () => {
    renderWithState({
      error: 'Something went wrong on our end. Please try again.',
      errorCode: 'internal',
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const errorEl = screen.getByTestId('debate-error');
    expect(errorEl.textContent).toMatch(/went wrong|server/i);
  });

  // UT-DEBATE-STATES-06: Timeout error shows specific message
  it('shows timeout-specific error message', () => {
    renderWithState({
      error: 'Generation is taking longer than usual. Please try again.',
      errorCode: 'timeout',
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const errorEl = screen.getByTestId('debate-error');
    expect(errorEl.textContent).toMatch(/longer than usual|timeout/i);
  });

  // UT-DEBATE-STATES-07: Invalid ticker shows no-retry message
  it('shows invalid-ticker error without retry button', () => {
    renderWithState({
      error: "We don't have data for this company yet.",
      errorCode: 'not-found',
    });
    render(<DebatePanelConnected ticker="XYZ999" />);
    const errorEl = screen.getByTestId('debate-error');
    expect(errorEl.textContent).toMatch(/don.t have data|not found/i);
    // no retry button for not-found
    expect(screen.queryByTestId('debate-error-retry')).toBeFalsy();
  });

  // UT-DEBATE-STATES-08: Retryable errors show retry button that calls refresh
  it('retry button calls refresh for retryable errors', () => {
    const mockRefresh = vi.fn();
    renderWithState({
      error: 'Unable to connect. Check your internet connection and try again.',
      errorCode: 'network',
      refresh: mockRefresh,
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const retryBtn = screen.getByTestId('debate-error-retry');
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  // UT-DEBATE-STATES-09: Error state is contained — dashboard container absent
  it('error state does not render the debate panel container', () => {
    renderWithState({ error: 'Something went wrong.', errorCode: 'internal' });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.queryByTestId('debate-panel-container')).toBeFalsy();
  });
});

describe('Debate Rate Limit State', () => {
  beforeEach(() => vi.clearAllMocks());

  // UT-DEBATE-STATES-10: Rate limit shows usage count
  it('shows usage count in rate limit screen', () => {
    renderWithState({
      isRateLimited: true,
      rateLimitInfo: {
        currentCount: 3,
        maxCount: 3,
        upgradeUrl: 'https://example.com/upgrade',
      },
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const rateLimitEl = screen.getByTestId('debate-rate-limit');
    expect(rateLimitEl).toBeTruthy();
    expect(screen.getByTestId('rate-limit-usage').textContent).toMatch(/3.*3/);
  });

  // UT-DEBATE-STATES-11: Rate limit shows upgrade message and CTA
  it('rate limit screen shows upgrade message and CTA button', () => {
    renderWithState({
      isRateLimited: true,
      rateLimitInfo: {
        currentCount: 3,
        maxCount: 3,
        upgradeUrl: 'https://example.com/upgrade',
      },
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('rate-limit-upgrade-message').textContent).toMatch(/\$9\.99|unlimited/i);
    const ctaLink = screen.getByTestId('rate-limit-cta');
    expect(ctaLink).toBeTruthy();
    expect(ctaLink.href).toMatch(/upgrade/);
  });

  // UT-DEBATE-STATES-12: CTA click fires upgrade_cta_clicked analytics event
  it('fires upgrade_cta_clicked analytics event on CTA click', () => {
    const gtagMock = vi.fn();
    globalThis.gtag = gtagMock;

    renderWithState({
      isRateLimited: true,
      rateLimitInfo: {
        currentCount: 3,
        maxCount: 3,
        upgradeUrl: 'https://example.com/upgrade',
      },
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const ctaLink = screen.getByTestId('rate-limit-cta');
    fireEvent.click(ctaLink);
    expect(gtagMock).toHaveBeenCalledWith('event', 'upgrade_cta_clicked', expect.any(Object));

    delete globalThis.gtag;
  });
});
