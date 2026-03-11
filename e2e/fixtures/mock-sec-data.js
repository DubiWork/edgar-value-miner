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

function msftEntry(val, end, form, frame, filed) {
  return { val, end, start: '2023-07-01', form, frame, filed, accn: '0000789019-24-000001' };
}

// ---------------------------------------------------------------------------
// Company Facts for AAPL — 5 years of annual data
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
            entry(394328000000, '2022-09-24', '10-K', 'CY2022', '2022-10-28'),
            entry(365817000000, '2021-09-25', '10-K', 'CY2021', '2021-10-29'),
            entry(274515000000, '2020-09-26', '10-K', 'CY2020', '2020-10-30'),
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
            entry(99803000000, '2022-09-24', '10-K', 'CY2022', '2022-10-28'),
            entry(94680000000, '2021-09-25', '10-K', 'CY2021', '2021-10-29'),
            entry(57411000000, '2020-09-26', '10-K', 'CY2020', '2020-10-30'),
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
            entry(170782000000, '2022-09-24', '10-K', 'CY2022', '2022-10-28'),
            entry(152836000000, '2021-09-25', '10-K', 'CY2021', '2021-10-29'),
            entry(104956000000, '2020-09-26', '10-K', 'CY2020', '2020-10-30'),
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
            entry(6.15, '2022-09-24', '10-K', 'CY2022', '2022-10-28'),
            entry(5.67, '2021-09-25', '10-K', 'CY2021', '2021-10-29'),
            entry(3.31, '2020-09-26', '10-K', 'CY2020', '2020-10-30'),
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
            entry(122151000000, '2022-09-24', '10-K', 'CY2022', '2022-10-28'),
            entry(104038000000, '2021-09-25', '10-K', 'CY2021', '2021-10-29'),
            entry(80674000000, '2020-09-26', '10-K', 'CY2020', '2020-10-30'),
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
            entry(10708000000, '2022-09-24', '10-K', 'CY2022', '2022-10-28'),
            entry(11085000000, '2021-09-25', '10-K', 'CY2021', '2021-10-29'),
            entry(7309000000, '2020-09-26', '10-K', 'CY2020', '2020-10-30'),
          ],
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Company Facts for MSFT
// (matches https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json)
// ---------------------------------------------------------------------------

export const MSFT_COMPANY_FACTS = {
  cik: 789019,
  entityName: 'Microsoft Corp',
  facts: {
    'us-gaap': {
      Revenues: {
        label: 'Revenues',
        description: 'Total revenue',
        units: {
          USD: [
            msftEntry(245122000000, '2024-06-30', '10-K', 'CY2024', '2024-07-30'),
            msftEntry(211915000000, '2023-06-30', '10-K', 'CY2023', '2023-07-27'),
          ],
        },
      },

      NetIncomeLoss: {
        label: 'Net Income (Loss)',
        description: 'Net income loss',
        units: {
          USD: [
            msftEntry(88136000000, '2024-06-30', '10-K', 'CY2024', '2024-07-30'),
            msftEntry(72361000000, '2023-06-30', '10-K', 'CY2023', '2023-07-27'),
          ],
        },
      },

      GrossProfit: {
        label: 'Gross Profit',
        description: 'Gross profit',
        units: {
          USD: [
            msftEntry(171008000000, '2024-06-30', '10-K', 'CY2024', '2024-07-30'),
            msftEntry(146052000000, '2023-06-30', '10-K', 'CY2023', '2023-07-27'),
          ],
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Empty-revenue company (for testing empty state / RT-51)
// ---------------------------------------------------------------------------

export const EMPTY_REVENUE_COMPANY_FACTS = {
  cik: 9999999,
  entityName: 'Empty Revenue Corp',
  facts: {
    'us-gaap': {
      Revenues: {
        label: 'Revenues',
        description: 'Total revenue',
        units: {
          USD: [],
        },
      },
    },
  },
};
