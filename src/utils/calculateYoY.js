/**
 * Year-over-Year Calculation Utility
 *
 * Calculates year-over-year percentage change between two values.
 * Returns both the raw percentage and a formatted string with
 * appropriate sign prefix.
 *
 * @module calculateYoY
 */

// =============================================================================
// Main Function
// =============================================================================

/**
 * Calculates year-over-year percentage change between two values.
 *
 * Returns an object with:
 * - `percentage`: the raw numeric change (e.g., 7.8 for 7.8% growth), or null if not calculable
 * - `formatted`: a display string (e.g., "+7.8%", "-5.2%", "0.0%", or "N/A")
 *
 * @param {number} currentValue - The current period's value
 * @param {number} previousValue - The prior period's value
 * @returns {{ percentage: number|null, formatted: string }}
 *
 * @example
 * calculateYoY(107800, 100000);  // { percentage: 7.8, formatted: "+7.8%" }
 * calculateYoY(94800, 100000);   // { percentage: -5.2, formatted: "-5.2%" }
 * calculateYoY(100000, 100000);  // { percentage: 0, formatted: "0.0%" }
 * calculateYoY(100000, 0);       // { percentage: null, formatted: "N/A" }
 * calculateYoY(null, 100000);    // { percentage: null, formatted: "N/A" }
 */
export function calculateYoY(currentValue, previousValue) {
  const NA_RESULT = { percentage: null, formatted: 'N/A' };

  // Validate inputs are finite numbers
  if (
    currentValue === null ||
    currentValue === undefined ||
    previousValue === null ||
    previousValue === undefined ||
    typeof currentValue !== 'number' ||
    typeof previousValue !== 'number' ||
    !isFinite(currentValue) ||
    !isFinite(previousValue)
  ) {
    return NA_RESULT;
  }

  // Division by zero: prior period is zero
  if (previousValue === 0) {
    return NA_RESULT;
  }

  // Calculate percentage change
  const percentage = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;

  // Round to 1 decimal place
  const rounded = Math.round(percentage * 10) / 10;

  // Format the string
  let formatted;
  if (rounded > 0) {
    formatted = `+${rounded.toFixed(1)}%`;
  } else if (rounded < 0) {
    formatted = `${rounded.toFixed(1)}%`;
  } else {
    formatted = '0.0%';
  }

  return { percentage: rounded, formatted };
}

export default calculateYoY;
