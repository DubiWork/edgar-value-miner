/**
 * Tests for Currency Formatting Utility
 *
 * Tests cover:
 * - Billions range formatting ($XB)
 * - Millions range formatting ($XM)
 * - Thousands range formatting ($XK)
 * - Below-thousand exact formatting
 * - Negative values with accounting parentheses notation
 * - Zero value
 * - Non-numeric / invalid inputs (null, undefined, NaN, Infinity, strings)
 * - Custom decimal precision
 * - Forced unit option
 * - Edge cases at unit boundaries
 */

import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../../utils/formatCurrency.js';

// =============================================================================
// Billions Range
// =============================================================================

describe('formatCurrency', () => {
  describe('billions range (>= 1B)', () => {
    it('should format value in the hundreds of billions', () => {
      expect(formatCurrency(394328000000)).toBe('$394.3B');
    });

    it('should format exact 1 billion', () => {
      expect(formatCurrency(1000000000)).toBe('$1.0B');
    });

    it('should format value in tens of billions', () => {
      expect(formatCurrency(56700000000)).toBe('$56.7B');
    });

    it('should format value in single-digit billions', () => {
      expect(formatCurrency(2500000000)).toBe('$2.5B');
    });

    it('should format value just over 1 billion', () => {
      expect(formatCurrency(1100000000)).toBe('$1.1B');
    });

    it('should format value in trillions as billions', () => {
      expect(formatCurrency(1500000000000)).toBe('$1500.0B');
    });
  });

  // ===========================================================================
  // Millions Range
  // ===========================================================================

  describe('millions range (>= 1M, < 1B)', () => {
    it('should format value in hundreds of millions', () => {
      expect(formatCurrency(500000000)).toBe('$500.0M');
    });

    it('should format exact 1 million', () => {
      expect(formatCurrency(1000000)).toBe('$1.0M');
    });

    it('should format value in tens of millions', () => {
      expect(formatCurrency(52000000)).toBe('$52.0M');
    });

    it('should format value with fractional millions', () => {
      expect(formatCurrency(5200000)).toBe('$5.2M');
    });

    it('should format value just over 1 million', () => {
      expect(formatCurrency(1100000)).toBe('$1.1M');
    });

    it('should format 999 million correctly (still M)', () => {
      expect(formatCurrency(999000000)).toBe('$999.0M');
    });
  });

  // ===========================================================================
  // Thousands Range
  // ===========================================================================

  describe('thousands range (>= 1K, < 1M)', () => {
    it('should format value in hundreds of thousands', () => {
      expect(formatCurrency(500000)).toBe('$500.0K');
    });

    it('should format exact 1 thousand', () => {
      expect(formatCurrency(1000)).toBe('$1.0K');
    });

    it('should format value with fractional thousands', () => {
      expect(formatCurrency(7500)).toBe('$7.5K');
    });

    it('should format value in tens of thousands', () => {
      expect(formatCurrency(25000)).toBe('$25.0K');
    });

    it('should format 999 thousand correctly (still K)', () => {
      expect(formatCurrency(999000)).toBe('$999.0K');
    });
  });

  // ===========================================================================
  // Below Thousand (Exact)
  // ===========================================================================

  describe('below thousand (exact display)', () => {
    it('should format 500 without unit suffix', () => {
      expect(formatCurrency(500)).toBe('$500');
    });

    it('should format 1 as exact value', () => {
      expect(formatCurrency(1)).toBe('$1');
    });

    it('should format 999 as exact value', () => {
      expect(formatCurrency(999)).toBe('$999');
    });

    it('should round fractional values below thousand', () => {
      expect(formatCurrency(99.7)).toBe('$100');
    });

    it('should format small values', () => {
      expect(formatCurrency(0.5)).toBe('$1');
    });
  });

  // ===========================================================================
  // Zero
  // ===========================================================================

  describe('zero value', () => {
    it('should format zero as $0', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should format negative zero as $0', () => {
      expect(formatCurrency(-0)).toBe('$0');
    });
  });

  // ===========================================================================
  // Negative Values (Accounting Convention)
  // ===========================================================================

  describe('negative values (parentheses notation)', () => {
    it('should format negative billions with parentheses', () => {
      expect(formatCurrency(-5200000000)).toBe('($5.2B)');
    });

    it('should format negative millions with parentheses', () => {
      expect(formatCurrency(-5200000)).toBe('($5.2M)');
    });

    it('should format negative thousands with parentheses', () => {
      expect(formatCurrency(-7500)).toBe('($7.5K)');
    });

    it('should format negative below-thousand with parentheses', () => {
      expect(formatCurrency(-500)).toBe('($500)');
    });

    it('should format negative value just over 1 billion', () => {
      expect(formatCurrency(-1100000000)).toBe('($1.1B)');
    });
  });

  // ===========================================================================
  // Invalid / Non-numeric Inputs
  // ===========================================================================

  describe('invalid inputs', () => {
    it('should return N/A for null', () => {
      expect(formatCurrency(null)).toBe('N/A');
    });

    it('should return N/A for undefined', () => {
      expect(formatCurrency(undefined)).toBe('N/A');
    });

    it('should return N/A for NaN', () => {
      expect(formatCurrency(NaN)).toBe('N/A');
    });

    it('should return N/A for Infinity', () => {
      expect(formatCurrency(Infinity)).toBe('N/A');
    });

    it('should return N/A for negative Infinity', () => {
      expect(formatCurrency(-Infinity)).toBe('N/A');
    });

    it('should return N/A for string input', () => {
      expect(formatCurrency('394328000000')).toBe('N/A');
    });

    it('should return N/A for boolean input', () => {
      expect(formatCurrency(true)).toBe('N/A');
    });

    it('should return N/A for object input', () => {
      expect(formatCurrency({})).toBe('N/A');
    });

    it('should return N/A for array input', () => {
      expect(formatCurrency([100])).toBe('N/A');
    });

    it('should return N/A when called with no arguments', () => {
      expect(formatCurrency()).toBe('N/A');
    });
  });

  // ===========================================================================
  // Custom Decimals Option
  // ===========================================================================

  describe('decimals option', () => {
    it('should format with 0 decimal places', () => {
      expect(formatCurrency(5200000000, { decimals: 0 })).toBe('$5B');
    });

    it('should format with 2 decimal places', () => {
      expect(formatCurrency(394328000000, { decimals: 2 })).toBe('$394.33B');
    });

    it('should format with 3 decimal places', () => {
      expect(formatCurrency(1234567890, { decimals: 3 })).toBe('$1.235B');
    });

    it('should default to 1 decimal place', () => {
      expect(formatCurrency(5000000)).toBe('$5.0M');
    });
  });

  // ===========================================================================
  // forceUnit Option
  // ===========================================================================

  describe('forceUnit option', () => {
    it('should force billions unit on a millions value', () => {
      expect(formatCurrency(1500000, { forceUnit: 'B' })).toBe('$0.0B');
    });

    it('should force millions unit on a billions value', () => {
      expect(formatCurrency(5000000000, { forceUnit: 'M' })).toBe('$5000.0M');
    });

    it('should force thousands unit on a millions value', () => {
      expect(formatCurrency(5000000, { forceUnit: 'K' })).toBe('$5000.0K');
    });

    it('should handle lowercase forceUnit', () => {
      expect(formatCurrency(5000000000, { forceUnit: 'b' })).toBe('$5.0B');
    });

    it('should handle unknown forceUnit as no-unit (exact)', () => {
      expect(formatCurrency(5000, { forceUnit: 'X' })).toBe('$5000');
    });

    it('should apply forceUnit to negative values', () => {
      expect(formatCurrency(-5000000000, { forceUnit: 'M' })).toBe('($5000.0M)');
    });
  });

  // ===========================================================================
  // Boundary Values
  // ===========================================================================

  describe('boundary values', () => {
    it('should format value at exact billion threshold', () => {
      expect(formatCurrency(1000000000)).toBe('$1.0B');
    });

    it('should format value just below billion as millions', () => {
      expect(formatCurrency(999999999)).toBe('$1000.0M');
    });

    it('should format value at exact million threshold', () => {
      expect(formatCurrency(1000000)).toBe('$1.0M');
    });

    it('should format value just below million as thousands', () => {
      expect(formatCurrency(999999)).toBe('$1000.0K');
    });

    it('should format value at exact thousand threshold', () => {
      expect(formatCurrency(1000)).toBe('$1.0K');
    });

    it('should format value just below thousand as exact', () => {
      expect(formatCurrency(999)).toBe('$999');
    });
  });
});
