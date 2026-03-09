/**
 * Tests for Debt-to-Equity Calculation Utility
 *
 * Tests cover:
 * - Normal D/E calculation (low, medium, high ratios)
 * - Fallback chain (totalDebt missing, falls back to shortTermDebt + longTermDebt)
 * - Negative equity edge case -> N/M
 * - Zero equity edge case -> N/M
 * - Zero debt edge case -> 0.00
 * - Missing data (no debt fields, no equity field) -> N/A
 * - Partial data (only longTermDebt, no shortTermDebt)
 * - Trend calculation: D/E decreased (green/positive)
 * - Trend calculation: D/E increased (red/negative)
 * - Trend calculation: D/E unchanged (neutral)
 * - Trend with missing/invalid data
 * - Return type structure validation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDebtToEquity,
  calculateDebtToEquityTrend,
} from '../../utils/calculateDebtToEquity.js';

// =============================================================================
// Normal D/E Calculation
// =============================================================================

describe('calculateDebtToEquity', () => {
  describe('normal D/E calculation', () => {
    it('should calculate low D/E ratio (0.5)', () => {
      const data = { totalDebt: 50000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(0.5);
      expect(result.display).toBe('0.50');
    });

    it('should calculate medium D/E ratio (1.0)', () => {
      const data = { totalDebt: 100000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(1);
      expect(result.display).toBe('1.00');
    });

    it('should calculate high D/E ratio (3.0+)', () => {
      const data = { totalDebt: 300000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(3);
      expect(result.display).toBe('3.00');
    });

    it('should calculate very high D/E ratio', () => {
      const data = { totalDebt: 1000000, stockholdersEquity: 50000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(20);
      expect(result.display).toBe('20.00');
    });

    it('should round to 2 decimal places', () => {
      const data = { totalDebt: 100000, stockholdersEquity: 300000 };
      const result = calculateDebtToEquity(data);
      // 100000 / 300000 = 0.33333... -> 0.33
      expect(result.value).toBe(0.33);
      expect(result.display).toBe('0.33');
    });
  });

  // ===========================================================================
  // Fallback Chain (totalDebt missing)
  // ===========================================================================

  describe('fallback chain for totalDebt', () => {
    it('should fall back to shortTermDebt + longTermDebt when totalDebt is missing', () => {
      const data = {
        shortTermDebt: 30000,
        longTermDebt: 70000,
        stockholdersEquity: 100000,
      };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(1);
      expect(result.display).toBe('1.00');
    });

    it('should prefer totalDebt over shortTermDebt + longTermDebt', () => {
      const data = {
        totalDebt: 200000,
        shortTermDebt: 30000,
        longTermDebt: 70000,
        stockholdersEquity: 100000,
      };
      const result = calculateDebtToEquity(data);
      // Should use totalDebt (200000), not shortTerm + longTerm (100000)
      expect(result.value).toBe(2);
      expect(result.display).toBe('2.00');
    });

    it('should handle only longTermDebt available (no shortTermDebt)', () => {
      const data = {
        longTermDebt: 80000,
        stockholdersEquity: 100000,
      };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(0.8);
      expect(result.display).toBe('0.80');
    });

    it('should handle only shortTermDebt available (no longTermDebt)', () => {
      const data = {
        shortTermDebt: 40000,
        stockholdersEquity: 100000,
      };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(0.4);
      expect(result.display).toBe('0.40');
    });

    it('should fall back when totalDebt is null', () => {
      const data = {
        totalDebt: null,
        shortTermDebt: 50000,
        longTermDebt: 50000,
        stockholdersEquity: 100000,
      };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(1);
      expect(result.display).toBe('1.00');
    });
  });

  // ===========================================================================
  // Negative Equity Edge Case
  // ===========================================================================

  describe('negative equity', () => {
    it('should return N/M with reason for negative equity', () => {
      const data = { totalDebt: 100000, stockholdersEquity: -50000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/M');
      expect(result.reason).toBe('negative-equity');
    });
  });

  // ===========================================================================
  // Zero Equity Edge Case
  // ===========================================================================

  describe('zero equity', () => {
    it('should return N/M with reason for zero equity', () => {
      const data = { totalDebt: 100000, stockholdersEquity: 0 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/M');
      expect(result.reason).toBe('zero-equity');
    });
  });

  // ===========================================================================
  // Zero Debt
  // ===========================================================================

  describe('zero debt', () => {
    it('should return 0.00 when totalDebt is 0', () => {
      const data = { totalDebt: 0, stockholdersEquity: 100000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(0);
      expect(result.display).toBe('0.00');
    });

    it('should return 0.00 when shortTermDebt + longTermDebt = 0', () => {
      const data = {
        shortTermDebt: 0,
        longTermDebt: 0,
        stockholdersEquity: 100000,
      };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBe(0);
      expect(result.display).toBe('0.00');
    });
  });

  // ===========================================================================
  // Missing Data
  // ===========================================================================

  describe('missing data', () => {
    it('should return N/A when no debt fields are present', () => {
      const data = { stockholdersEquity: 100000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/A');
      expect(result.reason).toBe('missing-data');
    });

    it('should return N/A when no equity field is present', () => {
      const data = { totalDebt: 100000 };
      const result = calculateDebtToEquity(data);
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/A');
      expect(result.reason).toBe('missing-data');
    });

    it('should return N/A for null input', () => {
      const result = calculateDebtToEquity(null);
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/A');
      expect(result.reason).toBe('missing-data');
    });

    it('should return N/A for undefined input', () => {
      const result = calculateDebtToEquity(undefined);
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/A');
      expect(result.reason).toBe('missing-data');
    });

    it('should return N/A for empty object', () => {
      const result = calculateDebtToEquity({});
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/A');
      expect(result.reason).toBe('missing-data');
    });

    it('should return N/A when called with no arguments', () => {
      const result = calculateDebtToEquity();
      expect(result.value).toBeNull();
      expect(result.display).toBe('N/A');
      expect(result.reason).toBe('missing-data');
    });
  });

  // ===========================================================================
  // Return Type Structure
  // ===========================================================================

  describe('return type structure', () => {
    it('should return object with value and display for normal result', () => {
      const data = { totalDebt: 100000, stockholdersEquity: 200000 };
      const result = calculateDebtToEquity(data);
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('display');
      expect(typeof result.value).toBe('number');
      expect(typeof result.display).toBe('string');
      expect(result).not.toHaveProperty('reason');
    });

    it('should return object with value, display, and reason for error cases', () => {
      const result = calculateDebtToEquity(null);
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('display');
      expect(result).toHaveProperty('reason');
      expect(result.value).toBeNull();
    });
  });
});

// =============================================================================
// Trend Calculation
// =============================================================================

describe('calculateDebtToEquityTrend', () => {
  describe('D/E decreased (falling = good = green)', () => {
    it('should return positive/green trend when D/E decreases', () => {
      const current = { totalDebt: 80000, stockholdersEquity: 100000 };
      const previous = { totalDebt: 120000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquityTrend(current, previous);
      expect(result.direction).toBe('positive');
      expect(result.color).toBe('green');
      expect(result.currentDE.value).toBe(0.8);
      expect(result.previousDE.value).toBe(1.2);
    });
  });

  describe('D/E increased (rising = bad = red)', () => {
    it('should return negative/red trend when D/E increases', () => {
      const current = { totalDebt: 200000, stockholdersEquity: 100000 };
      const previous = { totalDebt: 100000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquityTrend(current, previous);
      expect(result.direction).toBe('negative');
      expect(result.color).toBe('red');
      expect(result.currentDE.value).toBe(2);
      expect(result.previousDE.value).toBe(1);
    });
  });

  describe('D/E unchanged (neutral)', () => {
    it('should return neutral trend when D/E stays the same', () => {
      const current = { totalDebt: 100000, stockholdersEquity: 100000 };
      const previous = { totalDebt: 100000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquityTrend(current, previous);
      expect(result.direction).toBe('neutral');
      expect(result.color).toBe('neutral');
      expect(result.currentDE.value).toBe(1);
      expect(result.previousDE.value).toBe(1);
    });
  });

  describe('trend with invalid data', () => {
    it('should return neutral when current data is missing', () => {
      const previous = { totalDebt: 100000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquityTrend(null, previous);
      expect(result.direction).toBe('neutral');
      expect(result.color).toBe('neutral');
    });

    it('should return neutral when previous data is missing', () => {
      const current = { totalDebt: 100000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquityTrend(current, null);
      expect(result.direction).toBe('neutral');
      expect(result.color).toBe('neutral');
    });

    it('should return neutral when both periods have null D/E values', () => {
      const current = { stockholdersEquity: -50000, totalDebt: 100000 };
      const previous = { stockholdersEquity: -30000, totalDebt: 80000 };
      const result = calculateDebtToEquityTrend(current, previous);
      expect(result.direction).toBe('neutral');
      expect(result.color).toBe('neutral');
    });

    it('should return neutral when current D/E is null but previous is valid', () => {
      const current = { stockholdersEquity: 0, totalDebt: 100000 };
      const previous = { totalDebt: 100000, stockholdersEquity: 100000 };
      const result = calculateDebtToEquityTrend(current, previous);
      expect(result.direction).toBe('neutral');
      expect(result.color).toBe('neutral');
    });
  });
});
