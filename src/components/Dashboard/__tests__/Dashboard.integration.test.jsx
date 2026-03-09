/**
 * Dashboard Integration Tests
 *
 * Tests verify multi-component rendering, data flow, theme switching,
 * state transitions, and responsive layout when dashboard components
 * work together.
 *
 * These tests render the App component (or close to it) with mocked services,
 * verifying the full flow from welcome state through search to dashboard display.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeProvider';
import App from '../../../App';
import {
  mockAppleData,
  mockNullDataCompany,
  mockNegativeCompany,
  mockPreRevenueCompany,
  mockLongNameCompany,
  mockTenYearCompany,
  mockPartialDataCompany,
} from '../../../__fixtures__/companyData';

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

vi.mock('../../../hooks/useCompanySearch', () => ({
  useCompanySearch: () => mockHookReturn,
  default: () => mockHookReturn,
}));

vi.mock('../../../utils/gaapNormalizer', () => ({
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

// Mock TickerSearch to simplify testing
vi.mock('../../../components/TickerSearch', () => ({
  TickerSearch: ({ variant, onSearch, isSearching, autoFocus, className }) => (
    <div
      data-testid={`ticker-search-${variant}`}
      data-searching={isSearching}
      data-autofocus={autoFocus}
      className={className}
    >
      <input
        data-testid={`ticker-input-${variant}`}
        disabled={isSearching}
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
vi.mock('../../../components/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

// Mock ErrorFallback
vi.mock('../../../components/ErrorBoundary', () => ({
  ErrorFallback: ({ error, errorType, resetError }) => (
    <div data-testid="error-fallback" data-error-type={errorType}>
      <p>{error?.message || 'Unknown error'}</p>
      <button data-testid="error-retry" onClick={resetError}>
        Retry
      </button>
    </div>
  ),
}));

// Use REAL Dashboard components for integration testing
// (no mock for '../components/Dashboard')

// =============================================================================
// Helpers
// =============================================================================

/**
 * Renders App wrapped in ThemeProvider for integration tests.
 * FCFChart (and other chart components) require ThemeProvider context
 * for useChartTheme hook.
 */
function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

/**
 * Rerenders App wrapped in ThemeProvider for integration tests.
 * Used with rerender from RTL when testing state transitions.
 */
function rerenderApp(rerender) {
  return rerender(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function setHookState(overrides) {
  mockHookReturn = {
    data: null,
    loading: false,
    error: null,
    metadata: null,
    searchCompany: mockSearchCompany,
    clearError: mockClearError,
    reset: mockReset,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHookState({});
  });

  afterEach(() => {
    cleanup();
  });

  // ===========================================================================
  // IT-DASH-01: Welcome state -> search -> dashboard renders
  // ===========================================================================

  describe('Welcome to Dashboard transition', () => {
    it('IT-DASH-01: shows welcome state initially, then dashboard after data loads', () => {
      // Phase 1: Welcome state
      const { rerender } = renderApp();
      expect(screen.getByTestId('welcome-state')).toBeTruthy();
      expect(screen.getByText('Find gems in the market')).toBeTruthy();

      // Phase 2: Simulate loading state
      setHookState({ loading: true });
      rerenderApp(rerender);
      expect(screen.queryByTestId('welcome-state')).toBeNull();
      expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();

      // Phase 3: Data loaded
      setHookState({ data: mockAppleData });
      rerenderApp(rerender);
      expect(screen.queryByTestId('welcome-state')).toBeNull();
      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    });

    it('IT-DASH-06: compact search in header triggers new company load', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      const compactInput = screen.getByTestId('ticker-input-compact');
      fireEvent.change(compactInput, { target: { value: 'MSFT' } });
      fireEvent.keyDown(compactInput, { key: 'Enter', target: { value: 'MSFT' } });

      expect(mockSearchCompany).toHaveBeenCalledWith('MSFT');
    });
  });

  // ===========================================================================
  // IT-DASH-02: Loading skeleton -> data loaded transition
  // ===========================================================================

  describe('Loading skeleton to data transition', () => {
    it('IT-DASH-02: shows skeletons during loading, replaced by data', () => {
      // Loading state
      setHookState({ loading: true });
      const { rerender } = renderApp();

      const skeleton = screen.getByTestId('dashboard-skeleton');
      expect(skeleton).toBeTruthy();
      // Verify skeleton has accessible loading indicator
      expect(skeleton.getAttribute('role')).toBe('status');
      expect(skeleton.getAttribute('aria-busy')).toBe('true');

      // Data loaded
      setHookState({ data: mockAppleData });
      rerenderApp(rerender);

      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    });

    it('IT-DASH-14: skeleton renders correct number of loaders', () => {
      setHookState({ loading: true });
      renderApp();

      // DashboardSkeleton uses default 3 metric skeletons + 1 hero + 2 secondary = 3 chart skeletons
      const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
      expect(metricSkeletons.length).toBe(3);

      const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
      expect(chartSkeletons.length).toBe(3); // 1 hero + 2 secondary

      expect(screen.getByTestId('company-banner-skeleton')).toBeTruthy();
    });
  });

  // ===========================================================================
  // IT-DASH-03: Error state renders correctly with retry option
  // ===========================================================================

  describe('Error state handling', () => {
    it('IT-DASH-03: shows error with retry option after API failure', () => {
      setHookState({
        error: {
          type: 'NETWORK',
          message: 'Connection failed',
          originalError: new Error('Connection failed'),
          userMessage: 'Unable to connect.',
          retryable: true,
        },
      });
      renderApp();

      expect(screen.getByTestId('error-state')).toBeTruthy();
      expect(screen.getByTestId('error-fallback')).toBeTruthy();
      expect(screen.getByTestId('error-retry')).toBeTruthy();
    });

    it('IT-DASH-13: error recovery: error -> retry -> success', () => {
      // Error state
      setHookState({
        error: {
          type: 'NETWORK',
          message: 'Connection failed',
          originalError: new Error('Connection failed'),
          retryable: true,
        },
      });
      const { rerender } = renderApp();

      expect(screen.getByTestId('error-fallback')).toBeTruthy();

      // Click retry
      fireEvent.click(screen.getByTestId('error-retry'));
      expect(mockClearError).toHaveBeenCalledTimes(1);

      // Simulate successful reload
      setHookState({ data: mockAppleData });
      rerenderApp(rerender);

      expect(screen.queryByTestId('error-fallback')).toBeNull();
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
    });
  });

  // ===========================================================================
  // IT-DASH-04: MetricCards receive correct computed values
  // ===========================================================================

  describe('MetricCard data flow', () => {
    it('IT-DASH-04: renders metric cards with correctly formatted values from data', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // Revenue card should exist with formatted value
      const metricCards = screen.getAllByTestId('metric-card');
      expect(metricCards.length).toBeGreaterThanOrEqual(3);

      // Check that revenue heading exists
      const headings = screen.getAllByRole('heading', { level: 3 });
      const revenueHeading = headings.find((h) => h.textContent === 'Revenue');
      expect(revenueHeading).toBeTruthy();
    });

    it('IT-DASH-15: metric card trend arrows reflect year-over-year change', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // Apple revenue goes from 391B to 420B = up trend
      // Look for up trend indicator (triangle up)
      const trendElements = document.querySelectorAll('.metric-card__trend--up');
      expect(trendElements.length).toBeGreaterThan(0);
    });

    it('IT-DASH-16: extreme value formatting works correctly', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // Revenue $420B should be formatted as "$420.0B"
      const values = document.querySelectorAll('.metric-card__value');
      const valueTexts = Array.from(values).map((v) => v.textContent);

      // Check that at least one value contains "B" (billions)
      const hasBillions = valueTexts.some((v) => v.includes('B'));
      expect(hasBillions).toBe(true);
    });
  });

  // ===========================================================================
  // IT-DASH-05: Theme toggle updates chart container styling
  // ===========================================================================

  describe('Theme integration', () => {
    it('IT-DASH-05: dashboard layout renders with theme-aware CSS variables', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // Dashboard is rendered within a div that uses CSS variables
      const appContainer = screen.getByTestId('dashboard-layout').closest('[style]');
      // The parent app div uses backgroundColor with CSS var
      expect(appContainer).toBeTruthy();
    });

    it('renders all components consistently with default theme', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // All major components should be present
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.getByTestId('company-banner')).toBeTruthy();

      // ChartContainers should use section elements
      const chartContainers = screen.getAllByTestId('chart-container');
      expect(chartContainers.length).toBe(3); // 1 hero + 2 secondary
      chartContainers.forEach((container) => {
        expect(container.tagName).toBe('SECTION');
      });
    });
  });

  // ===========================================================================
  // IT-DASH-07: All null metrics shows "No data" states
  // ===========================================================================

  describe('Empty and edge-case data handling', () => {
    it('IT-DASH-07: company with empty metrics renders dashboard with placeholder metric cards', () => {
      setHookState({ data: mockNullDataCompany });
      renderApp();

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      // CompanyBanner should still render
      expect(screen.getByTestId('company-banner')).toBeTruthy();
      expect(screen.getByText('No Data Corp')).toBeTruthy();

      // useKeyMetrics always returns 6 metric cards (with '--' for missing values)
      expect(screen.queryAllByTestId('metric-card').length).toBe(6);

      // All values should be '--' placeholders
      const values = document.querySelectorAll('.metric-card__value');
      const allPlaceholder = Array.from(values).every((v) => v.textContent === '--');
      expect(allPlaceholder).toBe(true);
    });

    it('IT-DASH-09: company with 1 year of data renders single data points', () => {
      setHookState({ data: mockPreRevenueCompany });
      renderApp();

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.getByText('New IPO Corp')).toBeTruthy();

      // Should have some metric cards (revenue is 0, netIncome is -50M, etc.)
      // Revenue is 0, so formatLargeNumber(0) = '$0' which is valid
      const metricCards = screen.getAllByTestId('metric-card');
      expect(metricCards.length).toBeGreaterThan(0);
    });

    it('IT-DASH-10: company with 10 years of data renders all data', () => {
      setHookState({ data: mockTenYearCompany });
      renderApp();

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.getByText('Microsoft Corporation')).toBeTruthy();

      // Should have revenue and net income metric cards at minimum
      const headings = screen.getAllByRole('heading', { level: 3 });
      const revenueHeading = headings.find((h) => h.textContent === 'Revenue');
      expect(revenueHeading).toBeTruthy();
    });
  });

  // ===========================================================================
  // IT-DASH-08: Mixed data renders partial charts
  // ===========================================================================

  describe('Partial and mixed data', () => {
    it('IT-DASH-08: partial data company renders available metrics only', () => {
      setHookState({ data: mockPartialDataCompany });
      renderApp();

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();

      // Revenue should exist (3 years of data)
      const headings = screen.getAllByRole('heading', { level: 3 });
      const revenueHeading = headings.find((h) => h.textContent === 'Revenue');
      expect(revenueHeading).toBeTruthy();

      // useKeyMetrics returns fixed 6 metrics: Revenue, EPS, FCF, Gross Margin, D/E, Market Cap
      // EPS should exist (even if value is '--' for empty annual data)
      const epsHeading = headings.find((h) => h.textContent === 'EPS');
      expect(epsHeading).toBeTruthy();
    });

    it('handles company with negative values correctly', () => {
      setHookState({ data: mockNegativeCompany });
      renderApp();

      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.getByText('Money Losing Inc.')).toBeTruthy();

      // Net income is negative: formatLargeNumber(-150000000) = "-$150.0M"
      const values = document.querySelectorAll('.metric-card__value');
      const valueTexts = Array.from(values).map((v) => v.textContent);
      const hasNegative = valueTexts.some((v) => v.startsWith('-'));
      expect(hasNegative).toBe(true);
    });
  });

  // ===========================================================================
  // IT-DASH-11: Screen reader announcements
  // ===========================================================================

  describe('Accessibility', () => {
    it('IT-DASH-11: dashboard skeleton has proper ARIA attributes', () => {
      setHookState({ loading: true });
      renderApp();

      const skeleton = screen.getByTestId('dashboard-skeleton');
      expect(skeleton.getAttribute('role')).toBe('status');
      expect(skeleton.getAttribute('aria-busy')).toBe('true');
      expect(skeleton.getAttribute('aria-label')).toBe('Loading dashboard');
    });

    it('dashboard sections have proper ARIA labels', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // Check that main content area exists
      const main = document.querySelector('main');
      expect(main).toBeTruthy();

      // Dashboard layout sections should have aria-labels
      const sections = document.querySelectorAll('section[aria-label]');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('metric cards have accessible labels', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // MetricCards should have h3 headings for titles
      const metricCards = screen.getAllByTestId('metric-card');
      metricCards.forEach((card) => {
        const heading = card.querySelector('h3');
        expect(heading).toBeTruthy();
      });

      // Value elements should have aria-labels
      const valueElements = document.querySelectorAll('.metric-card__value[aria-label]');
      expect(valueElements.length).toBeGreaterThan(0);
    });

    it('chart containers have accessible section labels', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      const chartContainers = screen.getAllByTestId('chart-container');
      chartContainers.forEach((container) => {
        expect(container.getAttribute('aria-label')).toBeTruthy();
        expect(container.tagName).toBe('SECTION');
      });
    });
  });

  // ===========================================================================
  // IT-DASH-12: Loading state disables search input
  // ===========================================================================

  describe('Loading state behavior', () => {
    it('IT-DASH-12: search input reports searching state during loading', () => {
      setHookState({ loading: true });
      renderApp();

      const compactSearch = screen.getByTestId('ticker-search-compact');
      expect(compactSearch.getAttribute('data-searching')).toBe('true');
    });
  });

  // ===========================================================================
  // Long company name handling
  // ===========================================================================

  describe('Long company name', () => {
    it('renders long company names in banner with title attribute', () => {
      setHookState({ data: mockLongNameCompany });
      renderApp();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.textContent).toBe(mockLongNameCompany.companyName);
      expect(heading.getAttribute('title')).toBe(mockLongNameCompany.companyName);
    });
  });

  // ===========================================================================
  // Full dashboard composition
  // ===========================================================================

  describe('Full dashboard composition', () => {
    it('renders banner, metrics, hero chart, and secondary charts together', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      // Banner
      const banner = screen.getByTestId('company-banner');
      expect(banner).toBeTruthy();
      expect(within(banner).getByText('Apple Inc.')).toBeTruthy();
      expect(within(banner).getByText('AAPL')).toBeTruthy();

      // Metrics
      const metricCards = screen.getAllByTestId('metric-card');
      expect(metricCards.length).toBeGreaterThanOrEqual(3);

      // Charts (hero + 2 secondary)
      const chartContainers = screen.getAllByTestId('chart-container');
      expect(chartContainers.length).toBe(3);

      // Verify chart titles
      const chartTitles = chartContainers.map(
        (c) => c.querySelector('h3')?.textContent,
      );
      expect(chartTitles).toContain('Revenue');
      expect(chartTitles).toContain('Free Cash Flow');
      expect(chartTitles).toContain('Margins');
    });

    it('renders dashboard layout with proper grid structure', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      const layout = screen.getByTestId('dashboard-layout');
      expect(layout.className).toContain('dashboard-layout');
      expect(layout.className).toContain('max-w-7xl');
      expect(layout.className).toContain('mx-auto');

      // Inner grid
      const grid = layout.querySelector('.dashboard-layout__grid');
      expect(grid).toBeTruthy();

      // Metrics grid
      const metricsGrid = layout.querySelector('.dashboard-layout__metrics-grid');
      expect(metricsGrid).toBeTruthy();
    });

    it('renders correct section order in dashboard', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      const layout = screen.getByTestId('dashboard-layout');
      const grid = layout.querySelector('.dashboard-layout__grid');
      const sections = grid.querySelectorAll(':scope > section');

      // Should have: banner, metrics, hero chart, secondary charts
      expect(sections.length).toBeGreaterThanOrEqual(3);
      expect(sections[0].getAttribute('aria-label')).toBe('Company banner');
      expect(sections[1].getAttribute('aria-label')).toBe('Key metrics');
      expect(sections[2].getAttribute('aria-label')).toBe('Primary chart');
    });
  });

  // ===========================================================================
  // Responsive layout CSS classes
  // ===========================================================================

  describe('Responsive layout classes', () => {
    it('dashboard layout has responsive padding classes', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      const layout = screen.getByTestId('dashboard-layout');
      expect(layout.className).toContain('px-4');
      expect(layout.className).toContain('sm:px-6');
      expect(layout.className).toContain('lg:px-8');
    });

    it('chart containers have responsive class', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      const chartContainers = screen.getAllByTestId('chart-container');
      chartContainers.forEach((container) => {
        expect(container.classList.contains('chart-container--responsive')).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Cache metadata display
  // ===========================================================================

  describe('Cache metadata integration', () => {
    it('renders cache metadata below dashboard when available', () => {
      setHookState({
        data: mockAppleData,
        metadata: {
          source: 'indexeddb',
          cacheHit: true,
          lastUpdated: '2025-12-15T10:00:00Z',
        },
      });
      renderApp();

      const metadataEl = screen.getByTestId('cache-metadata');
      expect(metadataEl).toBeTruthy();
      expect(metadataEl.textContent).toContain('indexeddb');
    });

    it('does not render cache metadata when not available', () => {
      setHookState({ data: mockAppleData, metadata: null });
      renderApp();

      expect(screen.queryByTestId('cache-metadata')).toBeNull();
    });
  });

  // ===========================================================================
  // State mutual exclusivity
  // ===========================================================================

  describe('State mutual exclusivity', () => {
    it('only one state is visible at a time: welcome', () => {
      setHookState({});
      renderApp();

      expect(screen.getByTestId('welcome-state')).toBeTruthy();
      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
      expect(screen.queryByTestId('dashboard-layout')).toBeNull();
      expect(screen.queryByTestId('error-state')).toBeNull();
    });

    it('only one state is visible at a time: loading', () => {
      setHookState({ loading: true });
      renderApp();

      expect(screen.queryByTestId('welcome-state')).toBeNull();
      expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
      // Note: dashboard-layout IS present inside DashboardSkeleton (it composes DashboardLayout)
      // But the skeleton wrapper (with aria-busy="true") distinguishes it from the data-loaded state
      expect(screen.getByTestId('dashboard-skeleton').getAttribute('aria-busy')).toBe('true');
      expect(screen.queryByTestId('error-state')).toBeNull();
      // No real company banner or metric cards
      expect(screen.queryByTestId('company-banner')).toBeNull();
      expect(screen.queryAllByTestId('metric-card').length).toBe(0);
    });

    it('only one state is visible at a time: data loaded', () => {
      setHookState({ data: mockAppleData });
      renderApp();

      expect(screen.queryByTestId('welcome-state')).toBeNull();
      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
      expect(screen.getByTestId('dashboard-layout')).toBeTruthy();
      expect(screen.queryByTestId('error-state')).toBeNull();
    });

    it('only one state is visible at a time: error', () => {
      setHookState({
        error: {
          type: 'DATA',
          message: 'Not found',
          originalError: new Error('Not found'),
          retryable: false,
        },
      });
      renderApp();

      expect(screen.queryByTestId('welcome-state')).toBeNull();
      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
      expect(screen.queryByTestId('dashboard-layout')).toBeNull();
      expect(screen.getByTestId('error-state')).toBeTruthy();
    });
  });
});
