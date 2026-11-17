/**
 * Triage Calculator Utility
 *
 * Extracts and calculates fast-triage metrics and sparkline historical time-series
 * for Step 1 Triage (Stock Simplifier inspired flow).
 *
 * Evaluates:
 * 1. Revenue Growth (Consistent top-line growth over 10-15 years)
 * 2. Operating Margins (Stable / healthy margins > 10%)
 * 3. Share Dilution (Non-diluting / share buybacks: decreasing count = GREEN / Pass; dilution = RED / Fail)
 * 4. Current Ratio (Liquidity > 1.0 = GREEN / Pass; < 1.0 = RED / Fail)
 *
 * @module triageCalculator
 */

import gaapNormalizer from './gaapNormalizer.js';

// =============================================================================
// Default Fallbacks (MSFT High-Quality Defaults)
// =============================================================================

const DEFAULT_MSFT_TRIAGE = {
  revenue: {
    id: 'revenue-growth',
    title: 'Revenue Growth',
    value: '+14% YoY',
    latestValue: 245120000000,
    growthRate: 14.2,
    badge: 'Consistent Growth',
    detail: 'צמיחה עקבית של ~14% בשנה',
    metricSummary: '5Y CAGR ~14.2%',
    status: 'pass',
    sparkline: [
      { year: 2015, value: 93580 },
      { year: 2016, value: 85320 },
      { year: 2017, value: 89950 },
      { year: 2018, value: 110360 },
      { year: 2019, value: 125843 },
      { year: 2020, value: 143015 },
      { year: 2021, value: 168088 },
      { year: 2022, value: 198270 },
      { year: 2023, value: 211915 },
      { year: 2024, value: 245120 },
    ],
  },
  margins: {
    id: 'operating-margins',
    title: 'Operating Margins',
    value: '44%+',
    latestValue: 44.6,
    badge: 'High & Stable',
    detail: 'שוליים יציבים מעל 40%',
    metricSummary: 'Operating Margin > 40%',
    status: 'pass',
    sparkline: [
      { year: 2015, value: 30.1 },
      { year: 2016, value: 29.5 },
      { year: 2017, value: 31.8 },
      { year: 2018, value: 31.8 },
      { year: 2019, value: 34.1 },
      { year: 2020, value: 37.0 },
      { year: 2021, value: 41.6 },
      { year: 2022, value: 42.1 },
      { year: 2023, value: 41.8 },
      { year: 2024, value: 44.6 },
    ],
  },
  shares: {
    id: 'share-dilution',
    title: 'Share Dilution',
    value: 'Share Buybacks',
    target: 'Target: Decreasing',
    latestValue: 7430000000,
    changePct: -0.8,
    badge: 'Buybacks',
    detail: 'החברה רוכשת מניות חזרה',
    metricSummary: 'ירידה שנתית בכמות המניות (חיובי למשקיעים)',
    status: 'pass',
    sparkline: [
      { year: 2015, value: 8027 },
      { year: 2016, value: 7808 },
      { year: 2017, value: 7708 },
      { year: 2018, value: 7677 },
      { year: 2019, value: 7643 },
      { year: 2020, value: 7571 },
      { year: 2021, value: 7547 },
      { year: 2022, value: 7464 },
      { year: 2023, value: 7432 },
      { year: 2024, value: 7430 },
    ],
  },
  currentRatio: {
    id: 'balance-sheet',
    title: 'Current Ratio (Liquidity)',
    value: '1.24x',
    target: 'Target: > 1.0',
    latestValue: 1.24,
    badge: 'Safe (> 1.0)',
    detail: 'Current Ratio תקין > 1',
    metricSummary: 'Solid liquidity, low solvency risk',
    status: 'pass',
    sparkline: [
      { year: 2015, value: 2.47 },
      { year: 2016, value: 2.35 },
      { year: 2017, value: 2.92 },
      { year: 2018, value: 2.90 },
      { year: 2019, value: 2.53 },
      { year: 2020, value: 2.52 },
      { year: 2021, value: 2.08 },
      { year: 2022, value: 1.78 },
      { year: 2023, value: 1.77 },
      { year: 2024, value: 1.24 },
    ],
  },
};

// =============================================================================
// Helpers
// =============================================================================

function isNumeric(val) {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

function getMetricsObject(companyFacts) {
  if (!companyFacts) return null;

  // Already normalized object with metrics
  if (companyFacts.metrics && typeof companyFacts.metrics === 'object') {
    return companyFacts.metrics;
  }

  // Raw company facts with facts.us-gaap
  if (companyFacts.facts) {
    try {
      const normalized = gaapNormalizer.normalizeCompanyFacts(companyFacts, { fullHistory: true });
      return normalized?.metrics || null;
    } catch {
      return null;
    }
  }

  return null;
}

// =============================================================================
// Metric Extractors
// =============================================================================

/**
 * 1. Revenue Growth
 */
function calculateRevenueMetric(metrics) {
  const revList = metrics?.revenue?.annual;
  if (!Array.isArray(revList) || revList.length === 0) {
    return DEFAULT_MSFT_TRIAGE.revenue;
  }

  // Filter valid points, sort chronological (oldest to newest)
  const valid = revList
    .filter((item) => item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (valid.length === 0) {
    return DEFAULT_MSFT_TRIAGE.revenue;
  }

  // Deduplicate by fiscalYear (take last occurrence for restatements)
  const byYear = new Map();
  for (const item of valid) {
    byYear.set(item.fiscalYear, item.value);
  }

  // Take the last 10-15 years
  const allYears = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .slice(-15);

  const sparkline = allYears.map(({ year, value }) => ({
    year,
    value: Math.round(value / 1000000), // In millions for clean rendering
  }));

  const latest = allYears[allYears.length - 1];
  const prior = allYears.length >= 2 ? allYears[allYears.length - 2] : null;

  let yoy = 0;
  if (prior && prior.value > 0) {
    yoy = ((latest.value - prior.value) / prior.value) * 100;
  }

  // 5Y CAGR if available
  const oldest5Y = allYears.length >= 5 ? allYears[allYears.length - 5] : allYears[0];
  const yearsDiff = latest.year - oldest5Y.year;
  const cagr =
    yearsDiff > 0 && oldest5Y.value > 0
      ? (Math.pow(latest.value / oldest5Y.value, 1 / yearsDiff) - 1) * 100
      : yoy;

  // Status: Pass if positive growth (either latest YoY or 5Y trend)
  const isPass = yoy > 0 || cagr > 0;
  const formattedGrowth = `${yoy >= 0 ? '+' : ''}${Math.round(yoy)}% YoY`;

  return {
    id: 'revenue-growth',
    title: 'Revenue Growth',
    value: formattedGrowth,
    latestValue: latest.value,
    growthRate: Math.round(yoy * 10) / 10,
    badge: isPass ? 'Consistent Growth' : 'Revenue Decline',
    detail: isPass
      ? `צמיחה עקבית של ~${Math.abs(Math.round(yoy || cagr))}% בשנה`
      : `ירידה בהכנסות (${Math.round(yoy)}% YoY)`,
    metricSummary: `${yearsDiff > 0 ? `${yearsDiff}Y` : 'Latest'} CAGR ~${Math.round(cagr)}%`,
    status: isPass ? 'pass' : 'fail',
    sparkline,
  };
}

/**
 * 2. Operating Margins
 */
function calculateOperatingMarginsMetric(metrics) {
  const revList = metrics?.revenue?.annual || [];
  const opIncomeList = metrics?.operatingIncome?.annual || [];

  if (!Array.isArray(revList) || revList.length === 0 || !Array.isArray(opIncomeList)) {
    return DEFAULT_MSFT_TRIAGE.margins;
  }

  const opIncomeByYear = new Map();
  for (const item of opIncomeList) {
    if (item && isNumeric(item.fiscalYear) && isNumeric(item.value)) {
      opIncomeByYear.set(item.fiscalYear, item.value);
    }
  }

  const marginPoints = [];
  for (const revItem of revList) {
    if (revItem && isNumeric(revItem.fiscalYear) && isNumeric(revItem.value) && revItem.value > 0) {
      const opIncome = opIncomeByYear.get(revItem.fiscalYear);
      if (isNumeric(opIncome)) {
        const marginPct = (opIncome / revItem.value) * 100;
        marginPoints.push({
          year: revItem.fiscalYear,
          value: Math.round(marginPct * 10) / 10,
        });
      }
    }
  }

  if (marginPoints.length === 0) {
    return DEFAULT_MSFT_TRIAGE.margins;
  }

  // Deduplicate and sort ascending
  const byYear = new Map();
  for (const item of marginPoints) {
    byYear.set(item.year, item.value);
  }

  const sortedPoints = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year)
    .slice(-15);

  const latest = sortedPoints[sortedPoints.length - 1];
  const isPass = latest.value > 10; // Requirement: margins > 10%

  return {
    id: 'operating-margins',
    title: 'Operating Margins',
    value: `${latest.value.toFixed(0)}%+`,
    latestValue: latest.value,
    badge: isPass ? (latest.value >= 25 ? 'High & Stable' : 'Healthy Margins') : 'Low Margins',
    detail: isPass
      ? `שוליים יציבים מעל ${Math.min(40, Math.floor(latest.value / 10) * 10)}%`
      : `שולי רווח נמוכים מ-10% (${latest.value.toFixed(1)}%)`,
    metricSummary: `Operating Margin: ${latest.value.toFixed(1)}%`,
    status: isPass ? 'pass' : 'fail',
    sparkline: sortedPoints,
  };
}

/**
 * 3. Share Dilution (Financial logic: Buybacks / decreasing = GREEN / Pass; Dilution / increasing = RED / Fail)
 */
function calculateShareDilutionMetric(metrics) {
  const sharesList =
    metrics?.weightedAverageSharesDiluted?.annual ||
    metrics?.sharesOutstanding?.annual ||
    [];

  if (!Array.isArray(sharesList) || sharesList.length === 0) {
    return DEFAULT_MSFT_TRIAGE.shares;
  }

  const valid = sharesList
    .filter((item) => item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (valid.length === 0) {
    return DEFAULT_MSFT_TRIAGE.shares;
  }

  const byYear = new Map();
  for (const item of valid) {
    byYear.set(item.fiscalYear, item.value);
  }

  const allYears = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .slice(-15);

  const sparkline = allYears.map(({ year, value }) => ({
    year,
    value: Math.round(value / 1000000), // In millions
  }));

  const latest = allYears[allYears.length - 1];
  const prior = allYears.length >= 2 ? allYears[allYears.length - 2] : null;

  let annualChangePct = 0;
  if (prior && prior.value > 0) {
    annualChangePct = ((latest.value - prior.value) / prior.value) * 100;
  }

  // Financial Logic:
  // Decreasing share count (Buybacks / slope < 0) = POSITIVE (Pass -> GREEN)
  // Increasing share count (Dilution / slope > 0) = NEGATIVE (Fail -> RED)
  const isDecreasing = annualChangePct < -0.1 || (allYears.length >= 3 && latest.value < allYears[0].value);
  const isFlat = Math.abs(annualChangePct) <= 0.2;
  const isPass = isDecreasing || isFlat;

  return {
    id: 'share-dilution',
    title: 'Share Dilution',
    value: isDecreasing ? 'Share Buybacks' : (isFlat ? 'Flat Share Count' : `+${annualChangePct.toFixed(1)}% / yr`),
    target: 'Target: Decreasing',
    latestValue: latest.value,
    changePct: Math.round(annualChangePct * 10) / 10,
    badge: isDecreasing ? 'Buybacks' : (isFlat ? 'No Dilution' : 'Diluting'),
    detail: isDecreasing
      ? 'החברה רוכשת מניות חזרה'
      : (isFlat ? 'ללא דילול מניות משמעותי' : `הדפסת מניות ודילול משקיעים (+${annualChangePct.toFixed(1)}%)`),
    metricSummary: isDecreasing
      ? 'ירידה שנתית בכמות המניות - מגדיל את חלקנו ברווח'
      : (isFlat ? 'כמות מניות יציבה' : 'עלייה בכמות המניות - מקטין את חלקנו ברווח'),
    status: isPass ? 'pass' : 'fail',
    sparkline,
  };
}

/**
 * 4. Current Ratio (Liquidity)
 */
function calculateCurrentRatioMetric(metrics) {
  const currentAssets = metrics?.currentAssets?.annual || [];
  const currentLiabilities = metrics?.currentLiabilities?.annual || [];

  if (!Array.isArray(currentAssets) || !Array.isArray(currentLiabilities)) {
    return DEFAULT_MSFT_TRIAGE.currentRatio;
  }

  const liabilitiesByYear = new Map();
  for (const item of currentLiabilities) {
    if (item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0) {
      liabilitiesByYear.set(item.fiscalYear, item.value);
    }
  }

  const ratioPoints = [];
  for (const assetItem of currentAssets) {
    if (assetItem && isNumeric(assetItem.fiscalYear) && isNumeric(assetItem.value)) {
      const liab = liabilitiesByYear.get(assetItem.fiscalYear);
      if (isNumeric(liab) && liab > 0) {
        const ratio = Math.round((assetItem.value / liab) * 100) / 100;
        ratioPoints.push({
          year: assetItem.fiscalYear,
          value: ratio,
        });
      }
    }
  }

  if (ratioPoints.length === 0) {
    return DEFAULT_MSFT_TRIAGE.currentRatio;
  }

  const byYear = new Map();
  for (const item of ratioPoints) {
    byYear.set(item.year, item.value);
  }

  const sortedPoints = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year)
    .slice(-15);

  const latest = sortedPoints[sortedPoints.length - 1];
  // Requirement: יחס שוטף שגדול מ-1 מקבל ירוק (Pass). שקטן מ-1 מקבל אדום (Fail).
  const isPass = latest.value >= 1.0;

  return {
    id: 'balance-sheet',
    title: 'Current Ratio (Liquidity)',
    value: `${latest.value.toFixed(2)}x`,
    target: 'Target: > 1.0',
    latestValue: latest.value,
    badge: isPass ? 'Safe (> 1.0)' : 'At Risk (< 1.0)',
    detail: isPass
      ? 'Current Ratio תקין > 1'
      : `יחס שוטף נמוך מ-1.0 (${latest.value.toFixed(2)}x)`,
    metricSummary: isPass
      ? 'נכסים שוטפים עולים על התחייבויות (חוסן פיננסי)'
      : 'התחייבויות שוטפות עולות על נכסים (סיכון נזילות)',
    status: isPass ? 'pass' : 'fail',
    sparkline: sortedPoints,
  };
}

// =============================================================================
// Main Exported Function
// =============================================================================

/**
 * Calculates triage metrics and sparkline history from raw or normalized company facts.
 *
 * @param {Object} companyFacts - Raw SEC Company Facts or normalized company data
 * @returns {{
 *   revenue: Object,
 *   margins: Object,
 *   shares: Object,
 *   currentRatio: Object
 * }}
 */
export function calculateTriageMetrics(companyFacts) {
  const metrics = getMetricsObject(companyFacts);

  if (!metrics) {
    return DEFAULT_MSFT_TRIAGE;
  }

  return {
    revenue: calculateRevenueMetric(metrics),
    margins: calculateOperatingMarginsMetric(metrics),
    shares: calculateShareDilutionMetric(metrics),
    currentRatio: calculateCurrentRatioMetric(metrics),
  };
}

export default calculateTriageMetrics;
