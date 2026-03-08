/**
 * Mock SEC EDGAR data for Playwright E2E tests.
 *
 * Provides minimal but realistic data structures that match the real
 * SEC API responses used by edgarApi.js.
 */

// ---------------------------------------------------------------------------
// Company Tickers (matches https://www.sec.gov/files/company_tickers.json)
// ---------------------------------------------------------------------------

export const COMPANY_TICKERS = {
  '0': {
    cik_str: '320193',
    ticker: 'AAPL',
    title: 'Apple Inc.',
  },
  '1': {
    cik_str: '789019',
    ticker: 'MSFT',
    title: 'Microsoft Corp',
  },
};

// ---------------------------------------------------------------------------
// Helper: build a GAAP unit entry
// ---------------------------------------------------------------------------

function entry(val, end, form, frame, filed) {
  return { val, end, start: '2023-10-01', form, frame, filed, accn: '0000320193-24-000001' };
}

// ---------------------------------------------------------------------------
// Company Facts for AAPL
// (matches https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json)
// ---------------------------------------------------------------------------

export const AAPL_COMPANY_FACTS = {
  cik: 320193,
  entityName: 'Apple Inc.',
  facts: {
    'us-gaap': {
      Revenues: {
        label: 'Revenues',
        description: 'Total revenue',
        units: {
          USD: [
            entry(394328000000, '2024-09-28', '10-K', 'CY2024', '2024-11-01'),
            entry(383285000000, '2023-09-30', '10-K', 'CY2023', '2023-11-03'),
          ],
        },
      },

      NetIncomeLoss: {
        label: 'Net Income (Loss)',
        description: 'Net income loss',
        units: {
          USD: [
            entry(93736000000, '2024-09-28', '10-K', 'CY2024', '2024-11-01'),
            entry(96995000000, '2023-09-30', '10-K', 'CY2023', '2023-11-03'),
          ],
        },
      },

      GrossProfit: {
        label: 'Gross Profit',
        description: 'Gross profit',
        units: {
          USD: [
            entry(180683000000, '2024-09-28', '10-K', 'CY2024', '2024-11-01'),
            entry(169148000000, '2023-09-30', '10-K', 'CY2023', '2023-11-03'),
          ],
        },
      },

      EarningsPerShareBasic: {
        label: 'Earnings Per Share, Basic',
        description: 'Basic EPS',
        units: {
          'USD/shares': [
            entry(6.11, '2024-09-28', '10-K', 'CY2024', '2024-11-01'),
            entry(6.16, '2023-09-30', '10-K', 'CY2023', '2023-11-03'),
          ],
        },
      },

      NetCashProvidedByUsedInOperatingActivities: {
        label: 'Net Cash Provided by Operating Activities',
        description: 'Operating cash flow',
        units: {
          USD: [
            entry(118254000000, '2024-09-28', '10-K', 'CY2024', '2024-11-01'),
            entry(110543000000, '2023-09-30', '10-K', 'CY2023', '2023-11-03'),
          ],
        },
      },

      PaymentsToAcquirePropertyPlantAndEquipment: {
        label: 'Capital Expenditures',
        description: 'CapEx',
        units: {
          USD: [
            entry(9959000000, '2024-09-28', '10-K', 'CY2024', '2024-11-01'),
            entry(11154000000, '2023-09-30', '10-K', 'CY2023', '2023-11-03'),
          ],
        },
      },
    },
  },
};
