/**
 * useKeyMetrics - Hook that extracts key financial metrics from normalized data.
 *
 * Transforms gaapNormalizer output into an array of 7 metric card objects
 * for display in the dashboard MetricCard grid. When a stockQuote is provided,
 * Market Cap and P/E Ratio display live data; otherwise they show placeholders.
 *
 * @module useKeyMetrics
 */

import { useMemo } from 'react';
import gaapNormalizer from '../utils/gaapNormalizer';
import { calculateDebtToEquity } from '../utils/calculateDebtToEquity';

// =============================================================================
// Formatters
// =============================================================================

/**
 * Formats a large number into a human-readable string with suffix.
 * e.g., 394000000000 -> "$394.0B"
 *
 * @param {number|null} value - Raw numeric value
 * @param {string} [prefix='$'] - Currency prefix
 * @returns {string} Formatted value or '--' if null/undefined
 */
function formatLargeNumber(value, prefix = '$') {
  if (value === null || value === undefined) return '--';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

/**
 * Formats a percentage value (e.g., 0.284 -> "28.4%")
 *
 * @param {number|null} value - Decimal ratio (0-1 range)
 * @returns {string} Formatted percentage or '--'
 */
function formatPercentage(value) {
  if (value === null || value === undefined) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

// =============================================================================
// Trend Helpers
// =============================================================================

/**
 * Determines the trend direction by comparing two annual values.
 *
 * @param {Array} annualData - Array of annual data points (most recent first)
 * @returns {'up'|'down'|'neutral'|undefined} Trend direction
 */
function getTrend(annualData) {
  if (!Array.isArray(annualData) || annualData.length < 2) return undefined;
  const current = annualData[0]?.value;
  const previous = annualData[1]?.value;
  if (current == null || previous == null) return undefined;
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'neutral';
}

/**
 * Determines the trend for a margin (ratio) comparing two years of data.
 *
 * @param {number|null} currentMargin - Current period margin ratio
 * @param {number|null} previousMargin - Previous period margin ratio
 * @returns {'up'|'down'|'neutral'|undefined} Trend direction
 */
function getMarginTrend(currentMargin, previousMargin) {
  if (currentMargin == null || previousMargin == null) return undefined;
  if (currentMargin > previousMargin) return 'up';
  if (currentMargin < previousMargin) return 'down';
  return 'neutral';
}

/**
 * Determines the inverted trend for Debt-to-Equity.
 * Rising D/E = bad (down trend), falling D/E = good (up trend).
 *
 * @param {number|null} currentRatio - Current D/E ratio
 * @param {number|null} previousRatio - Previous D/E ratio
 * @returns {'up'|'down'|'neutral'|undefined} Inverted trend direction
 */
function getDebtToEquityTrend(currentRatio, previousRatio) {
  if (currentRatio == null || previousRatio == null) return undefined;
  // Inverted: lower is better
  if (currentRatio < previousRatio) return 'up';
  if (currentRatio > previousRatio) return 'down';
  return 'neutral';
}

// =============================================================================
// Hook
// =============================================================================

/**
 * useKeyMetrics extracts and formats key financial metrics from normalized data.
 *
 * Returns an array of metric objects suitable for MetricCard components:
 * 1. Revenue (FY[Year])
 * 2. EPS (FY[Year])
 * 3. FCF (FY[Year])
 * 4. Gross Margin (FY[Year])
 * 5. Debt-to-Equity (Ratio)
 * 6. Market Cap (live from stockQuote, or placeholder)
 * 7. P/E Ratio (live from stockQuote, or placeholder)
 *
 * @param {Object|null} normalizedData - Output from gaapNormalizer.normalizeCompanyFacts
 * @param {Object|null} [stockQuote=null] - Output from useStockQuote hook's data field
 * @param {number} [stockQuote.marketCap] - Market capitalization in dollars
 * @param {number} [stockQuote.pe] - Price-to-earnings ratio
 * @param {number} [stockQuote.price] - Current stock price
 * @param {number} [stockQuote.changesPercentage] - Daily price change percentage
 * @returns {Array<{ id: string, title: string, value: string, unit: string, trend: string|undefined }>}
 */
export function useKeyMetrics(normalizedData, stockQuote = null) {
  return useMemo(() => {
    if (!normalizedData?.metrics) return [];

    const metrics = [];

    // -----------------------------------------------------------------------
    // 1. Revenue
    // -----------------------------------------------------------------------
    const revenueLatest = gaapNormalizer.getLatestValue(normalizedData.metrics.revenue);
    metrics.push({
      id: 'revenue',
      title: 'Revenue',
      value: revenueLatest ? formatLargeNumber(revenueLatest.value) : '--',
      unit: revenueLatest?.fiscalYear ? `FY${revenueLatest.fiscalYear}` : undefined,
      trend: getTrend(normalizedData.metrics.revenue?.annual),
    });

    // -----------------------------------------------------------------------
    // 2. EPS
    // -----------------------------------------------------------------------
    const epsLatest = gaapNormalizer.getLatestValue(normalizedData.metrics.eps);
    metrics.push({
      id: 'eps',
      title: 'EPS',
      value: epsLatest ? `$${Number(epsLatest.value).toFixed(2)}` : '--',
      unit: epsLatest?.fiscalYear ? `FY${epsLatest.fiscalYear}` : undefined,
      trend: getTrend(normalizedData.metrics.eps?.annual),
    });

    // -----------------------------------------------------------------------
    // 3. Free Cash Flow
    // -----------------------------------------------------------------------
    const fcfLatest = gaapNormalizer.getLatestValue(normalizedData.metrics.freeCashFlow);
    metrics.push({
      id: 'fcf',
      title: 'FCF',
      value: fcfLatest ? formatLargeNumber(fcfLatest.value) : '--',
      unit: fcfLatest?.fiscalYear ? `FY${fcfLatest.fiscalYear}` : undefined,
      trend: getTrend(normalizedData.metrics.freeCashFlow?.annual),
    });

    // -----------------------------------------------------------------------
    // 4. Gross Margin
    // -----------------------------------------------------------------------
    const grossProfitLatest = gaapNormalizer.getLatestValue(normalizedData.metrics.grossProfit);
    const revenueForMargin = gaapNormalizer.getLatestValue(normalizedData.metrics.revenue);

    let grossMarginValue = '--';
    let grossMarginUnit;
    let grossMarginTrend;

    if (grossProfitLatest && revenueForMargin && revenueForMargin.value !== 0) {
      const currentMargin = grossProfitLatest.value / revenueForMargin.value;
      grossMarginValue = formatPercentage(currentMargin);
      grossMarginUnit = revenueForMargin.fiscalYear ? `FY${revenueForMargin.fiscalYear}` : undefined;

      // Calculate previous year margin for trend
      const gpAnnual = normalizedData.metrics.grossProfit?.annual;
      const revAnnual = normalizedData.metrics.revenue?.annual;
      if (
        Array.isArray(gpAnnual) && gpAnnual.length >= 2 &&
        Array.isArray(revAnnual) && revAnnual.length >= 2 &&
        revAnnual[1]?.value !== 0
      ) {
        const previousMargin = gpAnnual[1].value / revAnnual[1].value;
        grossMarginTrend = getMarginTrend(currentMargin, previousMargin);
      }
    }

    metrics.push({
      id: 'gross-margin',
      title: 'Gross Margin',
      value: grossMarginValue,
      unit: grossMarginUnit,
      trend: grossMarginTrend,
    });

    // -----------------------------------------------------------------------
    // 5. Debt-to-Equity
    // -----------------------------------------------------------------------
    const deResult = calculateDebtToEquity(normalizedData);

    let deValue = '--';
    let deTrend;

    if (deResult && deResult.ratio != null) {
      deValue = deResult.ratio.toFixed(2);
      deTrend = getDebtToEquityTrend(deResult.ratio, deResult.previousRatio);
    }

    metrics.push({
      id: 'debt-to-equity',
      title: 'Debt-to-Equity',
      value: deValue,
      unit: 'Ratio',
      trend: deTrend,
    });

    // -----------------------------------------------------------------------
    // 6. Market Cap (live from stockQuote or placeholder)
    // -----------------------------------------------------------------------
    if (stockQuote && stockQuote.marketCap != null) {
      metrics.push({
        id: 'market-cap',
        title: 'Market Cap',
        value: formatLargeNumber(stockQuote.marketCap),
        unit: 'Live',
        trend: stockQuote.changesPercentage != null
          ? (stockQuote.changesPercentage > 0 ? 'up' : stockQuote.changesPercentage < 0 ? 'down' : 'neutral')
          : undefined,
      });
    } else {
      metrics.push({
        id: 'market-cap',
        title: 'Market Cap',
        value: '--',
        unit: 'Awaiting price data',
        trend: undefined,
      });
    }

    // -----------------------------------------------------------------------
    // 7. P/E Ratio (live from stockQuote or placeholder)
    // -----------------------------------------------------------------------
    if (stockQuote && stockQuote.pe != null) {
      metrics.push({
        id: 'pe-ratio',
        title: 'P/E Ratio',
        value: Number(stockQuote.pe).toFixed(1),
        unit: 'TTM',
        trend: undefined,
      });
    } else {
      metrics.push({
        id: 'pe-ratio',
        title: 'P/E Ratio',
        value: '--',
        unit: 'Awaiting price data',
        trend: undefined,
      });
    }

    return metrics;
  }, [normalizedData, stockQuote]);
}

export default useKeyMetrics;
