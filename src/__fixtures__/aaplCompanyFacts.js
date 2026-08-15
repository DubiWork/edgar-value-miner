/**
 * Slimmed real AAPL SEC companyfacts fixture (3 tags, last 3 entries each).
 * Source: SEC EDGAR /api/xbrl/companyfacts/CIK0000320193.json, fetched 2026-08-14.
 * Covers 3 unit types: USD, shares, USD/shares. Latest filed: 2026-07-31.
 */
export const aaplCompanyFacts = {
  entityType: 'operating',
  facts: {
    'us-gaap': {
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        label: 'Revenue from Contract with Customer, Excluding Assessed Tax',
        units: {
          USD: [
            { start: '2025-12-28', end: '2026-03-28', val: 111184000000, accn: '0000320193-26-000013', fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-05-01', frame: 'CY2026Q1' },
            { start: '2025-09-28', end: '2026-06-27', val: 364357000000, accn: '0000320193-26-000020', fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-07-31' },
            { start: '2026-03-29', end: '2026-06-27', val: 109417000000, accn: '0000320193-26-000020', fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-07-31', frame: 'CY2026Q2' },
          ],
        },
      },
      CommonStockSharesOutstanding: {
        label: 'Common Stock, Shares, Outstanding',
        units: {
          shares: [
            { end: '2025-12-27', val: 14702703000, accn: '0000320193-26-000006', fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-01-30', frame: 'CY2025Q4I' },
            { end: '2026-03-28', val: 14667688000, accn: '0000320193-26-000013', fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-05-01', frame: 'CY2026Q1I' },
            { end: '2026-06-27', val: 14608963000, accn: '0000320193-26-000020', fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-07-31', frame: 'CY2026Q2I' },
          ],
        },
      },
      EarningsPerShareBasic: {
        label: 'Earnings Per Share, Basic',
        units: {
          'USD/shares': [
            { start: '2025-12-28', end: '2026-03-28', val: 2.02, accn: '0000320193-26-000013', fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-05-01', frame: 'CY2026Q1' },
            { start: '2025-09-28', end: '2026-06-27', val: 6.91, accn: '0000320193-26-000020', fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-07-31' },
            { start: '2026-03-29', end: '2026-06-27', val: 2.03, accn: '0000320193-26-000020', fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-07-31', frame: 'CY2026Q2' },
          ],
        },
      },
    },
  },
};
