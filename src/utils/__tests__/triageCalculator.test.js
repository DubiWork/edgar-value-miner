import { describe, it, expect } from 'vitest';
import { calculateTriageMetrics } from '../triageCalculator.js';

describe('triageCalculator', () => {
  it('returns default MSFT triage metrics when companyFacts is null or empty', () => {
    const metrics = calculateTriageMetrics(null);

    expect(metrics).toHaveProperty('revenue');
    expect(metrics).toHaveProperty('margins');
    expect(metrics).toHaveProperty('shares');
    expect(metrics).toHaveProperty('currentRatio');

    expect(metrics.currentRatio.title).toBe('Current Ratio (Liquidity)');
    expect(metrics.currentRatio.target).toBe('Target: > 1.0');
    expect(metrics.shares.target).toBe('Target: Decreasing');

    expect(metrics.revenue.status).toBe('pass');
    expect(metrics.margins.status).toBe('pass');
    expect(metrics.shares.status).toBe('pass');
    expect(metrics.currentRatio.status).toBe('pass');

    expect(metrics.revenue.sparkline.length).toBeGreaterThanOrEqual(10);
    expect(metrics.margins.sparkline.length).toBeGreaterThanOrEqual(10);
    expect(metrics.shares.sparkline.length).toBeGreaterThanOrEqual(10);
    expect(metrics.currentRatio.sparkline.length).toBeGreaterThanOrEqual(10);
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

    // Current Ratio (1.5 >= 1 = PASS)
    expect(result.currentRatio.status).toBe('pass');
    expect(result.currentRatio.value).toBe('1.50x');
    expect(result.currentRatio.target).toBe('Target: > 1.0');
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
          // Narrow margins swinging 2% -> 7% (cyclical even though latest is 7%)
          annual: [
            { fiscalYear: 2016, value: 60000000 }, // 6.0%
            { fiscalYear: 2017, value: 66000000 }, // 6.0%
            { fiscalYear: 2018, value: 72000000 }, // 6.0%
            { fiscalYear: 2019, value: 84500000 }, // 6.5%
            { fiscalYear: 2020, value: 20000000 }, // 2.0% cyclical trough
            { fiscalYear: 2021, value: 27000000 }, // 3.0%
            { fiscalYear: 2022, value: 69000000 }, // 6.0%
            { fiscalYear: 2023, value: 67500000 }, // 5.0% (drop)
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

    // Must show 5Y CAGR (~10%), NOT 4Y, with Hebrew-first ordering (#344)!
    expect(result.revenue.metricSummary).toContain('5Y CAGR ~10%');
    expect(result.revenue.metricSummaryHe).toBe('צמיחה שנתית (CAGR) · 5 ש׳: ~10% · 9 ש׳: ~5%');
    expect(result.currentRatio.badgeHe).toBe('בטוח (מעל 1.0)');
    expect(result.currentRatio.detail).toBe('יחס שוטף תקין (מעל 1.0)');
    expect(result.revenue.historyMeta.startYear).toBe(2016);
    expect(result.revenue.historyMeta.endYear).toBe(2025);

    // Narrow cyclical margins flagged as cyclical with min-max range
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
  });
});
