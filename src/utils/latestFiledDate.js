/**
 * Returns the most recent `filed` date string found across all us-gaap metrics.
 *
 * @param {Object} companyFactsJson - Raw SEC companyfacts JSON blob
 * @returns {string|null} ISO date string (e.g. "2024-11-01"), or null if unavailable
 */
export function latestFiledDate(companyFactsJson) {
  const usGaap = companyFactsJson?.facts?.['us-gaap'];
  if (!usGaap) return null;

  let max = null;
  for (const tag of Object.values(usGaap)) {
    for (const entries of Object.values(tag.units ?? {})) {
      for (const { filed } of entries) {
        if (filed && (max === null || filed > max)) max = filed;
      }
    }
  }
  return max;
}
