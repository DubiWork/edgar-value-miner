import { describe, it, expect, vi, beforeEach } from 'vitest';
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

/**
 * Creates a mock stock quote object matching FMP API / useStockQuote data shape.
 */
function createMockStockQuote(overrides = {}) {
  return {
    price: 178.72,
    eps: 6.13,
    pe: 29.15,
    marketCap: 2810000000000,
    sharesOutstanding: 15728700000,
    changesPercentage: 1.25,
    name: 'Apple Inc.',
    ...overrides,
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
    it('returns an array of 7 metric objects', () => {
      calculateDebtToEquity.mockReturnValue({ ratio: 4.67, previousRatio: 5.96 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      expect(result.current).toHaveLength(7);
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
    it('returns metrics in the correct order: Revenue, EPS, FCF, Gross Margin, D/E, Market Cap, P/E Ratio', () => {
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
        'P/E Ratio',
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
  // Market Cap — without stockQuote (backward compatible)
  // ===========================================================================

  describe('Market Cap without stockQuote (backward compatible)', () => {
    it('shows "--" value when stockQuote is not provided', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('--');
    });

    it('shows "Awaiting price data" unit when stockQuote is not provided', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.unit).toBe('Awaiting price data');
    });

    it('has undefined trend when stockQuote is not provided', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.trend).toBeUndefined();
    });

    it('shows "--" when stockQuote is explicitly null', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), null));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('--');
      expect(marketCap.unit).toBe('Awaiting price data');
    });

    it('shows "--" when stockQuote is explicitly undefined', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), undefined));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('--');
      expect(marketCap.unit).toBe('Awaiting price data');
    });
  });

  // ===========================================================================
  // Market Cap — with stockQuote (live data)
  // ===========================================================================

  describe('Market Cap with stockQuote', () => {
    it('fills Market Cap from stockQuote.marketCap', () => {
      const quote = createMockStockQuote({ marketCap: 2810000000000 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('$2.8T');
    });

    it('formats Market Cap in trillions correctly ($X.XT)', () => {
      const quote = createMockStockQuote({ marketCap: 3500000000000 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('$3.5T');
    });

    it('formats Market Cap in billions correctly ($X.XB)', () => {
      const quote = createMockStockQuote({ marketCap: 2100000000 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('$2.1B');
    });

    it('formats Market Cap in millions correctly ($X.XM)', () => {
      const quote = createMockStockQuote({ marketCap: 850000000 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('$850.0M');
    });

    it('shows "Live" unit when stockQuote provides marketCap', () => {
      const quote = createMockStockQuote();

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.unit).toBe('Live');
    });

    it('derives up trend from positive changesPercentage', () => {
      const quote = createMockStockQuote({ changesPercentage: 1.25 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.trend).toBe('up');
    });

    it('derives down trend from negative changesPercentage', () => {
      const quote = createMockStockQuote({ changesPercentage: -2.50 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.trend).toBe('down');
    });

    it('derives neutral trend from zero changesPercentage', () => {
      const quote = createMockStockQuote({ changesPercentage: 0 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.trend).toBe('neutral');
    });

    it('shows undefined trend when changesPercentage is missing', () => {
      const quote = createMockStockQuote({ changesPercentage: undefined });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.trend).toBeUndefined();
    });

    it('shows "--" when stockQuote has missing marketCap field', () => {
      const quote = createMockStockQuote({ marketCap: undefined });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('--');
      expect(marketCap.unit).toBe('Awaiting price data');
    });

    it('shows "--" when stockQuote has null marketCap', () => {
      const quote = createMockStockQuote({ marketCap: null });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const marketCap = result.current.find((m) => m.id === 'market-cap');
      expect(marketCap.value).toBe('--');
      expect(marketCap.unit).toBe('Awaiting price data');
    });
  });

  // ===========================================================================
  // P/E Ratio — without stockQuote (backward compatible)
  // ===========================================================================

  describe('P/E Ratio without stockQuote (backward compatible)', () => {
    it('shows "--" value when stockQuote is not provided', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.value).toBe('--');
    });

    it('shows "Awaiting price data" unit when stockQuote is not provided', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.unit).toBe('Awaiting price data');
    });

    it('has undefined trend when stockQuote is not provided', () => {
      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData()));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.trend).toBeUndefined();
    });
  });

  // ===========================================================================
  // P/E Ratio — with stockQuote (live data)
  // ===========================================================================

  describe('P/E Ratio with stockQuote', () => {
    it('fills P/E from stockQuote.pe', () => {
      const quote = createMockStockQuote({ pe: 29.15 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.value).toBe('29.1');
    });

    it('formats P/E correctly with one decimal place (XX.X)', () => {
      const quote = createMockStockQuote({ pe: 15.678 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.value).toBe('15.7');
    });

    it('shows "TTM" unit when stockQuote provides pe', () => {
      const quote = createMockStockQuote();

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.unit).toBe('TTM');
    });

    it('shows "--" when stockQuote has missing pe field', () => {
      const quote = createMockStockQuote({ pe: undefined });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.value).toBe('--');
      expect(pe.unit).toBe('Awaiting price data');
    });

    it('shows "--" when stockQuote has null pe', () => {
      const quote = createMockStockQuote({ pe: null });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.value).toBe('--');
      expect(pe.unit).toBe('Awaiting price data');
    });

    it('handles pe value of 0 (displays 0.0)', () => {
      const quote = createMockStockQuote({ pe: 0 });

      const { result } = renderHook(() => useKeyMetrics(createMockNormalizedData(), quote));

      const pe = result.current.find((m) => m.id === 'pe-ratio');
      expect(pe.value).toBe('0.0');
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

    it('returns empty array even when stockQuote is provided but normalizedData is null', () => {
      const quote = createMockStockQuote();

      const { result } = renderHook(() => useKeyMetrics(null, quote));

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
        ({ normalizedData, stockQuote }) => useKeyMetrics(normalizedData, stockQuote),
        { initialProps: { normalizedData: data, stockQuote: null } }
      );

      const firstResult = result.current;
      rerender({ normalizedData: data, stockQuote: null });
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('returns a new array reference when normalizedData changes', () => {
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
        ({ normalizedData, stockQuote }) => useKeyMetrics(normalizedData, stockQuote),
        { initialProps: { normalizedData: data1, stockQuote: null } }
      );

      const firstResult = result.current;
      rerender({ normalizedData: data2, stockQuote: null });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });

    it('returns a new array reference when stockQuote changes', () => {
      const data = createMockNormalizedData();
      const quote1 = createMockStockQuote({ marketCap: 2800000000000 });
      const quote2 = createMockStockQuote({ marketCap: 3000000000000 });

      const { result, rerender } = renderHook(
        ({ normalizedData, stockQuote }) => useKeyMetrics(normalizedData, stockQuote),
        { initialProps: { normalizedData: data, stockQuote: quote1 } }
      );

      const firstResult = result.current;
      rerender({ normalizedData: data, stockQuote: quote2 });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });

    it('returns a new array reference when stockQuote goes from null to a value', () => {
      const data = createMockNormalizedData();
      const quote = createMockStockQuote();

      const { result, rerender } = renderHook(
        ({ normalizedData, stockQuote }) => useKeyMetrics(normalizedData, stockQuote),
        { initialProps: { normalizedData: data, stockQuote: null } }
      );

      const firstResult = result.current;
      rerender({ normalizedData: data, stockQuote: quote });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });
});
