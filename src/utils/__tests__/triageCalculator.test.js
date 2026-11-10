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
    expect(result.margins.status).toBe('fail');

    // Dilution must be FAIL / Red
    expect(result.shares.status).toBe('fail');
    expect(result.shares.badge).toBe('Diluting');
    expect(result.shares.value).toContain('+50.0%');

    // Current Ratio < 1 must be FAIL / Red
    expect(result.currentRatio.status).toBe('fail');
    expect(result.currentRatio.value).toBe('0.50x');
    expect(result.currentRatio.badge).toBe('At Risk (< 1.0)');
  });
});
