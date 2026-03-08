/**
 * Margin Calculation Utility
 *
 * Calculates gross margin, operating margin, and net margin from
 * financial metrics. Uses revenue as the anchor — margins are
 * meaningless without it.
 *
 * @module calculateMargins
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Default maximum number of fiscal years to return.
 * @constant {number}
 */
const DEFAULT_MAX_YEARS = 5;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validates that the input is a non-empty array.
 * @param {*} value
 * @returns {boolean}
 */
function isValidArray(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Finds the matching entry in a metric array by fiscal year.
 * @param {Array} metricArray
 * @param {string|number} fiscalYear
 * @returns {Object|undefined}
 */
function findByYear(metricArray, fiscalYear) {
  if (!Array.isArray(metricArray)) return undefined;
  return metricArray.find((entry) => entry && entry.fiscalYear === fiscalYear);
}

/**
 * Calculates a single margin percentage: (numerator / revenue) * 100.
 * Returns null if numerator is missing or not a finite number.
 * @param {number|null|undefined} numerator
 * @param {number} revenue
 * @returns {number|null}
 */
function computeMargin(numerator, revenue) {
  if (
    numerator === null ||
    numerator === undefined ||
    typeof numerator !== 'number' ||
    !isFinite(numerator)
  ) {
    return null;
  }
  return Math.round(((numerator / revenue) * 100) * 10) / 10;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Calculates gross margin, operating margin, and net margin for each
 * fiscal year present in the revenue array.
 *
 * @param {Object} metrics - Financial metric arrays
 * @param {Array} metrics.revenue - Revenue data: [{ value, fiscalYear }, ...]
 * @param {Array} [metrics.grossProfit] - Gross profit data
 * @param {Array} [metrics.operatingIncome] - Operating income data
 * @param {Array} [metrics.netIncome] - Net income data
 * @param {Object} [options] - Calculation options
 * @param {number} [options.maxYears=5] - Maximum fiscal years to return
 * @returns {Array<{ fiscalYear: string|number, label: string, grossMargin: number|null, operatingMargin: number|null, netMargin: number|null }>}
 *
 * @example
 * calculateMargins({
 *   revenue: [{ value: 100000, fiscalYear: 2023 }],
 *   grossProfit: [{ value: 60000, fiscalYear: 2023 }],
 *   operatingIncome: [{ value: 30000, fiscalYear: 2023 }],
 *   netIncome: [{ value: 20000, fiscalYear: 2023 }],
 * });
 * // [{ fiscalYear: 2023, label: "FY2023", grossMargin: 60.0, operatingMargin: 30.0, netMargin: 20.0 }]
 */
export function calculateMargins(metrics, options = {}) {
  // Guard: metrics must be a non-null object
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return [];
  }

  const { revenue, grossProfit, operatingIncome, netIncome } = metrics;

  // Guard: revenue must be a non-empty array
  if (!isValidArray(revenue)) {
    return [];
  }

  const maxYears = (options && typeof options.maxYears === 'number' && options.maxYears > 0)
    ? options.maxYears
    : DEFAULT_MAX_YEARS;

  // Build results anchored on revenue entries
  const results = [];

  for (const entry of revenue) {
    // Skip entries that are not valid objects
    if (!entry || typeof entry !== 'object') continue;

    const { value: revenueValue, fiscalYear } = entry;

    // Revenue must be a positive finite number for meaningful margins
    const revenueIsValid =
      typeof revenueValue === 'number' &&
      isFinite(revenueValue) &&
      revenueValue !== 0;

    const grossEntry = findByYear(grossProfit, fiscalYear);
    const operatingEntry = findByYear(operatingIncome, fiscalYear);
    const netEntry = findByYear(netIncome, fiscalYear);

    results.push({
      fiscalYear,
      label: `FY${fiscalYear}`,
      grossMargin: revenueIsValid ? computeMargin(grossEntry?.value, revenueValue) : null,
      operatingMargin: revenueIsValid ? computeMargin(operatingEntry?.value, revenueValue) : null,
      netMargin: revenueIsValid ? computeMargin(netEntry?.value, revenueValue) : null,
    });
  }

  // Sort chronologically (oldest first)
  results.sort((a, b) => {
    const yearA = typeof a.fiscalYear === 'number' ? a.fiscalYear : Number(a.fiscalYear);
    const yearB = typeof b.fiscalYear === 'number' ? b.fiscalYear : Number(b.fiscalYear);
    return yearA - yearB;
  });

  // Limit to maxYears (take the most recent N after sorting)
  if (results.length > maxYears) {
    return results.slice(results.length - maxYears);
  }

  return results;
}

export default calculateMargins;
