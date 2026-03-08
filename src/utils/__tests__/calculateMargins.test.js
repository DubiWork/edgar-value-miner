/**
 * Tests for Margin Calculation Utility
 *
 * Tests cover:
 * - Standard 5-year data (all 3 margins calculated correctly)
 * - Division by zero (revenue = $0) -> all margins null
 * - Negative net income -> negative percentage
 * - Missing gross profit (banks) -> grossMargin null, others populated
 * - Misaligned fiscal years -> gaps correctly nulled
 * - Single year of data
 * - Empty/null/undefined inputs -> returns []
 * - Gross margin > 100% (software companies)
 * - maxYears option limits output
 * - Non-array inputs -> returns []
 * - Revenue array with value: 0 entries
 * - Only revenue data (no other metrics) -> all margins null
 * - Mixed valid/invalid entries
 * - Chronological sorting verified
 * - Label format "FY2023" verified
 */

import { describe, it, expect } from 'vitest';
import { calculateMargins } from '../../utils/calculateMargins.js';

// =============================================================================
// Test Data Helpers
// =============================================================================

function makeEntry(fiscalYear, value) {
  return { value, fiscalYear };
}

// =============================================================================
// Standard Multi-Year Data
// =============================================================================

describe('calculateMargins', () => {
  describe('standard 5-year data', () => {
    const metrics = {
      revenue: [
        makeEntry(2019, 100000),
        makeEntry(2020, 120000),
        makeEntry(2021, 150000),
        makeEntry(2022, 180000),
        makeEntry(2023, 200000),
      ],
      grossProfit: [
        makeEntry(2019, 60000),
        makeEntry(2020, 72000),
        makeEntry(2021, 90000),
        makeEntry(2022, 108000),
        makeEntry(2023, 120000),
      ],
      operatingIncome: [
        makeEntry(2019, 30000),
        makeEntry(2020, 36000),
        makeEntry(2021, 45000),
        makeEntry(2022, 54000),
        makeEntry(2023, 60000),
      ],
      netIncome: [
        makeEntry(2019, 20000),
        makeEntry(2020, 24000),
        makeEntry(2021, 30000),
        makeEntry(2022, 36000),
        makeEntry(2023, 40000),
      ],
    };

    it('should return all 5 years with correct margins', () => {
      const result = calculateMargins(metrics);
      expect(result).toHaveLength(5);
    });

    it('should calculate gross margin correctly for each year', () => {
      const result = calculateMargins(metrics);
      // All years have 60% gross margin
      result.forEach((year) => {
        expect(year.grossMargin).toBe(60.0);
      });
    });

    it('should calculate operating margin correctly for each year', () => {
      const result = calculateMargins(metrics);
      result.forEach((year) => {
        expect(year.operatingMargin).toBe(30.0);
      });
    });

    it('should calculate net margin correctly for each year', () => {
      const result = calculateMargins(metrics);
      result.forEach((year) => {
        expect(year.netMargin).toBe(20.0);
      });
    });

    it('should include fiscalYear in each result', () => {
      const result = calculateMargins(metrics);
      expect(result.map((r) => r.fiscalYear)).toEqual([2019, 2020, 2021, 2022, 2023]);
    });
  });

  // ===========================================================================
  // Division by Zero (Revenue = $0)
  // ===========================================================================

  describe('division by zero (revenue = $0)', () => {
    it('should return all margins as null when revenue is 0', () => {
      const metrics = {
        revenue: [makeEntry(2023, 0)],
        grossProfit: [makeEntry(2023, 50000)],
        operatingIncome: [makeEntry(2023, 25000)],
        netIncome: [makeEntry(2023, 10000)],
      };
      const result = calculateMargins(metrics);
      expect(result).toHaveLength(1);
      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBeNull();
      expect(result[0].netMargin).toBeNull();
    });

    it('should handle multiple years where some have zero revenue', () => {
      const metrics = {
        revenue: [makeEntry(2022, 0), makeEntry(2023, 100000)],
        grossProfit: [makeEntry(2022, 50000), makeEntry(2023, 60000)],
        operatingIncome: [makeEntry(2022, 25000), makeEntry(2023, 30000)],
        netIncome: [makeEntry(2022, 10000), makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBeNull();
      expect(result[1].grossMargin).toBe(60.0);
    });
  });

  // ===========================================================================
  // Negative Net Income
  // ===========================================================================

  describe('negative net income', () => {
    it('should return negative net margin percentage', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
        grossProfit: [makeEntry(2023, 60000)],
        operatingIncome: [makeEntry(2023, -5000)],
        netIncome: [makeEntry(2023, -15000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].netMargin).toBe(-15.0);
      expect(result[0].operatingMargin).toBe(-5.0);
      expect(result[0].grossMargin).toBe(60.0);
    });
  });

  // ===========================================================================
  // Missing Gross Profit (Banks)
  // ===========================================================================

  describe('missing gross profit (banks/financials)', () => {
    it('should return grossMargin as null with other margins populated', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
        // No grossProfit array at all
        operatingIncome: [makeEntry(2023, 30000)],
        netIncome: [makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBe(30.0);
      expect(result[0].netMargin).toBe(20.0);
    });

    it('should handle empty grossProfit array', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
        grossProfit: [],
        operatingIncome: [makeEntry(2023, 30000)],
        netIncome: [makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBe(30.0);
    });
  });

  // ===========================================================================
  // Misaligned Fiscal Years
  // ===========================================================================

  describe('misaligned fiscal years', () => {
    it('should return null margins for years with no matching metric data', () => {
      const metrics = {
        revenue: [makeEntry(2021, 100000), makeEntry(2022, 120000), makeEntry(2023, 150000)],
        grossProfit: [makeEntry(2022, 72000)], // Only 2022
        operatingIncome: [makeEntry(2021, 30000), makeEntry(2023, 45000)], // Missing 2022
        netIncome: [makeEntry(2023, 30000)], // Only 2023
      };
      const result = calculateMargins(metrics);

      // 2021: gross=null, operating=30%, net=null
      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBe(30.0);
      expect(result[0].netMargin).toBeNull();

      // 2022: gross=60%, operating=null, net=null
      expect(result[1].grossMargin).toBe(60.0);
      expect(result[1].operatingMargin).toBeNull();
      expect(result[1].netMargin).toBeNull();

      // 2023: gross=null, operating=30%, net=20%
      expect(result[2].grossMargin).toBeNull();
      expect(result[2].operatingMargin).toBe(30.0);
      expect(result[2].netMargin).toBe(20.0);
    });
  });

  // ===========================================================================
  // Single Year
  // ===========================================================================

  describe('single year of data', () => {
    it('should return a single-item array with correct margins', () => {
      const metrics = {
        revenue: [makeEntry(2023, 200000)],
        grossProfit: [makeEntry(2023, 140000)],
        operatingIncome: [makeEntry(2023, 60000)],
        netIncome: [makeEntry(2023, 40000)],
      };
      const result = calculateMargins(metrics);
      expect(result).toHaveLength(1);
      expect(result[0].grossMargin).toBe(70.0);
      expect(result[0].operatingMargin).toBe(30.0);
      expect(result[0].netMargin).toBe(20.0);
    });
  });

  // ===========================================================================
  // Empty / Null / Undefined Inputs
  // ===========================================================================

  describe('empty/null/undefined inputs', () => {
    it('should return empty array for null metrics', () => {
      expect(calculateMargins(null)).toEqual([]);
    });

    it('should return empty array for undefined metrics', () => {
      expect(calculateMargins(undefined)).toEqual([]);
    });

    it('should return empty array for empty object', () => {
      expect(calculateMargins({})).toEqual([]);
    });

    it('should return empty array when revenue is null', () => {
      expect(calculateMargins({ revenue: null })).toEqual([]);
    });

    it('should return empty array when revenue is undefined', () => {
      expect(calculateMargins({ revenue: undefined })).toEqual([]);
    });

    it('should return empty array when revenue is empty array', () => {
      expect(calculateMargins({ revenue: [] })).toEqual([]);
    });

    it('should return empty array when called with no arguments', () => {
      expect(calculateMargins()).toEqual([]);
    });
  });

  // ===========================================================================
  // Gross Margin > 100% (Software Companies)
  // ===========================================================================

  describe('gross margin > 100% (unusual but valid)', () => {
    it('should allow gross margin above 100%', () => {
      // This can happen with certain accounting treatments
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
        grossProfit: [makeEntry(2023, 120000)],
        operatingIncome: [makeEntry(2023, 50000)],
        netIncome: [makeEntry(2023, 30000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBe(120.0);
    });
  });

  // ===========================================================================
  // maxYears Option
  // ===========================================================================

  describe('maxYears option', () => {
    const metrics = {
      revenue: [
        makeEntry(2019, 100000),
        makeEntry(2020, 120000),
        makeEntry(2021, 150000),
        makeEntry(2022, 180000),
        makeEntry(2023, 200000),
      ],
      grossProfit: [
        makeEntry(2019, 60000),
        makeEntry(2020, 72000),
        makeEntry(2021, 90000),
        makeEntry(2022, 108000),
        makeEntry(2023, 120000),
      ],
      operatingIncome: [],
      netIncome: [],
    };

    it('should limit output to maxYears (3)', () => {
      const result = calculateMargins(metrics, { maxYears: 3 });
      expect(result).toHaveLength(3);
    });

    it('should return the most recent years when limited', () => {
      const result = calculateMargins(metrics, { maxYears: 3 });
      expect(result[0].fiscalYear).toBe(2021);
      expect(result[1].fiscalYear).toBe(2022);
      expect(result[2].fiscalYear).toBe(2023);
    });

    it('should limit output to maxYears (1)', () => {
      const result = calculateMargins(metrics, { maxYears: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].fiscalYear).toBe(2023);
    });

    it('should return all years when maxYears exceeds data length', () => {
      const result = calculateMargins(metrics, { maxYears: 10 });
      expect(result).toHaveLength(5);
    });

    it('should default to 5 years when maxYears is not specified', () => {
      const sevenYears = {
        revenue: [
          makeEntry(2017, 80000),
          makeEntry(2018, 90000),
          makeEntry(2019, 100000),
          makeEntry(2020, 120000),
          makeEntry(2021, 150000),
          makeEntry(2022, 180000),
          makeEntry(2023, 200000),
        ],
        grossProfit: [],
        operatingIncome: [],
        netIncome: [],
      };
      const result = calculateMargins(sevenYears);
      expect(result).toHaveLength(5);
      expect(result[0].fiscalYear).toBe(2019);
    });
  });

  // ===========================================================================
  // Non-Array Inputs
  // ===========================================================================

  describe('non-array inputs', () => {
    it('should return empty array when revenue is a string', () => {
      expect(calculateMargins({ revenue: 'not-an-array' })).toEqual([]);
    });

    it('should return empty array when revenue is a number', () => {
      expect(calculateMargins({ revenue: 12345 })).toEqual([]);
    });

    it('should return empty array when metrics is an array', () => {
      expect(calculateMargins([1, 2, 3])).toEqual([]);
    });

    it('should return empty array when metrics is a string', () => {
      expect(calculateMargins('invalid')).toEqual([]);
    });
  });

  // ===========================================================================
  // Revenue with value: 0
  // ===========================================================================

  describe('revenue entries with value: 0', () => {
    it('should null all margins for zero-revenue entries', () => {
      const metrics = {
        revenue: [makeEntry(2022, 0), makeEntry(2023, 100000)],
        grossProfit: [makeEntry(2022, 0), makeEntry(2023, 60000)],
        operatingIncome: [makeEntry(2022, 0), makeEntry(2023, 30000)],
        netIncome: [makeEntry(2022, -5000), makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);

      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBeNull();
      expect(result[0].netMargin).toBeNull();

      expect(result[1].grossMargin).toBe(60.0);
      expect(result[1].operatingMargin).toBe(30.0);
      expect(result[1].netMargin).toBe(20.0);
    });
  });

  // ===========================================================================
  // Only Revenue Data
  // ===========================================================================

  describe('only revenue data (no other metrics)', () => {
    it('should return structure with all margins as null', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
      };
      const result = calculateMargins(metrics);
      expect(result).toHaveLength(1);
      expect(result[0].fiscalYear).toBe(2023);
      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBeNull();
      expect(result[0].netMargin).toBeNull();
    });
  });

  // ===========================================================================
  // Mixed Valid / Invalid Entries
  // ===========================================================================

  describe('mixed valid and invalid entries', () => {
    it('should skip null entries in revenue array', () => {
      const metrics = {
        revenue: [null, makeEntry(2023, 100000), undefined],
        grossProfit: [makeEntry(2023, 60000)],
        operatingIncome: [makeEntry(2023, 30000)],
        netIncome: [makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);
      expect(result).toHaveLength(1);
      expect(result[0].grossMargin).toBe(60.0);
    });

    it('should handle NaN revenue values as invalid', () => {
      const metrics = {
        revenue: [{ value: NaN, fiscalYear: 2023 }],
        grossProfit: [makeEntry(2023, 60000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBeNull();
    });

    it('should handle Infinity revenue values as invalid', () => {
      const metrics = {
        revenue: [{ value: Infinity, fiscalYear: 2023 }],
        grossProfit: [makeEntry(2023, 60000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBeNull();
    });
  });

  // ===========================================================================
  // Chronological Sorting
  // ===========================================================================

  describe('chronological sorting', () => {
    it('should sort results by fiscal year ascending (oldest first)', () => {
      const metrics = {
        revenue: [
          makeEntry(2023, 200000),
          makeEntry(2021, 150000),
          makeEntry(2019, 100000),
          makeEntry(2022, 180000),
          makeEntry(2020, 120000),
        ],
        grossProfit: [
          makeEntry(2023, 120000),
          makeEntry(2021, 90000),
          makeEntry(2019, 60000),
          makeEntry(2022, 108000),
          makeEntry(2020, 72000),
        ],
      };
      const result = calculateMargins(metrics);
      const years = result.map((r) => r.fiscalYear);
      expect(years).toEqual([2019, 2020, 2021, 2022, 2023]);
    });
  });

  // ===========================================================================
  // Label Format
  // ===========================================================================

  describe('label format', () => {
    it('should generate FY{year} label for each entry', () => {
      const metrics = {
        revenue: [makeEntry(2021, 100000), makeEntry(2022, 120000), makeEntry(2023, 150000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].label).toBe('FY2021');
      expect(result[1].label).toBe('FY2022');
      expect(result[2].label).toBe('FY2023');
    });

    it('should handle string fiscal year in label', () => {
      const metrics = {
        revenue: [{ value: 100000, fiscalYear: '2023' }],
        grossProfit: [{ value: 60000, fiscalYear: '2023' }],
      };
      const result = calculateMargins(metrics);
      expect(result[0].label).toBe('FY2023');
      expect(result[0].grossMargin).toBe(60.0);
    });
  });

  // ===========================================================================
  // Rounding
  // ===========================================================================

  describe('rounding behavior', () => {
    it('should round margin to 1 decimal place', () => {
      const metrics = {
        revenue: [makeEntry(2023, 300000)],
        grossProfit: [makeEntry(2023, 200333)],
      };
      const result = calculateMargins(metrics);
      // 200333 / 300000 * 100 = 66.7776...  -> 66.8
      expect(result[0].grossMargin).toBe(66.8);
    });

    it('should round down below midpoint', () => {
      const metrics = {
        revenue: [makeEntry(2023, 300000)],
        netIncome: [makeEntry(2023, 100100)],
      };
      const result = calculateMargins(metrics);
      // 100100 / 300000 * 100 = 33.3666... -> 33.4
      expect(result[0].netMargin).toBe(33.4);
    });
  });

  // ===========================================================================
  // Return Type Structure
  // ===========================================================================

  describe('return type structure', () => {
    it('should return an array of objects with required properties', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
        grossProfit: [makeEntry(2023, 60000)],
        operatingIncome: [makeEntry(2023, 30000)],
        netIncome: [makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0]).toHaveProperty('fiscalYear');
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('grossMargin');
      expect(result[0]).toHaveProperty('operatingMargin');
      expect(result[0]).toHaveProperty('netMargin');
    });

    it('should return numbers for margin values on valid data', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
        grossProfit: [makeEntry(2023, 60000)],
        operatingIncome: [makeEntry(2023, 30000)],
        netIncome: [makeEntry(2023, 20000)],
      };
      const result = calculateMargins(metrics);
      expect(typeof result[0].grossMargin).toBe('number');
      expect(typeof result[0].operatingMargin).toBe('number');
      expect(typeof result[0].netMargin).toBe('number');
    });

    it('should return null for margin values on missing metric data', () => {
      const metrics = {
        revenue: [makeEntry(2023, 100000)],
      };
      const result = calculateMargins(metrics);
      expect(result[0].grossMargin).toBeNull();
      expect(result[0].operatingMargin).toBeNull();
      expect(result[0].netMargin).toBeNull();
    });
  });
});
