/**
 * Currency Formatting Utility
 *
 * Formats raw financial numbers into human-readable currency strings
 * with appropriate unit suffixes (B, M, K). Uses accounting convention
 * of parentheses for negative values.
 *
 * @module formatCurrency
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Threshold for billions (1,000,000,000)
 * @constant {number}
 */
const BILLION = 1_000_000_000;

/**
 * Threshold for millions (1,000,000)
 * @constant {number}
 */
const MILLION = 1_000_000;

/**
 * Threshold for thousands (1,000)
 * @constant {number}
 */
const THOUSAND = 1_000;

/**
 * Default formatting options
 * @constant {Object}
 */
const DEFAULT_OPTIONS = {
  decimals: 1,
  forceUnit: null,
};

// =============================================================================
// Main Function
// =============================================================================

/**
 * Formats a raw number into a human-readable currency string with unit suffix.
 *
 * - Values >= 1B display as "$X.XB" (e.g., 394328000000 -> "$394.3B")
 * - Values >= 1M display as "$X.XM" (e.g., 5200000 -> "$5.2M")
 * - Values >= 1K display as "$X.XK" (e.g., 7500 -> "$7.5K")
 * - Values < 1K display exact (e.g., 500 -> "$500")
 * - Negative values use parentheses per accounting convention (e.g., -5200000 -> "($5.2M)")
 *
 * @param {number} value - The raw numeric value to format
 * @param {Object} [options={}] - Formatting options
 * @param {number} [options.decimals=1] - Number of decimal places
 * @param {string|null} [options.forceUnit=null] - Force a specific unit: 'B', 'M', 'K', or null for auto
 * @returns {string} Formatted currency string
 *
 * @example
 * formatCurrency(394328000000);     // "$394.3B"
 * formatCurrency(-5200000);         // "($5.2M)"
 * formatCurrency(7500);             // "$7.5K"
 * formatCurrency(500);              // "$500"
 * formatCurrency(0);                // "$0"
 * formatCurrency(null);             // "N/A"
 * formatCurrency(1500000, { forceUnit: 'B' }); // "$0.0B"
 */
export function formatCurrency(value, options = {}) {
  // Handle non-numeric input
  if (value === null || value === undefined || typeof value !== 'number' || !isFinite(value)) {
    return 'N/A';
  }

  const { decimals, forceUnit } = { ...DEFAULT_OPTIONS, ...options };

  // Handle zero
  if (value === 0) {
    return '$0';
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  let scaledValue;
  let unit;

  if (forceUnit) {
    // Use forced unit
    const unitUpper = forceUnit.toUpperCase();
    switch (unitUpper) {
      case 'B':
        scaledValue = absValue / BILLION;
        unit = 'B';
        break;
      case 'M':
        scaledValue = absValue / MILLION;
        unit = 'M';
        break;
      case 'K':
        scaledValue = absValue / THOUSAND;
        unit = 'K';
        break;
      default:
        scaledValue = absValue;
        unit = '';
    }
  } else {
    // Auto-detect unit based on magnitude
    if (absValue >= BILLION) {
      scaledValue = absValue / BILLION;
      unit = 'B';
    } else if (absValue >= MILLION) {
      scaledValue = absValue / MILLION;
      unit = 'M';
    } else if (absValue >= THOUSAND) {
      scaledValue = absValue / THOUSAND;
      unit = 'K';
    } else {
      scaledValue = absValue;
      unit = '';
    }
  }

  // Format the number
  const formatted = unit
    ? `$${scaledValue.toFixed(decimals)}${unit}`
    : `$${Math.round(scaledValue)}`;

  // Apply accounting convention for negatives
  if (isNegative) {
    return `(${formatted})`;
  }

  return formatted;
}

export default formatCurrency;
