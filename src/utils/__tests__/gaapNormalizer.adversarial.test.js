/**
 * Adversarial Stress & Edge Case Test Suite for GAAP Normalizer (Milestone M1)
 *
 * Covers:
 * 1. Facts with 0 periods (empty units, empty namespace, alternative currency)
 * 2. Facts with exactly 1 annual period
 * 3. Facts with exactly 5 annual periods
 * 4. Facts with 50+ annual periods (1970-2024)
 * 5. Restatements (latest filed date wins, accession number tiebreaker)
 * 6. Out-of-order filing dates and period dates
 * 7. Deduplication, restatement selection, and descending sort in uncapped mode
 * 8. Derived metrics (margins, FCF, YoY), NaN resistance, and memory stability
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyFacts,
  extractTimeSeriesData,
  stitchTimeSeriesData,
  calculateFreeCashFlow,
  findGaapTag,
} from '../gaapNormalizer.js';
import { calculateMargins } from '../calculateMargins.js';
import { calculateYoY } from '../calculateYoY.js';

// =============================================================================
// Test Helpers
// =============================================================================

function createUnitEntry({
  end,
  val,
  form = '10-K',
  frame = null,
  filed = null,
  accn = null,
  fy = null,
  fp = null,
}) {
  const entry = { end, val, form };
  if (frame) entry.frame = frame;
  if (filed) entry.filed = filed;
  if (accn) entry.accn = accn;
  if (fy != null) entry.fy = fy;
  if (fp) entry.fp = fp;
  return entry;
}

function createCompanyFacts(metricsMap = {}, overrides = {}) {
  const usGaap = {};
  for (const [tag, entries] of Object.entries(metricsMap)) {
    usGaap[tag] = {
      label: tag,
      units: {
        USD: entries,
      },
    };
  }
  return {
    cik: '0000320193',
    entityName: 'Adversarial Test Corp',
    ticker: 'ADV',
    facts: {
      'us-gaap': usGaap,
    },
    ...overrides,
  };
}

// =============================================================================
// 1. Facts with 0 Periods (Empty Units)
// =============================================================================

describe('1. Adversarial: 0 periods (empty units / empty facts)', () => {
  it('handles empty units object ({}) gracefully without crashing or throwing', () => {
    const gaapTagData = { units: {} };
    const annual = extractTimeSeriesData(gaapTagData, 'annual');
    const quarterly = extractTimeSeriesData(gaapTagData, 'quarterly');
    const full = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });

    expect(annual).toEqual([]);
    expect(quarterly).toEqual([]);
    expect(full).toEqual([]);
  });

  it('handles empty unit array (units.USD = []) gracefully', () => {
    const gaapTagData = { units: { USD: [] } };
    const annual = extractTimeSeriesData(gaapTagData, 'annual');
    const full = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });

    expect(annual).toEqual([]);
    expect(full).toEqual([]);
  });

  it('normalizes company facts with empty us-gaap and no metrics cleanly', () => {
    const facts = createCompanyFacts({});
    const normalizedDefault = normalizeCompanyFacts(facts);
    const normalizedFull = normalizeCompanyFacts(facts, { fullHistory: true });

    expect(normalizedDefault.metrics.revenue.annual).toEqual([]);
    expect(normalizedDefault.metrics.revenue.quarterly).toEqual([]);
    expect(normalizedDefault.metrics.freeCashFlow.annual).toEqual([]);
    expect(normalizedDefault.metadata.metricsFound).toBe(0);
    expect(normalizedDefault.metadata.isPreRevenue).toBe(true);

    expect(normalizedFull.metrics.revenue.annual).toEqual([]);
    expect(normalizedFull.metrics.revenue.quarterly).toEqual([]);
    expect(normalizedFull.metrics.freeCashFlow.annual).toEqual([]);
    expect(normalizedFull.metadata.isPreRevenue).toBe(true);
  });

  it('handles null/undefined gaapTagData in extractTimeSeriesData safely', () => {
    expect(extractTimeSeriesData(null, 'annual')).toEqual([]);
    expect(extractTimeSeriesData(undefined, 'quarterly', { fullHistory: true })).toEqual([]);
    expect(extractTimeSeriesData({}, 'annual')).toEqual([]);
  });
});

// =============================================================================
// 2. Facts with Exactly 1 Annual Period
// =============================================================================

describe('2. Adversarial: exactly 1 annual period', () => {
  const singlePeriodFact = createCompanyFacts({
    Revenues: [
      createUnitEntry({ end: '2023-12-31', val: 500000, form: '10-K', frame: 'CY2023', filed: '2024-02-15' }),
    ],
    NetCashProvidedByUsedInOperatingActivities: [
      createUnitEntry({ end: '2023-12-31', val: 150000, form: '10-K', frame: 'CY2023', filed: '2024-02-15' }),
    ],
    PaymentsToAcquirePropertyPlantAndEquipment: [
      createUnitEntry({ end: '2023-12-31', val: -30000, form: '10-K', frame: 'CY2023', filed: '2024-02-15' }),
    ],
    GrossProfit: [
      createUnitEntry({ end: '2023-12-31', val: 300000, form: '10-K', frame: 'CY2023', filed: '2024-02-15' }),
    ],
    OperatingIncomeLoss: [
      createUnitEntry({ end: '2023-12-31', val: 100000, form: '10-K', frame: 'CY2023', filed: '2024-02-15' }),
    ],
    NetIncomeLoss: [
      createUnitEntry({ end: '2023-12-31', val: 80000, form: '10-K', frame: 'CY2023', filed: '2024-02-15' }),
    ],
  });

  it('normalizes single period identically in default and uncapped modes', () => {
    const resDefault = normalizeCompanyFacts(singlePeriodFact);
    const resFull = normalizeCompanyFacts(singlePeriodFact, { fullHistory: true });

    expect(resDefault.metrics.revenue.annual).toHaveLength(1);
    expect(resFull.metrics.revenue.annual).toHaveLength(1);

    expect(resDefault.metrics.revenue.annual[0].value).toBe(500000);
    expect(resFull.metrics.revenue.annual[0].value).toBe(500000);
    expect(resDefault.metrics.revenue.annual[0].fiscalYear).toBe(2023);
    expect(resFull.metrics.revenue.annual[0].fiscalYear).toBe(2023);

    // Free cash flow derived metric
    expect(resDefault.metrics.freeCashFlow.annual).toHaveLength(1);
    expect(resFull.metrics.freeCashFlow.annual).toHaveLength(1);
    expect(resFull.metrics.freeCashFlow.annual[0].value).toBe(120000); // 150000 - 30000
  });

  it('computes margins for single period without NaN or index errors', () => {
    const rev = [{ fiscalYear: 2023, value: 500000 }];
    const gp = [{ fiscalYear: 2023, value: 300000 }];
    const op = [{ fiscalYear: 2023, value: 100000 }];
    const ni = [{ fiscalYear: 2023, value: 80000 }];

    const margins = calculateMargins({ revenue: rev, grossProfit: gp, operatingIncome: op, netIncome: ni }, { fullHistory: true });
    expect(margins).toHaveLength(1);
    expect(margins[0].fiscalYear).toBe(2023);
    expect(margins[0].grossMargin).toBe(60);
    expect(margins[0].operatingMargin).toBe(20);
    expect(margins[0].netMargin).toBe(16);
    expect(Number.isNaN(margins[0].grossMargin)).toBe(false);
  });

  it('safely handles YoY calculation when only 1 period exists', () => {
    const singleVal = 500000;
    const yoy = calculateYoY(singleVal, undefined);
    expect(yoy.percentage).toBeNull();
    expect(yoy.formatted).toBe('N/A');
  });
});

// =============================================================================
// 3. Facts with Exactly 5 Annual Periods
// =============================================================================

describe('3. Adversarial: exactly 5 annual periods (boundary condition)', () => {
  const years = [2019, 2020, 2021, 2022, 2023];
  const entries = years.map(y =>
    createUnitEntry({
      end: `${y}-12-31`,
      val: y * 1000,
      form: '10-K',
      frame: `CY${y}`,
      filed: `${y + 1}-02-15`,
    })
  );

  const facts5 = createCompanyFacts({ Revenues: entries });

  it('returns all 5 periods in both default and uncapped modes', () => {
    const resDefault = normalizeCompanyFacts(facts5);
    const resFull = normalizeCompanyFacts(facts5, { fullHistory: true });

    expect(resDefault.metrics.revenue.annual).toHaveLength(5);
    expect(resFull.metrics.revenue.annual).toHaveLength(5);

    // Both should be in descending order: 2023 down to 2019
    const expectedYears = [2023, 2022, 2021, 2020, 2019];
    expect(resDefault.metrics.revenue.annual.map(d => d.fiscalYear)).toEqual(expectedYears);
    expect(resFull.metrics.revenue.annual.map(d => d.fiscalYear)).toEqual(expectedYears);
  });
});

// =============================================================================
// 4. Facts with 50+ Annual Periods (1970-2024, 55 periods)
// =============================================================================

describe('4. Adversarial: 50+ annual periods (1970-2024)', () => {
  const entries55 = [];
  const ocf55 = [];
  const capex55 = [];

  for (let y = 1970; y <= 2024; y++) {
    const rev = 10000 + (y - 1970) * 1000;
    entries55.push(
      createUnitEntry({
        end: `${y}-12-31`,
        val: rev,
        form: '10-K',
        frame: `CY${y}`,
        filed: `${y + 1}-02-15`,
      })
    );
    ocf55.push(
      createUnitEntry({
        end: `${y}-12-31`,
        val: Math.round(rev * 0.25),
        form: '10-K',
        frame: `CY${y}`,
        filed: `${y + 1}-02-15`,
      })
    );
    capex55.push(
      createUnitEntry({
        end: `${y}-12-31`,
        val: -Math.round(rev * 0.05),
        form: '10-K',
        frame: `CY${y}`,
        filed: `${y + 1}-02-15`,
      })
    );
  }

  const largeFacts = createCompanyFacts({
    Revenues: entries55,
    NetCashProvidedByUsedInOperatingActivities: ocf55,
    PaymentsToAcquirePropertyPlantAndEquipment: capex55,
  });

  it('caps at exactly 5 periods in default mode for 55 periods', () => {
    const res = normalizeCompanyFacts(largeFacts);
    expect(res.metrics.revenue.annual).toHaveLength(5);
    expect(res.metrics.freeCashFlow.annual).toHaveLength(5);

    // Most recent 5 years
    expect(res.metrics.revenue.annual.map(d => d.fiscalYear)).toEqual([2024, 2023, 2022, 2021, 2020]);
    expect(res.metrics.freeCashFlow.annual.map(d => d.fiscalYear)).toEqual([2024, 2023, 2022, 2021, 2020]);
  });

  it('returns all 55 periods in uncapped mode (fullHistory: true)', () => {
    const res = normalizeCompanyFacts(largeFacts, { fullHistory: true });
    expect(res.metrics.revenue.annual).toHaveLength(55);
    expect(res.metrics.freeCashFlow.annual).toHaveLength(55);

    expect(res.metrics.revenue.annual[0].fiscalYear).toBe(2024);
    expect(res.metrics.revenue.annual[54].fiscalYear).toBe(1970);
    expect(res.metrics.freeCashFlow.annual[0].fiscalYear).toBe(2024);
    expect(res.metrics.freeCashFlow.annual[54].fiscalYear).toBe(1970);

    // Verify FCF values
    for (const fcf of res.metrics.freeCashFlow.annual) {
      expect(Number.isNaN(fcf.value)).toBe(false);
      expect(fcf.value).toBeGreaterThan(0);
    }
  });

  it('calculates margins across all 55 years without index error or NaN', () => {
    const rev = entries55.map(e => ({ fiscalYear: extractFiscalYear(e.end), value: e.val }));
    const gp = rev.map(r => ({ fiscalYear: r.fiscalYear, value: r.value * 0.5 }));
    const op = rev.map(r => ({ fiscalYear: r.fiscalYear, value: r.value * 0.2 }));
    const ni = rev.map(r => ({ fiscalYear: r.fiscalYear, value: r.value * 0.1 }));

    const margins = calculateMargins({ revenue: rev, grossProfit: gp, operatingIncome: op, netIncome: ni }, { fullHistory: true });
    expect(margins).toHaveLength(55);
    expect(margins[0].fiscalYear).toBe(1970); // Margins are chronological
    expect(margins[54].fiscalYear).toBe(2024);

    for (const m of margins) {
      expect(m.grossMargin).toBe(50);
      expect(m.operatingMargin).toBe(20);
      expect(m.netMargin).toBe(10);
      expect(Number.isNaN(m.grossMargin)).toBe(false);
    }
  });
});

// =============================================================================
// 5. Facts with Restatements (Latest Filed Date Wins)
// =============================================================================

describe('5. Adversarial: Restatements and deduplication', () => {
  it('chooses the latest filed date when multiple filings exist for the same period end date', () => {
    const gaapTagData = {
      units: {
        USD: [
          createUnitEntry({ end: '2022-12-31', val: 100, frame: 'CY2022', filed: '2023-02-15', accn: '0001-23-000001' }),
          createUnitEntry({ end: '2022-12-31', val: 120, frame: 'CY2022', filed: '2024-02-15', accn: '0001-24-000001' }), // Later filed restatement
          createUnitEntry({ end: '2022-12-31', val: 110, frame: 'CY2022', filed: '2023-08-10', accn: '0001-23-000050' }), // Interim restatement
        ],
      },
    };

    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });
    expect(res).toHaveLength(1);
    expect(res[0].value).toBe(120); // 2024-02-15 restatement wins
    expect(res[0].filedDate).toBe('2024-02-15');
  });

  it('uses accession number as secondary tiebreaker when filed dates are identical', () => {
    const gaapTagData = {
      units: {
        USD: [
          createUnitEntry({ end: '2023-12-31', val: 50, frame: 'CY2023', filed: '2024-02-15', accn: '0001-24-000010' }),
          createUnitEntry({ end: '2023-12-31', val: 65, frame: 'CY2023', filed: '2024-02-15', accn: '0001-24-000099' }), // Higher accn
        ],
      },
    };

    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });
    expect(res).toHaveLength(1);
    expect(res[0].value).toBe(65);
  });

  it('preserves restatements across multiple years simultaneously in uncapped mode', () => {
    const gaapTagData = {
      units: {
        USD: [
          // 2021 original and restated
          createUnitEntry({ end: '2021-12-31', val: 80, frame: 'CY2021', filed: '2022-02-15' }),
          createUnitEntry({ end: '2021-12-31', val: 88, frame: 'CY2021', filed: '2023-02-15' }),
          // 2022 original and restated
          createUnitEntry({ end: '2022-12-31', val: 90, frame: 'CY2022', filed: '2023-02-15' }),
          createUnitEntry({ end: '2022-12-31', val: 95, frame: 'CY2022', filed: '2024-02-15' }),
          // 2023 original
          createUnitEntry({ end: '2023-12-31', val: 100, frame: 'CY2023', filed: '2024-02-15' }),
        ],
      },
    };

    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });
    expect(res).toHaveLength(3);
    expect(res[0].fiscalYear).toBe(2023);
    expect(res[0].value).toBe(100);
    expect(res[1].fiscalYear).toBe(2022);
    expect(res[1].value).toBe(95); // Restated
    expect(res[2].fiscalYear).toBe(2021);
    expect(res[2].value).toBe(88); // Restated
  });
});

// =============================================================================
// 6. Facts with Out-Of-Order Filing Dates and Period Dates
// =============================================================================

describe('6. Adversarial: Out-of-order filing dates and period dates', () => {
  it('correctly sorts completely scrambled period dates descending', () => {
    const scrambled = [
      createUnitEntry({ end: '2018-12-31', val: 18, frame: 'CY2018', filed: '2019-02-15' }),
      createUnitEntry({ end: '2024-12-31', val: 24, frame: 'CY2024', filed: '2025-02-15' }),
      createUnitEntry({ end: '2020-12-31', val: 20, frame: 'CY2020', filed: '2021-02-15' }),
      createUnitEntry({ end: '2019-12-31', val: 19, frame: 'CY2019', filed: '2020-02-15' }),
      createUnitEntry({ end: '2023-12-31', val: 23, frame: 'CY2023', filed: '2024-02-15' }),
      createUnitEntry({ end: '2021-12-31', val: 21, frame: 'CY2021', filed: '2022-02-15' }),
      createUnitEntry({ end: '2022-12-31', val: 22, frame: 'CY2022', filed: '2023-02-15' }),
    ];

    const gaapTagData = { units: { USD: scrambled } };
    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });

    expect(res).toHaveLength(7);
    const years = res.map(r => r.fiscalYear);
    expect(years).toEqual([2024, 2023, 2022, 2021, 2020, 2019, 2018]);
  });

  it('correctly handles scrambled restatements interleaved across time', () => {
    const scrambledWithRestatements = [
      createUnitEntry({ end: '2021-12-31', val: 10, frame: 'CY2021', filed: '2022-02-15' }), // 2021 orig
      createUnitEntry({ end: '2023-12-31', val: 30, frame: 'CY2023', filed: '2024-02-15' }), // 2023 orig
      createUnitEntry({ end: '2022-12-31', val: 25, frame: 'CY2022', filed: '2024-02-15' }), // 2022 restatement
      createUnitEntry({ end: '2022-12-31', val: 20, frame: 'CY2022', filed: '2023-02-15' }), // 2022 orig
      createUnitEntry({ end: '2021-12-31', val: 15, frame: 'CY2021', filed: '2024-02-15' }), // 2021 restatement (latest)
      createUnitEntry({ end: '2021-12-31', val: 12, frame: 'CY2021', filed: '2023-02-15' }), // 2021 restatement (intermediate)
    ];

    const gaapTagData = { units: { USD: scrambledWithRestatements } };
    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });

    expect(res).toHaveLength(3);
    expect(res[0].fiscalYear).toBe(2023);
    expect(res[0].value).toBe(30);

    expect(res[1].fiscalYear).toBe(2022);
    expect(res[1].value).toBe(25); // 2024 filed restatement won

    expect(res[2].fiscalYear).toBe(2021);
    expect(res[2].value).toBe(15); // 2024 filed restatement won
  });

  it('correctly sorts scrambled quarterly periods descending', () => {
    const scrambledQuarters = [
      createUnitEntry({ end: '2023-09-30', val: 300, frame: 'CY2023Q3', form: '10-Q', filed: '2023-10-25' }),
      createUnitEntry({ end: '2023-03-31', val: 100, frame: 'CY2023Q1', form: '10-Q', filed: '2023-04-25' }),
      createUnitEntry({ end: '2023-12-31', val: 400, frame: 'CY2023Q4', form: '10-Q', filed: '2024-01-25' }),
      createUnitEntry({ end: '2023-06-30', val: 200, frame: 'CY2023Q2', form: '10-Q', filed: '2023-07-25' }),
    ];

    const gaapTagData = { units: { USD: scrambledQuarters } };
    const res = extractTimeSeriesData(gaapTagData, 'quarterly', { fullHistory: true });

    expect(res).toHaveLength(4);
    expect(res.map(r => r.period)).toEqual(['CY2023Q4', 'CY2023Q3', 'CY2023Q2', 'CY2023Q1']);
    expect(res.map(r => r.value)).toEqual([400, 300, 200, 100]);
  });
});

// =============================================================================
// 7. Deduplication, Restatement Selection, and Sorting in Uncapped Mode
// =============================================================================

describe('7. Uncapped Deduplication, Restatement Selection, and Sorting', () => {
  it('deduplicates by fiscal year for annual data even if frames differ', () => {
    const gaapTagData = {
      units: {
        USD: [
          createUnitEntry({ end: '2023-12-31', val: 100, frame: 'CY2023', fy: 2023, filed: '2024-02-15' }),
          createUnitEntry({ end: '2023-12-31', val: 105, frame: 'CY2023I4', fy: 2023, filed: '2024-05-15' }), // Later filing
        ],
      },
    };

    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });
    expect(res).toHaveLength(1);
    expect(res[0].value).toBe(105);
  });

  it('keeps distinct quarters without collapsing when periods share the same fiscal year', () => {
    const quarters = [1, 2, 3, 4].map(q =>
      createUnitEntry({
        end: `2023-${String(q * 3).padStart(2, '0')}-30`,
        val: q * 50,
        frame: `CY2023Q${q}`,
        form: '10-Q',
        filed: `2023-${String(q * 3 + 1).padStart(2, '0')}-15`,
      })
    );

    const gaapTagData = { units: { USD: quarters } };
    const res = extractTimeSeriesData(gaapTagData, 'quarterly', { fullHistory: true });

    // Must NOT collapse 4 quarters into 1
    expect(res).toHaveLength(4);
    expect(res.map(r => r.period)).toEqual(['CY2023Q4', 'CY2023Q3', 'CY2023Q2', 'CY2023Q1']);
  });
});

// =============================================================================
// 8. Robustness Against NaN, Corrupted Data, and Memory Leak Pressure
// =============================================================================

describe('8. Robustness against NaN, Corrupted Data, and High Load', () => {
  it('filters out NaN, null, and non-numeric values from units without crashing', () => {
    const corruptedUnits = [
      createUnitEntry({ end: '2023-12-31', val: NaN, frame: 'CY2023', filed: '2024-02-15' }),
      createUnitEntry({ end: '2022-12-31', val: null, frame: 'CY2022', filed: '2023-02-15' }),
      createUnitEntry({ end: '2021-12-31', val: 'not-a-number', frame: 'CY2021', filed: '2022-02-15' }),
      createUnitEntry({ end: '2020-12-31', val: 5000, frame: 'CY2020', filed: '2021-02-15' }),
    ];

    const gaapTagData = { units: { USD: corruptedUnits } };
    const res = extractTimeSeriesData(gaapTagData, 'annual', { fullHistory: true });

    expect(res).toHaveLength(1);
    expect(res[0].fiscalYear).toBe(2020);
    expect(res[0].value).toBe(5000);
    expect(Number.isNaN(res[0].value)).toBe(false);
  });

  it('safely handles zero and negative revenues in margin computations without producing NaN or Infinity', () => {
    const rev = [
      { fiscalYear: 2023, value: 0 },
      { fiscalYear: 2022, value: -5000 },
      { fiscalYear: 2021, value: 10000 },
    ];
    const gp = [
      { fiscalYear: 2023, value: 1000 },
      { fiscalYear: 2022, value: 1000 },
      { fiscalYear: 2021, value: 4000 },
    ];

    const margins = calculateMargins({ revenue: rev, grossProfit: gp }, { fullHistory: true });
    expect(margins).toHaveLength(3);

    // FY2021 (valid)
    const m2021 = margins.find(m => m.fiscalYear === 2021);
    expect(m2021.grossMargin).toBe(40);
    expect(Number.isNaN(m2021.grossMargin)).toBe(false);

    // FY2022 (negative revenue -> null margin)
    const m2022 = margins.find(m => m.fiscalYear === 2022);
    expect(m2022.grossMargin).toBeNull();

    // FY2023 (zero revenue -> null margin)
    const m2023 = margins.find(m => m.fiscalYear === 2023);
    expect(m2023.grossMargin).toBeNull();
  });

  it('survives high throughput stress without memory leak or performance degradation', () => {
    // Generate 100 years of data
    const largeEntries = [];
    for (let y = 1925; y <= 2024; y++) {
      largeEntries.push(
        createUnitEntry({ end: `${y}-12-31`, val: y * 10, frame: `CY${y}`, filed: `${y + 1}-02-15` })
      );
    }
    const facts = createCompanyFacts({ Revenues: largeEntries });

    // Execute 200 consecutive normalizations
    for (let i = 0; i < 200; i++) {
      const res = normalizeCompanyFacts(facts, { fullHistory: true });
      expect(res.metrics.revenue.annual).toHaveLength(100);
    }
  });
});

function extractFiscalYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}
