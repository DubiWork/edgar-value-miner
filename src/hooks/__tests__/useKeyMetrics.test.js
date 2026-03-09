import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyMetrics } from '../useKeyMetrics';

// =============================================================================
// Mock calculateDebtToEquity (built in parallel — issue #75)
// =============================================================================

vi.mock('../../utils/calculateDebtToEquity', () => ({
  calculateDebtToEquity: vi.fn(() => null),
}));

import { calculateDebtToEquity } from '../../utils/calculateDebtToEquity';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a mock normalized data object matching gaapNormalizer output shape.
 * Each metric has an `annual` array of data points sorted most-recent-first.
 */
function createMockNormalizedData(overrides = {}) {
  return {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    metrics: {
      revenue: {
        annual: [
          { value: 394328000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          { value: 365817000000, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'high' },
        ],
        quarterly: [],
        tag: 'Revenues',
      },
      eps: {
        annual: [
          { value: 6.13, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          { value: 5.89, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'high' },
        ],
        quarterly: [],
        tag: 'EarningsPerShareBasic',
      },
      freeCashFlow: {
        annual: [
          { value: 111443000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'medium' },
          { value: 99803000000, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'medium' },
        ],
        quarterly: [],
        tag: null,
        calculated: true,
      },
      grossProfit: {
        annual: [
          { value: 169148000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          { value: 152836000000, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'high' },
        ],
        quarterly: [],
        tag: 'GrossProfit',
      },
      totalLiabilities: {
        annual: [
          { value: 290437000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          { value: 302083000000, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'high' },
        ],
        quarterly: [],
        tag: 'Liabilities',
      },
      stockholdersEquity: {
        annual: [
          { value: 62146000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          { value: 50672000000, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'high' },
        ],
        quarterly: [],
        tag: 'StockholdersEquity',
      },
      ...overrides,
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('useKeyMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculateDebtToEquity.mockReturnValue(null);
  });

  // ===========================================================================
  // Return structure
  // ===========================================================================

  describe('return structure', () => {
    it('returns an array of 6 metric objects', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      expect(result.current).toHaveLength(6);
    });

    it('each metric has required properties: id, title, value, unit, trend', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      result.current.forEach((metric) => {
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('title');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('unit');
        expect(metric).toHaveProperty('trend');
      });
    });

    it('each metric id is a unique non-empty string', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const ids = result.current.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });

  // ===========================================================================
  // Metric order and content
  // ===========================================================================

  describe('metric order and content', () => {
    it('returns metrics in the correct order: Revenue, EPS, FCF, Gross Margin, D/E, Market Cap', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const titles = result.current.map((m) => m.title);
      expect(titles).toEqual([
        'Revenue',
        'EPS',
        'FCF',
        'Gross Margin',
        'Debt-to-Equity',
        'Market Cap',
      ]);
    });
  });

  // ===========================================================================
  // Revenue metric
  // ===========================================================================

  describe('Revenue metric', () => {
    it('formats revenue using formatLargeNumber', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const revenue = result.current.find((m) => m.id === 'revenue');
      expect(revenue.value).toBe('$394.3B');
    });

    it('displays FY[Year] label (not TTM)', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const revenue = result.current.find((m) => m.id === 'revenue');
      expect(revenue.unit).toBe('FY2023');
    });

    it('shows up trend when current year > previous year', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const revenue = result.current.find((m) => m.id === 'revenue');
      expect(revenue.trend).toBe('up');
    });

    it('shows down trend when current year < previous year', () => {
      const data = createMockNormalizedData({
        revenue: {
          annual: [
            { value: 300000000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
            { value: 365817000000, period: 'CY2022', fiscalYear: 2022, form: '10-K', confidence: 'high' },
          ],
          quarterly: [],
          tag: 'Revenues',
        },
      });

      const { result } = renderHook(() => useKeyMetrics(data));

      const revenue = result.current.find((m) => m.id === 'revenue');
      expect(revenue.trend).toBe('down');
    });
  });

  // ===========================================================================
  // EPS metric
  // ===========================================================================

  describe('EPS metric', () => {
    it('formats EPS as $X.XX', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const eps = result.current.find((m) => m.id === 'eps');
      expect(eps.value).toBe('$6.13');
    });

    it('displays FY[Year] label', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const eps = result.current.find((m) => m.id === 'eps');
      expect(eps.unit).toBe('FY2023');
    });

    it('calculates trend correctly', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const eps = result.current.find((m) => m.id === 'eps');
      // 6.13 > 5.89 = up
      expect(eps.trend).toBe('up');
    });
  });

  // ===========================================================================
  // FCF metric
  // ===========================================================================

  describe('FCF metric', () => {
    it('formats FCF using formatLargeNumber', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const fcf = result.current.find((m) => m.id === 'fcf');
      expect(fcf.value).toBe('$111.4B');
    });

    it('displays FY[Year] label', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const fcf = result.current.find((m) => m.id === 'fcf');
      expect(fcf.unit).toBe('FY2023');
    });

    it('calculates trend correctly', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const fcf = result.current.find((m) => m.id === 'fcf');
      // 111.4B > 99.8B = up
      expect(fcf.trend).toBe('up');
    });
  });

  // ===========================================================================
  // Gross Margin metric
  // ===========================================================================

  describe('Gross Margin metric', () => {
    it('calculates gross margin as grossProfit/revenue formatted as percentage', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const margin = result.current.find((m) => m.id === 'gross-margin');
      // 169148000000 / 394328000000 = 42.9%
      expect(margin.value).toBe('42.9%');
    });

    it('displays FY[Year] label', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const margin = result.current.find((m) => m.id === 'gross-margin');
      expect(margin.unit).toBe('FY2023');
    });

    it('calculates trend from margin change, not raw grossProfit change', () => {
      // Current: 169148000000 / 394328000000 = 42.89%
      // Previous: 152836000000 / 365817000000 = 41.78%
      // Margin went UP
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const margin = result.current.find((m) => m.id === 'gross-margin');
      expect(margin.trend).toBe('up');
    });
  });

  // ===========================================================================
  // Debt-to-Equity metric
  // ===========================================================================

  describe('Debt-to-Equity metric', () => {
    it('calls calculateDebtToEquity with correct data', () => {
      const data = createMockNormalizedData();
      renderHook(() => useKeyMetrics(data));

      expect(calculateDebtToEquity).toHaveBeenCalledWith(data);
    });

    it('formats D/E ratio as X.XX', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const de = result.current.find((m) => m.id === 'debt-to-equity');
      expect(de.value).toBe('4.67');
    });

    it('inverts trend: rising D/E = down (bad), falling D/E = up (good)', () => {
      // ratio dropped from 5.96 to 4.67 — that's GOOD, so trend should be "up"
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const de = result.current.find((m) => m.id === 'debt-to-equity');
      expect(de.trend).toBe('up');
    });

    it('shows down trend when D/E ratio increases (getting worse)', () => {
      // ratio rose from 3.50 to 4.67 — that's BAD, so trend should be "down"
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 3.50 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const de = result.current.find((m) => m.id === 'debt-to-equity');
      expect(de.trend).toBe('down');
    });

    it('shows "--" when calculateDebtToEquity returns null', () => {
      calculateDebtToEquity.mockReturnValue(null);

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const de = result.current.find((m) => m.id === 'debt-to-equity');
      expect(de.value).toBe('--');
    });

    it('has no unit suffix', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const de = result.current.find((m) => m.id === 'debt-to-equity');
      expect(de.unit).toBe('Ratio');
    });
  });

  // ===========================================================================
  // Market Cap placeholder
  // ===========================================================================

  describe('Market Cap placeholder', () => {
    it('shows "--" value', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('--');
    });

    it('shows "Awaiting price data" unit', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.unit).toBe('Awaiting price data');
    });

    it('has undefined trend', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.trend).toBeUndefined();
    });
  });

  // ===========================================================================
  // Loading / null data state
  // ===========================================================================

  describe('loading state', () => {
    it('returns empty array when normalizedData is null', () => {
      const { result } = renderHook(() => useKeyMetrics(null));

      expect(result.current).toEqual([]);
    });

    it('returns empty array when normalizedData is undefined', () => {
      const { result } = renderHook(() => useKeyMetrics(undefined));

      expect(result.current).toEqual([]);
    });

    it('returns empty array when normalizedData.metrics is missing', () => {
      const { result } = renderHook(() => useKeyMetrics({ ticker: 'AAPL' }));

      expect(result.current).toEqual([]);
    });
  });

  // ===========================================================================
  // Missing individual fields
  // ===========================================================================

  describe('missing individual fields', () => {
    it('shows "--" for revenue when revenue metric is missing', () => {
      const data = createMockNormalizedData({
        revenue: { annual: [], quarterly: [], tag: null },
      });

      const { result } = renderHook(() => useKeyMetrics(data));

      const revenue = result.current.find((m) => m.id === 'revenue');
      expect(revenue.value).toBe('--');
    });

    it('shows "--" for EPS when eps metric is missing', () => {
      const data = createMockNormalizedData({
        eps: { annual: [], quarterly: [], tag: null },
      });

      const { result } = renderHook(() => useKeyMetrics(data));

      const eps = result.current.find((m) => m.id === 'eps');
      expect(eps.value).toBe('--');
    });

    it('shows "--" for Gross Margin when grossProfit is missing', () => {
      const data = createMockNormalizedData({
        grossProfit: { annual: [], quarterly: [], tag: null },
      });

      const { result } = renderHook(() => useKeyMetrics(data));

      const margin = result.current.find((m) => m.id === 'gross-margin');
      expect(margin.value).toBe('--');
    });

    it('shows "--" for Gross Margin when revenue is zero', () => {
      const data = createMockNormalizedData({
        revenue: {
          annual: [
            { value: 0, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          ],
          quarterly: [],
          tag: 'Revenues',
        },
      });

      const { result } = renderHook(() => useKeyMetrics(data));

      const margin = result.current.find((m) => m.id === 'gross-margin');
      expect(margin.value).toBe('--');
    });

    it('handles missing trend data (only 1 year) gracefully', () => {
      const data = createMockNormalizedData({
        revenue: {
          annual: [
            { value: 394328000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          ],
          quarterly: [],
          tag: 'Revenues',
        },
      });

      const { result } = renderHook(() => useKeyMetrics(data));

      const revenue = result.current.find((m) => m.id === 'revenue');
      expect(revenue.trend).toBeUndefined();
    });
  });

  // ===========================================================================
  // Memoization
  // ===========================================================================

  describe('memoization', () => {
    it('returns the same array reference when input has not changed', () => {
      const data = createMockNormalizedData();

      const { result, rerender } = renderHook(
        ({ normalizedData }) => useKeyMetrics(normalizedData),
        { initialProps: { normalizedData: data } }
      );

      const firstResult = result.current;
      rerender({ normalizedData: data });
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('returns a new array reference when input changes', () => {
      const data1 = createMockNormalizedData();
      const data2 = createMockNormalizedData({
        revenue: {
          annual: [
            { value: 500000000000, period: 'CY2024', fiscalYear: 2024, form: '10-K', confidence: 'high' },
            { value: 394328000000, period: 'CY2023', fiscalYear: 2023, form: '10-K', confidence: 'high' },
          ],
          quarterly: [],
          tag: 'Revenues',
        },
      });

      const { result, rerender } = renderHook(
        ({ normalizedData }) => useKeyMetrics(normalizedData),
        { initialProps: { normalizedData: data1 } }
      );

      const firstResult = result.current;
      rerender({ normalizedData: data2 });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });
});
