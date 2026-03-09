/**
 * Fair Value Calculation Utility
 *
 * Calculates P/E-based fair value, margin of safety, and valuation
 * status from EPS, current price, and a target P/E multiple.
 *
 * Formulas:
 * - Fair Value = EPS x targetPE
 * - Margin of Safety = (fairValue - currentPrice) / fairValue x 100
 * - Current P/E = currentPrice / EPS
 *
 * Valuation Thresholds:
 * - MoS >= 25%  -> 'undervalued' (green)
 * - MoS >= -10% -> 'fair'        (yellow)
 * - MoS < -10%  -> 'overvalued'  (red)
 *
 * @module calculateFairValue
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Default P/E multiple when none is provided or value is invalid.
 * @constant {number}
 */
const DEFAULT_TARGET_PE = 15;

/**
 * Margin of safety threshold for undervalued classification.
 * @constant {number}
 */
const UNDERVALUED_THRESHOLD = 25;

/**
 * Margin of safety threshold below which a stock is overvalued.
 * @constant {number}
 */
const OVERVALUED_THRESHOLD = -10;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Checks if a value is a positive finite number (> 0).
 * @param {*} value
 * @returns {boolean}
 */
function isPositiveFinite(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

/**
 * Checks if a value is a finite number (including zero and negatives).
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

/**
 * Rounds a number to a specified number of decimal places.
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Determines valuation status based on margin of safety.
 * @param {number} marginOfSafety
 * @returns {string} 'undervalued' | 'fair' | 'overvalued'
 */
function classifyValuation(marginOfSafety) {
  if (marginOfSafety >= UNDERVALUED_THRESHOLD) return 'undervalued';
  if (marginOfSafety >= OVERVALUED_THRESHOLD) return 'fair';
  return 'overvalued';
}

/**
 * Maps valuation status to a display-friendly label.
 * @param {string} status
 * @returns {string}
 */
const STATUS_DISPLAY = {
  undervalued: 'Undervalued',
  fair: 'Fair Value',
  overvalued: 'Overvalued',
  unavailable: 'N/A',
};

// =============================================================================
// Unavailable result (reused for all invalid-EPS paths)
// =============================================================================

/**
 * Builds the unavailable result object.
 * @param {number} targetPE - The target P/E that was used or defaulted
 * @returns {Object}
 */
function unavailableResult(targetPE) {
  return {
    fairValue: null,
    marginOfSafety: null,
    valuationStatus: 'unavailable',
    currentPE: null,
    targetPE,
    display: {
      fairValue: 'N/A',
      marginOfSafety: 'N/A',
      currentPE: 'N/A',
      valuationStatus: 'N/A',
    },
  };
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Calculates P/E-based fair value with margin of safety and valuation status.
 *
 * @param {Object} params
 * @param {number} params.eps - Earnings per share
 * @param {number} [params.currentPrice] - Current stock price
 * @param {number} [params.targetPE=15] - Target P/E multiple
 * @returns {{
 *   fairValue: number|null,
 *   marginOfSafety: number|null,
 *   valuationStatus: string,
 *   currentPE: number|null,
 *   targetPE: number,
 *   display: {
 *     fairValue: string,
 *     marginOfSafety: string,
 *     currentPE: string,
 *     valuationStatus: string,
 *   }
 * }}
 *
 * @example
 * calculateFairValue({ eps: 6.97, currentPrice: 175, targetPE: 15 });
 * // {
 * //   fairValue: 104.55,
 * //   marginOfSafety: -40.3,
 * //   valuationStatus: 'overvalued',
 * //   currentPE: 25.1,
 * //   targetPE: 15,
 * //   display: { fairValue: "$104.55", marginOfSafety: "-40.3%", currentPE: "25.1", valuationStatus: "Overvalued" }
 * // }
 */
export function calculateFairValue({ eps, currentPrice, targetPE = DEFAULT_TARGET_PE } = {}) {
  // Resolve targetPE: 0 or invalid -> use default
  const resolvedPE = (isPositiveFinite(targetPE)) ? targetPE : DEFAULT_TARGET_PE;

  // Guard: EPS must be a positive finite number
  if (!isPositiveFinite(eps)) {
    return unavailableResult(resolvedPE);
  }

  // Core calculation
  const fairValue = roundTo(eps * resolvedPE, 2);

  // Current P/E (requires a valid currentPrice)
  const hasPrice = isFiniteNumber(currentPrice) && currentPrice > 0;
  const currentPE = hasPrice ? roundTo(currentPrice / eps, 1) : null;

  // Margin of Safety (requires both fairValue and currentPrice)
  const marginOfSafety = hasPrice
    ? roundTo(((fairValue - currentPrice) / fairValue) * 100, 1)
    : null;

  // Valuation status (requires margin of safety)
  const valuationStatus = marginOfSafety !== null
    ? classifyValuation(marginOfSafety)
    : 'unavailable';

  // Build display strings
  const display = {
    fairValue: `$${fairValue.toFixed(2)}`,
    marginOfSafety: marginOfSafety !== null ? `${marginOfSafety.toFixed(1)}%` : 'N/A',
    currentPE: currentPE !== null ? currentPE.toFixed(1) : 'N/A',
    valuationStatus: STATUS_DISPLAY[valuationStatus],
  };

  return {
    fairValue,
    marginOfSafety,
    valuationStatus,
    currentPE,
    targetPE: resolvedPE,
    display,
  };
}

// =============================================================================
// Valuation Color
// =============================================================================

/**
 * Maps a valuation status to its CSS variable name.
 *
 * @param {string} status - 'undervalued' | 'fair' | 'overvalued' | 'unavailable'
 * @returns {string} CSS variable name
 *
 * @example
 * getValuationColor('undervalued'); // '--color-success'
 */
export function getValuationColor(status) {
  const colorMap = {
    undervalued: '--color-success',
    fair: '--color-warning',
    overvalued: '--color-danger',
    unavailable: '--color-text-secondary',
  };
  return colorMap[status] || '--color-text-secondary';
}

// =============================================================================
// Valuation Icon
// =============================================================================

/**
 * Maps a valuation status to its icon character.
 *
 * @param {string} status - 'undervalued' | 'fair' | 'overvalued' | 'unavailable'
 * @returns {string} Icon character
 *
 * @example
 * getValuationIcon('undervalued'); // '↓'
 */
export function getValuationIcon(status) {
  const iconMap = {
    undervalued: '\u2193', // ↓
    fair: '\u2194',        // ↔
    overvalued: '\u2191',  // ↑
    unavailable: '\u2014', // —
  };
  return iconMap[status] || '\u2014';
}

export default calculateFairValue;
