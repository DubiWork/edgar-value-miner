/**
 * Triage Calculator Utility
 *
 * Extracts and calculates fast-triage metrics and sparkline historical time-series
 * for Step 1 Triage (Stock Simplifier inspired flow).
 *
 * Evaluates:
 * 1. Revenue Growth (Consistent top-line growth over 10-15 years; 3-tier Weakest-Link)
 * 2. Operating Margins (Stable / healthy margins >= 10%, Weakest-Link before >= 25%)
 * 3. Share Dilution (Buybacks / <= +0.2% = pass; +0.2%..+3.0% = warn; > +3.0% = fail)
 * 4. Current Ratio (>= 1.5x = pass; 1.0x–1.5x = warn; < 1.0x = fail)
 *
 * Returns an explicit `unavailable` state when SEC XBRL data is missing or invalid
 * (never fabricates fallback defaults).
 *
 * @module triageCalculator
 */

import gaapNormalizer from './gaapNormalizer.js';
import {
  evaluateInversionFlags,
  evaluateSaaSDeferredRevenueGuardrail,
} from './inversionEngine.js';

// =============================================================================
// Unavailable Metric State Factory
// =============================================================================

const UNAVAILABLE_METRIC_CONFIG = {
  revenue: {
    id: 'revenue-growth',
    title: 'Revenue Growth',
    titleHe: 'צמיחה בהכנסות',
    detail: 'לא נמצאו נתוני הכנסות בדיווחי SEC לחישוב צמיחה.',
    detailEn: 'No valid SEC XBRL revenue data available.',
    sparklineUnit: '$M',
  },
  margins: {
    id: 'operating-margins',
    title: 'Operating Margins',
    titleHe: 'שולי רווח תפעולי',
    detail: 'לא נמצאו נתוני רווח תפעולי בדיווחי SEC לחישוב שוליים.',
    detailEn: 'No valid SEC XBRL operating margin data available.',
    sparklineUnit: '%',
  },
  shares: {
    id: 'share-dilution',
    title: 'Share Dilution',
    titleHe: 'רכישה עצמית / דילול',
    target: 'Target: Decreasing',
    targetHe: 'תנאי למעבר: ירידה או יציבות במניות',
    detail: 'לא נמצאו נתוני כמות מניות בדיווחי SEC לבדיקת דילול.',
    detailEn: 'No valid SEC XBRL share count data available.',
    sparklineUnit: 'sharesM',
  },
  currentRatio: {
    id: 'balance-sheet',
    title: 'Current Ratio (Liquidity)',
    titleHe: 'יחס שוטף (נזילות)',
    target: 'Target: >= 1.5x',
    targetHe: 'תנאי למעבר: מעל 1.5x',
    detail: 'לא נמצאו נתוני נכסים והתחייבויות שוטפות בדיווחי SEC.',
    detailEn: 'No valid SEC XBRL current assets/liabilities available.',
    sparklineUnit: 'x',
  },
};

function createUnavailableMetric(key, currencySymbol = '$') {
  const cfg = UNAVAILABLE_METRIC_CONFIG[key];
  return {
    id: cfg.id,
    title: cfg.title,
    titleHe: cfg.titleHe,
    ...(cfg.target ? { target: cfg.target } : {}),
    ...(cfg.targetHe ? { targetHe: cfg.targetHe } : {}),
    value: 'No SEC Data',
    valueHe: 'אין נתוני SEC',
    latestValue: null,
    badge: 'No SEC Data',
    badgeHe: 'אין נתוני SEC',
    detail: cfg.detail,
    detailEn: cfg.detailEn,
    metricSummary: 'Unavailable',
    metricSummaryHe: 'לא זמין בדיווחי SEC',
    sparklineUnit: key === 'revenue' ? `${currencySymbol}M` : cfg.sparklineUnit,
    historyMeta: null,
    status: 'unavailable',
    sparkline: [],
  };
}

// =============================================================================
// Helpers
// =============================================================================

function isNumeric(val) {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

function formatCompactCurrency(amount, currencySymbol = '$') {
  const abs = Math.abs(Number(amount) || 0);
  if (abs >= 1e9) return `${currencySymbol}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${currencySymbol}${Math.round(abs / 1e6)}M`;
  return `${currencySymbol}${Math.round(abs / 1e3)}K`;
}

function firstNonEmptyAnnual(candidates) {
  for (const list of candidates) {
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return [];
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
  let runningPeak = sparkline[0].value;
  let maxDrawdownPct = 0;
  let maxMarginDrawdown = 0;
  let downYears = 0;
  let recentDownYears = 0;
  const recentStartIdx = Math.max(1, sparkline.length - 7);

  for (let i = 0; i < sparkline.length; i++) {
    const val = sparkline[i].value;
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
    sum += val;

    if (val > runningPeak) {
      runningPeak = val;
    } else if (val < runningPeak) {
      if (runningPeak > 0) {
        const dd = ((runningPeak - val) / runningPeak) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      }
      const ppDrop = runningPeak - val;
      if (ppDrop > maxMarginDrawdown) maxMarginDrawdown = ppDrop;
    }

    if (i > 0) {
      const prev = sparkline[i - 1].value;
      if (kind === 'margins') {
        if (val <= prev - 2.5) {
          downYears += 1;
          if (i >= recentStartIdx) recentDownYears += 1;
        }
      } else if (kind === 'revenue') {
        if (prev > 0 && val < prev * 0.98) {
          downYears += 1;
          if (i >= recentStartIdx) recentDownYears += 1;
        }
      }
    }
  }

  // Recency-aware drawdown over strictly the last 10 points (prevents 11Y+ one-offs from flagging)
  const recentSlice = sparkline.slice(-10);
  let recentMarginDrawdownRaw = 0;
  let recentPeak = recentSlice[0].value;
  for (let i = 1; i < recentSlice.length; i++) {
    const val = recentSlice[i].value;
    if (val > recentPeak) {
      recentPeak = val;
    } else {
      const drop = recentPeak - val;
      if (drop > recentMarginDrawdownRaw) recentMarginDrawdownRaw = drop;
    }
  }
  const recentMarginDrawdown = Math.round(recentMarginDrawdownRaw * 10) / 10;

  // Trailing consecutive decline streak (from latest backward) to catch steady multi-year erosion
  let recentConsecutiveDownYears = 0;
  let erosionIdx = sparkline.length - 1;
  while (erosionIdx >= 1 && sparkline[erosionIdx].value < sparkline[erosionIdx - 1].value) {
    recentConsecutiveDownYears += 1;
    erosionIdx -= 1;
  }
  const erosionPeakVal = recentConsecutiveDownYears > 0 ? sparkline[erosionIdx].value : null;
  const recentErosionPp =
    recentConsecutiveDownYears > 0 && erosionPeakVal !== null
      ? Math.round((erosionPeakVal - sparkline[sparkline.length - 1].value) * 10) / 10
      : 0;

  const avg = Math.round((sum / sparkline.length) * 10) / 10;
  const spread = Math.round((maxVal - minVal) * 10) / 10;
  const roundedMarginDrawdown = Math.round(maxMarginDrawdown * 10) / 10;

  let cycleType = 'steady';
  let cycleBadgeHe = `${startYear}–${endYear}`;
  let cycleBadgeEn = `${startYear}–${endYear}`;

  if (kind === 'revenue' && sparkline.length >= 3) {
    if (downYears >= 3 || (maxDrawdownPct >= 15 && recentDownYears >= 1) || maxDrawdownPct >= 25) {
      cycleType = 'cyclical';
      cycleBadgeHe =
        downYears === 1
          ? 'מחזורי (שנת ירידה אחת)'
          : downYears >= 2
          ? `מחזורי (${downYears} ש׳ ירידה)`
          : 'מחזורי';
      cycleBadgeEn = downYears > 0 ? `Cyclical (${downYears} down yrs)` : 'Cyclical';
    } else if (downYears >= 1 || maxDrawdownPct >= 5) {
      cycleType = 'moderate';
      cycleBadgeHe =
        downYears === 1
          ? 'שנת ירידה אחת'
          : downYears >= 2
          ? `תנודתי (${downYears} שנות ירידה)`
          : 'תנודתי קלות';
      cycleBadgeEn = downYears > 0 ? `${downYears} dip yr${downYears > 1 ? 's' : ''}` : 'Mild swing';
    } else {
      cycleType = 'steady';
      cycleBadgeHe = 'עלייה רציפה';
      cycleBadgeEn = 'Steady';
    }
  } else if (kind === 'margins' && sparkline.length >= 3) {
    const hasNegativeYear = minVal < 0;
    const swingRatio = Math.abs(avg) > 1 ? spread / Math.abs(avg) : spread / 5;
    if (
      hasNegativeYear ||
      recentMarginDrawdown >= 12 ||
      recentDownYears >= 3 ||
      downYears >= 4 ||
      (recentMarginDrawdown >= 6 && swingRatio >= 0.35)
    ) {
      cycleType = 'cyclical';
      cycleBadgeHe = `מחזורי (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
      cycleBadgeEn = `Cyclical (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
    } else if (
      spread >= 10 &&
      !hasNegativeYear &&
      sparkline[sparkline.length - 1].value > sparkline[0].value
    ) {
      cycleType = 'steady';
      cycleBadgeHe = `מתרחב (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
      cycleBadgeEn = `Expanding (${minVal.toFixed(1)}%–${maxVal.toFixed(1)}%)`;
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
    maxMarginDrawdown: roundedMarginDrawdown,
    recentMarginDrawdown,
    recentConsecutiveDownYears,
    recentErosionPp,
    erosionPeakVal,
    cycleType,
    cycleBadgeHe,
    cycleBadgeEn,
  };
}

function getMetricsAndCurrency(companyFacts) {
  if (!companyFacts) return { metrics: null, currencySymbol: '$' };

  const resolveSymbol = (cur) =>
    gaapNormalizer.getCurrencySymbol ? gaapNormalizer.getCurrencySymbol(cur) : '$';

  // Already normalized object with metrics
  if (companyFacts.metrics && typeof companyFacts.metrics === 'object') {
    return {
      metrics: companyFacts.metrics,
      currencySymbol: resolveSymbol(companyFacts.metadata?.currency),
    };
  }

  // Raw company facts (US-GAAP or IFRS)
  if (companyFacts.facts) {
    try {
      const normalized = gaapNormalizer.normalizeCompanyFacts(companyFacts, { fullHistory: true });
      return {
        metrics: normalized?.metrics || null,
        currencySymbol: resolveSymbol(normalized?.metadata?.currency),
      };
    } catch {
      return { metrics: null, currencySymbol: '$' };
    }
  }

  return { metrics: null, currencySymbol: '$' };
}

// =============================================================================
// Metric Extractors
// =============================================================================

function countMaxConsecutiveDownYears(allYears) {
  let maxConsecutiveDownYears = 0;
  let currentStreak = 0;
  for (let i = 1; i < allYears.length; i++) {
    if (allYears[i].value < allYears[i - 1].value) {
      currentStreak += 1;
      if (currentStreak > maxConsecutiveDownYears) {
        maxConsecutiveDownYears = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }
  return maxConsecutiveDownYears;
}

/**
 * 1. Revenue Growth (3-tier Weakest-Link: pass / warn / fail)
 */
function calculateRevenueMetric(metrics, currencySymbol = '$') {
  const revList = metrics?.revenue?.annual;
  if (!Array.isArray(revList) || revList.length === 0) {
    return createUnavailableMetric('revenue', currencySymbol);
  }

  // Filter valid points, sort chronological (oldest to newest)
  const valid = revList
    .filter((item) => item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (valid.length === 0) {
    return createUnavailableMetric('revenue', currencySymbol);
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
  const downYears = historyMeta?.downYears ?? 0;
  const maxConsecutiveDownYears = countMaxConsecutiveDownYears(allYears);
  const isCyclical = historyMeta?.cycleType === 'cyclical';
  const roundedCagr = Math.round(cagr * 10) / 10;

  const isFail =
    maxConsecutiveDownYears >= 3 ||
    (yoy < 0 && cagr <= 0) ||
    (allYears.length === 2 && yoy < 0);
  const isWarn =
    !isFail &&
    (roundedCagr < 5 ||
      downYears >= 3 ||
      isCyclical ||
      yoy < 0 ||
      (roundedCagr >= 5 && cagr - yoy >= 10));

  const yoyRounded = Math.round(yoy);
  const yoySigned = `${yoy >= 0 ? '+' : ''}${yoyRounded}%`;
  const formattedGrowth = `${yoySigned} YoY`;
  const formattedGrowthHe = `${yoySigned} (שנה אחרונה / YoY)`;

  let status = 'pass';
  let badgeEn = 'Consistent Growth';
  let badgeHe = 'צמיחה עקבית';
  let detail = `צמיחה עקבית של ~${Math.abs(Math.round(yoy || cagr))}% בשנה`;
  let detailEn = `Consistent ~${Math.abs(Math.round(yoy || cagr))}% annual revenue growth`;

  if (isFail) {
    status = 'fail';
    badgeEn = 'Revenue Decline';
    badgeHe = 'ירידה בהכנסות';
    if (maxConsecutiveDownYears >= 3) {
      detail = `ירידה מתמשכת בהכנסות (${maxConsecutiveDownYears} שנים רצופות של ירידה, שנה אחרונה ${yoySigned})`;
      detailEn = `${maxConsecutiveDownYears} consecutive years of revenue decline (latest ${formattedGrowth})`;
    } else {
      detail = `ירידה בהכנסות של ${yoyRounded}% בשנה`;
      detailEn = `Revenue declined ${yoyRounded}% YoY`;
    }
  } else if (isWarn) {
    status = 'warn';
    if (allYears.length === 1) {
      badgeEn = 'Slow Growth';
      badgeHe = 'צמיחה איטית';
      detail = 'נתון הכנסות שנתי יחיד — חסרות שנים קודמות למדידת מגמה';
      detailEn = 'Single annual revenue point — insufficient history for growth trend';
    } else if (isCyclical || downYears >= 3) {
      badgeEn = 'Cyclical Growth';
      badgeHe = 'צמיחה מחזורית';
      detail = `צמיחה מחזורית (${yoySigned} בשנה אחרונה לצד ${downYears} שנות ירידה)`;
      detailEn = `${formattedGrowth} top-line with cyclical dips (${downYears} down yrs)`;
    } else if (roundedCagr < 5) {
      badgeEn = 'Slow Growth';
      badgeHe = 'צמיחה איטית';
      detail = `צמיחה איטית בהכנסות (קצב ממוצע ${roundedCagr.toFixed(1)}%, מתחת ל-5%)`;
      detailEn = `Slow annual growth (${roundedCagr.toFixed(1)}% CAGR, below 5%)`;
    } else {
      badgeEn = 'Slowing Growth';
      badgeHe = 'האטה בצמיחה';
      detail = `האטה בצמיחה (${yoySigned} בשנה אחרונה לעומת קצב ממוצע ~${Math.round(cagr)}%)`;
      detailEn = `Growth decelerating (${formattedGrowth} vs ~${Math.round(cagr)}% CAGR)`;
    }
  }

  const longEn = fullCagr !== null ? ` | ${fullSpanYears}Y ~${Math.round(fullCagr)}%` : '';
  const longHe = fullCagr !== null ? ` | ${fullSpanYears} ש׳: ~${Math.round(fullCagr)}%` : '';

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
    detail,
    detailEn,
    metricSummary: `${yearsDiff > 0 ? `${yearsDiff}Y` : 'Latest'} CAGR ~${Math.round(cagr)}%${longEn}`,
    metricSummaryHe: `צמיחה שנתית (CAGR) | ${yearsDiff > 0 ? `${yearsDiff} ש׳` : 'אחרון'}: ~${Math.round(cagr)}%${longHe}`,
    sparklineUnit: `${currencySymbol}M`,
    historyMeta,
    status,
    sparkline,
  };
}

/**
 * Checks whether a low-cost scale retailer maintains narrow (2%–10%) yet completely steady margins
 * backed by operating cash flow >= net income (e.g., warehouse club / discount model).
 */
function hasLowCostRetailCashBacking(metrics) {
  const ocfList = metrics?.operatingCashFlow?.annual || [];
  const niList = metrics?.netIncome?.annual || [];
  if (ocfList.length === 0 || niList.length === 0) return true;
  const niByYear = new Map(
    niList.filter((x) => x && isNumeric(x.fiscalYear) && isNumeric(x.value)).map((x) => [x.fiscalYear, x.value])
  );
  let sumOcf = 0;
  let sumNi = 0;
  let matched = 0;
  for (const pt of ocfList.slice(-3)) {
    if (pt && isNumeric(pt.fiscalYear) && isNumeric(pt.value) && niByYear.has(pt.fiscalYear)) {
      sumOcf += pt.value;
      sumNi += niByYear.get(pt.fiscalYear);
      matched += 1;
    }
  }
  return matched === 0 || (sumNi > 0 && sumOcf >= sumNi * 0.95);
}

/**
 * 2. Operating Margins (Weakest-Link evaluated BEFORE >= 25%)
 */
function calculateOperatingMarginsMetric(metrics, options = {}) {
  const revList = metrics?.revenue?.annual || [];
  const opIncomeList = metrics?.operatingIncome?.annual || [];

  if (!Array.isArray(revList) || revList.length === 0 || !Array.isArray(opIncomeList)) {
    return createUnavailableMetric('margins');
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
    return createUnavailableMetric('margins');
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
  const prev = sortedPoints.length >= 2 ? sortedPoints[sortedPoints.length - 2] : null;
  const historyMeta = analyzeSeriesShape(sortedPoints, 'margins');

  const hasNegativeYear = historyMeta ? historyMeta.minVal < 0 : latest.value < 0;
  const spread = historyMeta ? historyMeta.maxVal - historyMeta.minVal : 0;
  const recentMarginDrawdown = historyMeta?.recentMarginDrawdown ?? 0;
  const isVolatileCollapse =
    recentMarginDrawdown >= 12 || (spread > 20 && recentMarginDrawdown >= 8);
  const isCyclical = historyMeta?.cycleType === 'cyclical';
  const recentDrop = prev ? prev.value - latest.value >= 10 : false;
  const isRecentErosion =
    (historyMeta?.recentConsecutiveDownYears ?? 0) >= 3 &&
    (historyMeta?.recentErosionPp ?? 0) >= 2.0;

  const minFmt = historyMeta ? historyMeta.minVal.toFixed(1) : latest.value.toFixed(1);
  const maxFmt = historyMeta ? historyMeta.maxVal.toFixed(1) : latest.value.toFixed(1);
  const latestFmt = latest.value.toFixed(1);

  let status;
  let badgeEn;
  let badgeHe;
  let detail;
  let detailEn;

  const isLowCostRetailEligible =
    options?.archetype === 'RETAIL_ECOMMERCE' &&
    !hasNegativeYear &&
    latest.value >= 2 &&
    latest.value <= 6 &&
    spread <= 2.5 &&
    !isVolatileCollapse &&
    !isCyclical &&
    hasLowCostRetailCashBacking(metrics);

  if (latest.value < 0) {
    status = 'fail';
    badgeEn = 'Negative Margins';
    badgeHe = 'שוליים שליליים';
    detail = historyMeta
      ? `שולי רווח תפעולי שליליים (${latestFmt}%), נעו בין ${minFmt}% ל-${maxFmt}%`
      : `שולי רווח תפעולי שליליים (${latestFmt}%)`;
    detailEn = `Negative operating margin (${latestFmt}%${historyMeta ? `, range ${minFmt}%–${maxFmt}%` : ''})`;
  } else if (hasNegativeYear) {
    status = 'fail';
    badgeEn = 'Volatile (Loss Year)';
    badgeHe = 'תנודתיים (שנת הפסד)';
    detail = `שוליים נוכחיים ${latestFmt}%, אך כללו שנת הפסד — נעו בין ${minFmt}% ל-${maxFmt}%`;
    detailEn = `Current margin ${latestFmt}%, but suffered historical loss year (${minFmt}%–${maxFmt}% range)`;
  } else if (isLowCostRetailEligible) {
    status = 'pass';
    badgeEn = 'Low-Cost Stable';
    badgeHe = 'יציבים (עלות-נמוכה)';
    detail = `שולי קמעונאות עלות-נמוכה יציבים (${latestFmt}%) המגובים בתזרים חזק`;
    detailEn = `Consistent low-cost retail margin (${latestFmt}%) backed by strong cash conversion`;
  } else if (latest.value < 10) {
    status = 'fail';
    badgeEn = isCyclical ? 'Low & Cyclical' : 'Low Margins';
    badgeHe = isCyclical ? 'נמוכים ומחזוריים' : 'שוליים נמוכים';
    detail = isCyclical && historyMeta
      ? `שולי רווח צרים ומחזוריים (${latestFmt}%, נעו בין ${minFmt}% ל-${maxFmt}%)`
      : `שולי רווח נמוכים מ-10% (${latestFmt}%)`;
    detailEn = `Operating margin ${latestFmt}% (below 10% threshold)`;
  } else if (isVolatileCollapse || isCyclical || recentDrop) {
    status = 'warn';
    badgeEn = 'Volatile / Cyclical';
    badgeHe = 'תנודתיים / מחזוריים';
    detail = historyMeta
      ? `שוליים מעל 10% (${latestFmt}%) אך תנודתיים בין ${minFmt}% ל-${maxFmt}%`
      : `שולי רווח תנודתיים (${latestFmt}%)`;
    detailEn = historyMeta
      ? `Margins above 10% (${latestFmt}%) with cyclical volatility (${minFmt}%–${maxFmt}%)`
      : `Volatile operating margins (${latestFmt}%)`;
  } else if (isRecentErosion) {
    status = 'warn';
    badgeEn = 'Margin Erosion';
    badgeHe = 'שחיקה בשוליים';
    detail = `שולי הרווח בירידה ${historyMeta.recentConsecutiveDownYears} שנים רצופות (מ-${historyMeta.erosionPeakVal.toFixed(1)}% ל-${latestFmt}%)`;
    detailEn = `Operating margins declined ${historyMeta.recentConsecutiveDownYears} consecutive years (${historyMeta.erosionPeakVal.toFixed(1)}% to ${latestFmt}%)`;
  } else {
    status = 'pass';
    if (latest.value >= 25) {
      badgeEn = 'High & Stable';
      badgeHe = 'גבוהים ויציבים';
      detail = `שוליים יציבים מעל ${Math.min(40, Math.floor(latest.value / 10) * 10)}%`;
      detailEn = `High & stable operating margin at ${latestFmt}%`;
    } else {
      badgeEn = 'Healthy Margins';
      badgeHe = 'שוליים תקינים';
      detail = `שוליים תקינים ויציבים (${latestFmt}%)`;
      detailEn = `Healthy, stable operating margin at ${latestFmt}%`;
    }
  }

  return {
    id: 'operating-margins',
    title: 'Operating Margins',
    titleHe: 'שולי רווח תפעולי',
    value: `${latestFmt}%`,
    valueHe: `${latestFmt}%`,
    latestValue: latest.value,
    badge: badgeEn,
    badgeHe,
    detail,
    detailEn,
    metricSummary: historyMeta
      ? `${historyMeta.startYear}–${historyMeta.endYear} avg: ${historyMeta.avg.toFixed(1)}% (dashed line)`
      : `Operating Margin: ${latestFmt}%`,
    metricSummaryHe: historyMeta
      ? `ממוצע ${historyMeta.startYear}–${historyMeta.endYear}: ${historyMeta.avg.toFixed(1)}% (הקו המקווקו בגרף)`
      : `שולי רווח תפעולי: ${latestFmt}%`,
    sparklineUnit: '%',
    historyMeta,
    isLowCostRetailException: isLowCostRetailEligible,
    status,
    sparkline: sortedPoints,
  };
}

/**
 * Detects whether dilution or share buyback pace is accelerating, steady, or slowing over time
 * by comparing recent YoY share-count % changes against earlier years.
 */
function calculateShareRateTrend(
  allYears,
  { isDecreasing, isFlat, isBuybackCannibal = false, roundedAnnualChangePct = 0 }
) {
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
        trendLabelHe: 'קצב רכישה עצמית: נתון שנתי יחיד',
        trendLabelEn: 'Buyback pace: Single-year data',
      };
    }
    if (isFlat) {
      return {
        trendDirection: 'steady',
        trendTone: 'steady',
        trendLabelHe: 'כמות מניות יציבה',
        trendLabelEn: 'Stable share count',
      };
    }
    return {
      trendDirection: 'single',
      trendTone: 'neutral',
      trendLabelHe: 'קצב דילול: נתון שנתי יחיד',
      trendLabelEn: 'Dilution pace: Single-year data',
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
        trendLabelHe: 'קצב רכישה עצמית: מואץ',
        trendLabelEn: 'Buyback pace: Accelerating',
      };
    }
    if (recentPace <= priorPace - THRESHOLD) {
      return {
        trendDirection: 'slowing',
        trendTone: 'slowing',
        trendLabelHe: 'קצב רכישה עצמית: האטה',
        trendLabelEn: 'Buyback pace: Slowing',
      };
    }
    return {
      trendDirection: 'steady',
      trendTone: 'steady',
      trendLabelHe: 'קצב רכישה עצמית: יציב',
      trendLabelEn: 'Buyback pace: Steady',
    };
  }

  // Buyback cannibal whose buybacks paused or ticked slightly positive (<= +0.5% YoY)
  if ((isFlat || roundedAnnualChangePct <= 0.5) && isBuybackCannibal) {
    return {
      trendDirection: 'slowing',
      trendTone: 'slowing',
      trendLabelHe: 'קצב רכישה עצמית: הפסקה זמנית',
      trendLabelEn: 'Buyback pace: Temporarily paused',
    };
  }

  if (isFlat) {
    if (priorAvg > 0.5) {
      return {
        trendDirection: 'slowing',
        trendTone: 'improving',
        trendLabelHe: 'קצב דילול: בירידה (התייצבות)',
        trendLabelEn: 'Dilution pace: Declining (stabilized)',
      };
    }
    if (priorAvg < -0.5) {
      return {
        trendDirection: 'slowing',
        trendTone: 'slowing',
        trendLabelHe: 'קצב רכישה עצמית: הפסקה זמנית',
        trendLabelEn: 'Buyback pace: Temporarily paused',
      };
    }
    return {
      trendDirection: 'steady',
      trendTone: 'steady',
      trendLabelHe: 'כמות מניות יציבה',
      trendLabelEn: 'Stable share count',
    };
  }

  // Active dilution regime
  if (recentAvg >= priorAvg + THRESHOLD) {
    return {
      trendDirection: 'accelerating',
      trendTone: 'worsening',
      trendLabelHe: 'קצב דילול: מואץ (מחמיר)',
      trendLabelEn: 'Dilution pace: Accelerating (worsening)',
    };
  }
  if (recentAvg <= priorAvg - THRESHOLD) {
    return {
      trendDirection: 'slowing',
      trendTone: 'improving',
      trendLabelHe: 'קצב דילול: בירידה (משתפר)',
      trendLabelEn: 'Dilution pace: Slowing (improving)',
    };
  }
  return {
    trendDirection: 'steady',
    trendTone: 'steady',
    trendLabelHe: 'קצב דילול: יציב',
    trendLabelEn: 'Dilution pace: Steady',
  };
}

/**
 * 3. Share Dilution (3-tier: <= 0.2% pass; > 0.2%..<= 3.0% warn; > 3.0% fail)
 */
function calculateShareDilutionMetric(metrics, currencySymbol = '$') {
  const sharesList = firstNonEmptyAnnual([
    metrics?.weightedAverageSharesDiluted?.annual,
    metrics?.weightedAverageShares?.annual,
    metrics?.sharesOutstanding?.annual,
  ]);

  if (!Array.isArray(sharesList) || sharesList.length === 0) {
    return createUnavailableMetric('shares');
  }

  const valid = sharesList
    .filter((item) => item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (valid.length === 0) {
    return createUnavailableMetric('shares');
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
  const latestBuybackUsd =
    rawRepurchases.length > 0 ? Math.abs(rawRepurchases[rawRepurchases.length - 1].value) : null;

  // Evaluate tier thresholds against displayed 1-decimal percentage so UI value & status stay 100% consistent
  const rawRoundedAnnual = Math.round(annualChangePct * 10) / 10;
  const roundedAnnualChangePct = Object.is(rawRoundedAnnual, -0) ? 0 : rawRoundedAnnual;
  const isDecreasing = roundedAnnualChangePct <= -0.1;
  const isFlat = roundedAnnualChangePct > -0.1 && roundedAnnualChangePct <= 0.2;
  const isWarn = roundedAnnualChangePct > 0.2 && roundedAnnualChangePct <= 3.0;
  const isFail = roundedAnnualChangePct > 3.0;
  const status = isFail ? 'fail' : isWarn ? 'warn' : 'pass';
  const isBuybackCannibal = spanYears >= 3 && totalChangePct <= -5;

  const totalFmt = `${totalChangePct >= 0 ? '+' : ''}${totalChangePct.toFixed(1)}%`;
  const annualFmt = `${roundedAnnualChangePct >= 0 ? '+' : ''}${roundedAnnualChangePct.toFixed(1)}%`;

  const valueHe = isFlat
    ? '~0% בכמות המניות (שנה אחרונה)'
    : `${annualFmt} בכמות המניות (שנה אחרונה)`;
  const value = isFlat
    ? '~0% shares (YoY)'
    : `${annualFmt} shares (YoY)`;

  const shareTrend = calculateShareRateTrend(allYears, {
    isDecreasing,
    isFlat,
    isBuybackCannibal,
    roundedAnnualChangePct,
  });

  const historyMeta = analyzeSeriesShape(sparkline, 'shares');
  if (historyMeta) {
    historyMeta.cycleBadgeHe = spanYears > 0 ? `מצטבר: ${totalFmt}` : `${first.year}`;
    historyMeta.cycleBadgeEn = spanYears > 0 ? `Cumulative: ${totalFmt}` : `${first.year}`;
  }

  let badge = 'No Dilution';
  let badgeHe = 'ללא דילול';
  let detail = 'ללא דילול מניות משמעותי';
  let detailEn = 'Stable diluted share count (no material dilution)';

  if (isFail) {
    badge = 'Diluting';
    badgeHe = 'דילול מניות';
    detail = `הדפסת מניות ודילול משקיעים (${annualFmt} בשנה)`;
    detailEn = `Share count expanding (${annualFmt} YoY dilution)`;
  } else if (isWarn) {
    badge = 'Moderate Dilution';
    badgeHe = 'דילול מתון';
    detail = `דילול מתון בכמות המניות (${annualFmt} בשנה)`;
    detailEn = `Moderate share dilution (${annualFmt} YoY)`;
  } else if (isDecreasing) {
    badge = 'Buybacks';
    badgeHe = 'רכישה עצמית';
    if (spanYears >= 1 && totalChangePct < 0) {
      detail = `סה״כ ${Math.abs(totalChangePct).toFixed(1)}% פחות מניות מאז ${first.year} — החלק שלך ברווח גדל`;
      detailEn = `${Math.abs(totalChangePct).toFixed(1)}% fewer shares since ${first.year} — your ownership slice grew`;
    } else {
      detail = 'החברה רוכשת מניות חזרה';
      detailEn = 'Net share count shrinking via buybacks';
    }
  } else if (isFlat && isBuybackCannibal) {
    detail = `יציב השנה לאחר צמצום של ${Math.abs(totalChangePct).toFixed(1)}% במניות מאז ${first.year}`;
    detailEn = `Flat this year after retiring ${Math.abs(totalChangePct).toFixed(1)}% of shares since ${first.year}`;
  }

  return {
    id: 'share-dilution',
    title: 'Share Dilution',
    titleHe: 'רכישה עצמית / דילול',
    value,
    valueHe,
    target: 'Target: Decreasing',
    targetHe: 'תנאי למעבר: ירידה או יציבות במניות',
    ...shareTrend,
    latestValue: latest.value,
    changePct: roundedAnnualChangePct,
    totalChangePct: Math.round(totalChangePct * 10) / 10,
    latestBuybackUsd,
    badge,
    badgeHe,
    detail,
    detailEn,
    metricSummary: latestBuybackUsd
      ? `Buyback spend last year: ${formatCompactCurrency(latestBuybackUsd, currencySymbol)}`
      : spanYears >= 1
      ? `Tracked span: ${first.year}–${latest.year}`
      : 'Limited share history',
    metricSummaryHe: latestBuybackUsd
      ? `השקעה ברכישה עצמית אשתקד: ${formatCompactCurrency(latestBuybackUsd, currencySymbol)}`
      : spanYears >= 1
      ? `טווח מעקב: ${first.year}–${latest.year}`
      : 'היסטוריית מניות קצרה',
    sparklineUnit: 'sharesM',
    historyMeta,
    status,
    sparkline,
  };
}

/**
 * 4. Current Ratio (Liquidity: >= 1.5x pass; 1.0x–1.5x warn; < 1.0x fail)
 * Applies Locked A1 Guardrail #2 (SaaS Deferred Revenue) and A2 Deposit Bank exemption.
 */
function calculateCurrentRatioMetric(metrics, options = {}) {
  const { archetype = null, financialSubType = null, saasGuardrail = null } = options;

  if (archetype === 'FINANCIAL_SPREAD' && financialSubType === 'DEPOSIT_BANK') {
    return {
      ...createUnavailableMetric('currentRatio'),
      value: 'N/A (Bank)',
      valueHe: 'לא רלוונטי לבנק',
      badge: 'Bank Exempt',
      badgeHe: 'החרגת בנק',
      detail: 'פיקדונות לקוחות מסווגים כהתחייבות שוטפת בבנקים — נמדד ביחס הון לנכסים (Equity/Assets).',
      detailEn: 'Customer deposits are short-term liabilities by definition — evaluated via Equity/Assets cushion.',
      metricSummary: 'Not applicable to deposit banks',
      metricSummaryHe: 'לא רלוונטי בבנקים מקבלי פיקדונות',
      isBankExempt: true,
      status: 'pass',
    };
  }

  const currentAssets = metrics?.currentAssets?.annual || [];
  const currentLiabilities = metrics?.currentLiabilities?.annual || [];
  const deferredRevList = metrics?.deferredRevenueCurrent?.annual || [];

  if (!Array.isArray(currentAssets) || !Array.isArray(currentLiabilities)) {
    return createUnavailableMetric('currentRatio');
  }

  const liabilitiesByYear = new Map();
  for (const item of currentLiabilities) {
    if (item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0) {
      liabilitiesByYear.set(item.fiscalYear, item.value);
    }
  }

  const activeSaasGuardrail =
    saasGuardrail || evaluateSaaSDeferredRevenueGuardrail(metrics, archetype);
  const applyDeferredAdj = activeSaasGuardrail?.active === true;

  const defRevByYear = new Map();
  if (applyDeferredAdj && Array.isArray(deferredRevList)) {
    for (const item of deferredRevList) {
      if (item && isNumeric(item.fiscalYear) && isNumeric(item.value) && item.value > 0) {
        defRevByYear.set(item.fiscalYear, item.value);
      }
    }
  }

  const ratioPoints = [];
  for (const assetItem of currentAssets) {
    if (assetItem && isNumeric(assetItem.fiscalYear) && isNumeric(assetItem.value)) {
      const liab = liabilitiesByYear.get(assetItem.fiscalYear);
      if (isNumeric(liab) && liab > 0) {
        const defRev = applyDeferredAdj ? defRevByYear.get(assetItem.fiscalYear) || 0 : 0;
        const effectiveLiab = liab - defRev > 0 ? liab - defRev : liab;
        const ratio = Math.round((assetItem.value / effectiveLiab) * 100) / 100;
        ratioPoints.push({
          year: assetItem.fiscalYear,
          value: ratio,
        });
      }
    }
  }

  if (ratioPoints.length === 0) {
    return createUnavailableMetric('currentRatio');
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

  const evaluatedRatio = applyDeferredAdj ? activeSaasGuardrail.adjustedRatio : latest.value;
  const latestFmt = evaluatedRatio.toFixed(2);
  let status = 'fail';
  let badge = 'At Risk (< 1.0)';
  let badgeHe = 'סיכון (מתחת ל-1.0)';
  let detail = `יחס שוטף נמוך מ-1.0 (${latestFmt}x)`;
  let detailEn = `Low short-term liquidity (${latestFmt}x < 1.0)`;
  let metricSummary = 'Short-term liabilities exceed liquid assets';
  let metricSummaryHe = 'התחייבויות שוטפות עולות על נכסים נזילים';

  if (evaluatedRatio >= 1.5) {
    status = 'pass';
    badge = applyDeferredAdj ? 'Healthy Liquidity' : 'Safe (>= 1.5x)';
    badgeHe = applyDeferredAdj ? 'נזילות תקינה' : 'בטוח (מעל 1.5x)';
    detail = applyDeferredAdj
      ? `נזילות תקינה בניכוי הכנסות מראש (${activeSaasGuardrail.adjustedDisplayHe}, ${activeSaasGuardrail.reportedSublabelHe})`
      : `יחס שוטף תקין ובטוח (${latestFmt}x, מעל 1.5x)`;
    detailEn = applyDeferredAdj
      ? `Healthy liquidity excluding deferred revenue (${activeSaasGuardrail.adjustedDisplayEn}, ${activeSaasGuardrail.reportedSublabelEn})`
      : `Healthy liquidity (${latestFmt}x >= 1.5x)`;
    metricSummary = applyDeferredAdj
      ? 'Adjusted for upfront subscription cash already collected'
      : 'Current assets comfortably cover near-term obligations';
    metricSummaryHe = applyDeferredAdj
      ? 'מנוטרל מהכנסות מנויים שכבר התקבלו במזומן'
      : 'נכסים שוטפים מכסים בנוחות התחייבויות קרובות';
  } else if (evaluatedRatio >= 1.0) {
    status = 'warn';
    badge = applyDeferredAdj ? 'Borderline Liquidity' : 'Borderline (1.0–1.5x)';
    badgeHe = applyDeferredAdj ? 'נזילות בינונית' : 'גבולי (1.0x–1.5x)';
    detail = applyDeferredAdj
      ? `נזילות בינונית גם בניכוי הכנסות מראש (${activeSaasGuardrail.adjustedDisplayHe}, ${activeSaasGuardrail.reportedSublabelHe})`
      : `יחס שוטף גבולי (${latestFmt}x — בין 1.0x ל-1.5x)`;
    detailEn = applyDeferredAdj
      ? `Borderline adjusted liquidity (${activeSaasGuardrail.adjustedDisplayEn}, ${activeSaasGuardrail.reportedSublabelEn})`
      : `Borderline short-term liquidity (${latestFmt}x, 1.0x–1.5x)`;
    metricSummary = 'Modest short-term liquidity buffer';
    metricSummaryHe = 'כרית נזילות צרה לטווח הקצר';
  }

  return {
    id: 'balance-sheet',
    title: 'Current Ratio (Liquidity)',
    titleHe: 'יחס שוטף (נזילות)',
    value: applyDeferredAdj ? activeSaasGuardrail.adjustedDisplayEn : `${latestFmt}x`,
    valueHe: applyDeferredAdj ? activeSaasGuardrail.adjustedDisplayHe : `${latestFmt}x`,
    target: 'Target: >= 1.5x',
    targetHe: 'תנאי למעבר: מעל 1.5x',
    latestValue: evaluatedRatio,
    badge,
    badgeHe,
    detail,
    detailEn,
    metricSummary,
    metricSummaryHe,
    sparklineUnit: 'x',
    historyMeta,
    status,
    sparkline: sortedPoints,
    ...(applyDeferredAdj
      ? {
          isAdjustedForDeferredRevenue: true,
          reportedValue: activeSaasGuardrail.reportedRatio,
          adjustedValue: activeSaasGuardrail.adjustedRatio,
          reportedSublabelHe: activeSaasGuardrail.reportedSublabelHe,
          reportedSublabelEn: activeSaasGuardrail.reportedSublabelEn,
          guardrailTagHe: activeSaasGuardrail.tagHe,
          guardrailTagEn: activeSaasGuardrail.tagEn,
          guardrailExplanationHe: activeSaasGuardrail.explanationHe,
          guardrailExplanationEn: activeSaasGuardrail.explanationEn,
        }
      : {}),
  };
}

// =============================================================================
// Main Exported Function
// =============================================================================

/**
 * Calculates triage metrics, sparkline history, and Inversion Red-Flag Matrix
 * from raw or normalized company facts.
 *
 * @param {Object} companyFacts - Raw SEC Company Facts or normalized company data
 * @param {Object} [options={}] - Optional archetype, sub-type, and AI summary context
 * @returns {{
 *   revenue: Object,
 *   margins: Object,
 *   shares: Object,
 *   currentRatio: Object,
 *   capitalStructure: Object,
 *   inversion: Object
 * }}
 */
export function calculateTriageMetrics(companyFacts, options = {}) {
  const { metrics, currencySymbol } = getMetricsAndCurrency(companyFacts);

  if (!metrics) {
    const unavailable = {
      revenue: createUnavailableMetric('revenue', currencySymbol),
      margins: createUnavailableMetric('margins'),
      shares: createUnavailableMetric('shares'),
      currentRatio: createUnavailableMetric('currentRatio'),
    };
    const inversion = evaluateInversionFlags(null, { ...options, triageMetrics: unavailable });
    return {
      ...unavailable,
      capitalStructure: inversion.capitalStructure,
      inversion,
    };
  }

  const revenue = calculateRevenueMetric(metrics, currencySymbol);
  const margins = calculateOperatingMarginsMetric(metrics, options);
  const shares = calculateShareDilutionMetric(metrics, currencySymbol);
  const saasGuardrail = evaluateSaaSDeferredRevenueGuardrail(metrics, options?.archetype);
  const currentRatio = calculateCurrentRatioMetric(metrics, {
    ...options,
    saasGuardrail,
  });

  const triageMetrics = { revenue, margins, shares, currentRatio };
  const inversion = evaluateInversionFlags(
    { metrics },
    {
      ...options,
      triageMetrics,
      isLowCostRetailException: Boolean(margins.isLowCostRetailException),
    }
  );

  return {
    ...triageMetrics,
    capitalStructure: inversion.capitalStructure,
    inversion,
  };
}

export { evaluateInversionFlags };
export default calculateTriageMetrics;
