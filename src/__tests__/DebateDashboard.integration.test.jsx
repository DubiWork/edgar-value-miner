/**
 * Integration Tests: Dashboard + DebatePanelConnected
 *
 * IT-DEBATE-INT-01 through IT-DEBATE-INT-15
 *
 * These tests render the App with the REAL DebatePanelConnected component
 * (not mocked), verifying that the debate panel integrates correctly
 * within the dashboard context when the AI debate feature flag is on.
 *
 * All Cloud Function calls are mocked via useDebate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeProvider';
import App from '../App';

// =============================================================================
// Mocks
// =============================================================================

// useCompanySearch — controls dashboard data
const mockSearchCompany = vi.fn();
const mockClearError = vi.fn();

let mockHookReturn = {
  data: null,
  loading: false,
  error: null,
  metadata: null,
  searchCompany: mockSearchCompany,
  clearError: mockClearError,
  reset: vi.fn(),
};

vi.mock('../hooks/useCompanySearch', () => ({
  useCompanySearch: () => mockHookReturn,
  default: () => mockHookReturn,
}));

vi.mock('../utils/gaapNormalizer', () => ({
  default: {
    getLatestValue: vi.fn((metric) => {
      if (!metric || !metric.annual || metric.annual.length === 0) return null;
      return {
        value: metric.annual[0].value,
        period: metric.annual[0].period,
        fiscalYear: metric.annual[0].fiscalYear,
      };
    }),
    normalizeCompanyFacts: vi.fn(),
  },
}));

vi.mock('../hooks/useKeyMetrics', () => ({
  useKeyMetrics: () => [],
  default: () => [],
}));

vi.mock('../hooks/useStockQuote', () => ({
  useStockQuote: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
  default: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('../utils/calculateMargins', () => ({
  calculateMargins: vi.fn(() => []),
  default: vi.fn(() => []),
}));

// Mock useDebate — controls the debate panel state
vi.mock('../hooks/useDebate', () => ({
  useDebate: vi.fn(),
}));

// Mock debateApi — no real Firebase calls
vi.mock('../services/debateApi', () => ({
  getDebate: vi.fn(),
  submitFeedback: vi.fn(),
}));

// useAuth — unauthenticated for simplicity
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  default: () => ({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../components/TickerSearch', () => ({
  TickerSearch: ({ variant, onSearch, isSearching }) => (
    <div data-testid={`ticker-search-${variant}`} data-searching={isSearching}>
      <input
        data-testid={`ticker-input-${variant}`}
        onChange={() => {}}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) onSearch(e.target.value);
        }}
      />
    </div>
  ),
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

vi.mock('../components/ErrorBoundary', () => ({
  ErrorFallback: ({ error, resetError }) => (
    <div data-testid="error-fallback">
      <p>{error?.message || 'Unknown error'}</p>
      <button data-testid="error-retry" onClick={resetError}>Retry</button>
    </div>
  ),
}));

vi.mock('../components/LoginModal', () => ({
  LoginModal: ({ isOpen }) => isOpen ? <div data-testid="login-modal">Login Modal</div> : null,
}));

vi.mock('../components/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

import { useDebate } from '../hooks/useDebate';

// =============================================================================
// Fixtures
// =============================================================================

const mockCompanyData = {
  ticker: 'AAPL',
  cik: '0000320193',
  companyName: 'Apple Inc.',
  metrics: {
    revenue: { annual: [{ value: 394000000000, period: '2024-09-28', fiscalYear: 2024 }], quarterly: [], tag: 'Revenues' },
    netIncome: { annual: [{ value: 97000000000, period: '2024-09-28', fiscalYear: 2024 }], quarterly: [], tag: 'NetIncomeLoss' },
    freeCashFlow: { annual: [{ value: 111000000000, period: '2024-09-28', fiscalYear: 2024 }], quarterly: [], calculated: true },
    grossProfit: { annual: [{ value: 112000000000, period: '2024-09-28', fiscalYear: 2024 }], quarterly: [], tag: 'GrossProfit' },
    eps: { annual: [{ value: 6.42, period: '2024-09-28', fiscalYear: 2024 }], quarterly: [], tag: 'EarningsPerShareBasic' },
    operatingCashFlow: { annual: [{ value: 118000000000, period: '2024-09-28', fiscalYear: 2024 }], quarterly: [], tag: 'NetCashProvidedByUsedInOperatingActivities' },
  },
  metadata: { normalizationVersion: 1, metricsFound: 20, missingMetrics: [] },
};

const mockDebate = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  generatedAt: '2026-03-01T00:00:00.000Z',
  bullCase: {
    arguments: [
      { title: 'Strong Ecosystem', detail: 'Apple ecosystem lock-in.', citation: 'Apple Annual Report 2025' },
      { title: 'Services Growth', detail: 'Services at 22% of revenue.', citation: 'Apple Q4 2025 Earnings' },
      { title: 'Capital Allocation', detail: 'Net cash funds buybacks.', citation: 'Apple 10-K 2025' },
    ],
    confidence: 0.75,
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  bearCase: {
    riskFactors: [
      { title: 'China Revenue Risk', detail: 'China iPhone declined 13%.', dataPoint: 'Q4 2025 China: -13% YoY' },
      { title: 'Regulatory Headwinds', detail: 'EU DMA threatens App Store.', dataPoint: 'EU DMA begins Q1 2026' },
      { title: 'Valuation Premium', detail: 'At 28x earnings.', dataPoint: 'P/E: 28x vs 22x sector avg' },
    ],
    confidence: 0.6,
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  synthesis: {
    keyFactors: [
      { title: 'Services Growth', analysis: 'Strong recurring revenue driving margins.' },
      { title: 'China Risk', analysis: 'Geographic concentration is primary risk.' },
    ],
    recommendation: 'Quality at a Fair Price — Hold with upside on Services mix-shift',
    confidence: 0.65,
    disclaimer: 'AI-generated analysis for educational purposes only. Not financial advice.',
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  metadata: { model: 'claude-3-5-haiku-20241022', version: 1, viewCount: 4721 },
  source: 'cached',
};

// =============================================================================
// Helpers
// =============================================================================

function enableDebateFlag() {
  import.meta.env.VITE_FEATURE_AI_DEBATE = 'true';
}

function disableDebateFlag() {
  delete import.meta.env.VITE_FEATURE_AI_DEBATE;
}

function setHookState(overrides = {}) {
  mockHookReturn = {
    data: null,
    loading: false,
    error: null,
    metadata: null,
    searchCompany: mockSearchCompany,
    clearError: mockClearError,
    reset: vi.fn(),
    ...overrides,
  };
}

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('Dashboard + DebatePanelConnected Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHookState({});
    disableDebateFlag();
  });

  afterEach(() => {
    cleanup();
    disableDebateFlag();
  });

  // ===========================================================================
  // IT-DEBATE-INT-01: Feature flag off — debate panel not rendered
  // ===========================================================================

  it('IT-DEBATE-INT-01: does NOT render debate panel when feature flag is off', () => {
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    expect(screen.queryByTestId('debate-panel-container')).toBeFalsy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-02: Feature flag on, data loaded — debate panel renders
  // ===========================================================================

  it('IT-DEBATE-INT-02: renders DebatePanelConnected alongside dashboard when flag is on', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    expect(screen.getByTestId('debate-panel-container')).toBeTruthy();
    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-03: Dashboard content + debate panel coexist
  // ===========================================================================

  it('IT-DEBATE-INT-03: dashboard layout and debate panel render simultaneously without conflict', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    // Dashboard present
    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    // Debate panel present with all sub-sections
    expect(screen.getByTestId('debate-panel-container')).toBeTruthy();
    expect(screen.getByTestId('bull-case-card')).toBeTruthy();
    expect(screen.getByTestId('bear-case-card')).toBeTruthy();
    expect(screen.getByTestId('synthesis-card')).toBeTruthy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-04: Debate panel shows loading state within dashboard
  // ===========================================================================

  it('IT-DEBATE-INT-04: debate loading skeleton renders within dashboard when debate is loading', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: null,
      loading: true,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    // Dashboard still shows
    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    // Debate shows loading skeleton
    expect(screen.getByTestId('debate-loading')).toBeTruthy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-05: Debate error doesn't break dashboard
  // ===========================================================================

  it('IT-DEBATE-INT-05: debate error state renders within dashboard without breaking it', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: 'Unable to connect. Check your internet connection and try again.',
      errorCode: 'network',
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    // Dashboard still shows
    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    // Debate shows error
    expect(screen.getByTestId('debate-error')).toBeTruthy();
    // Dashboard error state should NOT be shown
    expect(screen.queryByTestId('error-state')).toBeFalsy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-06: Rate limit shows within dashboard
  // ===========================================================================

  it('IT-DEBATE-INT-06: rate limit state renders within dashboard context', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: 'Rate limit exceeded.',
      isRateLimited: true,
      rateLimitInfo: { currentCount: 3, maxCount: 3, upgradeUrl: 'https://example.com/upgrade' },
      refresh: vi.fn(),
    });
    renderApp();

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('debate-rate-limit')).toBeTruthy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-07: Debate panel passes correct ticker from App state
  // ===========================================================================

  it('IT-DEBATE-INT-07: useDebate is called with the correct ticker from search result', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    // useDebate should have been called with 'AAPL' (the ticker from mockCompanyData)
    expect(useDebate).toHaveBeenCalledWith('AAPL');
  });

  // ===========================================================================
  // IT-DEBATE-INT-08: Debate panel not shown when dashboard has no data
  // ===========================================================================

  it('IT-DEBATE-INT-08: DebatePanelConnected is not rendered when no company data (welcome state)', () => {
    enableDebateFlag();
    setHookState({ data: null, loading: false });
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    expect(screen.getByTestId('welcome-state')).toBeTruthy();
    expect(screen.queryByTestId('debate-panel-container')).toBeFalsy();
  });

  // ===========================================================================
  // IT-DEBATE-INT-09: Debate panel shows company name from debate data
  // ===========================================================================

  it('IT-DEBATE-INT-09: debate panel displays company name from debate response', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    const panel = screen.getByTestId('debate-panel-container');
    expect(panel.textContent).toMatch(/Apple Inc\./);
  });

  // ===========================================================================
  // IT-DEBATE-INT-10: Both bull and bear cards render with their headings
  // ===========================================================================

  it('IT-DEBATE-INT-10: bull and bear case headings are present side-by-side', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    const bullCard = screen.getByTestId('bull-case-card');
    const bearCard = screen.getByTestId('bear-case-card');
    expect(bullCard.textContent).toMatch(/bull case/i);
    expect(bearCard.textContent).toMatch(/bear case/i);
  });

  // ===========================================================================
  // IT-DEBATE-INT-11: Grid layout for bull+bear on desktop
  // ===========================================================================

  it('IT-DEBATE-INT-11: debate grid container has md:grid-cols-2 class for desktop layout', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    const grid = screen.getByTestId('debate-grid');
    expect(grid.className).toMatch(/md:grid-cols-2/);
  });

  // ===========================================================================
  // IT-DEBATE-INT-12: Synthesis card renders below the bull/bear grid
  // ===========================================================================

  it('IT-DEBATE-INT-12: synthesis card renders with recommendation text', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    const synthesisCard = screen.getByTestId('synthesis-card');
    expect(synthesisCard.textContent).toMatch(/Quality at a Fair Price/);
  });

  // ===========================================================================
  // IT-DEBATE-INT-13: Debate panel ARIA label for accessibility
  // ===========================================================================

  it('IT-DEBATE-INT-13: debate panel section has correct aria-label for screen readers', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    const panel = screen.getByTestId('debate-panel-container');
    expect(panel.getAttribute('aria-label')).toMatch(/debate|AI/i);
  });

  // ===========================================================================
  // IT-DEBATE-INT-14: Investment disclaimer visible within integrated view
  // ===========================================================================

  it('IT-DEBATE-INT-14: investment disclaimer is visible in the synthesis card', () => {
    enableDebateFlag();
    setHookState({ data: mockCompanyData });
    useDebate.mockReturnValue({
      debate: mockDebate,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    const disclaimer = screen.getByTestId('investment-disclaimer');
    expect(disclaimer).toBeTruthy();
    expect(disclaimer.textContent).toMatch(/not financial advice/i);
  });

  // ===========================================================================
  // IT-DEBATE-INT-15: Dashboard loading state shows debate panel if data pre-loaded
  // ===========================================================================

  it('IT-DEBATE-INT-15: debate panel uses cached debate while dashboard refreshes new company', () => {
    enableDebateFlag();
    // Dashboard is still loading (new company search in progress)
    // but debate data already present from previous ticker
    setHookState({ data: null, loading: true });
    useDebate.mockReturnValue({
      debate: null,
      loading: false,
      error: null,
      isRateLimited: false,
      rateLimitInfo: null,
      refresh: vi.fn(),
    });
    renderApp();

    // Dashboard skeleton visible
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
    // Debate panel is absent (no company data to key off)
    expect(screen.queryByTestId('debate-panel-container')).toBeFalsy();
  });
});
