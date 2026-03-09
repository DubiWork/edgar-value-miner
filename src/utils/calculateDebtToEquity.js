/**
 * Debt-to-Equity Calculation Utility
 *
 * Calculates Debt-to-Equity ratio from normalized GAAP data.
 * Uses a fallback chain for totalDebt: tries totalDebt first,
 * then shortTermDebt + longTermDebt.
 *
 * D/E trend is inverted: rising D/E = bad (red), falling D/E = good (green).
 *
 * @module calculateDebtToEquity
 */

// =============================================================================
// Helpers
// =============================================================================

/**
 * Checks if a value is a valid finite number.
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

/**
 * Resolves total debt from the data object using a fallback chain:
 * 1. Use totalDebt if it is a valid finite number
 * 2. Fall back to shortTermDebt + longTermDebt (either can be missing/0)
 * 3. Return null if no debt data is available
 *
 * @param {Object} data
 * @returns {number|null}
 */
function resolveDebt(data) {
  if (isFiniteNumber(data.totalDebt)) {
    return data.totalDebt;
  }

  const hasShort = isFiniteNumber(data.shortTermDebt);
  const hasLong = isFiniteNumber(data.longTermDebt);

  if (hasShort || hasLong) {
    return (hasShort ? data.shortTermDebt : 0) + (hasLong ? data.longTermDebt : 0);
  }

  return null;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Calculates Debt-to-Equity ratio from financial data.
 *
 * @param {Object} data - Financial data object
 * @param {number} [data.totalDebt] - Total debt (preferred)
 * @param {number} [data.shortTermDebt] - Short-term debt (fallback component)
 * @param {number} [data.longTermDebt] - Long-term debt (fallback component)
 * @param {number} [data.stockholdersEquity] - Stockholders' equity
 * @returns {{ value: number|null, display: string, reason?: string }}
 *
 * @example
 * calculateDebtToEquity({ totalDebt: 100000, stockholdersEquity: 200000 });
 * // { value: 0.5, display: "0.50" }
 *
 * calculateDebtToEquity({ stockholdersEquity: -50000, totalDebt: 100000 });
 * // { value: null, display: "N/M", reason: "negative-equity" }
 */
export function calculateDebtToEquity(data) {
  const MISSING = { value: null, display: 'N/A', reason: 'missing-data' };

  // Guard: data must be a non-null object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return MISSING;
  }

  const { stockholdersEquity } = data;

  // Guard: equity must be present and valid
  if (!isFiniteNumber(stockholdersEquity)) {
    return MISSING;
  }

  // Resolve debt through fallback chain
  const debt = resolveDebt(data);

  // Guard: debt data must be available
  if (debt === null) {
    return MISSING;
  }

  // Edge case: negative equity
  if (stockholdersEquity < 0) {
    return { value: null, display: 'N/M', reason: 'negative-equity' };
  }

  // Edge case: zero equity (division by zero)
  if (stockholdersEquity === 0) {
    return { value: null, display: 'N/M', reason: 'zero-equity' };
  }

  // Edge case: zero debt
  if (debt === 0) {
    return { value: 0, display: '0.00' };
  }

  // Normal calculation
  const ratio = Math.round((debt / stockholdersEquity) * 100) / 100;
  return { value: ratio, display: ratio.toFixed(2) };
}

// =============================================================================
// Trend Function
// =============================================================================

/**
 * Calculates D/E trend between two periods with inverted logic:
 * - Rising D/E = bad (red / negative)
 * - Falling D/E = good (green / positive)
 * - Unchanged = neutral
 *
 * @param {Object} currentData - Current period financial data
 * @param {Object} previousData - Previous period financial data
 * @returns {{ direction: string, color: string, currentDE: Object, previousDE: Object }}
 *
 * @example
 * calculateDebtToEquityTrend(
 *   { totalDebt: 80000, stockholdersEquity: 100000 },
 *   { totalDebt: 120000, stockholdersEquity: 100000 }
 * );
 * // { direction: "positive", color: "green", currentDE: { value: 0.8, ... }, previousDE: { value: 1.2, ... } }
 */
export function calculateDebtToEquityTrend(currentData, previousData) {
  const NEUTRAL = { direction: 'neutral', color: 'neutral' };

  const currentDE = calculateDebtToEquity(currentData);
  const previousDE = calculateDebtToEquity(previousData);

  // If either period has no calculable D/E, trend is neutral
  if (currentDE.value === null || previousDE.value === null) {
    return { ...NEUTRAL, currentDE, previousDE };
  }

  let direction;
  let color;

  if (currentDE.value < previousDE.value) {
    // D/E decreased = good (inverted: falling is positive)
    direction = 'positive';
    color = 'green';
  } else if (currentDE.value > previousDE.value) {
    // D/E increased = bad (inverted: rising is negative)
    direction = 'negative';
    color = 'red';
  } else {
    direction = 'neutral';
    color = 'neutral';
  }

  return { direction, color, currentDE, previousDE };
}

export default calculateDebtToEquity;
