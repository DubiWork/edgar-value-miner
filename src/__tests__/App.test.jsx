/**
 * Tests for App component — wiring DashboardLayout into the application.
 *
 * Tests cover:
 * - Welcome state (no data, no loading, no error)
 * - Loading state (skeleton displayed)
 * - Data loaded state (dashboard with banner, metrics, charts)
 * - Error state (ErrorFallback displayed)
 * - Compact search visibility
 * - Metric extraction and formatting
 * - Cache metadata display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

// =============================================================================
// Mock Setup
// =============================================================================

const mockSearchCompany = vi.fn();
const mockClearError = vi.fn();
const mockReset = vi.fn();

let mockHookReturn = {
  data: null,
  loading: false,
  error: null,
  metadata: null,
  searchCompany: mockSearchCompany,
  clearError: mockClearError,
  reset: mockReset,
};

vi.mock('../hooks/useCompanySearch', () => ({
  useCompanySearch: () => mockHookReturn,
  default: () => mockHookReturn,
}));

// Mock gaapNormalizer so we control getLatestValue
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

// Mock useKeyMetrics hook — returns metrics array based on data
let mockKeyMetricsReturn = [];
vi.mock('../hooks/useKeyMetrics', () => ({
  useKeyMetrics: () => mockKeyMetricsReturn,
  default: () => mockKeyMetricsReturn,
}));

// Mock useStockQuote hook
let mockStockQuoteReturn = { data: null, loading: false, error: null, refetch: vi.fn() };
vi.mock('../hooks/useStockQuote', () => ({
  useStockQuote: () => mockStockQuoteReturn,
  default: () => mockStockQuoteReturn,
}));

// Mock TickerSearch to simplify — avoid autocomplete complexity
vi.mock('../components/TickerSearch', () => ({
  TickerSearch: ({ variant, onSearch, isSearching, autoFocus, className }) => (
    <div
      data-testid={`ticker-search-${variant}`}
      data-searching={isSearching}
      data-autofocus={autoFocus}
      className={className}
    >
      <input
        data-testid={`ticker-input-${variant}`}
        onChange={() => {}}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) {
            onSearch(e.target.value);
          }
        }}
      />
    </div>
  ),
}));

// Mock ThemeToggle
vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

// Mock ErrorFallback
vi.mock('../components/ErrorBoundary', () => ({
  ErrorFallback: ({ error, errorType, resetError }) => (
    <div data-testid="error-fallback" data-error-type={errorType}>
      <p>{error?.message || 'Unknown error'}</p>
      <button data-testid="error-retry" onClick={resetError}>
        Retry
      </button>
    </div>
  ),
}));

// Mock Dashboard components — keep them simple to focus on wiring
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
            <div key={i} data-testid={`secondary-chart-slot-${i}`}>{c}</div>
          ))}
        </div>
      )}
      {valuation && <div data-testid="dashboard-valuation">{valuation}</div>}
    </div>
  ),
  CompanyBanner: ({ companyName, ticker, price }) => (
    <div data-testid="company-banner">
      <span data-testid="banner-company-name">{companyName}</span>
      <span data-testid="banner-ticker">{ticker}</span>
      {price !== undefined && <span data-testid="banner-price">{price}</span>}
    </div>
  ),
  MetricCard: ({ title, value, unit, trend, style }) => (
    <div data-testid={`metric-card-${title}`} style={style}>
      <span data-testid="metric-title">{title}</span>
      <span data-testid="metric-value">{value}</span>
      {unit && <span data-testid="metric-unit">{unit}</span>}
      {trend && <span data-testid="metric-trend">{trend}</span>}
    </div>
  ),
  ChartContainer: ({ title, loading, children }) => (
    <div data-testid={`chart-container-${title}`} data-loading={loading}>
      <span>{title}</span>
      {children}
    </div>
  ),
  RevenueChart: ({ data }) => (
    <div data-testid="revenue-chart" data-has-data={Array.isArray(data) && data.length > 0}>
      RevenueChart mock
    </div>
  ),
  FCFChart: ({ data }) => (
    <div data-testid="fcf-chart" data-has-data={Array.isArray(data) && data.length > 0}>
      FCFChart mock
    </div>
  ),
  MarginsChart: ({ data }) => (
    <div data-testid="margins-chart" data-has-data={Array.isArray(data) && data.length > 0}>
      MarginsChart mock
    </div>
  ),
  ValuationPanel: ({ eps, currentPrice, companyName, loading: vpLoading }) => (
    <div
      data-testid="valuation-panel"
      data-eps={eps}
      data-price={currentPrice}
      data-company={companyName}
      data-loading={vpLoading}
    >
      ValuationPanel mock
    </div>
  ),
  DashboardSkeleton: () => (
    <div data-testid="dashboard-skeleton">Loading skeleton...</div>
  ),
}));

// Mock calculateMargins utility
vi.mock('../utils/calculateMargins', () => ({
  calculateMargins: vi.fn((metrics) => {
    if (!metrics || !metrics.revenue || metrics.revenue.length === 0) return [];
    return metrics.revenue.map((entry) => ({
      fiscalYear: entry.fiscalYear,
      label: `FY${entry.fiscalYear}`,
      grossMargin: 44.0,
      operatingMargin: 31.0,
      netMargin: 25.0,
    }));
  }),
  default: vi.fn(),
}));

// =============================================================================
// Mock Data Fixtures
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
      netIncome: {
        annual: [
          { value: 97000000000, period: '2024-09-28', fiscalYear: 2024 },
          { value: 94000000000, period: '2023-09-30', fiscalYear: 2023 },
        ],
        quarterly: [],
        tag: 'NetIncomeLoss',
      },
      freeCashFlow: {
        annual: [
          { value: 111000000000, period: '2024-09-28', fiscalYear: 2024 },
          { value: 99000000000, period: '2023-09-30', fiscalYear: 2023 },
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
      eps: {
        annual: [
          { value: 6.42, period: '2024-09-28', fiscalYear: 2024 },
          { value: 6.13, period: '2023-09-30', fiscalYear: 2023 },
        ],
        quarterly: [],
        tag: 'EarningsPerShareBasic',
      },
      operatingCashFlow: {
        annual: [
          { value: 118000000000, period: '2024-09-28', fiscalYear: 2024 },
          { value: 110000000000, period: '2023-09-30', fiscalYear: 2023 },
        ],
        quarterly: [],
        tag: 'NetCashProvidedByUsedInOperatingActivities',
      },
    },
    metadata: {
      normalizationVersion: 1,
      metricsFound: 20,
      missingMetrics: [],
    },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeyMetricsReturn = [];
    mockStockQuoteReturn = { data: null, loading: false, error: null, refetch: vi.fn() };
    mockHookReturn = {
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
  // Welcome State
  // ===========================================================================

  describe('Welcome State', () => {
    it('renders the welcome state when no data, not loading, no error', () => {
      render(<App />);

      expect(screen.getByTestId('welcome-state')).toBeTruthy();
      expect(screen.getByText('Find gems in the market')).toBeTruthy();
      expect(screen.getByTestId('ticker-search-hero')).toBeTruthy();
    });

    it('renders feature cards in welcome state', () => {
      render(<App />);

      expect(screen.getByText('Visual Analysis')).toBeTruthy();
      expect(screen.getByText('Smart Valuations')).toBeTruthy();
      expect(screen.getByText('Quality Scoring')).toBeTruthy();
    });

    it('does not show compact search bar in welcome state', () => {
      render(<App />);

      expect(screen.queryByTestId('ticker-search-compact')).toBeNull();
    });

    it('renders theme toggle in welcome state', () => {
      render(<App />);

      expect(screen.getByTestId('theme-toggle')).toBeTruthy();
    });

    it('renders the footer', () => {
      render(<App />);

      expect(screen.getByText(/Data powered by SEC EDGAR/)).toBeTruthy();
    });
  });

  // ===========================================================================
  // Loading State
  // ===========================================================================

  describe('Loading State', () => {
    beforeEach(() => {
      mockHookReturn.loading = true;
    });

    it('renders dashboard skeleton when loading without data', () => {
      render(<App />);

      expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
    });

    it('hides welcome state when loading', () => {
      render(<App />);

      expect(screen.queryByTestId('welcome-state')).toBeNull();
    });

    it('shows compact search bar in header when loading', () => {
      render(<App />);

      expect(screen.getByTestId('ticker-search-compact')).toBeTruthy();
    });

    it('does not show hero search when loading', () => {
      render(<App />);

      expect(screen.queryByTestId('ticker-search-hero')).toBeNull();
    });
  });

  // ===========================================================================
  // Error State
  // ===========================================================================

  describe('Error State', () => {
    beforeEach(() => {
      mockHookReturn.error = {
        type: 'DATA',
        message: 'No data found for ticker "XYZ"',
        ticker: 'XYZ',
        originalError: new Error('No data found for ticker "XYZ"'),
        userMessage: 'No data found for ticker "XYZ". Please verify the ticker symbol is correct.',
        retryable: false,
      };
    });

    it('renders ErrorFallback when error exists and not loading', () => {
      render(<App />);

      expect(screen.getByTestId('error-state')).toBeTruthy();
      expect(screen.getByTestId('error-fallback')).toBeTruthy();
    });

    it('hides welcome state when error is present', () => {
      render(<App />);

      expect(screen.queryByTestId('welcome-state')).toBeNull();
    });

    it('does not show dashboard skeleton when error exists', () => {
      render(<App />);

      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
    });

    it('passes correct error type to ErrorFallback', () => {
      render(<App />);

      const fallback = screen.getByTestId('error-fallback');
      expect(fallback.getAttribute('data-error-type')).toBe('DATA');
    });

    it('calls clearError when retry button is clicked', () => {
      render(<App />);

      const retryBtn = screen.getByTestId('error-retry');
      fireEvent.click(retryBtn);

      expect(mockClearError).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Dashboard State (Data Loaded)
  // ===========================================================================

  describe('Dashboard State', () => {
    let mockData;

    beforeEach(() => {
      mockData = createMockCompanyData();
      mockHookReturn.data = mockData;
      mockStockQuoteReturn = {
        data: { price: 178.72, eps: 6.42, pe: 27.8, marketCap: 2780000000000, changesPercentage: 1.2 },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
      mockKeyMetricsReturn = [
        { id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' },
        { id: 'eps', title: 'EPS', value: '$6.42', unit: 'FY2024', trend: 'up' },
        { id: 'fcf', title: 'FCF', value: '$111.0B', unit: 'FY2024', trend: 'up' },
        { id: 'gross-margin', title: 'Gross Margin', value: '28.4%', unit: 'FY2024', trend: undefined },
        { id: 'debt-to-equity', title: 'Debt-to-Equity', value: '--', unit: 'Ratio', trend: undefined },
        { id: 'market-cap', title: 'Market Cap', value: '$2.8T', unit: 'Live', trend: 'up' },
        { id: 'pe-ratio', title: 'P/E Ratio', value: '27.8', unit: 'TTM', trend: undefined },
      ];
    });

    it('renders DashboardLayout when data is loaded', () => {
      render(<App />);

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    });

    it('hides welcome state when data is loaded', () => {
      render(<App />);

      expect(screen.queryByTestId('welcome-state')).toBeNull();
    });

    it('does not show dashboard skeleton when data is loaded', () => {
      render(<App />);

      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
    });

    it('renders CompanyBanner with correct company name and ticker', () => {
      render(<App />);

      expect(screen.getByTestId('company-banner')).toBeTruthy();
      expect(screen.getByTestId('banner-company-name').textContent).toBe('Apple Inc.');
      expect(screen.getByTestId('banner-ticker').textContent).toBe('AAPL');
    });

    it('renders metric cards for available metrics', () => {
      render(<App />);

      expect(screen.getByTestId('dashboard-metrics')).toBeTruthy();
      expect(screen.getByTestId('metric-card-Revenue')).toBeTruthy();
      expect(screen.getByTestId('metric-card-EPS')).toBeTruthy();
      expect(screen.getByTestId('metric-card-FCF')).toBeTruthy();
    });

    it('passes --card-index style to MetricCard for staggered animation', () => {
      render(<App />);

      const revenueCard = screen.getByTestId('metric-card-Revenue');
      expect(revenueCard.style.getPropertyValue('--card-index')).toBe('0');

      const epsCard = screen.getByTestId('metric-card-EPS');
      expect(epsCard.style.getPropertyValue('--card-index')).toBe('1');
    });

    it('formats revenue as large number', () => {
      render(<App />);

      const revenueCard = screen.getByTestId('metric-card-Revenue');
      const value = revenueCard.querySelector('[data-testid="metric-value"]');
      expect(value.textContent).toBe('$394.0B');
    });

    it('shows fiscal year unit on metric cards', () => {
      render(<App />);

      const revenueCard = screen.getByTestId('metric-card-Revenue');
      const unit = revenueCard.querySelector('[data-testid="metric-unit"]');
      expect(unit.textContent).toBe('FY2024');
    });

    it('shows trend indicator on metric cards with sufficient data', () => {
      render(<App />);

      const revenueCard = screen.getByTestId('metric-card-Revenue');
      const trend = revenueCard.querySelector('[data-testid="metric-trend"]');
      expect(trend.textContent).toBe('up');
    });

    it('renders hero chart container with Revenue title', () => {
      render(<App />);

      expect(screen.getByTestId('dashboard-hero-chart')).toBeTruthy();
      expect(screen.getByTestId('chart-container-Revenue')).toBeTruthy();
    });

    it('renders secondary chart containers', () => {
      render(<App />);

      expect(screen.getByTestId('dashboard-secondary-charts')).toBeTruthy();
      expect(screen.getByTestId('chart-container-Free Cash Flow')).toBeTruthy();
      expect(screen.getByTestId('chart-container-Margins')).toBeTruthy();
    });

    it('renders ValuationPanel in the valuation slot', () => {
      render(<App />);

      expect(screen.getByTestId('dashboard-valuation')).toBeTruthy();
      expect(screen.getByTestId('valuation-panel')).toBeTruthy();
    });

    it('passes EPS from normalized data to ValuationPanel', () => {
      render(<App />);

      const panel = screen.getByTestId('valuation-panel');
      expect(panel.getAttribute('data-eps')).toBe('6.42');
    });

    it('passes stock price from useStockQuote to ValuationPanel', () => {
      render(<App />);

      const panel = screen.getByTestId('valuation-panel');
      expect(panel.getAttribute('data-price')).toBe('178.72');
    });

    it('passes company name to ValuationPanel', () => {
      render(<App />);

      const panel = screen.getByTestId('valuation-panel');
      expect(panel.getAttribute('data-company')).toBe('Apple Inc.');
    });

    it('passes priceLoading state to ValuationPanel', () => {
      mockStockQuoteReturn = { data: null, loading: true, error: null, refetch: vi.fn() };
      render(<App />);

      const panel = screen.getByTestId('valuation-panel');
      expect(panel.getAttribute('data-loading')).toBe('true');
    });

    it('shows compact search bar in header when data loaded', () => {
      render(<App />);

      expect(screen.getByTestId('ticker-search-compact')).toBeTruthy();
    });

    it('does not show hero search when data loaded', () => {
      render(<App />);

      expect(screen.queryByTestId('ticker-search-hero')).toBeNull();
    });
  });

  // ===========================================================================
  // Metrics Extraction
  // ===========================================================================

  describe('Metrics Extraction', () => {
    it('renders gross margin from useKeyMetrics hook', () => {
      mockHookReturn.data = createMockCompanyData();
      mockKeyMetricsReturn = [
        { id: 'revenue', title: 'Revenue', value: '$394.0B', unit: 'FY2024', trend: 'up' },
        { id: 'gross-margin', title: 'Gross Margin', value: '28.4%', unit: 'FY2024', trend: undefined },
      ];
      render(<App />);

      expect(screen.getByTestId('metric-card-Gross Margin')).toBeTruthy();
      const marginCard = screen.getByTestId('metric-card-Gross Margin');
      const value = marginCard.querySelector('[data-testid="metric-value"]');
      expect(value.textContent).toBe('28.4%');
    });

    it('renders EPS from useKeyMetrics hook', () => {
      mockHookReturn.data = createMockCompanyData();
      mockKeyMetricsReturn = [
        { id: 'eps', title: 'EPS', value: '$6.42', unit: 'FY2024', trend: 'up' },
      ];
      render(<App />);

      expect(screen.getByTestId('metric-card-EPS')).toBeTruthy();
      const epsCard = screen.getByTestId('metric-card-EPS');
      const value = epsCard.querySelector('[data-testid="metric-value"]');
      expect(value.textContent).toBe('$6.42');
    });

    it('renders 7 metric cards when all metrics plus live data available', () => {
      mockHookReturn.data = createMockCompanyData();
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
    });

    it('handles company with no metrics gracefully', () => {
      mockHookReturn.data = createMockCompanyData({ metrics: {} });
      mockKeyMetricsReturn = [];
      render(<App />);

      // Dashboard should still render, just without metrics section
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.queryByTestId('dashboard-metrics')).toBeNull();
    });

    it('handles company with partial metrics', () => {
      mockHookReturn.data = createMockCompanyData({
        metrics: {
          revenue: {
            annual: [
              { value: 100000000000, period: '2024-09-28', fiscalYear: 2024 },
            ],
            quarterly: [],
            tag: 'Revenues',
          },
        },
      });
      mockKeyMetricsReturn = [
        { id: 'revenue', title: 'Revenue', value: '$100.0B', unit: 'FY2024', trend: undefined },
      ];
      render(<App />);

      expect(screen.getByTestId('metric-card-Revenue')).toBeTruthy();
      // No FCF — that metric card should not exist
      expect(screen.queryByTestId('metric-card-FCF')).toBeNull();
    });
  });

  // ===========================================================================
  // Cache Metadata Display
  // ===========================================================================

  describe('Cache Metadata', () => {
    it('renders cache metadata when metadata is available', () => {
      mockHookReturn.data = createMockCompanyData();
      mockHookReturn.metadata = {
        source: 'indexeddb',
        cacheHit: true,
        lastUpdated: '2024-12-15T10:00:00Z',
      };
      render(<App />);

      const metadataEl = screen.getByTestId('cache-metadata');
      expect(metadataEl).toBeTruthy();
      expect(metadataEl.textContent).toContain('indexeddb');
    });

    it('does not render cache metadata when no metadata', () => {
      mockHookReturn.data = createMockCompanyData();
      mockHookReturn.metadata = null;
      render(<App />);

      expect(screen.queryByTestId('cache-metadata')).toBeNull();
    });

    it('does not render cache metadata when loading', () => {
      mockHookReturn.data = createMockCompanyData();
      mockHookReturn.metadata = { source: 'firestore' };
      mockHookReturn.loading = true;
      render(<App />);

      expect(screen.queryByTestId('cache-metadata')).toBeNull();
    });
  });

  // ===========================================================================
  // Search Interaction
  // ===========================================================================

  describe('Search Interaction', () => {
    it('calls searchCompany when hero search triggers', () => {
      render(<App />);

      const input = screen.getByTestId('ticker-input-hero');
      fireEvent.change(input, { target: { value: 'AAPL' } });
      fireEvent.keyDown(input, { key: 'Enter', target: { value: 'AAPL' } });

      expect(mockSearchCompany).toHaveBeenCalledWith('AAPL');
    });

    it('calls searchCompany when compact search triggers', () => {
      mockHookReturn.data = createMockCompanyData();
      render(<App />);

      const input = screen.getByTestId('ticker-input-compact');
      fireEvent.change(input, { target: { value: 'MSFT' } });
      fireEvent.keyDown(input, { key: 'Enter', target: { value: 'MSFT' } });

      expect(mockSearchCompany).toHaveBeenCalledWith('MSFT');
    });
  });

  // ===========================================================================
  // State Transitions
  // ===========================================================================

  describe('State Transitions', () => {
    it('shows loading skeleton but not error when loading with an existing error', () => {
      mockHookReturn.loading = true;
      mockHookReturn.error = {
        type: 'NETWORK',
        message: 'Connection failed',
        originalError: new Error('Connection failed'),
      };
      render(<App />);

      // Loading takes precedence over error display
      expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
      expect(screen.queryByTestId('error-state')).toBeNull();
    });

    it('shows dashboard when data is loaded even if loading was true before', () => {
      mockHookReturn.data = createMockCompanyData();
      mockHookReturn.loading = false;
      render(<App />);

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
    });
  });
});
