/**
 * Loading Skeleton Integration Tests (RT-23)
 *
 * Relocated from e2e/regression/dashboard.spec.js RT-23.
 * The original E2E test used mockAPIs(page, { delay: 2000 }) to observe the
 * skeleton while the API was delayed — a condition that cannot be reliably
 * induced against live staging. This vitest layer uses vi.mock to hold the
 * hook in loading=true state and verifies skeleton rendering with RTL.
 *
 * Also verifies the skeleton→data transition (loading=false + data present).
 *
 * Covers:
 * - dashboard-skeleton renders when loading=true
 * - company-banner-skeleton renders during loading
 * - metric-card-skeleton elements render during loading
 * - chart-container-skeleton elements render during loading
 * - Skeletons are replaced by real content when loading=false + data present
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeProvider';
import App from '../App';
import { mockAppleData } from '../__fixtures__/companyData';

// =============================================================================
// Mock Setup — same pattern as Dashboard.integration.test.jsx
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

// =============================================================================
// Helpers
// =============================================================================

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
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
// RT-23: Loading skeleton appears during data fetch
// =============================================================================

describe('RT-23: Loading skeleton (data fetch in progress)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHookState({});
  });

  afterEach(() => {
    cleanup();
  });

  it('RT-23-a: dashboard-skeleton renders when loading=true', () => {
    setHookState({ loading: true });
    renderApp();

    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('RT-23-b: company-banner-skeleton renders during loading', () => {
    setHookState({ loading: true });
    renderApp();

    expect(screen.getByTestId('company-banner-skeleton')).toBeTruthy();
  });

  it('RT-23-c: metric-card-skeleton elements render during loading', () => {
    setHookState({ loading: true });
    renderApp();

    const metricSkeletons = screen.getAllByTestId('metric-card-skeleton');
    expect(metricSkeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('RT-23-d: chart-container-skeleton elements render during loading', () => {
    setHookState({ loading: true });
    renderApp();

    const chartSkeletons = screen.getAllByTestId('chart-container-skeleton');
    expect(chartSkeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('RT-23-e: welcome state is hidden during loading', () => {
    setHookState({ loading: true });
    renderApp();

    expect(screen.queryByTestId('welcome-state')).toBeNull();
  });

  it('RT-23-f: skeleton has accessible role=status and aria-busy=true', () => {
    setHookState({ loading: true });
    renderApp();

    const skeleton = screen.getByTestId('dashboard-skeleton');
    expect(skeleton.getAttribute('role')).toBe('status');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
  });

  it('RT-23-g: skeleton is replaced by real content when data loads', () => {
    // Phase 1: loading
    setHookState({ loading: true });
    const { rerender } = renderApp();

    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('company-banner')).toBeNull();

    // Phase 2: data available
    setHookState({ data: mockAppleData });
    rerender(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
    expect(screen.getByTestId('company-banner')).toBeTruthy();
  });
});
