/**
 * Tests for GAAP Normalizer Edge Cases
 *
 * Tests cover:
 * - P0 #5: Pre-revenue company handling
 * - P0 #6: Negative equity (bankruptcy) detection
 * - P0 #8: Restated financials (duplicate periods, latest filing wins)
 * - P1 #13: Missing fiscal year end default
 * - P1 #15: Missing shares outstanding
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyFacts,
  extractTimeSeriesData,
  findGaapTag,
  NORMALIZATION_VERSION,
} from '../../utils/gaapNormalizer.js';

// =============================================================================
// Mock Data Helpers
// =============================================================================

/**
 * Creates a minimal company facts JSON structure
 */
function createCompanyFacts(overrides = {}) {
  return {
    cik: '0000320193',
    entityName: 'Test Company Inc.',
    ticker: 'TEST',
    facts: {
      'us-gaap': {},
    },
    ...overrides,
  };
}

/**
 * Creates a metric unit entry
 */
function createUnitEntry({ end, val, form = '10-K', frame = null, filed = null, accn = null }) {
  const entry = { end, val, form };
  if (frame) entry.frame = frame;
  if (filed) entry.filed = filed;
  if (accn) entry.accn = accn;
  return entry;
}

/**
 * Creates company facts with specific metrics
 */
function createCompanyFactsWithMetrics(metricsMap) {
  const usGaap = {};
  for (const [tag, entries] of Object.entries(metricsMap)) {
    usGaap[tag] = {
      label: tag,
      units: {
        USD: entries,
      },
    };
  }
  return createCompanyFacts({
    facts: { 'us-gaap': usGaap },
  });
}

// =============================================================================
// P0 #5: Pre-Revenue Company Handling
// =============================================================================

describe('P0 #5: Pre-revenue company handling', () => {
  it('should flag company with zero revenue as pre-revenue', () => {
    const facts = createCompanyFactsWithMetrics({
      Revenues: [
        createUnitEntry({ end: '2023-12-31', val: 0, frame: 'CY2023', filed: '2024-02-15' }),
        createUnitEntry({ end: '2022-12-31', val: 0, frame: 'CY2022', filed: '2023-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.isPreRevenue).toBe(true);
    expect(result.metadata.warnings).toContain(
      'Company appears to be pre-revenue (revenue is zero or missing)'
    );
  });

  it('should flag company with no revenue metric as pre-revenue', () => {
    const facts = createCompanyFacts(); // No us-gaap metrics at all

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.isPreRevenue).toBe(true);
  });

  it('should NOT flag company with positive revenue', () => {
    const facts = createCompanyFactsWithMetrics({
      Revenues: [
        createUnitEntry({ end: '2023-12-31', val: 50000000, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.isPreRevenue).toBe(false);
    expect(result.metadata.warnings).not.toContain(
      'Company appears to be pre-revenue (revenue is zero or missing)'
    );
  });

  it('should not crash for pre-revenue companies', () => {
    const facts = createCompanyFacts();

    expect(() => normalizeCompanyFacts(facts)).not.toThrow();

    const result = normalizeCompanyFacts(facts);
    expect(result.ticker).toBe('TEST');
    expect(result.companyName).toBe('Test Company Inc.');
    expect(result.metrics).toBeDefined();
  });

  it('should flag company with revenue tag but empty data arrays', () => {
    const facts = createCompanyFactsWithMetrics({
      Revenues: [], // Tag exists but no data
    });

    const result = normalizeCompanyFacts(facts);
    expect(result.metadata.isPreRevenue).toBe(true);
  });

  it('should detect revenue from alternative tags (e.g., SalesRevenueNet)', () => {
    const facts = createCompanyFactsWithMetrics({
      SalesRevenueNet: [
        createUnitEntry({ end: '2023-12-31', val: 100000, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);
    expect(result.metadata.isPreRevenue).toBe(false);
  });
});

// =============================================================================
// P0 #6: Negative Equity (Bankruptcy) Detection
// =============================================================================

describe('P0 #6: Negative equity detection', () => {
  it('should flag negative stockholders equity', () => {
    const facts = createCompanyFactsWithMetrics({
      StockholdersEquity: [
        createUnitEntry({ end: '2023-12-31', val: -5000000, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.hasNegativeEquity).toBe(true);
    expect(result.metadata.warnings).toContain(
      'Company has negative stockholders equity - may indicate financial distress'
    );
  });

  it('should NOT flag positive stockholders equity', () => {
    const facts = createCompanyFactsWithMetrics({
      StockholdersEquity: [
        createUnitEntry({ end: '2023-12-31', val: 50000000, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.hasNegativeEquity).toBe(false);
    expect(result.metadata.warnings).not.toContain(
      'Company has negative stockholders equity - may indicate financial distress'
    );
  });

  it('should NOT flag zero stockholders equity', () => {
    const facts = createCompanyFactsWithMetrics({
      StockholdersEquity: [
        createUnitEntry({ end: '2023-12-31', val: 0, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);
    expect(result.metadata.hasNegativeEquity).toBe(false);
  });

  it('should NOT flag when equity metric is missing', () => {
    const facts = createCompanyFacts(); // No equity data

    const result = normalizeCompanyFacts(facts);
    expect(result.metadata.hasNegativeEquity).toBe(false);
  });

  it('should not crash for negative equity companies', () => {
    const facts = createCompanyFactsWithMetrics({
      StockholdersEquity: [
        createUnitEntry({ end: '2023-12-31', val: -999999999, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    expect(() => normalizeCompanyFacts(facts)).not.toThrow();
    const result = normalizeCompanyFacts(facts);
    expect(result.metrics.stockholdersEquity.annual[0].value).toBe(-999999999);
  });

  it('should detect negative equity from alternative tags', () => {
    const facts = createCompanyFactsWithMetrics({
      StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest: [
        createUnitEntry({ end: '2023-12-31', val: -1000000, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);
    expect(result.metadata.hasNegativeEquity).toBe(true);
  });
});

// =============================================================================
// P0 #8: Restated Financials
// =============================================================================

describe('P0 #8: Restated financials', () => {
  it('should use latest filing for duplicate fiscal periods', () => {
    const gaapTagData = {
      units: {
        USD: [
          // Original filing
          createUnitEntry({
            end: '2023-12-31',
            val: 100000000,
            frame: 'CY2023',
            filed: '2024-02-15',
            accn: '0000320193-24-000001',
          }),
          // Restated filing (same period, later filed date)
          createUnitEntry({
            end: '2023-12-31',
            val: 95000000,
            frame: 'CY2023',
            filed: '2024-06-15',
            accn: '0000320193-24-000050',
          }),
        ],
      },
    };

    const result = extractTimeSeriesData(gaapTagData, 'annual');

    // Should only have one entry for CY2023, with the restated value
    const cy2023Entries = result.filter(d => d.period === 'CY2023');
    expect(cy2023Entries).toHaveLength(1);
    expect(cy2023Entries[0].value).toBe(95000000); // Restated value
  });

  it('should use accession number as tiebreaker when filed dates are equal', () => {
    const gaapTagData = {
      units: {
        USD: [
          createUnitEntry({
            end: '2023-12-31',
            val: 100000000,
            frame: 'CY2023',
            filed: '2024-02-15',
            accn: '0000320193-24-000001',
          }),
          createUnitEntry({
            end: '2023-12-31',
            val: 110000000,
            frame: 'CY2023',
            filed: '2024-02-15',
            accn: '0000320193-24-000050', // Higher accn = more recent
          }),
        ],
      },
    };

    const result = extractTimeSeriesData(gaapTagData, 'annual');

    const cy2023Entries = result.filter(d => d.period === 'CY2023');
    expect(cy2023Entries).toHaveLength(1);
    expect(cy2023Entries[0].value).toBe(110000000); // Higher accn value
  });

  it('should handle multiple years with restatements', () => {
    const gaapTagData = {
      units: {
        USD: [
          // 2023 - original
          createUnitEntry({
            end: '2023-12-31', val: 100, frame: 'CY2023',
            filed: '2024-02-15', accn: '0000-24-000001',
          }),
          // 2023 - restated
          createUnitEntry({
            end: '2023-12-31', val: 95, frame: 'CY2023',
            filed: '2024-08-15', accn: '0000-24-000050',
          }),
          // 2022 - original
          createUnitEntry({
            end: '2022-12-31', val: 80, frame: 'CY2022',
            filed: '2023-02-15', accn: '0000-23-000001',
          }),
          // 2022 - restated
          createUnitEntry({
            end: '2022-12-31', val: 82, frame: 'CY2022',
            filed: '2024-08-15', accn: '0000-24-000051',
          }),
        ],
      },
    };

    const result = extractTimeSeriesData(gaapTagData, 'annual');

    expect(result).toHaveLength(2);
    // Most recent year first
    expect(result[0].value).toBe(95);
    expect(result[0].period).toBe('CY2023');
    expect(result[1].value).toBe(82);
    expect(result[1].period).toBe('CY2022');
  });

  it('should not lose data when no restatements exist', () => {
    const gaapTagData = {
      units: {
        USD: [
          createUnitEntry({
            end: '2023-12-31', val: 100, frame: 'CY2023', filed: '2024-02-15',
          }),
          createUnitEntry({
            end: '2022-12-31', val: 80, frame: 'CY2022', filed: '2023-02-15',
          }),
          createUnitEntry({
            end: '2021-12-31', val: 60, frame: 'CY2021', filed: '2022-02-15',
          }),
        ],
      },
    };

    const result = extractTimeSeriesData(gaapTagData, 'annual');

    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(100);
    expect(result[1].value).toBe(80);
    expect(result[2].value).toBe(60);
  });
});

// =============================================================================
// P1 #13: Missing Fiscal Year End
// =============================================================================

describe('P1 #13: Missing fiscal year end', () => {
  it('should default to 12-31 when fiscal year end is missing', () => {
    const facts = createCompanyFacts(); // No revenue data to extract fiscal year end

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.fiscalYearEnd).toBe('12-31');
    expect(result.metadata.fiscalYearEndDefaulted).toBe(true);
    expect(result.metadata.warnings).toContain(
      'Fiscal year end not found in data - defaulted to December 31'
    );
  });

  it('should NOT default when fiscal year end is available', () => {
    const facts = createCompanyFactsWithMetrics({
      Revenues: [
        createUnitEntry({ end: '2023-09-30', val: 50000000, frame: 'CY2023', filed: '2024-02-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.fiscalYearEnd).toBe('CY2023');
    expect(result.metadata.fiscalYearEndDefaulted).toBe(false);
  });

  it('should set fiscalYearEndDefaulted to false when fiscal year end exists', () => {
    const facts = createCompanyFactsWithMetrics({
      Revenues: [
        createUnitEntry({ end: '2023-06-30', val: 50000000, frame: 'CY2023', filed: '2023-09-15' }),
      ],
    });

    const result = normalizeCompanyFacts(facts);
    expect(result.metadata.fiscalYearEndDefaulted).toBe(false);
  });
});

// =============================================================================
// P1 #15: Missing Shares Outstanding
// =============================================================================

describe('P1 #15: Missing shares outstanding', () => {
  it('should flag missing shares outstanding', () => {
    const facts = createCompanyFacts(); // No shares data

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.missingShares).toBe(true);
    expect(result.metadata.warnings).toContain(
      'Shares outstanding data is missing - EPS calculations unavailable'
    );
  });

  it('should NOT flag when shares outstanding are present', () => {
    const facts = createCompanyFactsWithMetrics({
      CommonStockSharesOutstanding: [
        {
          end: '2023-12-31',
          val: 15000000000,
          form: '10-K',
          frame: 'CY2023',
          filed: '2024-02-15',
        },
      ],
    });

    // Note: shares use 'shares' unit, not USD
    const factsWithShares = createCompanyFacts({
      facts: {
        'us-gaap': {
          CommonStockSharesOutstanding: {
            label: 'Common Stock Shares Outstanding',
            units: {
              shares: [
                {
                  end: '2023-12-31',
                  val: 15000000000,
                  form: '10-K',
                  frame: 'CY2023',
                  filed: '2024-02-15',
                },
              ],
            },
          },
        },
      },
    });

    const result = normalizeCompanyFacts(factsWithShares);

    expect(result.metadata.missingShares).toBe(false);
    expect(result.metadata.warnings).not.toContain(
      'Shares outstanding data is missing - EPS calculations unavailable'
    );
  });

  it('should flag when shares tag exists but has no data', () => {
    const factsWithEmptyShares = createCompanyFacts({
      facts: {
        'us-gaap': {
          CommonStockSharesOutstanding: {
            label: 'Common Stock Shares Outstanding',
            units: {
              shares: [], // Tag exists but empty
            },
          },
        },
      },
    });

    const result = normalizeCompanyFacts(factsWithEmptyShares);
    expect(result.metadata.missingShares).toBe(true);
  });

  it('should set sharesOutstanding metric to empty arrays when missing', () => {
    const facts = createCompanyFacts();

    const result = normalizeCompanyFacts(facts);

    expect(result.metrics.sharesOutstanding).toBeDefined();
    expect(result.metrics.sharesOutstanding.annual).toEqual([]);
    expect(result.metrics.sharesOutstanding.quarterly).toEqual([]);
    expect(result.metrics.sharesOutstanding.tag).toBeNull();
  });
});

// =============================================================================
// BUG-1 / #197: Revenue tag recency — findGaapTag returns stale first-match
// =============================================================================

describe('BUG-1/#197 revenue tag recency', () => {
  /**
   * AAPL-shaped scenario: "Revenues" exists but only covers FY2016-FY2018.
   * "RevenueFromContractWithCustomerExcludingAssessedTax" covers FY2019-FY2025.
   * findGaapTag must return the tag with recent data, not the first-present tag.
   */
  function createAaplShapedFacts() {
    return createCompanyFacts({
      facts: {
        'us-gaap': {
          Revenues: {
            label: 'Revenues',
            units: {
              USD: [
                createUnitEntry({ end: '2016-09-24', val: 215639000000, form: '10-K', frame: 'CY2016' }),
                createUnitEntry({ end: '2017-09-30', val: 229234000000, form: '10-K', frame: 'CY2017' }),
                createUnitEntry({ end: '2018-09-29', val: 265595000000, form: '10-K', frame: 'CY2018' }),
              ],
            },
          },
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            label: 'Revenue From Contract With Customer Excluding Assessed Tax',
            units: {
              USD: [
                createUnitEntry({ end: '2019-09-28', val: 260174000000, form: '10-K', frame: 'CY2019' }),
                createUnitEntry({ end: '2020-09-26', val: 274515000000, form: '10-K', frame: 'CY2020' }),
                createUnitEntry({ end: '2021-09-25', val: 365817000000, form: '10-K', frame: 'CY2021' }),
                createUnitEntry({ end: '2022-09-24', val: 394328000000, form: '10-K', frame: 'CY2022' }),
                createUnitEntry({ end: '2023-09-30', val: 383285000000, form: '10-K', frame: 'CY2023' }),
                createUnitEntry({ end: '2024-09-28', val: 391035000000, form: '10-K', frame: 'CY2024' }),
                createUnitEntry({ end: '2025-09-27', val: 395760000000, form: '10-K', frame: 'CY2025' }),
              ],
            },
          },
        },
      },
    });
  }

  it('normalizeCompanyFacts: most recent annual[0].fiscalYear should be 2025, not 2018', () => {
    // BUG: findGaapTag picks "Revenues" (index 0) which only has data through FY2018.
    // The result.metrics.revenue.annual[0].fiscalYear will be 2018 instead of 2025.
    const result = normalizeCompanyFacts(createAaplShapedFacts());
    expect(result.metrics.revenue.annual[0].fiscalYear).toBe(2025);
  });

  it('normalizeCompanyFacts: annual series should cover recent years (length 5, no year < 2021)', () => {
    // BUG: today returns FY2016-FY2018 stale data (at most 3 entries from Revenues).
    const result = normalizeCompanyFacts(createAaplShapedFacts());
    expect(result.metrics.revenue.annual).toHaveLength(5);
    const years = result.metrics.revenue.annual.map(d => d.fiscalYear);
    expect(Math.min(...years)).toBeGreaterThanOrEqual(2021);
  });

  it('findGaapTag: should return RevenueFromContractWithCustomerExcludingAssessedTax, not Revenues', () => {
    // BUG: today returns { tag: "Revenues", index: 0 } because it is first in GAAP_TAG_MAP.
    // The correct tag is the one with more recent data.
    const tagResult = findGaapTag(createAaplShapedFacts(), 'revenue');
    expect(tagResult).not.toBeNull();
    expect(tagResult.tag).toBe('RevenueFromContractWithCustomerExcludingAssessedTax');
  });
});

// =============================================================================
// BUG-2 / #198: Duplicate fiscal year dedup — no-frame + off-by-one-day end
// =============================================================================

describe('BUG-2/#198 duplicate fiscal year dedup (no-frame, off-by-one-day end)', () => {
  /**
   * Stronger than the existing "#8 restated" test.
   * The existing test uses frame: 'CY2023' on both entries — dedup keys on frame,
   * so it works. THIS test omits frame entirely (10-K/A restatement shape) and
   * uses two slightly different end dates (2023-09-30 vs 2023-10-01) for the
   * same fiscal year. The dedup key becomes item.end, which differs → both survive.
   */
  it('extractTimeSeriesData: FY2023 with no-frame + off-by-one-day ends → exactly 1 row', () => {
    const gaapTagData = {
      units: {
        USD: [
          // Original 10-K for FY2023
          createUnitEntry({
            end: '2023-09-30',
            val: 383285000000,
            form: '10-K',
            // no frame — intentional, this is the bug-triggering shape
            filed: '2023-11-03',
            accn: '0000320193-23-000077',
          }),
          // 10-K/A restatement same fiscal year, end date off by 1 day
          createUnitEntry({
            end: '2023-10-01',
            val: 383000000000,
            form: '10-K/A',
            // no frame
            filed: '2024-01-15',
            accn: '0000320193-24-000012',
          }),
        ],
      },
    };

    const result = extractTimeSeriesData(gaapTagData, 'annual');

    // BUG: dedup keys on (frame || end). Without frame, key = end.
    // '2023-09-30' !== '2023-10-01' → both survive → length is 2, not 1.
    const fy2023Entries = result.filter(d => d.fiscalYear === 2023);
    expect(fy2023Entries).toHaveLength(1);
  });

  it('extractTimeSeriesData: no-frame dedup keeps the later-filed entry (10-K/A value)', () => {
    const gaapTagData = {
      units: {
        USD: [
          createUnitEntry({
            end: '2023-09-30',
            val: 383285000000,
            form: '10-K',
            filed: '2023-11-03',
            accn: '0000320193-23-000077',
          }),
          createUnitEntry({
            end: '2023-10-01',
            val: 383000000000,
            form: '10-K/A',
            filed: '2024-01-15',
            accn: '0000320193-24-000012',
          }),
        ],
      },
    };

    const result = extractTimeSeriesData(gaapTagData, 'annual');
    const fy2023 = result.find(d => d.fiscalYear === 2023);

    // The 10-K/A (later-filed) should be the surviving entry
    expect(fy2023).toBeDefined();
    expect(fy2023.value).toBe(383000000000);
  });
});

// =============================================================================
// BUG-3 / #199: Gross margin same-year integrity
//
// The same-year guard should live in: useKeyMetrics.js, in the "Gross Margin"
// section (lines ~177-192). Specifically, before computing:
//   grossProfitLatest.value / revenueForMargin.value
// the code must assert grossProfitLatest.fiscalYear === revenueForMargin.fiscalYear.
// calculateMargins() already enforces this correctly via findByYear() join, but
// useKeyMetrics bypasses calculateMargins and calls getLatestValue() independently
// on each metric, allowing cross-year division when BUG-1 stales revenue.
// =============================================================================

describe('BUG-3/#199 gross margin same-year integrity', () => {
  /**
   * Reproduce the AAPL cross-year mismatch:
   * - revenue resolves to FY2018 (BUG-1 stale tag path)
   * - grossProfit resolves to FY2025 (GrossProfit tag has current data)
   * After BUG-1 is fixed, revenue.annual[0].fiscalYear must equal
   * grossProfit.annual[0].fiscalYear. This test encodes the invariant at the
   * normalizedData level so it fails today (before either bug is fixed) and
   * passes once both tags resolve to the same latest year.
   */
  it('normalizeCompanyFacts: revenue.annual[0].fiscalYear must equal grossProfit.annual[0].fiscalYear for AAPL-shaped data', () => {
    const facts = createCompanyFacts({
      facts: {
        'us-gaap': {
          // Stale revenue tag (FY2016-FY2018 only) — triggers BUG-1
          Revenues: {
            label: 'Revenues',
            units: {
              USD: [
                createUnitEntry({ end: '2016-09-24', val: 215639000000, form: '10-K', frame: 'CY2016' }),
                createUnitEntry({ end: '2017-09-30', val: 229234000000, form: '10-K', frame: 'CY2017' }),
                createUnitEntry({ end: '2018-09-29', val: 265595000000, form: '10-K', frame: 'CY2018' }),
              ],
            },
          },
          // Current revenue tag (FY2019-FY2025)
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            label: 'Revenue From Contract With Customer Excluding Assessed Tax',
            units: {
              USD: [
                createUnitEntry({ end: '2019-09-28', val: 260174000000, form: '10-K', frame: 'CY2019' }),
                createUnitEntry({ end: '2020-09-26', val: 274515000000, form: '10-K', frame: 'CY2020' }),
                createUnitEntry({ end: '2021-09-25', val: 365817000000, form: '10-K', frame: 'CY2021' }),
                createUnitEntry({ end: '2022-09-24', val: 394328000000, form: '10-K', frame: 'CY2022' }),
                createUnitEntry({ end: '2023-09-30', val: 383285000000, form: '10-K', frame: 'CY2023' }),
                createUnitEntry({ end: '2024-09-28', val: 391035000000, form: '10-K', frame: 'CY2024' }),
                createUnitEntry({ end: '2025-09-27', val: 395760000000, form: '10-K', frame: 'CY2025' }),
              ],
            },
          },
          // GrossProfit has current data through FY2025
          GrossProfit: {
            label: 'Gross Profit',
            units: {
              USD: [
                createUnitEntry({ end: '2021-09-25', val: 152836000000, form: '10-K', frame: 'CY2021' }),
                createUnitEntry({ end: '2022-09-24', val: 170782000000, form: '10-K', frame: 'CY2022' }),
                createUnitEntry({ end: '2023-09-30', val: 169148000000, form: '10-K', frame: 'CY2023' }),
                createUnitEntry({ end: '2024-09-28', val: 180683000000, form: '10-K', frame: 'CY2024' }),
                createUnitEntry({ end: '2025-09-27', val: 184830000000, form: '10-K', frame: 'CY2025' }),
              ],
            },
          },
        },
      },
    });

    const result = normalizeCompanyFacts(facts);

    const revYear = result.metrics.revenue.annual[0]?.fiscalYear;
    const gpYear = result.metrics.grossProfit.annual[0]?.fiscalYear;

    // BUG: today revYear = 2018 (stale Revenues tag), gpYear = 2025.
    // A gross margin computed from these would divide FY2025 grossProfit by FY2018 revenue.
    // After fix: both should resolve to 2025 (or at minimum, the same year).
    expect(revYear).toBe(gpYear);
  });
});

// =============================================================================
// Combined Edge Cases
// =============================================================================

describe('Combined edge cases', () => {
  it('should handle company with all edge cases at once', () => {
    // Pre-revenue, no equity data, no shares, no fiscal year end
    const facts = createCompanyFacts();

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.isPreRevenue).toBe(true);
    expect(result.metadata.hasNegativeEquity).toBe(false); // Missing = not negative
    expect(result.metadata.missingShares).toBe(true);
    expect(result.metadata.fiscalYearEndDefaulted).toBe(true);
    expect(result.metadata.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('should still include normalization version and timestamp', () => {
    const facts = createCompanyFacts();

    const result = normalizeCompanyFacts(facts);

    expect(result.metadata.normalizationVersion).toBe(NORMALIZATION_VERSION);
    expect(result.metadata.normalizedAt).toBeDefined();
    expect(result.metadata.normalized).toBe(true);
    expect(result.metadata.currency).toBe('USD');
  });

  it('should have warnings as an array', () => {
    const facts = createCompanyFacts();
    const result = normalizeCompanyFacts(facts);
    expect(Array.isArray(result.metadata.warnings)).toBe(true);
  });

  it('should throw for null input', () => {
    expect(() => normalizeCompanyFacts(null)).toThrow('Company facts JSON is required');
  });

  it('should throw for undefined input', () => {
    expect(() => normalizeCompanyFacts(undefined)).toThrow('Company facts JSON is required');
  });
});
