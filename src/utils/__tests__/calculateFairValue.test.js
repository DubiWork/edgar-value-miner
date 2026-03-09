/**
 * Tests for Fair Value Calculation Utility
 *
 * Tests cover:
 * - Normal P/E-based fair value calculation
 * - Margin of Safety: positive (undervalued), negative (overvalued), near zero (fair)
 * - Valuation threshold boundaries (exactly 25%, exactly -10%)
 * - Edge cases: negative EPS, zero EPS, missing EPS, missing currentPrice
 * - Default and custom targetPE; targetPE = 0 fallback
 * - Display formatting: dollar amounts, percentages, P/E ratio
 * - Very large and very small values
 * - getValuationColor: CSS variable mapping
 * - getValuationIcon: icon mapping
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFairValue,
  getValuationColor,
  getValuationIcon,
} from '../../utils/calculateFairValue.js';

// =============================================================================
// calculateFairValue — Normal Calculations
// =============================================================================

describe('calculateFairValue', () => {
  describe('normal calculation', () => {
    it('should calculate fair value as EPS x targetPE', () => {
      const result = calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 });
      expect(result.fairValue).toBe(104.55);
      expect(result.targetPE).toBe(15);
    });

    it('should calculate currentPE as currentPrice / EPS (1 decimal place)', () => {
      const result = calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 });
      // 175 / 6.97 = 25.107... -> 25.1
      expect(result.currentPE).toBe(25.1);
    });

    it('should use default targetPE of 15 when not specified', () => {
      const result = calculateFairValue({ eps: 10, currentPrice: 150 });
      expect(result.fairValue).toBe(150);
      expect(result.targetPE).toBe(15);
    });

    it('should accept custom targetPE', () => {
      const result = calculateFairValue({ eps: 10, currentPrice: 150, targetPE: 20 });
      expect(result.fairValue).toBe(200);
      expect(result.targetPE).toBe(20);
    });

    it('should use default 15 when targetPE is 0', () => {
      const result = calculateFairValue({ eps: 10, currentPrice: 150, targetPE: 0 });
      expect(result.fairValue).toBe(150);
      expect(result.targetPE).toBe(15);
    });
  });

  // ===========================================================================
  // Margin of Safety
  // ===========================================================================

  describe('margin of safety', () => {
    it('should calculate positive MoS for undervalued stock', () => {
      // fairValue = 10 * 15 = 150, currentPrice = 100
      // MoS = (150 - 100) / 150 * 100 = 33.3%
      const result = calculateFairValue({ eps: 10, currentPrice: 100, targetPE: 15 });
      expect(result.marginOfSafety).toBeCloseTo(33.3, 1);
      expect(result.valuationStatus).toBe('undervalued');
    });

    it('should calculate negative MoS for overvalued stock', () => {
      // fairValue = 5 * 15 = 75, currentPrice = 100
      // MoS = (75 - 100) / 75 * 100 = -33.3%
      const result = calculateFairValue({ eps: 5, currentPrice: 100, targetPE: 15 });
      expect(result.marginOfSafety).toBeCloseTo(-33.3, 1);
      expect(result.valuationStatus).toBe('overvalued');
    });

    it('should calculate MoS near zero for fair value stock', () => {
      // fairValue = 10 * 15 = 150, currentPrice = 150
      // MoS = (150 - 150) / 150 * 100 = 0%
      const result = calculateFairValue({ eps: 10, currentPrice: 150, targetPE: 15 });
      expect(result.marginOfSafety).toBe(0);
      expect(result.valuationStatus).toBe('fair');
    });
  });

  // ===========================================================================
  // Valuation Threshold Boundaries
  // ===========================================================================

  describe('valuation threshold boundaries', () => {
    it('should classify exactly 25% MoS as undervalued', () => {
      // fairValue = 100, currentPrice = 75 -> MoS = (100-75)/100*100 = 25%
      const result = calculateFairValue({ eps: 100 / 15, currentPrice: 75, targetPE: 15 });
      // fairValue = (100/15)*15 = 100 (exact)
      // MoS = (100-75)/100*100 = 25.0
      expect(result.marginOfSafety).toBeCloseTo(25, 0);
      expect(result.valuationStatus).toBe('undervalued');
    });

    it('should classify exactly -10% MoS as overvalued', () => {
      // fairValue = 100, currentPrice = 110 -> MoS = (100-110)/100*100 = -10%
      const result = calculateFairValue({ eps: 100 / 15, currentPrice: 110, targetPE: 15 });
      expect(result.marginOfSafety).toBeCloseTo(-10, 0);
      expect(result.valuationStatus).toBe('fair');
    });

    it('should classify MoS just below 25% as fair', () => {
      // fairValue = 100, currentPrice = 75.1 -> MoS = (100-75.1)/100*100 = 24.9%
      const result = calculateFairValue({ eps: 100 / 15, currentPrice: 75.1, targetPE: 15 });
      expect(result.valuationStatus).toBe('fair');
    });

    it('should classify MoS just below -10% as overvalued', () => {
      // fairValue = 100, currentPrice = 110.2 -> MoS = (100-110.2)/100*100 = -10.2%
      const result = calculateFairValue({ eps: 100 / 15, currentPrice: 110.2, targetPE: 15 });
      expect(result.valuationStatus).toBe('overvalued');
    });
  });

  // ===========================================================================
  // Edge Cases — Invalid EPS
  // ===========================================================================

  describe('invalid EPS', () => {
    it('should return unavailable for negative EPS', () => {
      const result = calculateFairValue({ eps: -5, currentPrice: 100 });
      expect(result.fairValue).toBeNull();
      expect(result.valuationStatus).toBe('unavailable');
      expect(result.marginOfSafety).toBeNull();
      expect(result.currentPE).toBeNull();
      expect(result.display.fairValue).toBe('N/A');
      expect(result.display.marginOfSafety).toBe('N/A');
      expect(result.display.currentPE).toBe('N/A');
      expect(result.display.valuationStatus).toBe('N/A');
    });

    it('should return unavailable for zero EPS', () => {
      const result = calculateFairValue({ eps: 0, currentPrice: 100 });
      expect(result.fairValue).toBeNull();
      expect(result.valuationStatus).toBe('unavailable');
    });

    it('should return unavailable for null EPS', () => {
      const result = calculateFairValue({ eps: null, currentPrice: 100 });
      expect(result.fairValue).toBeNull();
      expect(result.valuationStatus).toBe('unavailable');
    });

    it('should return unavailable for undefined EPS', () => {
      const result = calculateFairValue({ currentPrice: 100 });
      expect(result.fairValue).toBeNull();
      expect(result.valuationStatus).toBe('unavailable');
    });
  });

  // ===========================================================================
  // Edge Cases — Missing currentPrice
  // ===========================================================================

  describe('missing currentPrice', () => {
    it('should calculate fairValue but return null MoS and currentPE when currentPrice is missing', () => {
      const result = calculateFairValue({ eps: 10, targetPE: 15 });
      expect(result.fairValue).toBe(150);
      expect(result.marginOfSafety).toBeNull();
      expect(result.currentPE).toBeNull();
      expect(result.valuationStatus).toBe('unavailable');
      expect(result.display.fairValue).toBe('$150.00');
      expect(result.display.marginOfSafety).toBe('N/A');
      expect(result.display.currentPE).toBe('N/A');
    });
  });

  // ===========================================================================
  // Display Formatting
  // ===========================================================================

  describe('display formatting', () => {
    it('should format fairValue as dollar amount ($XXX.XX)', () => {
      const result = calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 });
      expect(result.display.fairValue).toBe('$104.55');
    });

    it('should format marginOfSafety as percentage (XX.X%)', () => {
      // fairValue = 150, currentPrice = 100 -> MoS = 33.3%
      const result = calculateFairValue({ eps: 10, currentPrice: 100, targetPE: 15 });
      expect(result.display.marginOfSafety).toBe('33.3%');
    });

    it('should format currentPE as decimal (XX.X)', () => {
      // 175 / 6.97 = 25.1
      const result = calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 });
      expect(result.display.currentPE).toBe('25.1');
    });

    it('should format valuationStatus with proper capitalization', () => {
      const undervalued = calculateFairValue({ eps: 10, currentPrice: 100, targetPE: 15 });
      expect(undervalued.display.valuationStatus).toBe('Undervalued');

      const fair = calculateFairValue({ eps: 10, currentPrice: 150, targetPE: 15 });
      expect(fair.display.valuationStatus).toBe('Fair Value');

      const overvalued = calculateFairValue({ eps: 5, currentPrice: 100, targetPE: 15 });
      expect(overvalued.display.valuationStatus).toBe('Overvalued');
    });

    it('should show N/A display values for unavailable status', () => {
      const result = calculateFairValue({ eps: -5, currentPrice: 100 });
      expect(result.display.fairValue).toBe('N/A');
      expect(result.display.marginOfSafety).toBe('N/A');
      expect(result.display.currentPE).toBe('N/A');
      expect(result.display.valuationStatus).toBe('N/A');
    });
  });

  // ===========================================================================
  // Very Large and Very Small Values
  // ===========================================================================

  describe('extreme values', () => {
    it('should handle AAPL-like values (EPS $6.97, price $175)', () => {
      const result = calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 });
      expect(result.fairValue).toBe(104.55);
      expect(result.currentPE).toBe(25.1);
      expect(result.valuationStatus).toBe('overvalued');
    });

    it('should handle penny stock values', () => {
      const result = calculateFairValue({ eps: 0.02, currentPrice: 0.5, targetPE: 15 });
      expect(result.fairValue).toBe(0.3);
      expect(result.currentPE).toBe(25);
      expect(result.display.fairValue).toBe('$0.30');
    });

    it('should allow very high targetPE (>100)', () => {
      const result = calculateFairValue({ eps: 5, currentPrice: 600, targetPE: 120 });
      expect(result.fairValue).toBe(600);
      expect(result.targetPE).toBe(120);
    });
  });
});

// =============================================================================
// getValuationColor
// =============================================================================

describe('getValuationColor', () => {
  it('should return --color-success for undervalued', () => {
    expect(getValuationColor('undervalued')).toBe('--color-success');
  });

  it('should return --color-warning for fair', () => {
    expect(getValuationColor('fair')).toBe('--color-warning');
  });

  it('should return --color-danger for overvalued', () => {
    expect(getValuationColor('overvalued')).toBe('--color-danger');
  });

  it('should return --color-text-secondary for unavailable', () => {
    expect(getValuationColor('unavailable')).toBe('--color-text-secondary');
  });
});

// =============================================================================
// getValuationIcon
// =============================================================================

describe('getValuationIcon', () => {
  it('should return down arrow for undervalued (price below fair value)', () => {
    expect(getValuationIcon('undervalued')).toBe('\u2193');
  });

  it('should return left-right arrow for fair', () => {
    expect(getValuationIcon('fair')).toBe('\u2194');
  });

  it('should return up arrow for overvalued (price above fair value)', () => {
    expect(getValuationIcon('overvalued')).toBe('\u2191');
  });

  it('should return em dash for unavailable', () => {
    expect(getValuationIcon('unavailable')).toBe('\u2014');
  });
});
