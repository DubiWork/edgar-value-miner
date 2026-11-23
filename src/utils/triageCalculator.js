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
    titleHe: 'צמיחה בהכנסות',
    value: '+14% YoY',
    valueHe: '+14% בשנה',
    latestValue: 245120000000,
    growthRate: 14.2,
    badge: 'Consistent Growth',
    badgeHe: 'צמיחה עקבית',
    detail: 'צמיחה עקבית של ~14% בשנה',
    detailEn: 'Consistent ~14% annual revenue growth',
    metricSummary: '5Y CAGR ~14.2% · 9Y ~11.3%',
    metricSummaryHe: 'צמיחה שנתית (CAGR) · 5 ש׳: ~14% · 9 ש׳: ~11%',
    sparklineUnit: '$M',
    historyMeta: {
      startYear: 2015,
      endYear: 2024,
      avg: 152176,
      minVal: 85320,
      maxVal: 245120,
      cycleType: 'steady',
      cycleBadgeHe: 'עלייה רציפה',
      cycleBadgeEn: 'Steady',
    },
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
    titleHe: 'שולי רווח תפעולי',
    value: '44%+',
    valueHe: '44.6%',
    latestValue: 44.6,
    badge: 'High & Stable',
    badgeHe: 'גבוהים ויציבים',
    detail: 'שוליים יציבים מעל 40%',
    detailEn: 'Stable operating margins above 40%',
    metricSummary: 'Operating Margin > 40%',
    metricSummaryHe: 'ממוצע רב-שנתי: 36.7% (יציב)',
    sparklineUnit: '%',
    historyMeta: {
      startYear: 2015,
      endYear: 2024,
      avg: 36.7,
      minVal: 29.5,
      maxVal: 44.6,
      cycleType: 'steady',
      cycleBadgeHe: 'יציב (29.5%–44.6%)',
      cycleBadgeEn: 'Steady (29.5%–44.6%)',
    },
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
    titleHe: 'רכישה עצמית / דילול',
    value: 'Share Buybacks',
    valueHe: '↓ -7.4% מניות ב-9 ש׳',
    target: 'Target: Decreasing',
    targetHe: 'תנאי למעבר: ירידה או יציבות במניות',
    trendDirection: 'slowing',
    trendTone: 'slowing',
    trendLabelHe: 'מגמת הבייבאקס: בירידה ↓ (האטה)',
    trendLabelEn: 'Buyback trend: Slowing ↓',
    latestValue: 7430000000,
    changePct: -0.8,
    totalChangePct: -7.4,
    badge: 'Buybacks',
    badgeHe: 'רכישה עצמית',
    detail: 'החברה רוכשת מניות חזרה',
    detailEn: 'Company consistently repurchasing shares',
    metricSummary: 'Cumulative -7.4% share reduction (2015–2024)',
    metricSummaryHe: 'שינוי מצטבר (2015–2024): -7.4% מניות',
    sparklineUnit: 'sharesM',
    historyMeta: {
      startYear: 2015,
      endYear: 2024,
      avg: 7655,
      minVal: 7430,
      maxVal: 8027,
      cycleType: 'steady',
      cycleBadgeHe: 'מצטבר: -7.4%',
      cycleBadgeEn: 'Cumulative: -7.4%',
    },
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
    titleHe: 'יחס שוטף (נזילות)',
    value: '1.24x',
    valueHe: '1.24x',
    target: 'Target: > 1.0',
    targetHe: 'תנאי למעבר: מעל 1.0',
    latestValue: 1.24,
    badge: 'Safe (> 1.0)',
    badgeHe: 'בטוח (מעל 1.0)',
    detail: 'יחס שוטף תקין (מעל 1.0)',
    detailEn: 'Healthy Current Ratio > 1.0',
    metricSummary: 'Solid liquidity, low solvency risk',
    metricSummaryHe: 'נכסים שוטפים עולים על התחייבויות (טווח 1.2x–2.9x)',
    sparklineUnit: 'x',
    historyMeta: {
      startYear: 2015,
      endYear: 2024,
      avg: 2.26,
      minVal: 1.24,
      maxVal: 2.92,
      cycleType: 'steady',
      cycleBadgeHe: 'טווח 1.2x–2.9x',
      cycleBadgeEn: 'Range 1.2x–2.9x',
    },
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

function formatCompactUsd(amount) {
  const abs = Math.abs(Number(amount) || 0);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${Math.round(abs / 1e6)}M`;
  return `$${Math.round(abs / 1e3)}K`;
}

function analyzeSeriesShape(sparkline, kind = 'generic') {
  if (!Array.isArray(sparkline) || sparkline.length === 0) {
    return null;
  }

  const startYear = sparkline[0].year;
  const endYear = sparkline[sparkline.length - 1].year;
  const spanYears = Math.max(0, endYear - startYear);

  let minVal = Infinity;
  let maxVal = -Infinity;
  let sum = 0;
  let runningPeak = -Infinity;
  let maxDrawdownPct = 0;
  let downYears = 0;

  for (let i = 0; i < sparkline.length; i++) {
    const val = sparkline[i].value;
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
    sum += val;

    if (val > runningPeak) runningPeak = val;
    if (runningPeak > 0 && val < runningPeak) {
      const dd = ((runningPeak - val) / runningPeak) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    if (i > 0) {
      const prev = sparkline[i - 1].value;
      if (kind === 'margins') {
        if (val <= prev - 1.5) downYears += 1;
      } else if (kind === 'revenue') {
        if (prev > 0 && val < prev * 0.98) downYears += 1;
      }
    }
  }

  const avg = Math.round((sum / sparkline.length) * 10) / 10;
  const spread = Math.round((maxVal - minVal) * 10) / 10;

  let cycleType = 'steady';
  let cycleBadgeHe = `${startYear}–${endYear}`;
  let cycleBadgeEn = `${startYear}–${endYear}`;

  if (kind === 'revenue' && sparkline.length >= 3) {
    if (downYears >= 3 || maxDrawdownPct >= 15) {
      cycleType = 'cyclical';
      cycleBadgeHe = downYears > 0 ? `מחזורי (${downYears} ש׳ ירידה)` : 'מחזורי';
      cycleBadgeEn = downYears > 0 ? `Cyclical (${downYears} down yrs)` : 'Cyclical';
    } else if (downYears >= 1 || maxDrawdownPct >= 5) {
      cycleType = 'moderate';
      cycleBadgeHe = downYears > 0 ? `תנודתי (${downYears} ירידות)` : 'תנודתי קלות';
      cycleBadgeEn = downYears > 0 ? `${downYears} dip yr${downYears > 1 ? 's' : ''}` : 'Mild swing';
    } else {
      cycleType = 'steady';
      cycleBadgeHe = 'עלייה רציפה';
      cycleBadgeEn = 'Steady';
    }
  } else if (kind === 'margins' && sparkline.length >= 3) {
    const hasNegativeYear = minVal < 0;
    const swingRatio = Math.abs(avg) > 1 ? spread / Math.abs(avg) : spread / 5;
    if (hasNegativeYear || downYears >= 2 || (spread >= 4 && swingRatio >= 0.4)) {
      cycleType = 'cyclical';
      cycleBadgeHe = `מחזורי (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
      cycleBadgeEn = `Cyclical (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
    } else if (downYears === 1 || spread >= 3) {
      cycleType = 'moderate';
      cycleBadgeHe = `טווח ${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%`;
      cycleBadgeEn = `Range ${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%`;
    } else {
      cycleType = 'steady';
      cycleBadgeHe = `יציב (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
      cycleBadgeEn = `Steady (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
    }
  }

  return {
    startYear,
    endYear,
    spanYears,
    avg,
    minVal,
    maxVal,
    downYears,
    maxDrawdownPct: Math.round(maxDrawdownPct),
    cycleType,
    cycleBadgeHe,
    cycleBadgeEn,
  };
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

  // True 5Y CAGR requires 6 annual data points (e.g. FY2020 -> FY2025 = 5 intervals)
  const oldest5Y = allYears.length >= 6 ? allYears[allYears.length - 6] : allYears[0];
  const yearsDiff = latest.year - oldest5Y.year;
  const cagr =
    yearsDiff > 0 && oldest5Y.value > 0
      ? (Math.pow(latest.value / oldest5Y.value, 1 / yearsDiff) - 1) * 100
      : yoy;

  // Full multi-year cycle CAGR (e.g. 9Y–14Y) when 7+ years of history exist
  const fullFirst = allYears[0];
  const fullSpanYears = latest.year - fullFirst.year;
  const fullCagr =
    fullSpanYears >= 7 && fullSpanYears !== yearsDiff && fullFirst.value > 0
      ? (Math.pow(latest.value / fullFirst.value, 1 / fullSpanYears) - 1) * 100
      : null;

  const historyMeta = analyzeSeriesShape(sparkline, 'revenue');
  const isCyclical = historyMeta?.cycleType === 'cyclical';

  // Status: Pass if positive growth (either latest YoY or multi-year trend)
  const isPass = yoy > 0 || cagr > 0;
  const formattedGrowth = `${yoy >= 0 ? '+' : ''}${Math.round(yoy)}% YoY`;
  const formattedGrowthHe = `${yoy >= 0 ? '+' : ''}${Math.round(yoy)}% בשנה`;

  const badgeEn = isPass
    ? isCyclical
      ? 'Cyclical Growth'
      : 'Consistent Growth'
    : 'Revenue Decline';
  const badgeHe = isPass
    ? isCyclical
      ? 'צמיחה מחזורית'
      : 'צמיחה עקבית'
    : 'ירידה בהכנסות';

  const longEn = fullCagr !== null ? ` · ${fullSpanYears}Y ~${Math.round(fullCagr)}%` : '';
  const longHe = fullCagr !== null ? ` · ${fullSpanYears} ש׳: ~${Math.round(fullCagr)}%` : '';

  return {
    id: 'revenue-growth',
    title: 'Revenue Growth',
    titleHe: 'צמיחה בהכנסות',
    value: formattedGrowth,
    valueHe: formattedGrowthHe,
    latestValue: latest.value,
    growthRate: Math.round(yoy * 10) / 10,
    badge: badgeEn,
    badgeHe,
    detail: isPass
      ? isCyclical
        ? `צמיחה של ${yoy >= 0 ? '+' : ''}${Math.round(yoy)}% בשנה לצד מחזוריות (${historyMeta.downYears} ש׳ ירידה)`
        : `צמיחה עקבית של ~${Math.abs(Math.round(yoy || cagr))}% בשנה`
      : `ירידה בהכנסות של ${Math.round(yoy)}% בשנה`,
    detailEn: isPass
      ? isCyclical
        ? `${formattedGrowth} top-line with cyclical dips (${historyMeta.downYears} down yrs)`
        : `Consistent ~${Math.abs(Math.round(yoy || cagr))}% annual revenue growth`
      : `Revenue declined ${Math.round(yoy)}% YoY`,
    metricSummary: `${yearsDiff > 0 ? `${yearsDiff}Y` : 'Latest'} CAGR ~${Math.round(cagr)}%${longEn}`,
    metricSummaryHe: `צמיחה שנתית (CAGR) · ${yearsDiff > 0 ? `${yearsDiff} ש׳` : 'אחרון'}: ~${Math.round(cagr)}%${longHe}`,
    sparklineUnit: '$M',
    historyMeta,
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
  const historyMeta = analyzeSeriesShape(sortedPoints, 'margins');
  const isCyclical = historyMeta?.cycleType === 'cyclical';

  const badgeEn = isPass
    ? latest.value >= 25
      ? 'High & Stable'
      : isCyclical
      ? 'Cyclical Margins'
      : 'Healthy Margins'
    : isCyclical
    ? 'Low & Cyclical'
    : 'Low Margins';

  const badgeHe = isPass
    ? latest.value >= 25
      ? 'גבוהים ויציבים'
      : isCyclical
      ? 'תקינים ומחזוריים'
      : 'שוליים תקינים'
    : isCyclical
    ? 'נמוכים ומחזוריים'
    : 'שוליים נמוכים';

  return {
    id: 'operating-margins',
    title: 'Operating Margins',
    titleHe: 'שולי רווח תפעולי',
    value: `${latest.value.toFixed(0)}%+`,
    valueHe: `${latest.value.toFixed(1)}%`,
    latestValue: latest.value,
    badge: badgeEn,
    badgeHe,
    detail: isPass
      ? isCyclical
        ? `שוליים מעל 10% (${latest.value.toFixed(1)}%) אך תנודתיים בין ${historyMeta.minVal.toFixed(1)}% ל-${historyMeta.maxVal.toFixed(1)}%`
        : `שוליים יציבים מעל ${Math.min(40, Math.floor(latest.value / 10) * 10)}%`
      : isCyclical
      ? `שולי רווח צרים ומחזוריים (${latest.value.toFixed(1)}%, נעו בטווח ${historyMeta.minVal.toFixed(1)}%–${historyMeta.maxVal.toFixed(1)}%)`
      : `שולי רווח נמוכים מ-10% (${latest.value.toFixed(1)}%)`,
    detailEn: isPass
      ? `Operating margin ${latest.value.toFixed(1)}% (> 10% threshold)`
      : `Operating margin ${latest.value.toFixed(1)}% (below 10% target)`,
    metricSummary: `Operating Margin: ${latest.value.toFixed(1)}%${historyMeta ? ` · ${historyMeta.cycleBadgeEn}` : ''}`,
    metricSummaryHe: historyMeta
      ? `ממוצע רב-שנתי: ${historyMeta.avg.toFixed(1)}% · ${historyMeta.cycleBadgeHe}`
      : `שולי רווח תפעולי: ${latest.value.toFixed(1)}%`,
    sparklineUnit: '%',
    historyMeta,
    status: isPass ? 'pass' : 'fail',
    sparkline: sortedPoints,
  };
}

/**
 * Detects whether dilution or share buyback pace is accelerating, steady, or slowing over time
 * by comparing recent YoY share-count % changes against earlier years.
 */
function calculateShareRateTrend(allYears, { isDecreasing, isFlat }) {
  const yoyChanges = [];
  for (let i = 1; i < allYears.length; i++) {
    const prev = allYears[i - 1].value;
    const curr = allYears[i].value;
    if (prev > 0) {
      yoyChanges.push(((curr - prev) / prev) * 100);
    }
  }

  if (yoyChanges.length < 2) {
    if (isDecreasing) {
      return {
        trendDirection: 'single',
        trendTone: 'neutral',
        trendLabelHe: 'מגמת בייבאקס: נתון שנתי יחיד',
        trendLabelEn: 'Buyback trend: Single-year data',
      };
    }
    if (isFlat) {
      return {
        trendDirection: 'steady',
        trendTone: 'steady',
        trendLabelHe: 'מגמה: כמות מניות יציבה',
        trendLabelEn: 'Trend: Stable share count',
      };
    }
    return {
      trendDirection: 'single',
      trendTone: 'neutral',
      trendLabelHe: 'מגמת דילול: נתון שנתי יחיד',
      trendLabelEn: 'Dilution trend: Single-year data',
    };
  }

  const recentWindow = yoyChanges.length >= 4 ? yoyChanges.slice(-2) : yoyChanges.slice(-1);
  const priorWindow =
    yoyChanges.length >= 4
      ? yoyChanges.slice(Math.max(0, yoyChanges.length - 6), -2)
      : yoyChanges.slice(0, -1);

  const avg = (arr) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const recentAvg = avg(recentWindow);
  const priorAvg = avg(priorWindow);
  const THRESHOLD = 0.3;

  if (isDecreasing) {
    const recentPace = -recentAvg;
    const priorPace = -priorAvg;
    if (recentPace >= priorPace + THRESHOLD) {
      return {
        trendDirection: 'accelerating',
        trendTone: 'improving',
        trendLabelHe: 'מגמת הבייבאקס: בעלייה ↑ (משתפר)',
        trendLabelEn: 'Buyback trend: Accelerating ↑ (improving)',
      };
    }
    if (recentPace <= priorPace - THRESHOLD) {
      return {
        trendDirection: 'slowing',
        trendTone: 'slowing',
        trendLabelHe: 'מגמת הבייבאקס: בירידה ↓ (האטה)',
        trendLabelEn: 'Buyback trend: Slowing ↓',
      };
    }
    return {
      trendDirection: 'steady',
      trendTone: 'steady',
      trendLabelHe: 'מגמת הבייבאקס: קצב יציב →',
      trendLabelEn: 'Buyback trend: Steady pace →',
    };
  }

  if (isFlat) {
    if (priorAvg > 0.5) {
      return {
        trendDirection: 'slowing',
        trendTone: 'improving',
        trendLabelHe: 'מגמת הדילול: בירידה ↓ (התייצבות)',
        trendLabelEn: 'Dilution trend: Declining ↓ (stabilized)',
      };
    }
    if (priorAvg < -0.5) {
      return {
        trendDirection: 'slowing',
        trendTone: 'slowing',
        trendLabelHe: 'מגמת הבייבאקס: בירידה ↓ (התייצבות)',
        trendLabelEn: 'Buyback trend: Slowed ↓ (flat)',
      };
    }
    return {
      trendDirection: 'steady',
      trendTone: 'steady',
      trendLabelHe: 'מגמה: כמות מניות יציבה →',
      trendLabelEn: 'Trend: Stable share count →',
    };
  }

  // Active dilution regime
  if (recentAvg >= priorAvg + THRESHOLD) {
    return {
      trendDirection: 'accelerating',
      trendTone: 'worsening',
      trendLabelHe: 'מגמת הדילול: בעלייה ↑ (מחמיר)',
      trendLabelEn: 'Dilution trend: Accelerating ↑ (worsening)',
    };
  }
  if (recentAvg <= priorAvg - THRESHOLD) {
    return {
      trendDirection: 'slowing',
      trendTone: 'improving',
      trendLabelHe: 'מגמת הדילול: בירידה ↓ (משתפר)',
      trendLabelEn: 'Dilution trend: Slowing ↓ (improving)',
    };
  }
  return {
    trendDirection: 'steady',
    trendTone: 'steady',
    trendLabelHe: 'מגמת הדילול: קצב יציב →',
    trendLabelEn: 'Dilution trend: Steady pace →',
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

  const first = allYears[0];
  const latest = allYears[allYears.length - 1];
  const prior = allYears.length >= 2 ? allYears[allYears.length - 2] : null;
  const spanYears = Math.max(0, latest.year - first.year);

  let annualChangePct = 0;
  if (prior && prior.value > 0) {
    annualChangePct = ((latest.value - prior.value) / prior.value) * 100;
  }
  const totalChangePct =
    spanYears > 0 && first.value > 0 ? ((latest.value - first.value) / first.value) * 100 : 0;

  // Optional SEC Cash Flow dollar buybacks extraction (PaymentsForRepurchaseOfCommonStock)
  const rawRepurchases = Array.isArray(metrics?.stockRepurchases?.annual)
    ? metrics.stockRepurchases.annual
        .filter((r) => r && isNumeric(r.fiscalYear) && isNumeric(r.value) && Math.abs(r.value) > 0)
        .sort((a, b) => a.fiscalYear - b.fiscalYear)
    : [];
  const repByYear = new Map();
  for (const r of rawRepurchases) {
    repByYear.set(r.fiscalYear, Math.abs(r.value));
  }
  const repYears = Array.from(repByYear.entries()).map(([year, value]) => ({ year, value }));
  const latestBuybackUsd = repYears.length > 0 ? repYears[repYears.length - 1].value : null;
  let buybackCagrPct = null;
  if (repYears.length >= 2) {
    const repLatest = repYears[repYears.length - 1];
    const repBase = repYears.length >= 6 ? repYears[repYears.length - 6] : repYears[0];
    const repSpan = repLatest.year - repBase.year;
    if (repSpan > 0 && repBase.value > 0 && repLatest.value > 0) {
      buybackCagrPct = (Math.pow(repLatest.value / repBase.value, 1 / repSpan) - 1) * 100;
    }
  }

  // Financial Logic:
  // Decreasing share count (Buybacks / slope < 0) = POSITIVE (Pass -> GREEN)
  // Increasing share count (Dilution / slope > 0) = NEGATIVE (Fail -> RED)
  const isDecreasing = annualChangePct < -0.1 || (allYears.length >= 3 && latest.value < allYears[0].value);
  const isFlat = Math.abs(annualChangePct) <= 0.2;
  const isPass = isDecreasing || isFlat;

  const totalFmt = `${totalChangePct >= 0 ? '+' : ''}${totalChangePct.toFixed(1)}%`;
  const annualFmt = `${annualChangePct >= 0 ? '+' : ''}${annualChangePct.toFixed(1)}%`;
  const spendNoteHe = latestBuybackUsd
    ? ` · רכישות אשתקד: ${formatCompactUsd(latestBuybackUsd)}${
        buybackCagrPct !== null ? ` (קצב שנתי ${buybackCagrPct >= 0 ? '+' : ''}${Math.round(buybackCagrPct)}%)` : ''
      }`
    : '';
  const spendNoteEn = latestBuybackUsd
    ? ` · Latest spend: ${formatCompactUsd(latestBuybackUsd)}${
        buybackCagrPct !== null ? ` (${Math.round(buybackCagrPct)}% CAGR)` : ''
      }`
    : '';

  const valueHe = isDecreasing
    ? annualChangePct <= -0.1
      ? `↓ ${annualFmt} מניות (בייבאק)`
      : `↓ ${totalFmt} מניות (${spanYears} ש׳)`
    : isFlat
    ? '~0% מניות (יציב)'
    : `↑ ${annualFmt} מניות (דילול)`;

  const shareTrend = calculateShareRateTrend(allYears, { isDecreasing, isFlat });

  const historyMeta = analyzeSeriesShape(sparkline, 'shares');
  if (historyMeta) {
    historyMeta.cycleBadgeHe = spanYears > 0 ? `מצטבר: ${totalFmt}` : `${first.year}`;
    historyMeta.cycleBadgeEn = spanYears > 0 ? `Cumulative: ${totalFmt}` : `${first.year}`;
  }

  return {
    id: 'share-dilution',
    title: 'Share Dilution',
    titleHe: 'רכישה עצמית / דילול',
    value: isDecreasing ? 'Share Buybacks' : (isFlat ? 'Flat Share Count' : `+${annualChangePct.toFixed(1)}% / yr`),
    valueHe,
    target: 'Target: Decreasing',
    targetHe: 'תנאי למעבר: ירידה או יציבות במניות',
    ...shareTrend,
    latestValue: latest.value,
    changePct: Math.round(annualChangePct * 10) / 10,
    totalChangePct: Math.round(totalChangePct * 10) / 10,
    latestBuybackUsd,
    badge: isDecreasing ? 'Buybacks' : (isFlat ? 'No Dilution' : 'Diluting'),
    badgeHe: isDecreasing ? 'רכישה עצמית' : (isFlat ? 'ללא דילול' : 'דילול מניות'),
    detail: isDecreasing
      ? 'החברה רוכשת מניות חזרה'
      : (isFlat ? 'ללא דילול מניות משמעותי' : `הדפסת מניות ודילול משקיעים (+${annualChangePct.toFixed(1)}%)`),
    detailEn: isDecreasing
      ? 'Net share count shrinking via buybacks'
      : isFlat
      ? 'Stable diluted share count (no material dilution)'
      : `Share count expanding (+${annualChangePct.toFixed(1)}% YoY dilution)`,
    metricSummary:
      spanYears >= 1
        ? `Cumulative (${first.year}–${latest.year}): ${totalFmt}${spendNoteEn}`
        : isDecreasing
        ? 'Decreasing share count increases ownership stake'
        : 'Limited share history',
    metricSummaryHe:
      spanYears >= 1
        ? `שינוי מצטבר (${first.year}–${latest.year}): ${totalFmt}${spendNoteHe}`
        : isDecreasing
        ? 'ירידה בכמות המניות מגדילה את חלקנו ברווח'
        : 'כמות מניות יציבה',
    sparklineUnit: 'sharesM',
    historyMeta,
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
  const historyMeta = analyzeSeriesShape(sortedPoints, 'currentRatio');
  if (historyMeta) {
    historyMeta.cycleBadgeHe = `טווח ${historyMeta.minVal.toFixed(1)}x–${historyMeta.maxVal.toFixed(1)}x`;
    historyMeta.cycleBadgeEn = `Range ${historyMeta.minVal.toFixed(1)}x–${historyMeta.maxVal.toFixed(1)}x`;
  }
  // Requirement: יחס שוטף שגדול מ-1 מקבל ירוק (Pass). שקטן מ-1 מקבל אדום (Fail).
  const isPass = latest.value >= 1.0;

  return {
    id: 'balance-sheet',
    title: 'Current Ratio (Liquidity)',
    titleHe: 'יחס שוטף (נזילות)',
    value: `${latest.value.toFixed(2)}x`,
    valueHe: `${latest.value.toFixed(2)}x`,
    target: 'Target: > 1.0',
    targetHe: 'תנאי למעבר: מעל 1.0',
    latestValue: latest.value,
    badge: isPass ? 'Safe (> 1.0)' : 'At Risk (< 1.0)',
    badgeHe: isPass ? 'בטוח (מעל 1.0)' : 'סיכון (מתחת ל-1.0)',
    detail: isPass
      ? 'יחס שוטף תקין (מעל 1.0)'
      : `יחס שוטף נמוך מ-1.0 (${latest.value.toFixed(2)}x)`,
    detailEn: isPass
      ? `Healthy liquidity (${latest.value.toFixed(2)}x > 1.0)`
      : `Low short-term liquidity (${latest.value.toFixed(2)}x < 1.0)`,
    metricSummary: isPass
      ? `Current assets exceed liabilities (${historyMeta?.cycleBadgeEn || 'solid'})`
      : `Short-term liabilities exceed current assets (${latest.value.toFixed(2)}x)`,
    metricSummaryHe: isPass
      ? `נכסים שוטפים עולים על התחייבויות (${historyMeta?.cycleBadgeHe || 'חוסן פיננסי'})`
      : 'התחייבויות שוטפות עולות על נכסים (סיכון נזילות)',
    sparklineUnit: 'x',
    historyMeta,
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
