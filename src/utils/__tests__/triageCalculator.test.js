import { describe, it, expect } from 'vitest';
import { calculateTriageMetrics } from '../triageCalculator.js';

describe('triageCalculator', () => {
  it('returns unavailable status (never fake MSFT defaults) when companyFacts is null or empty', () => {
    for (const input of [null, undefined, {}, { metrics: {} }]) {
      const metrics = calculateTriageMetrics(input);

      expect(metrics).toHaveProperty('revenue');
      expect(metrics).toHaveProperty('margins');
      expect(metrics).toHaveProperty('shares');
      expect(metrics).toHaveProperty('currentRatio');

      expect(metrics.currentRatio.title).toBe('Current Ratio (Liquidity)');
      expect(metrics.currentRatio.target).toBe('Target: >= 1.5x');
      expect(metrics.shares.target).toBe('Target: Decreasing');

      for (const key of ['revenue', 'margins', 'shares', 'currentRatio']) {
        expect(metrics[key].status).toBe('unavailable');
        expect(metrics[key].value).toBe('No SEC Data');
        expect(metrics[key].valueHe).toBe('אין נתוני SEC');
        expect(metrics[key].badge).toBe('No SEC Data');
        expect(metrics[key].badgeHe).toBe('אין נתוני SEC');
        expect(metrics[key].metricSummary).toBe('Unavailable');
        expect(metrics[key].metricSummaryHe).toBe('לא זמין בדיווחי SEC');
        expect(metrics[key].latestValue).toBeNull();
        expect(metrics[key].historyMeta).toBeNull();
        expect(metrics[key].sparkline).toEqual([]);
      }
    }
  });

  it('calculates metrics correctly from normalized data with pass statuses', () => {
    const mockFacts = {
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2024, value: 200000000 },
            { fiscalYear: 2023, value: 180000000 },
            { fiscalYear: 2022, value: 160000000 },
            { fiscalYear: 2021, value: 140000000 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2024, value: 60000000 }, // 30% margin
            { fiscalYear: 2023, value: 50000000 },
            { fiscalYear: 2022, value: 45000000 },
            { fiscalYear: 2021, value: 40000000 },
          ],
        },
        weightedAverageSharesDiluted: {
          annual: [
            { fiscalYear: 2024, value: 95000000 }, // decreasing -> buybacks (PASS / Green)
            { fiscalYear: 2023, value: 98000000 },
            { fiscalYear: 2022, value: 100000000 },
            { fiscalYear: 2021, value: 102000000 },
          ],
        },
        currentAssets: {
          annual: [
            { fiscalYear: 2024, value: 150000000 },
            { fiscalYear: 2023, value: 140000000 },
          ],
        },
        currentLiabilities: {
          annual: [
            { fiscalYear: 2024, value: 100000000 }, // ratio = 1.5 > 1 (PASS / Green)
            { fiscalYear: 2023, value: 90000000 },
          ],
        },
      },
    };

    const result = calculateTriageMetrics(mockFacts);

    // Revenue
    expect(result.revenue.status).toBe('pass');
    expect(result.revenue.sparkline).toEqual([
      { year: 2021, value: 140 },
      { year: 2022, value: 160 },
      { year: 2023, value: 180 },
      { year: 2024, value: 200 },
    ]);

    // Margins (30% > 10%)
    expect(result.margins.status).toBe('pass');
    expect(result.margins.latestValue).toBe(30);

    // Shares: Decreasing = Buybacks = PASS
    expect(result.shares.status).toBe('pass');
    expect(result.shares.value).toBe('Share Buybacks');
    expect(result.shares.badge).toBe('Buybacks');

    // Current Ratio (1.5 >= 1.5 = PASS)
    expect(result.currentRatio.status).toBe('pass');
    expect(result.currentRatio.value).toBe('1.50x');
    expect(result.currentRatio.target).toBe('Target: >= 1.5x');
    expect(result.currentRatio.badge).toBe('Safe (>= 1.5x)');
    expect(result.currentRatio.badgeHe).toBe('בטוח (מעל 1.5x)');
    expect(result.currentRatio.latestValue).toBe(1.5);
  });

  it('correctly marks fail statuses when fundamentals are unhealthy', () => {
    const unhealthyFacts = {
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2024, value: 80000000 }, // declining
            { fiscalYear: 2023, value: 100000000 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2024, value: 4000000 }, // 5% margin <= 10%
            { fiscalYear: 2023, value: 8000000 },
          ],
        },
        sharesOutstanding: {
          annual: [
            { fiscalYear: 2024, value: 150000000 }, // increasing (+50% dilution) -> FAIL / Red
            { fiscalYear: 2023, value: 100000000 },
          ],
        },
        currentAssets: {
          annual: [
            { fiscalYear: 2024, value: 50000000 },
          ],
        },
        currentLiabilities: {
          annual: [
            { fiscalYear: 2024, value: 100000000 }, // ratio = 0.50x < 1 -> FAIL / Red
          ],
        },
      },
    };

    const result = calculateTriageMetrics(unhealthyFacts);

    expect(result.revenue.status).toBe('fail');
    expect(result.revenue.detail).toBe('ירידה בהכנסות של -20% בשנה');
    expect(result.revenue.detail).not.toContain('YoY');
    expect(result.margins.status).toBe('fail');

    // Dilution must be FAIL / Red
    expect(result.shares.status).toBe('fail');
    expect(result.shares.badge).toBe('Diluting');
    expect(result.shares.value).toContain('+50.0%');

    // Current Ratio < 1 must be FAIL / Red
    expect(result.currentRatio.status).toBe('fail');
    expect(result.currentRatio.value).toBe('0.50x');
    expect(result.currentRatio.badge).toBe('At Risk (< 1.0)');
    expect(result.currentRatio.badgeHe).toBe('סיכון (מתחת ל-1.0)');
  });

  it('computes true 5Y CAGR without off-by-one (no 4Y shift) and detects cyclical low margins + buyback dollar spend', () => {
    const facts = {
      metrics: {
        revenue: {
          // 10 years: 2016..2025. 5Y CAGR compares 2020 -> 2025 (5 years exact), 9Y compares 2016 -> 2025.
          annual: [
            { fiscalYear: 2016, value: 1000000000 },
            { fiscalYear: 2017, value: 1100000000 },
            { fiscalYear: 2018, value: 1200000000 },
            { fiscalYear: 2019, value: 1300000000 },
            { fiscalYear: 2020, value: 1000000000 }, // COVID cyclical dip
            { fiscalYear: 2021, value: 900000000 },
            { fiscalYear: 2022, value: 1150000000 },
            { fiscalYear: 2023, value: 1350000000 },
            { fiscalYear: 2024, value: 1500000000 },
            { fiscalYear: 2025, value: 1610510000 }, // 1.61051x 2020 => exact 10% 5Y CAGR
          ],
        },
        operatingIncome: {
          // Narrow margins swinging 2% -> 7% across multiple compression cycles (cyclical even though latest is 7%)
          annual: [
            { fiscalYear: 2016, value: 60000000 }, // 6.0%
            { fiscalYear: 2017, value: 27500000 }, // 2.5% (-3.5pp drop #1)
            { fiscalYear: 2018, value: 72000000 }, // 6.0%
            { fiscalYear: 2019, value: 84500000 }, // 6.5%
            { fiscalYear: 2020, value: 20000000 }, // 2.0% cyclical trough (-4.5pp drop #2)
            { fiscalYear: 2021, value: 54000000 }, // 6.0%
            { fiscalYear: 2022, value: 69000000 }, // 6.0%
            { fiscalYear: 2023, value: 40500000 }, // 3.0% (-3.0pp drop #3)
            { fiscalYear: 2024, value: 105000000 }, // 7.0%
            { fiscalYear: 2025, value: 112735700 }, // 7.0%
          ],
        },
        weightedAverageSharesDiluted: {
          annual: [
            { fiscalYear: 2024, value: 100000000 },
            { fiscalYear: 2025, value: 95000000 }, // -5.0% share reduction YoY
          ],
        },
        stockRepurchases: {
          annual: [
            { fiscalYear: 2024, value: 40000000 },
            { fiscalYear: 2025, value: 50000000 }, // $50M buybacks
          ],
        },
        currentAssets: { annual: [{ fiscalYear: 2025, value: 250000000 }] },
        currentLiabilities: { annual: [{ fiscalYear: 2025, value: 100000000 }] },
      },
    };

    const result = calculateTriageMetrics(facts);

    // Must show 5Y CAGR (~10%), NOT 4Y, with Hebrew-first ordering (#344) & explicit YoY/CAGR label!
    expect(result.revenue.status).toBe('warn');
    expect(result.revenue.badge).toBe('Cyclical Growth');
    expect(result.revenue.badgeHe).toBe('צמיחה מחזורית');
    expect(result.revenue.valueHe).toContain('(שנה אחרונה / YoY)');
    expect(result.revenue.metricSummary).toContain('5Y CAGR ~10% | 9Y ~5%');
    expect(result.revenue.metricSummaryHe).toBe('צמיחה שנתית (CAGR) | 5 ש׳: ~10% | 9 ש׳: ~5%');
    expect(result.margins.metricSummary).toContain(' | ');
    expect(result.margins.metricSummaryHe).toContain(' | ');
    expect(result.shares.metricSummary).toContain(' | Latest spend: $50M');
    expect(result.shares.metricSummaryHe).toContain(' | רכישות אשתקד: $50M');
    expect(result.revenue.metricSummaryHe).not.toContain('·');
    expect(result.margins.metricSummaryHe).not.toContain('·');
    expect(result.shares.metricSummaryHe).not.toContain('·');
    expect(result.currentRatio.status).toBe('pass');
    expect(result.currentRatio.badgeHe).toBe('בטוח (מעל 1.5x)');
    expect(result.currentRatio.detail).toContain('מעל 1.5x');
    expect(result.revenue.historyMeta.startYear).toBe(2016);
    expect(result.revenue.historyMeta.endYear).toBe(2025);

    // Narrow cyclical margins flagged as fail (< 10%) & cyclical with min-max range
    expect(result.margins.status).toBe('fail');
    expect(result.margins.historyMeta.cycleType).toBe('cyclical');
    expect(result.margins.historyMeta.cycleBadgeHe).toContain('מחזורי');
    expect(result.margins.historyMeta.cycleBadgeHe).toContain('2.0%–7.0%');

    // Buybacks % and USD spend surfaced cleanly
    expect(result.shares.valueHe).toBe('↓ -5.0% מניות (בייבאק)');
    expect(result.shares.metricSummaryHe).toContain('$50M');
  });

  it('detects share dilution and buyback pace trends (accelerating, slowing, steady)', () => {
    const buildFactsWithShares = (series) => ({
      metrics: {
        weightedAverageSharesDiluted: {
          annual: series.map(([fiscalYear, value]) => ({ fiscalYear, value })),
        },
      },
    });

    // 1. Slowing dilution (Shopify-style: high early SBC dilution -> slowing recent dilution)
    const slowingDilution = calculateTriageMetrics(
      buildFactsWithShares([
        [2020, 100],
        [2021, 106], // +6%
        [2022, 112], // +5.66%
        [2023, 113], // +0.89%
        [2024, 113.4], // +0.35% -> still diluting > 0.2% vs +5.8% prior
      ])
    );
    expect(slowingDilution.shares.status).toBe('warn');
    expect(slowingDilution.shares.badge).toBe('Moderate Dilution');
    expect(slowingDilution.shares.badgeHe).toBe('דילול מתון');
    expect(slowingDilution.shares.valueHe).toBe('↑ +0.4% מניות (דילול)');
    expect(slowingDilution.shares.trendDirection).toBe('slowing');
    expect(slowingDilution.shares.trendTone).toBe('improving');
    expect(slowingDilution.shares.trendLabelHe).toBe('מגמת הדילול: בירידה ↓ (משתפר)');

    // 2. Accelerating dilution (worsening)
    const acceleratingDilution = calculateTriageMetrics(
      buildFactsWithShares([
        [2020, 100],
        [2021, 101], // +1%
        [2022, 102], // +0.99%
        [2023, 107], // +4.9%
        [2024, 115], // +7.48%
      ])
    );
    expect(acceleratingDilution.shares.valueHe).toBe('↑ +7.5% מניות (דילול)');
    expect(acceleratingDilution.shares.trendDirection).toBe('accelerating');
    expect(acceleratingDilution.shares.trendTone).toBe('worsening');
    expect(acceleratingDilution.shares.trendLabelHe).toBe('מגמת הדילול: בעלייה ↑ (מחמיר)');

    // 3. Steady dilution
    const steadyDilution = calculateTriageMetrics(
      buildFactsWithShares([
        [2020, 100.0],
        [2021, 102.0], // +2.0%
        [2022, 104.04], // +2.0%
        [2023, 106.12], // +2.0%
        [2024, 108.24], // +2.0%
      ])
    );
    expect(steadyDilution.shares.trendDirection).toBe('steady');
    expect(steadyDilution.shares.trendTone).toBe('steady');
    expect(steadyDilution.shares.trendLabelHe).toBe('מגמת הדילול: קצב יציב →');

    // 4. Accelerating buybacks (improving)
    const acceleratingBuybacks = calculateTriageMetrics(
      buildFactsWithShares([
        [2020, 100],
        [2021, 99], // -1%
        [2022, 98], // -1.01%
        [2023, 94], // -4.08%
        [2024, 89], // -5.32%
      ])
    );
    expect(acceleratingBuybacks.shares.valueHe).toBe('↓ -5.3% מניות (בייבאק)');
    expect(acceleratingBuybacks.shares.trendDirection).toBe('accelerating');
    expect(acceleratingBuybacks.shares.trendTone).toBe('improving');
    expect(acceleratingBuybacks.shares.trendLabelHe).toBe('מגמת הבייבאקס: בעלייה ↑ (משתפר)');

    // 5. Slowing buybacks
    const slowingBuybacks = calculateTriageMetrics(
      buildFactsWithShares([
        [2020, 100],
        [2021, 95], // -5%
        [2022, 90], // -5.26%
        [2023, 89.5], // -0.56%
        [2024, 89.0], // -0.56%
      ])
    );
    expect(slowingBuybacks.shares.valueHe).toBe('↓ -0.6% מניות (בייבאק)');
    expect(slowingBuybacks.shares.trendDirection).toBe('slowing');
    expect(slowingBuybacks.shares.trendTone).toBe('slowing');
    expect(slowingBuybacks.shares.trendLabelHe).toBe('מגמת הבייבאקס: בירידה ↓ (האטה)');

    // 6. Steady buybacks
    const steadyBuybacks = calculateTriageMetrics(
      buildFactsWithShares([
        [2020, 100.0],
        [2021, 98.0], // -2%
        [2022, 96.04], // -2%
        [2023, 94.12], // -2%
        [2024, 92.24], // -2%
      ])
    );
    expect(steadyBuybacks.shares.trendDirection).toBe('steady');
    expect(steadyBuybacks.shares.trendTone).toBe('steady');
    expect(steadyBuybacks.shares.trendLabelHe).toBe('מגמת הבייבאקס: קצב יציב →');
  });

  it('uses filing currency unit (€M) and falls through empty share arrays (#348)', () => {
    const sapMetrics = calculateTriageMetrics({
      metadata: { currency: 'EUR', accountingStandard: 'IFRS' },
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2025, value: 36800000000 },
            { fiscalYear: 2024, value: 34176000000 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2025, value: 9617000000 },
            { fiscalYear: 2024, value: 4665000000 },
          ],
        },
        weightedAverageSharesDiluted: { annual: [] },
        weightedAverageShares: { annual: [] },
        sharesOutstanding: {
          annual: [
            { fiscalYear: 2025, value: 1165000000 },
            { fiscalYear: 2024, value: 1180000000 },
          ],
        },
        currentAssets: { annual: [{ fiscalYear: 2025, value: 20256000000 }] },
        currentLiabilities: { annual: [{ fiscalYear: 2025, value: 16200000000 }] },
      },
    });

    expect(sapMetrics.revenue.sparklineUnit).toBe('€M');
    expect(sapMetrics.shares.latestValue).toBe(1165000000);
    expect(sapMetrics.shares.status).toBe('pass');
    expect(sapMetrics.currentRatio.value).toBe('1.25x');
    expect(sapMetrics.currentRatio.status).toBe('warn');
    expect(sapMetrics.currentRatio.badge).toBe('Borderline (1.0–1.5x)');
    expect(sapMetrics.currentRatio.badgeHe).toBe('גבולי (1.0x–1.5x)');
  });

  it('catches AER-style Weakest-Link traps: 48.0% latest margin with -14.3% loss year -> fail, and 5 down revenue yrs -> fail', () => {
    const aerLikeFacts = {
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2018, value: 5000000000 },
            { fiscalYear: 2019, value: 4900000000 }, // down 1
            { fiscalYear: 2020, value: 4500000000 }, // down 2
            { fiscalYear: 2021, value: 4300000000 }, // down 3
            { fiscalYear: 2022, value: 4100000000 }, // down 4
            { fiscalYear: 2023, value: 3900000000 }, // down 5
            { fiscalYear: 2024, value: 4100000000 }, // slight bounce, yet 5 consecutive down yrs in history
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2018, value: 1800000000 }, // 36.0%
            { fiscalYear: 2019, value: 1715000000 }, // 35.0%
            { fiscalYear: 2020, value: -643500000 }, // -14.3% loss year!
            { fiscalYear: 2021, value: 1290000000 }, // 30.0%
            { fiscalYear: 2022, value: 1435000000 }, // 35.0%
            { fiscalYear: 2023, value: 1638000000 }, // 42.0%
            { fiscalYear: 2024, value: 1968000000 }, // 48.0%
          ],
        },
      },
    };

    const result = calculateTriageMetrics(aerLikeFacts);

    // Revenue failed due to >= 3 consecutive down years even though latest YoY > 0
    expect(result.revenue.status).toBe('fail');
    expect(result.revenue.badgeHe).toBe('ירידה בהכנסות');
    expect(result.revenue.valueHe).toContain('שנה אחרונה / YoY');

    // Operating margin failed due to historical loss year (-14.3%), NOT green >= 25%!
    expect(result.margins.status).toBe('fail');
    expect(result.margins.badge).toBe('Volatile (Loss Year)');
    expect(result.margins.badgeHe).toBe('תנודתיים (שנת הפסד)');
    expect(result.margins.detail).toContain('בין -14.3% ל-48.0%');
    expect(result.margins.value).toBe('48.0%');

    // Missing shares & currentRatio return unavailable (no fake MSFT fallback)
    expect(result.shares.status).toBe('unavailable');
    expect(result.currentRatio.status).toBe('unavailable');
  });

  it('enforces 3-tier scoring across Revenue, Margins, Share Dilution (no loophole), and Current Ratio', () => {
    // 1. Margins: latest < 0 -> fail ('Negative Margins'); volatile spread > 20 with no loss year -> warn
    const negativeLatestMargin = calculateTriageMetrics({
      metrics: {
        revenue: { annual: [{ fiscalYear: 2024, value: 100 }] },
        operatingIncome: { annual: [{ fiscalYear: 2024, value: -14.3 }] },
      },
    });
    expect(negativeLatestMargin.margins.status).toBe('fail');
    expect(negativeLatestMargin.margins.badge).toBe('Negative Margins');
    expect(negativeLatestMargin.margins.badgeHe).toBe('שוליים שליליים');
    expect(negativeLatestMargin.margins.value).toBe('-14.3%');

    const expandingHighMargin = calculateTriageMetrics({
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2021, value: 100 },
            { fiscalYear: 2022, value: 100 },
            { fiscalYear: 2023, value: 100 },
            { fiscalYear: 2024, value: 100 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2021, value: 12 }, // 12%
            { fiscalYear: 2022, value: 14 }, // 14%
            { fiscalYear: 2023, value: 16 }, // 16%
            { fiscalYear: 2024, value: 36 }, // 36% -> monotonic expansion (+24pp, zero drawdown)
          ],
        },
      },
    });
    expect(expandingHighMargin.margins.status).toBe('pass');
    expect(expandingHighMargin.margins.badge).toBe('High & Stable');
    expect(expandingHighMargin.margins.badgeHe).toBe('גבוהים ויציבים');
    expect(expandingHighMargin.margins.historyMeta.cycleType).toBe('steady');
    expect(expandingHighMargin.margins.historyMeta.cycleBadgeEn).toBe('Expanding (12.0%–36.0%)');
    expect(expandingHighMargin.margins.historyMeta.cycleBadgeHe).toBe('מתרחב (12.0%–36.0%)');

    const volatileCollapseMargin = calculateTriageMetrics({
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2021, value: 100 },
            { fiscalYear: 2022, value: 100 },
            { fiscalYear: 2023, value: 100 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2021, value: 38 }, // 38% peak
            { fiscalYear: 2022, value: 14 }, // 14% trough (-24pp drawdown)
            { fiscalYear: 2023, value: 32 }, // 32% recovery (>= 25% latest, still volatile collapse)
          ],
        },
      },
    });
    expect(volatileCollapseMargin.margins.status).toBe('warn');
    expect(volatileCollapseMargin.margins.badge).toBe('Volatile / Cyclical');
    expect(volatileCollapseMargin.margins.badgeHe).toBe('תנודתיים / מחזוריים');

    const healthyModerateMargin = calculateTriageMetrics({
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2022, value: 100 },
            { fiscalYear: 2023, value: 110 },
            { fiscalYear: 2024, value: 120 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2022, value: 18 }, // 18%
            { fiscalYear: 2023, value: 20 }, // 18.2%
            { fiscalYear: 2024, value: 22.8 }, // 19.0%
          ],
        },
      },
    });
    expect(healthyModerateMargin.margins.status).toBe('pass');
    expect(healthyModerateMargin.margins.badge).toBe('Healthy Margins');
    expect(healthyModerateMargin.margins.badgeHe).toBe('שוליים תקינים');

    // 2. Revenue: slow CAGR (< 5%) -> warn; sharp deceleration (cagr >= 5 && cagr - yoy >= 10) -> warn
    const slowRevenue = calculateTriageMetrics({
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2021, value: 100000000 },
            { fiscalYear: 2022, value: 102000000 },
            { fiscalYear: 2023, value: 104000000 },
            { fiscalYear: 2024, value: 106000000 },
          ],
        },
      },
    });
    expect(slowRevenue.revenue.status).toBe('warn');
    expect(slowRevenue.revenue.badgeHe).toBe('צמיחה איטית');

    const deceleratingRevenue = calculateTriageMetrics({
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2020, value: 100000000 },
            { fiscalYear: 2021, value: 125000000 },
            { fiscalYear: 2022, value: 155000000 },
            { fiscalYear: 2023, value: 195000000 },
            { fiscalYear: 2024, value: 200000000 }, // ~19% CAGR, +2.6% YoY => cagr - yoy >= 10
          ],
        },
      },
    });
    expect(deceleratingRevenue.revenue.status).toBe('warn');

    // 3. Share Dilution loophole closed: lower than 2020 yet latest year diluted +5.56% -> MUST FAIL
    const loopholeClosed = calculateTriageMetrics({
      metrics: {
        weightedAverageSharesDiluted: {
          annual: [
            { fiscalYear: 2020, value: 120000000 },
            { fiscalYear: 2021, value: 110000000 },
            { fiscalYear: 2022, value: 100000000 },
            { fiscalYear: 2023, value: 90000000 },
            { fiscalYear: 2024, value: 95000000 }, // +5.56% YoY dilution!
          ],
        },
      },
    });
    expect(loopholeClosed.shares.status).toBe('fail');
    expect(loopholeClosed.shares.badge).toBe('Diluting');

    const flatShares = calculateTriageMetrics({
      metrics: {
        weightedAverageSharesDiluted: {
          annual: [
            { fiscalYear: 2023, value: 100000000 },
            { fiscalYear: 2024, value: 100100000 }, // +0.1% <= 0.2%
          ],
        },
      },
    });
    expect(flatShares.shares.status).toBe('pass');
    expect(flatShares.shares.badge).toBe('No Dilution');

    // 4. Current Ratio 3 tiers
    const crSafe = calculateTriageMetrics({
      metrics: {
        currentAssets: { annual: [{ fiscalYear: 2024, value: 160 }] },
        currentLiabilities: { annual: [{ fiscalYear: 2024, value: 100 }] },
      },
    });
    expect(crSafe.currentRatio.status).toBe('pass');
    expect(crSafe.currentRatio.badge).toBe('Safe (>= 1.5x)');

    const crBorderline = calculateTriageMetrics({
      metrics: {
        currentAssets: { annual: [{ fiscalYear: 2024, value: 120 }] },
        currentLiabilities: { annual: [{ fiscalYear: 2024, value: 100 }] },
      },
    });
    expect(crBorderline.currentRatio.status).toBe('warn');
    expect(crBorderline.currentRatio.badge).toBe('Borderline (1.0–1.5x)');
    expect(crBorderline.currentRatio.badgeHe).toBe('גבולי (1.0x–1.5x)');

    const crFail = calculateTriageMetrics({
      metrics: {
        currentAssets: { annual: [{ fiscalYear: 2024, value: 90 }] },
        currentLiabilities: { annual: [{ fiscalYear: 2024, value: 100 }] },
      },
    });
    expect(crFail.currentRatio.status).toBe('fail');
    expect(crFail.currentRatio.badge).toBe('At Risk (< 1.0)');
  });

  describe('Issue #362 — Margin expansion vs collapse & long-horizon revenue dip', () => {
    it('passes MSFT-style monotonic expanding margins (24% -> 46%) and ignores decade-old isolated revenue dip', () => {
      const msftLike = calculateTriageMetrics({
        metrics: {
          revenue: {
            annual: [
              { fiscalYear: 2015, value: 93580 },
              { fiscalYear: 2016, value: 91154 }, // Isolated decade-old dip (> 7 yrs ago)
              { fiscalYear: 2017, value: 96571 },
              { fiscalYear: 2018, value: 110360 },
              { fiscalYear: 2019, value: 125843 },
              { fiscalYear: 2020, value: 143015 },
              { fiscalYear: 2021, value: 168088 },
              { fiscalYear: 2022, value: 198270 },
              { fiscalYear: 2023, value: 211915 },
              { fiscalYear: 2024, value: 245122 },
              { fiscalYear: 2025, value: 281724 },
            ],
          },
          operatingIncome: {
            annual: [
              { fiscalYear: 2016, value: 21877 }, // 24.0%
              { fiscalYear: 2017, value: 26074 }, // 27.0%
              { fiscalYear: 2018, value: 34212 }, // 31.0%
              { fiscalYear: 2019, value: 44045 }, // 35.0%
              { fiscalYear: 2020, value: 57206 }, // 40.0%
              { fiscalYear: 2021, value: 70597 }, // 42.0%
              { fiscalYear: 2022, value: 87239 }, // 44.0%
              { fiscalYear: 2023, value: 93243 }, // 44.0%
              { fiscalYear: 2024, value: 110305 }, // 45.0%
              { fiscalYear: 2025, value: 129593 }, // 46.0%
            ],
          },
        },
      });

      expect(msftLike.revenue.status).toBe('pass');
      expect(msftLike.revenue.badgeHe).toBe('צמיחה עקבית');
      expect(msftLike.revenue.historyMeta.cycleType).toBe('steady');

      expect(msftLike.margins.status).toBe('pass');
      expect(msftLike.margins.badge).toBe('High & Stable');
      expect(msftLike.margins.badgeHe).toBe('גבוהים ויציבים');
      expect(msftLike.margins.historyMeta.maxMarginDrawdown).toBe(0);
      expect(msftLike.margins.historyMeta.cycleType).toBe('steady');
      expect(msftLike.margins.historyMeta.cycleBadgeEn).toBe('Expanding (24.0%–46.0%)');
      expect(msftLike.margins.historyMeta.cycleBadgeHe).toBe('מתרחב (24.0%–46.0%)');
    });

    it('warns on cyclical margin collapse (38% -> 14% -> 32%) and fails on AER-style negative loss year', () => {
      const collapse = calculateTriageMetrics({
        metrics: {
          revenue: {
            annual: [
              { fiscalYear: 2020, value: 100 },
              { fiscalYear: 2021, value: 100 },
              { fiscalYear: 2022, value: 100 },
              { fiscalYear: 2023, value: 100 },
              { fiscalYear: 2024, value: 100 },
            ],
          },
          operatingIncome: {
            annual: [
              { fiscalYear: 2020, value: 38 }, // 38%
              { fiscalYear: 2021, value: 22 }, // 22%
              { fiscalYear: 2022, value: 14 }, // 14% (-24pp drawdown)
              { fiscalYear: 2023, value: 26 }, // 26%
              { fiscalYear: 2024, value: 32 }, // 32%
            ],
          },
        },
      });
      expect(collapse.margins.status).toBe('warn');
      expect(collapse.margins.badge).toBe('Volatile / Cyclical');
      expect(collapse.margins.badgeHe).toBe('תנודתיים / מחזוריים');
      expect(collapse.margins.historyMeta.maxMarginDrawdown).toBe(24);
      expect(collapse.margins.historyMeta.cycleType).toBe('cyclical');

      const aerLossYear = calculateTriageMetrics({
        metrics: {
          revenue: {
            annual: [
              { fiscalYear: 2020, value: 1000 },
              { fiscalYear: 2021, value: 1200 },
              { fiscalYear: 2022, value: 1500 },
              { fiscalYear: 2023, value: 1700 },
              { fiscalYear: 2024, value: 2000 },
            ],
          },
          operatingIncome: {
            annual: [
              { fiscalYear: 2020, value: -143 }, // -14.3% loss year
              { fiscalYear: 2021, value: 360 },  // 30.0%
              { fiscalYear: 2022, value: 570 },  // 38.0%
              { fiscalYear: 2023, value: 765 },  // 45.0%
              { fiscalYear: 2024, value: 960 },  // 48.0%
            ],
          },
        },
      });
      expect(aerLossYear.margins.status).toBe('fail');
      expect(aerLossYear.margins.badge).toBe('Volatile (Loss Year)');
      expect(aerLossYear.margins.badgeHe).toBe('תנודתיים (שנת הפסד)');
    });

    it('treats margin micro-wobbles (<= 1pp) as noise while counting >= 2.5pp compression as down years', () => {
      const microWobble = calculateTriageMetrics({
        metrics: {
          revenue: {
            annual: [
              { fiscalYear: 2021, value: 1000 },
              { fiscalYear: 2022, value: 1000 },
              { fiscalYear: 2023, value: 1000 },
              { fiscalYear: 2024, value: 1000 },
            ],
          },
          operatingIncome: {
            annual: [
              { fiscalYear: 2021, value: 300 }, // 30.0%
              { fiscalYear: 2022, value: 290 }, // 29.0% (-1pp noise)
              { fiscalYear: 2023, value: 310 }, // 31.0%
              { fiscalYear: 2024, value: 305 }, // 30.5% (-0.5pp noise)
            ],
          },
        },
      });
      expect(microWobble.margins.status).toBe('pass');
      expect(microWobble.margins.historyMeta.downYears).toBe(0);
      expect(microWobble.margins.historyMeta.cycleType).toBe('steady');
    });
  });

  describe('Issue #363 — Share dilution rounding boundary & buyback pause clarity', () => {
    const buildShares = (series) => ({
      metrics: {
        weightedAverageSharesDiluted: {
          annual: series.map(([fiscalYear, value]) => ({ fiscalYear, value })),
        },
      },
    });

    it('passes HD-style -40% cumulative buyback cannibal when +0.23% YoY rounds to +0.2% and shows buyback pause trend', () => {
      const hdLike = calculateTriageMetrics(
        buildShares([
          [2011, 1654000000],
          [2014, 1380000000],
          [2017, 1200000000],
          [2020, 1080000000],
          [2023, 1015000000],
          [2025, 990000000],
          [2026, 992277000], // +0.23% YoY -> rounds to +0.2%; cumulative ~ -40.0%
        ])
      );

      expect(hdLike.shares.status).toBe('pass');
      expect(hdLike.shares.changePct).toBe(0.2);
      expect(hdLike.shares.value).toBe('Flat Share Count');
      expect(hdLike.shares.badge).toBe('No Dilution');
      expect(hdLike.shares.badgeHe).toBe('ללא דילול');
      expect(hdLike.shares.trendDirection).toBe('slowing');
      expect(hdLike.shares.trendTone).toBe('slowing');
      expect(hdLike.shares.trendLabelHe).toBe('מגמת הבייבאקס: האטה / הפסקה זמנית ↓');
      expect(hdLike.shares.trendLabelEn).toBe('Buyback trend: Slowed / Paused ↓');
      expect(hdLike.shares.detail).toBe(
        'כמות מניות יציבה השנה (האטה בקצב הרכישה העצמית לאחר צמצום רב-שנתי)'
      );
      expect(hdLike.shares.detailEn).toBe(
        'Flat share count this year (buyback pace paused after multi-year net reduction)'
      );
    });

    it('treats slight +0.4% YoY tick after multi-year buyback reduction as buyback pause rather than worsening dilution', () => {
      const slightTick = calculateTriageMetrics(
        buildShares([
          [2016, 1500000000],
          [2019, 1300000000],
          [2022, 1100000000],
          [2024, 1000000000],
          [2025, 1004000000], // +0.4% YoY (<= 0.5%) on -33.1% cumulative cannibal
        ])
      );

      expect(slightTick.shares.status).toBe('warn');
      expect(slightTick.shares.value).toBe('+0.4% / yr');
      expect(slightTick.shares.badge).toBe('Moderate Dilution');
      expect(slightTick.shares.trendDirection).toBe('slowing');
      expect(slightTick.shares.trendTone).toBe('slowing');
      expect(slightTick.shares.trendLabelHe).toBe('מגמת הבייבאקס: האטה / הפסקה זמנית ↓');
    });

    it('keeps moderate (+1.5%), aggressive (+5.0%), and regular non-buyback flat dilution behavior intact', () => {
      const moderate = calculateTriageMetrics(
        buildShares([
          [2023, 100000000],
          [2024, 101500000], // +1.5% YoY
        ])
      );
      expect(moderate.shares.status).toBe('warn');
      expect(moderate.shares.value).toBe('+1.5% / yr');
      expect(moderate.shares.badge).toBe('Moderate Dilution');
      expect(moderate.shares.badgeHe).toBe('דילול מתון');

      const aggressive = calculateTriageMetrics(
        buildShares([
          [2023, 100000000],
          [2024, 105000000], // +5.0% YoY
        ])
      );
      expect(aggressive.shares.status).toBe('fail');
      expect(aggressive.shares.value).toBe('+5.0% / yr');
      expect(aggressive.shares.badge).toBe('Diluting');
      expect(aggressive.shares.badgeHe).toBe('דילול מניות');

      const regularFlat = calculateTriageMetrics(
        buildShares([
          [2021, 100000000],
          [2022, 100100000],
          [2023, 100000000],
          [2024, 100050000], // +0.05% -> rounds to +0.1%, non-buyback flat
        ])
      );
      expect(regularFlat.shares.status).toBe('pass');
      expect(regularFlat.shares.detail).toBe('ללא דילול מניות משמעותי');
    });
  });
});
