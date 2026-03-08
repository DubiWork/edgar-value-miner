/**
 * Tests for Year-over-Year Calculation Utility
 *
 * Tests cover:
 * - Positive growth (formatted with "+" prefix)
 * - Negative growth (formatted with "-" prefix)
 * - Zero growth
 * - Division by zero (previous value = 0)
 * - Non-numeric / invalid inputs (null, undefined, NaN, Infinity, strings)
 * - Large percentage changes
 * - Small percentage changes
 * - Negative-to-negative transitions
 * - Negative-to-positive transitions
 * - Return type structure validation
 */

import { describe, it, expect } from 'vitest';
import { calculateYoY } from '../../utils/calculateYoY.js';

// =============================================================================
// Positive Growth
// =============================================================================

describe('calculateYoY', () => {
  describe('positive growth', () => {
    it('should calculate positive percentage change', () => {
      const result = calculateYoY(107800, 100000);
      expect(result.percentage).toBe(7.8);
      expect(result.formatted).toBe('+7.8%');
    });

    it('should format with + prefix for positive growth', () => {
      const result = calculateYoY(120000, 100000);
      expect(result.formatted).toBe('+20.0%');
    });

    it('should handle 100% growth (value doubled)', () => {
      const result = calculateYoY(200000, 100000);
      expect(result.percentage).toBe(100);
      expect(result.formatted).toBe('+100.0%');
    });

    it('should handle very large growth (10x)', () => {
      const result = calculateYoY(1000000, 100000);
      expect(result.percentage).toBe(900);
      expect(result.formatted).toBe('+900.0%');
    });

    it('should handle fractional percentage growth', () => {
      const result = calculateYoY(100500, 100000);
      expect(result.percentage).toBe(0.5);
      expect(result.formatted).toBe('+0.5%');
    });
  });

  // ===========================================================================
  // Negative Growth
  // ===========================================================================

  describe('negative growth', () => {
    it('should calculate negative percentage change', () => {
      const result = calculateYoY(94800, 100000);
      expect(result.percentage).toBe(-5.2);
      expect(result.formatted).toBe('-5.2%');
    });

    it('should format with - prefix for negative growth', () => {
      const result = calculateYoY(80000, 100000);
      expect(result.formatted).toBe('-20.0%');
    });

    it('should handle 50% decline', () => {
      const result = calculateYoY(50000, 100000);
      expect(result.percentage).toBe(-50);
      expect(result.formatted).toBe('-50.0%');
    });

    it('should handle 100% decline (value went to zero)', () => {
      const result = calculateYoY(0, 100000);
      expect(result.percentage).toBe(-100);
      expect(result.formatted).toBe('-100.0%');
    });

    it('should handle decline beyond 100% (value went negative)', () => {
      const result = calculateYoY(-50000, 100000);
      expect(result.percentage).toBe(-150);
      expect(result.formatted).toBe('-150.0%');
    });
  });

  // ===========================================================================
  // Zero Growth
  // ===========================================================================

  describe('zero growth', () => {
    it('should show 0.0% when values are equal', () => {
      const result = calculateYoY(100000, 100000);
      expect(result.percentage).toBe(0);
      expect(result.formatted).toBe('0.0%');
    });

    it('should show 0.0% for both zero values handled as N/A (division by zero)', () => {
      // When previous is 0, it's division by zero -> N/A
      const result = calculateYoY(0, 0);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });
  });

  // ===========================================================================
  // Division by Zero
  // ===========================================================================

  describe('division by zero (previous = 0)', () => {
    it('should return N/A when previous value is 0', () => {
      const result = calculateYoY(100000, 0);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A when previous value is 0 and current is negative', () => {
      const result = calculateYoY(-50000, 0);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A when previous value is 0 and current is 0', () => {
      const result = calculateYoY(0, 0);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });
  });

  // ===========================================================================
  // Invalid Inputs
  // ===========================================================================

  describe('invalid inputs', () => {
    it('should return N/A for null current value', () => {
      const result = calculateYoY(null, 100000);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for null previous value', () => {
      const result = calculateYoY(100000, null);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for undefined current value', () => {
      const result = calculateYoY(undefined, 100000);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for undefined previous value', () => {
      const result = calculateYoY(100000, undefined);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for NaN current value', () => {
      const result = calculateYoY(NaN, 100000);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for NaN previous value', () => {
      const result = calculateYoY(100000, NaN);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for Infinity current value', () => {
      const result = calculateYoY(Infinity, 100000);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for Infinity previous value', () => {
      const result = calculateYoY(100000, Infinity);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for string current value', () => {
      const result = calculateYoY('100000', 100000);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for string previous value', () => {
      const result = calculateYoY(100000, '100000');
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A for both values null', () => {
      const result = calculateYoY(null, null);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('should return N/A when called with no arguments', () => {
      const result = calculateYoY();
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });
  });

  // ===========================================================================
  // Negative-to-Negative Transitions
  // ===========================================================================

  describe('negative-to-negative transitions', () => {
    it('should handle improvement from negative to less negative', () => {
      // -100 to -50 means the loss decreased: (-50 - (-100)) / |-100| = 50%
      const result = calculateYoY(-50, -100);
      expect(result.percentage).toBe(50);
      expect(result.formatted).toBe('+50.0%');
    });

    it('should handle worsening from negative to more negative', () => {
      // -100 to -200 means loss increased: (-200 - (-100)) / |-100| = -100%
      const result = calculateYoY(-200, -100);
      expect(result.percentage).toBe(-100);
      expect(result.formatted).toBe('-100.0%');
    });

    it('should handle same negative values', () => {
      const result = calculateYoY(-100, -100);
      expect(result.percentage).toBe(0);
      expect(result.formatted).toBe('0.0%');
    });
  });

  // ===========================================================================
  // Negative-to-Positive Transitions
  // ===========================================================================

  describe('sign transitions', () => {
    it('should handle transition from negative to positive', () => {
      // -100 to 100: (100 - (-100)) / |-100| = 200%
      const result = calculateYoY(100, -100);
      expect(result.percentage).toBe(200);
      expect(result.formatted).toBe('+200.0%');
    });

    it('should handle transition from positive to negative', () => {
      // 100 to -100: (-100 - 100) / |100| = -200%
      const result = calculateYoY(-100, 100);
      expect(result.percentage).toBe(-200);
      expect(result.formatted).toBe('-200.0%');
    });
  });

  // ===========================================================================
  // Return Type Structure
  // ===========================================================================

  describe('return type structure', () => {
    it('should return an object with percentage and formatted properties', () => {
      const result = calculateYoY(120000, 100000);
      expect(result).toHaveProperty('percentage');
      expect(result).toHaveProperty('formatted');
    });

    it('should return a number for percentage on valid input', () => {
      const result = calculateYoY(120000, 100000);
      expect(typeof result.percentage).toBe('number');
    });

    it('should return a string for formatted on valid input', () => {
      const result = calculateYoY(120000, 100000);
      expect(typeof result.formatted).toBe('string');
    });

    it('should return null for percentage on invalid input', () => {
      const result = calculateYoY(null, 100000);
      expect(result.percentage).toBeNull();
    });

    it('should return "N/A" string for formatted on invalid input', () => {
      const result = calculateYoY(null, 100000);
      expect(result.formatted).toBe('N/A');
    });
  });

  // ===========================================================================
  // Rounding
  // ===========================================================================

  describe('rounding behavior', () => {
    it('should round to 1 decimal place', () => {
      // 107850 / 100000 = 1.0785 => 7.85% => rounds to 7.9%
      const result = calculateYoY(107850, 100000);
      expect(result.percentage).toBe(7.9);
      expect(result.formatted).toBe('+7.9%');
    });

    it('should round down when below midpoint', () => {
      // 107840 / 100000 = 1.0784 => 7.84% => rounds to 7.8%
      const result = calculateYoY(107840, 100000);
      expect(result.percentage).toBe(7.8);
      expect(result.formatted).toBe('+7.8%');
    });

    it('should handle very small percentage changes', () => {
      // 100010 / 100000 = 0.01% => rounds to 0.0%
      const result = calculateYoY(100010, 100000);
      expect(result.percentage).toBe(0);
      expect(result.formatted).toBe('0.0%');
    });
  });
});
