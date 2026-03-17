/**
 * Tests for DebatePanel (real implementation)
 *
 * UT-DEBATE-NEW-01 through UT-DEBATE-NEW-20
 * Replaces the stub tests in DebatePanel.test.jsx for the real implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebatePanelConnected } from '../DebatePanelConnected';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../hooks/useDebate', () => ({
  useDebate: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock debateApi so FeedbackButtons doesn't call real Firebase
vi.mock('../../services/debateApi', () => ({
  getDebate: vi.fn(),
  submitFeedback: vi.fn(),
}));

import { useDebate } from '../../hooks/useDebate';

// =============================================================================
// Fixtures
// =============================================================================

const mockDebate = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  generatedAt: '2026-03-01T00:00:00.000Z',
  bullCase: {
    arguments: [
      {
        title: 'Strong Ecosystem',
        detail: 'Apple ecosystem lock-in with 2.2B+ active devices worldwide.',
        citation: 'Apple Annual Report 2025, p. 12',
      },
      {
        title: 'Services Revenue Growth',
        detail: 'Services growing at 16% YoY with 90%+ gross margins.',
        citation: 'Apple Q4 2025 Earnings Call',
      },
      {
        title: 'Capital Allocation',
        detail: 'Net cash of $50B+ funds aggressive buybacks.',
        citation: 'Apple 10-K 2025',
      },
    ],
    confidence: 0.75,
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  bearCase: {
    riskFactors: [
      {
        title: 'China Revenue Risk',
        detail: 'China iPhone revenue declined 13% last quarter.',
        dataPoint: 'Q4 2025 China revenue: -13% YoY',
      },
      {
        title: 'Regulatory Headwinds',
        detail: 'EU Digital Markets Act threatens App Store revenue.',
        dataPoint: 'EU DMA enforcement begins Q1 2026',
      },
      {
        title: 'Valuation Premium',
        detail: 'Valuation at 28x earnings prices in significant growth.',
        dataPoint: 'P/E: 28x vs sector avg 22x',
      },
    ],
    confidence: 0.6,
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  synthesis: {
    keyFactors: [
      { title: 'Services Growth', analysis: 'Strong recurring revenue mix driving margin expansion.' },
      { title: 'China Risk', analysis: 'Geographic concentration is the primary near-term risk.' },
    ],
    recommendation: 'Quality at a Fair Price — Hold with upside on Services mix-shift',
    confidence: 0.65,
    disclaimer: 'AI-generated analysis for educational purposes only. Not financial advice.',
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  metadata: {
    model: 'claude-3-5-haiku-20241022',
    version: 1,
    viewCount: 4721,
  },
  source: 'cached',
};

// =============================================================================
// Tests
// =============================================================================

describe('DebatePanelConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-DEBATE-NEW-01: Renders loading state
  it('renders loading state', () => {
    useDebate.mockReturnValue({
      debate: null,
      loading: true,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('debate-loading')).toBeTruthy();
  });

  // UT-DEBATE-NEW-02: Renders error state with retry button
  it('renders error state with retry button', () => {
    const mockRefresh = vi.fn();
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: 'An error occurred.',
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: mockRefresh,
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('debate-error')).toBeTruthy();
    expect(screen.getByText(/An error occurred/)).toBeTruthy();
  });

  // UT-DEBATE-NEW-03: Renders rate limit state
  it('renders rate limit state', () => {
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: 'Rate limit exceeded.',
      isRateLimited: true,
      rateLimitInfo: { currentCount: 3, maxCount: 3, upgradeUrl: 'https://example.com/upgrade' },
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('debate-rate-limit')).toBeTruthy();
  });

  // UT-DEBATE-NEW-04: Renders null state (no ticker)
  it('renders nothing when no debate data', () => {
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="" />);
    expect(screen.queryByTestId('debate-panel-container')).toBeFalsy();
  });

  // UT-DEBATE-NEW-05: Renders BullCaseCard when debate loaded
  it('renders BullCaseCard when debate is loaded', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('bull-case-card')).toBeTruthy();
  });

  // UT-DEBATE-NEW-06: Renders BearCaseCard when debate loaded
  it('renders BearCaseCard when debate is loaded', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('bear-case-card')).toBeTruthy();
  });

  // UT-DEBATE-NEW-07: Renders SynthesisCard when debate loaded
  it('renders SynthesisCard when debate is loaded', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('synthesis-card')).toBeTruthy();
  });

  // UT-DEBATE-NEW-08: Shows "X investors researched this" view count
  it('shows investor view count from metadata', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('view-count')).toBeTruthy();
    expect(screen.getByTestId('view-count').textContent).toMatch(/4[,.]?721|4721/);
  });

  // UT-DEBATE-NEW-09: Shows "Updated [date]" generatedAt
  it('shows updated date from generatedAt', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('generated-at')).toBeTruthy();
  });

  // UT-DEBATE-NEW-10: Shows methodology citation
  it('shows methodology citation on the panel', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('methodology-citation')).toBeTruthy();
    expect(screen.getByTestId('methodology-citation').textContent).toMatch(/feroldi/i);
  });

  // UT-DEBATE-NEW-11: Bull and bear side-by-side (desktop grid) + synthesis below
  it('has responsive grid layout container', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const grid = screen.getByTestId('debate-grid');
    expect(grid).toBeTruthy();
    // md:grid-cols-2 for side-by-side on desktop
    expect(grid.className).toMatch(/grid/);
  });

  // UT-DEBATE-NEW-12: Panel has correct aria-label
  it('has aria-label for accessibility', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const panel = screen.getByTestId('debate-panel-container');
    expect(panel.getAttribute('aria-label')).toMatch(/debate|AI/i);
  });

  // UT-DEBATE-NEW-13: Rate limit shows upgrade URL
  it('rate limit state shows upgrade link', () => {
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: 'Rate limit exceeded.',
      isRateLimited: true,
      rateLimitInfo: { currentCount: 3, maxCount: 3, upgradeUrl: 'https://example.com/upgrade' },
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const upgradeLink = screen.getByRole('link', { name: /upgrade/i });
    expect(upgradeLink).toBeTruthy();
    expect(upgradeLink.href).toMatch(/upgrade/);
  });

  // UT-DEBATE-NEW-14: Does not show "Coming Soon" badge
  it('does not show "Coming Soon" badge', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.queryByTestId('coming-soon-badge')).toBeFalsy();
  });

  // UT-DEBATE-NEW-15: Company name shown in panel header
  it('shows company name in header', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    const matches = screen.getAllByText(/Apple Inc\./);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // UT-DEBATE-NEW-16: Share card rendered when debate is loaded
  it('renders DebateShareCard when debate is loaded', () => {
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.getByTestId('debate-share-card')).toBeTruthy();
  });

  // UT-DEBATE-NEW-17: Share card not shown during loading state
  it('does not render DebateShareCard while loading', () => {
    useDebate.mockReturnValue({
      debate: null,
      loading: true,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    render(<DebatePanelConnected ticker="AAPL" />);
    expect(screen.queryByTestId('debate-share-card')).toBeFalsy();
  });
});
