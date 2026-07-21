/**
 * Error Boundary Integration Tests (RT-24)
 *
 * Relocated from e2e/regression/dashboard.spec.js RT-24.
 * The original E2E test used mockAPIs(page, { errorOnFacts: true }) to induce
 * a 500 from the Cloud Function — a condition that cannot be triggered against
 * live staging infra. This vitest layer uses vi.mock to simulate an API error
 * at the module level and verifies the UI state with React Testing Library.
 *
 * Covers:
 * - Error state renders when useCompanySearch returns an error
 * - Error container (data-testid="error-state") is present
 * - Retry button (btn-primary) is present
 * - Go Home button (btn-secondary) is present
 * - Dashboard layout is NOT visible in error state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeProvider';
import App from '../App';

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
// RT-24: Error boundary displays with retry when API errors
// =============================================================================

describe('RT-24: Error boundary (API error state)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHookState({});
  });

  afterEach(() => {
    cleanup();
  });

  it('RT-24-a: error-state container renders when secCompanyFacts returns 500', () => {
    // Simulate what happens when the Cloud Function returns 500:
    // cacheCoordinator throws, useCompanySearch sets error with type NETWORK.
    setHookState({
      error: {
        type: 'NETWORK',
        message: 'SEC API returned 500',
        ticker: 'AAPL',
        originalError: new Error('SEC API returned 500'),
        userMessage: 'Unable to connect to SEC EDGAR service.',
        retryable: true,
      },
    });
    renderApp();

    expect(screen.getByTestId('error-state')).toBeTruthy();
  });

  it('RT-24-b: dashboard layout is NOT visible in error state', () => {
    setHookState({
      error: {
        type: 'NETWORK',
        message: 'SEC API returned 500',
        ticker: 'AAPL',
        originalError: new Error('SEC API returned 500'),
        userMessage: 'Unable to connect.',
        retryable: true,
      },
    });
    renderApp();

    expect(screen.queryByTestId('dashboard-layout')).toBeNull();
  });

  it('RT-24-c: retry button (btn-primary) is visible in error state', () => {
    setHookState({
      error: {
        type: 'NETWORK',
        message: 'SEC API returned 500',
        ticker: 'AAPL',
        originalError: new Error('SEC API returned 500'),
        userMessage: 'Unable to connect.',
        retryable: true,
      },
    });
    renderApp();

    const errorState = screen.getByTestId('error-state');
    const retryButton = errorState.querySelector('button.btn-primary');
    expect(retryButton).toBeTruthy();
  });

  it('RT-24-d: go-home button (btn-secondary) is visible in error state', () => {
    setHookState({
      error: {
        type: 'NETWORK',
        message: 'SEC API returned 500',
        ticker: 'AAPL',
        originalError: new Error('SEC API returned 500'),
        userMessage: 'Unable to connect.',
        retryable: true,
      },
    });
    renderApp();

    const errorState = screen.getByTestId('error-state');
    const goHomeButton = errorState.querySelector('button.btn-secondary');
    expect(goHomeButton).toBeTruthy();
  });

  it('RT-24-e: DATA error type (TICKER_NOT_FOUND) also renders error state', () => {
    setHookState({
      error: {
        type: 'DATA',
        message: 'Ticker not found: ZZZZZ',
        ticker: 'ZZZZZ',
        originalError: new Error('Ticker not found: ZZZZZ'),
        userMessage: 'No data found for ticker "ZZZZZ".',
        retryable: false,
      },
    });
    renderApp();

    expect(screen.getByTestId('error-state')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-layout')).toBeNull();
  });
});
