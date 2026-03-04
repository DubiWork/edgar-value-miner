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
