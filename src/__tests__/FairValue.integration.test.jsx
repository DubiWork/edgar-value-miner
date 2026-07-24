/**
 * Fair Value Integration Tests
 *
 * Tests the full integration of the fair value feature:
 * - App renders ValuationPanel in the dashboard
 * - ValuationPanel receives correct EPS and price data
 * - useKeyMetrics receives stockQuote and produces 7 metric cards
 * - Loading and error states propagate correctly
 * - Graceful degradation when FMP data is unavailable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// =============================================================================
// Mock Setup
// =============================================================================

const mockSearchCompany = vi.fn();
const mockClearError = vi.fn();
const mockReset = vi.fn();

let mockCompanySearchReturn = {
  data: null,
  loading: false,
  error: null,
  metadata: null,
  searchCompany: mockSearchCompany,
  clearError: mockClearError,
  reset: mockReset,
};

vi.mock('../hooks/useCompanySearch', () => ({
  useCompanySearch: () => mockCompanySearchReturn,
  default: () => mockCompanySearchReturn,
}));

let mockStockQuoteReturn = { data: null, loading: false, error: null, refetch: vi.fn() };
vi.mock('../hooks/useStockQuote', () => ({
  useStockQuote: () => mockStockQuoteReturn,
  default: () => mockStockQuoteReturn,
}));

let mockKeyMetricsReturn = [];
vi.mock('../hooks/useKeyMetrics', () => ({
  useKeyMetrics: (...args) => {
    mockKeyMetricsArgs = args;
    return mockKeyMetricsReturn;
  },
  default: (...args) => {
    mockKeyMetricsArgs = args;
    return mockKeyMetricsReturn;
  },
}));
let mockKeyMetricsArgs = [];

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

vi.mock('../components/TickerSearch', () => ({
  TickerSearch: ({ variant }) => (
    <div data-testid={`ticker-search-${variant}`} />
  ),
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle</button>,
}));

vi.mock('../components/ErrorBoundary', () => ({
  ErrorFallback: ({ error }) => (
    <div data-testid="error-fallback">
      <p>{error?.message || 'Error'}</p>
    </div>
  ),
}));

vi.mock('../components/Dashboard', () => ({
  DashboardLayout: ({ banner, metrics, heroChart, secondaryCharts, valuation }) => (
    <div data-testid="dashboard-layout">
      {banner && <div data-testid="dashboard-banner">{banner}</div>}
      {metrics && metrics.length > 0 && (
        <div data-testid="dashboard-metrics">
          {metrics.map((m, i) => (
            <div key={i} data-testid={`metric-slot-${i}`}>{m}</div>
          ))}
        </div>
      )}
      {heroChart && <div data-testid="dashboard-hero-chart">{heroChart}</div>}
      {secondaryCharts && secondaryCharts.length > 0 && (
        <div data-testid="dashboard-secondary-charts">
          {secondaryCharts.map((c, i) => (
            <div key={i} data-testid={`secondary-chart-${i}`}>{c}</div>
          ))}
        </div>
      )}
      {valuation && <div data-testid="dashboard-valuation">{valuation}</div>}
    </div>
  ),
  CompanyBanner: ({ companyName, ticker }) => (
    <div data-testid="company-banner">{companyName} ({ticker})</div>
  ),
  MetricCard: ({ title, value }) => (
    <div data-testid={`metric-card-${title}`}>{value}</div>
  ),
  ChartContainer: ({ title, children }) => (
    <div data-testid={`chart-container-${title}`}>{children}</div>
  ),
  RevenueChart: () => <div data-testid="revenue-chart" />,
  FCFChart: () => <div data-testid="fcf-chart" />,
  MarginsChart: () => <div data-testid="margins-chart" />,
  ValuationPanel: ({ eps, currentPrice, companyName, loading: vpLoading }) => (
    <div
      data-testid="valuation-panel"
      data-eps={eps}
      data-price={currentPrice}
      data-company={companyName}
      data-loading={vpLoading}
    >
      ValuationPanel
    </div>
  ),
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
}));

vi.mock('../utils/calculateMargins', () => ({
  calculateMargins: vi.fn(() => []),
}));

// =============================================================================
// Fixtures
// =============================================================================

function createMockCompanyData(overrides = {}) {
  return {
    ticker: 'AAPL',
    cik: '0000320193',
    companyName: 'Apple Inc.',
    metrics: {
      revenue: {
        annual: [
          { value: 394000000000, period: '2024-09-28', fiscalYear: 2024 },
          { value: 383000000000, period: '2023-09-30', fiscalYear: 2023 },
        ],
        quarterly: [],
        tag: 'Revenues',
      },
      eps: {
        annual: [
          { value: 6.42, period: '2024-09-28', fiscalYear: 2024 },
          { value: 6.13, period: '2023-09-30', fiscalYear: 2023 },
        ],
        quarterly: [],
        tag: 'EarningsPerShareBasic',
      },
      freeCashFlow: {
        annual: [
          { value: 111000000000, period: '2024-09-28', fiscalYear: 2024 },
        ],
        quarterly: [],
        calculated: true,
      },
      grossProfit: {
        annual: [
          { value: 112000000000, period: '2024-09-28', fiscalYear: 2024 },
        ],
        quarterly: [],
        tag: 'GrossProfit',
      },
      netIncome: {
        annual: [
          { value: 97000000000, period: '2024-09-28', fiscalYear: 2024 },
        ],
        quarterly: [],
        tag: 'NetIncomeLoss',
      },
    },
    ...overrides,
  };
}

const STOCK_QUOTE = {
  price: 178.72,
  eps: 6.42,
  pe: 27.8,
  marketCap: 2780000000000,
  changesPercentage: 1.2,
  name: 'Apple Inc.',
};

// =============================================================================
// Tests
// =============================================================================

describe('FairValue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeyMetricsReturn = [];
    mockKeyMetricsArgs = [];
    mockStockQuoteReturn = { data: null, loading: false, error: null, refetch: vi.fn() };
    mockCompanySearchReturn = {
      data: null,
      loading: false,
      error: null,
      metadata: null,
      searchCompany: mockSearchCompany,
      clearError: mockClearError,
      reset: mockReset,
    };
  });

  // ===========================================================================
  // ValuationPanel Rendering
  // ===========================================================================

  it('renders ValuationPanel inside DashboardLayout when company data is loaded', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: STOCK_QUOTE, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [
      { id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' },
    ];

    render(<App />);

    expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByTestId('dashboard-valuation')).toBeTruthy();
    expect(screen.getByTestId('valuation-panel')).toBeTruthy();
  });

  it('passes EPS from normalized company data to ValuationPanel', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: STOCK_QUOTE, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [{ id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' }];

    render(<App />);

    const panel = screen.getByTestId('valuation-panel');
    expect(panel.getAttribute('data-eps')).toBe('6.42');
  });

  it('passes current price from useStockQuote to ValuationPanel', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: STOCK_QUOTE, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [{ id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' }];

    render(<App />);

    const panel = screen.getByTestId('valuation-panel');
    expect(panel.getAttribute('data-price')).toBe('178.72');
  });

  // ===========================================================================
  // useKeyMetrics receives stockQuote
  // ===========================================================================

  it('passes stockQuote data to useKeyMetrics for 7 metric cards', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: STOCK_QUOTE, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [
      { id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' },
      { id: 'eps', title: 'EPS', value: '$6.42', unit: 'FY2024', trend: 'up' },
      { id: 'fcf', title: 'FCF', value: '$111.0B', unit: 'FY2024', trend: 'up' },
      { id: 'gross-margin', title: 'Gross Margin', value: '28.4%', unit: 'FY2024', trend: undefined },
      { id: 'debt-to-equity', title: 'Debt-to-Equity', value: '--', unit: 'Ratio', trend: undefined },
      { id: 'market-cap', title: 'Market Cap', value: '$2.8T', unit: 'Live', trend: 'up' },
      { id: 'pe-ratio', title: 'P/E Ratio', value: '27.8', unit: 'TTM', trend: undefined },
    ];

    render(<App />);

    const metricsContainer = screen.getByTestId('dashboard-metrics');
    const metricSlots = metricsContainer.querySelectorAll('[data-testid^="metric-slot-"]');
    expect(metricSlots.length).toBe(7);

    // Verify useKeyMetrics was called with both normalizedData and stockQuote
    expect(mockKeyMetricsArgs[0]).toBe(mockCompanySearchReturn.data);
    expect(mockKeyMetricsArgs[1]).toBe(STOCK_QUOTE);
  });

  it('passes null stockQuote to useKeyMetrics when FMP data not available', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: null, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [
      { id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' },
    ];

    render(<App />);

    expect(mockKeyMetricsArgs[1]).toBeNull();
  });

  // ===========================================================================
  // Loading States
  // ===========================================================================

  it('shows ValuationPanel loading state while stock quote is fetching', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: null, loading: true, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [{ id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' }];

    render(<App />);

    const panel = screen.getByTestId('valuation-panel');
    expect(panel.getAttribute('data-loading')).toBe('true');
  });

  it('shows ValuationPanel with loaded data after stock quote resolves', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: STOCK_QUOTE, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [{ id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' }];

    render(<App />);

    const panel = screen.getByTestId('valuation-panel');
    expect(panel.getAttribute('data-loading')).toBe('false');
    expect(panel.getAttribute('data-price')).toBe('178.72');
    expect(panel.getAttribute('data-eps')).toBe('6.42');
  });

  // ===========================================================================
  // Graceful Degradation
  // ===========================================================================

  it('renders ValuationPanel with undefined price when stockQuote is null', () => {
    mockCompanySearchReturn.data = createMockCompanyData();
    mockStockQuoteReturn = { data: null, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [{ id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' }];

    render(<App />);

    const panel = screen.getByTestId('valuation-panel');
    // price should be undefined (no attribute value)
    expect(panel.getAttribute('data-price')).toBeNull();
    // EPS still available from SEC data
    expect(panel.getAttribute('data-eps')).toBe('6.42');
  });

  it('renders ValuationPanel with undefined EPS when company has no EPS data', () => {
    const noEpsData = createMockCompanyData({
      metrics: {
        revenue: {
          annual: [{ value: 100000000000, period: '2024-09-28', fiscalYear: 2024 }],
          quarterly: [],
          tag: 'Revenues',
        },
      },
    });
    mockCompanySearchReturn.data = noEpsData;
    mockStockQuoteReturn = { data: STOCK_QUOTE, loading: false, error: null, refetch: vi.fn() };
    mockKeyMetricsReturn = [{ id: 'revenue', title: 'Revenue', value: '$100.0B', unit: 'FY2024', trend: undefined }];

    render(<App />);

    const panel = screen.getByTestId('valuation-panel');
    // EPS should be undefined since no eps metric
    expect(panel.getAttribute('data-eps')).toBeNull();
    // Price should still come through
    expect(panel.getAttribute('data-price')).toBe('178.72');
  });

  it('does not render ValuationPanel when no company data is loaded (welcome state)', () => {
    render(<App />);

    expect(screen.queryByTestId('valuation-panel')).toBeNull();
    expect(screen.getByTestId('welcome-state')).toBeTruthy();
  });

  it('does not render ValuationPanel during company data loading state', () => {
    mockCompanySearchReturn.loading = true;
    render(<App />);

    expect(screen.queryByTestId('valuation-panel')).toBeNull();
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });
});
