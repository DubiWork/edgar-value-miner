/**
 * Test data fixtures for dashboard component tests.
 *
 * Provides mock company data in the format returned by useCompanySearch
 * after normalization by gaapNormalizer.
 */

// =============================================================================
// Standard Company (AAPL-like, 5 years)
// =============================================================================

export const mockAppleData = {
  ticker: 'AAPL',
  cik: '0000320193',
  companyName: 'Apple Inc.',
  // Balance sheet fields for D/E calculation (AAPL-like FY2025)
  totalDebt: 111088000000,
  stockholdersEquity: 62146000000,
  // Previous year balance sheet for D/E trend
  previousTotalDebt: 120000000000,
  previousStockholdersEquity: 50672000000,
  metrics: {
    revenue: {
      annual: [
        { value: 420000000000, period: '2025-09-27', fiscalYear: 2025 },
        { value: 391035000000, period: '2024-09-28', fiscalYear: 2024 },
        { value: 383285000000, period: '2023-09-30', fiscalYear: 2023 },
        { value: 394328000000, period: '2022-10-01', fiscalYear: 2022 },
        { value: 365817000000, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      tag: 'Revenues',
    },
    netIncome: {
      annual: [
        { value: 105000000000, period: '2025-09-27', fiscalYear: 2025 },
        { value: 97000000000, period: '2024-09-28', fiscalYear: 2024 },
        { value: 94000000000, period: '2023-09-30', fiscalYear: 2023 },
        { value: 99800000000, period: '2022-10-01', fiscalYear: 2022 },
        { value: 94680000000, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      tag: 'NetIncomeLoss',
    },
    grossProfit: {
      annual: [
        { value: 185000000000, period: '2025-09-27', fiscalYear: 2025 },
        { value: 178000000000, period: '2024-09-28', fiscalYear: 2024 },
        { value: 169148000000, period: '2023-09-30', fiscalYear: 2023 },
        { value: 170782000000, period: '2022-10-01', fiscalYear: 2022 },
        { value: 152836000000, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      tag: 'GrossProfit',
    },
    operatingIncome: {
      annual: [
        { value: 130000000000, period: '2025-09-27', fiscalYear: 2025 },
        { value: 123000000000, period: '2024-09-28', fiscalYear: 2024 },
        { value: 114301000000, period: '2023-09-30', fiscalYear: 2023 },
        { value: 119437000000, period: '2022-10-01', fiscalYear: 2022 },
        { value: 108949000000, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      tag: 'OperatingIncomeLoss',
    },
    operatingCashFlow: {
      annual: [
        { value: 125000000000, period: '2025-09-27', fiscalYear: 2025 },
        { value: 118000000000, period: '2024-09-28', fiscalYear: 2024 },
        { value: 110543000000, period: '2023-09-30', fiscalYear: 2023 },
        { value: 122151000000, period: '2022-10-01', fiscalYear: 2022 },
        { value: 104038000000, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      tag: 'NetCashProvidedByUsedInOperatingActivities',
    },
    freeCashFlow: {
      annual: [
        { value: 115000000000, period: '2025-09-27', fiscalYear: 2025 },
        { value: 111000000000, period: '2024-09-28', fiscalYear: 2024 },
        { value: 99584000000, period: '2023-09-30', fiscalYear: 2023 },
        { value: 111443000000, period: '2022-10-01', fiscalYear: 2022 },
        { value: 92953000000, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      calculated: true,
    },
    eps: {
      annual: [
        { value: 6.97, period: '2025-09-27', fiscalYear: 2025 },
        { value: 6.42, period: '2024-09-28', fiscalYear: 2024 },
        { value: 6.13, period: '2023-09-30', fiscalYear: 2023 },
        { value: 6.15, period: '2022-10-01', fiscalYear: 2022 },
        { value: 5.67, period: '2021-09-25', fiscalYear: 2021 },
      ],
      quarterly: [],
      tag: 'EarningsPerShareBasic',
    },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 20,
    missingMetrics: [],
  },
};

// =============================================================================
// Pre-Revenue Company (1 year of data)
// =============================================================================

export const mockPreRevenueCompany = {
  ticker: 'NEWCO',
  cik: '999999',
  companyName: 'New IPO Corp',
  // Balance sheet: startup with low debt and positive equity
  totalDebt: 5000000,
  stockholdersEquity: 80000000,
  metrics: {
    revenue: {
      annual: [{ value: 0, period: '2025-12-31', fiscalYear: 2025 }],
      quarterly: [],
      tag: 'Revenues',
    },
    netIncome: {
      annual: [{ value: -50000000, period: '2025-12-31', fiscalYear: 2025 }],
      quarterly: [],
      tag: 'NetIncomeLoss',
    },
    grossProfit: {
      annual: [],
      quarterly: [],
      tag: 'GrossProfit',
    },
    operatingIncome: {
      annual: [{ value: -50000000, period: '2025-12-31', fiscalYear: 2025 }],
      quarterly: [],
      tag: 'OperatingIncomeLoss',
    },
    operatingCashFlow: {
      annual: [{ value: -30000000, period: '2025-12-31', fiscalYear: 2025 }],
      quarterly: [],
      tag: 'NetCashProvidedByUsedInOperatingActivities',
    },
    freeCashFlow: {
      annual: [{ value: -35000000, period: '2025-12-31', fiscalYear: 2025 }],
      quarterly: [],
      calculated: true,
    },
    eps: {
      annual: [{ value: -0.5, period: '2025-12-31', fiscalYear: 2025 }],
      quarterly: [],
      tag: 'EarningsPerShareBasic',
    },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 10,
    missingMetrics: ['capitalExpenditures'],
  },
};

// =============================================================================
// All Null/Empty Data
// =============================================================================

export const mockNullDataCompany = {
  ticker: 'NULL',
  cik: '000000',
  companyName: 'No Data Corp',
  metrics: {
    revenue: { annual: [], quarterly: [], tag: 'Revenues' },
    netIncome: { annual: [], quarterly: [], tag: 'NetIncomeLoss' },
    grossProfit: { annual: [], quarterly: [], tag: 'GrossProfit' },
    operatingIncome: { annual: [], quarterly: [], tag: 'OperatingIncomeLoss' },
    operatingCashFlow: { annual: [], quarterly: [], tag: 'NetCashProvidedByUsedInOperatingActivities' },
    freeCashFlow: { annual: [], quarterly: [], calculated: true },
    eps: { annual: [], quarterly: [], tag: 'EarningsPerShareBasic' },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 0,
    missingMetrics: ['revenue', 'netIncome', 'grossProfit'],
  },
};

// =============================================================================
// Negative Values Company (money-losing)
// =============================================================================

export const mockNegativeCompany = {
  ticker: 'LOSS',
  cik: '111111',
  companyName: 'Money Losing Inc.',
  // Balance sheet: negative equity (accumulated losses)
  totalDebt: 200000000,
  stockholdersEquity: -50000000,
  metrics: {
    revenue: {
      annual: [
        { value: 80000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: 100000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'Revenues',
    },
    netIncome: {
      annual: [
        { value: -150000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: -200000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'NetIncomeLoss',
    },
    grossProfit: {
      annual: [
        { value: 20000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: 30000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'GrossProfit',
    },
    operatingIncome: {
      annual: [],
      quarterly: [],
      tag: 'OperatingIncomeLoss',
    },
    operatingCashFlow: {
      annual: [
        { value: -30000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: -50000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'NetCashProvidedByUsedInOperatingActivities',
    },
    freeCashFlow: {
      annual: [
        { value: -38000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: -60000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      calculated: true,
    },
    eps: {
      annual: [
        { value: -1.5, period: '2025-12-31', fiscalYear: 2025 },
        { value: -2.0, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'EarningsPerShareBasic',
    },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 12,
    missingMetrics: [],
  },
};

// =============================================================================
// Long Company Name
// =============================================================================

export const mockLongNameCompany = {
  ticker: 'LONG',
  cik: '222222',
  companyName: 'The Very Long International Holding Corporation of Americas and Europe Ltd.',
  // Balance sheet
  totalDebt: 1500000000,
  stockholdersEquity: 3000000000,
  metrics: {
    revenue: {
      annual: [
        { value: 5000000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: 4500000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'Revenues',
    },
    netIncome: {
      annual: [
        { value: 500000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: 450000000, period: '2024-12-31', fiscalYear: 2024 },
      ],
      quarterly: [],
      tag: 'NetIncomeLoss',
    },
    grossProfit: {
      annual: [
        { value: 2000000000, period: '2025-12-31', fiscalYear: 2025 },
      ],
      quarterly: [],
      tag: 'GrossProfit',
    },
    operatingIncome: { annual: [], quarterly: [], tag: 'OperatingIncomeLoss' },
    operatingCashFlow: { annual: [], quarterly: [], tag: 'NetCashProvidedByUsedInOperatingActivities' },
    freeCashFlow: { annual: [], quarterly: [], calculated: true },
    eps: { annual: [], quarterly: [], tag: 'EarningsPerShareBasic' },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 6,
    missingMetrics: ['operatingCashFlow', 'freeCashFlow'],
  },
};

// =============================================================================
// 10-Year Data Company
// =============================================================================

export const mockTenYearCompany = {
  ticker: 'MSFT',
  cik: '0000789019',
  companyName: 'Microsoft Corporation',
  // Balance sheet (MSFT-like)
  totalDebt: 47000000000,
  stockholdersEquity: 206000000000,
  metrics: {
    revenue: {
      annual: Array.from({ length: 10 }, (_, i) => ({
        value: (200 + i * 20) * 1e9,
        period: `${2025 - i}-06-30`,
        fiscalYear: 2025 - i,
      })),
      quarterly: [],
      tag: 'Revenues',
    },
    netIncome: {
      annual: Array.from({ length: 10 }, (_, i) => ({
        value: (70 + i * 5) * 1e9,
        period: `${2025 - i}-06-30`,
        fiscalYear: 2025 - i,
      })),
      quarterly: [],
      tag: 'NetIncomeLoss',
    },
    grossProfit: {
      annual: Array.from({ length: 10 }, (_, i) => ({
        value: (140 + i * 12) * 1e9,
        period: `${2025 - i}-06-30`,
        fiscalYear: 2025 - i,
      })),
      quarterly: [],
      tag: 'GrossProfit',
    },
    operatingIncome: { annual: [], quarterly: [], tag: 'OperatingIncomeLoss' },
    operatingCashFlow: { annual: [], quarterly: [], tag: 'NetCashProvidedByUsedInOperatingActivities' },
    freeCashFlow: { annual: [], quarterly: [], calculated: true },
    eps: { annual: [], quarterly: [], tag: 'EarningsPerShareBasic' },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 30,
    missingMetrics: [],
  },
};

// =============================================================================
// Partial Data Company (some years missing)
// =============================================================================

export const mockPartialDataCompany = {
  ticker: 'PART',
  cik: '333333',
  companyName: 'Partial Data Inc.',
  // Balance sheet: only component debt (no totalDebt)
  shortTermDebt: 5000000,
  longTermDebt: 15000000,
  stockholdersEquity: 30000000,
  metrics: {
    revenue: {
      annual: [
        { value: 50000000, period: '2025-12-31', fiscalYear: 2025 },
        { value: 45000000, period: '2024-12-31', fiscalYear: 2024 },
        { value: 40000000, period: '2023-12-31', fiscalYear: 2023 },
      ],
      quarterly: [],
      tag: 'Revenues',
    },
    netIncome: {
      annual: [
        { value: 5000000, period: '2025-12-31', fiscalYear: 2025 },
      ],
      quarterly: [],
      tag: 'NetIncomeLoss',
    },
    grossProfit: { annual: [], quarterly: [], tag: 'GrossProfit' },
    operatingIncome: { annual: [], quarterly: [], tag: 'OperatingIncomeLoss' },
    operatingCashFlow: { annual: [], quarterly: [], tag: 'NetCashProvidedByUsedInOperatingActivities' },
    freeCashFlow: { annual: [], quarterly: [], calculated: true },
    eps: { annual: [], quarterly: [], tag: 'EarningsPerShareBasic' },
  },
  metadata: {
    normalizationVersion: 1,
    metricsFound: 4,
    missingMetrics: ['grossProfit', 'operatingIncome', 'operatingCashFlow'],
  },
};
