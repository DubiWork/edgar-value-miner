/**
 * GAAP Tag Normalizer for SEC Company Facts
 *
 * Normalizes SEC XBRL GAAP tags into consistent financial metrics.
 * Companies use different GAAP tags for the same metrics (e.g., revenue
 * could be "Revenues", "SalesRevenueNet", or "RevenueFromContractWithCustomer...").
 *
 * This module maps these variations to standardized metric names and extracts
 * time series data for analysis.
 *
 * @module gaapNormalizer
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Current version of the normalization schema
 * Increment when making breaking changes to metric mappings
 * @constant {number}
 */
export const NORMALIZATION_VERSION = 2;

/**
 * Number of years of annual data to extract
 * @constant {number}
 */
const ANNUAL_YEARS = 5;

/**
 * Number of quarters of data to extract (5 years * 4 quarters)
 * @constant {number}
 */
const QUARTERLY_PERIODS = 20;

/**
 * Forms used for annual filings
 * @constant {string[]}
 */
export const ANNUAL_FORMS = ['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'];

const GAAP_NAMESPACE = 'us-gaap';
const IFRS_NAMESPACE = 'ifrs-full';
const DEFAULT_CURRENCY = 'USD';

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF ',
  DKK: 'DKK ',
  SEK: 'SEK ',
  NOK: 'NOK ',
  ILS: '₪',
  TWD: 'NT$',
};

/**
 * Returns the currency symbol/prefix for a given ISO 4217 currency code.
 * @param {string} [currency='USD']
 * @returns {string}
 */
export function getCurrencySymbol(currency) {
  const code = String(currency || DEFAULT_CURRENCY).trim().toUpperCase();
  if (!code) return '$';
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

/**
 * Forms used for quarterly filings
 * @constant {string[]}
 */
const QUARTERLY_FORMS = ['10-Q', '10-Q/A'];

// =============================================================================
// GAAP Tag Mappings
// =============================================================================

/**
 * Cash-basis fallback tags for interest expense (used ONLY if accrual tags yield zero points).
 * Never mixed into GAAP_TAG_MAP.interestExpense so a newer 10-Q InterestPaidNet date cannot
 * override a valid accrual InterestExpense tag.
 * @constant {string[]}
 */
export const INTEREST_EXPENSE_CASH_FALLBACK_TAGS = ['InterestPaidNet'];

/**
 * Bank / financial-spread revenue tags that include interest income.
 * @constant {string[]}
 */
export const BANK_REVENUE_TAGS = [
  'RevenuesNetOfInterestExpense',
  'InterestAndDividendIncomeOperating',
  'InterestRevenueExpense',
];

/**
 * Maps standard metric names to possible GAAP tag variations.
 * Tags are ordered by commonality (most common first).
 *
 * @constant {Object<string, string[]>}
 */
export const GAAP_TAG_MAP = {
  // -------------------------------------------------------------------------
  // Income Statement
  // -------------------------------------------------------------------------

  /** Total revenue/sales */
  revenue: [
    'Revenues',
    'RevenuesNetOfInterestExpense',
    'InterestAndDividendIncomeOperating',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueNet',
    'SalesRevenueGoodsNet',
    'SalesRevenueServicesNet',
    'NetRevenuesFromSalesOfProducts',
    'TotalRevenuesAndOtherIncome',
  ],

  /** Net income/profit */
  netIncome: [
    'NetIncomeLoss',
    'ProfitLoss',
    'NetIncome',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
    'NetIncomeLossAvailableToCommonStockholdersDiluted',
    'NetIncomeLossAttributableToParent',
  ],

  /** Gross profit */
  grossProfit: [
    'GrossProfit',
  ],

  /** Operating income/EBIT */
  operatingIncome: [
    'OperatingIncomeLoss',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
    'IncomeLossFromContinuingOperations',
  ],

  /** Earnings per share (basic) */
  eps: [
    'EarningsPerShareBasic',
    'IncomeLossFromContinuingOperationsPerBasicShare',
    'BasicEarningsLossPerShare',
  ],

  /** Earnings per share (diluted) */
  epsDiluted: [
    'EarningsPerShareDiluted',
    'IncomeLossFromContinuingOperationsPerDilutedShare',
    'DilutedEarningsLossPerShare',
  ],

  /** Cost of revenue/goods sold */
  costOfRevenue: [
    'CostOfGoodsAndServicesSold',
    'CostOfRevenue',
    'CostOfGoodsSold',
    'CostOfSales',
  ],

  /** Research and development expenses */
  researchAndDevelopment: [
    'ResearchAndDevelopmentExpense',
    'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
  ],

  /** Selling, general, and administrative expenses */
  sellingGeneralAdmin: [
    'SellingGeneralAndAdministrativeExpense',
    'GeneralAndAdministrativeExpense',
    'SellingAndMarketingExpense',
  ],

  /** Interest expense (accrual tags only — never override with cash InterestPaidNet) */
  interestExpense: [
    'InterestExpense',
    'InterestExpenseOperating',
    'InterestExpenseDebt',
    'InterestAndDebtExpense',
  ],

  /** Income tax expense */
  incomeTaxExpense: [
    'IncomeTaxExpenseBenefit',
    'IncomeTaxExpense',
    'CurrentIncomeTaxExpenseBenefit',
  ],

  // -------------------------------------------------------------------------
  // Cash Flow Statement
  // -------------------------------------------------------------------------

  /** Cash from operations */
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'CashFlowsFromUsedInOperatingActivities',
    'NetCashProvidedByOperatingActivities',
    'CashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],

  /** Capital expenditures */
  capitalExpenditures: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
    'PaymentsForCapitalImprovements',
  ],

  /** Cash from investing activities */
  investingCashFlow: [
    'NetCashProvidedByUsedInInvestingActivities',
    'CashFlowsFromUsedInInvestingActivities',
    'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations',
  ],

  /** Cash from financing activities */
  financingCashFlow: [
    'NetCashProvidedByUsedInFinancingActivities',
    'CashFlowsFromUsedInFinancingActivities',
    'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations',
  ],

  /** Depreciation and amortization */
  depreciationAmortization: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'Depreciation',
    'AmortizationOfIntangibleAssets',
  ],

  /** Dividends paid */
  dividendsPaid: [
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfDividends',
    'DividendsPaid',
    'PaymentsOfOrdinaryDividends',
  ],

  /** Stock repurchases */
  stockRepurchases: [
    'PaymentsForRepurchaseOfCommonStock',
    'PaymentsForRepurchaseOfEquity',
    'StockRepurchasedDuringPeriodValue',
  ],

  /** Stock-based compensation */
  stockBasedCompensation: [
    'ShareBasedCompensation',
    'AllocatedShareBasedCompensationExpense',
    'EmployeeBenefitsAndShareBasedCompensation',
  ],

  // -------------------------------------------------------------------------
  // Balance Sheet - Assets
  // -------------------------------------------------------------------------

  /** Total assets */
  totalAssets: [
    'Assets',
  ],

  /** Current assets */
  currentAssets: [
    'AssetsCurrent',
  ],

  /** Cash and cash equivalents */
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsAndShortTermInvestments',
    'Cash',
    'CashAndCashEquivalents',
  ],

  /** Short-term investments */
  shortTermInvestments: [
    'ShortTermInvestments',
    'MarketableSecuritiesCurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
  ],

  /** Accounts receivable */
  accountsReceivable: [
    'AccountsReceivableNetCurrent',
    'ReceivablesNetCurrent',
    'AccountsReceivableNet',
    'AccountsNotesAndLoansReceivableNetCurrent',
  ],

  /** Inventory */
  inventory: [
    'InventoryNet',
    'Inventory',
    'InventoryRawMaterialsAndSupplies',
  ],

  /** Property, plant, and equipment (net) */
  propertyPlantEquipment: [
    'PropertyPlantAndEquipmentNet',
    'PropertyPlantAndEquipmentGross',
    'PropertyPlantAndEquipment',
  ],

  /** Goodwill */
  goodwill: [
    'Goodwill',
  ],

  /** Intangible assets */
  intangibleAssets: [
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
  ],

  // -------------------------------------------------------------------------
  // Balance Sheet - Liabilities
  // -------------------------------------------------------------------------

  /** Total liabilities */
  totalLiabilities: [
    'Liabilities',
  ],

  /** Current liabilities */
  currentLiabilities: [
    'LiabilitiesCurrent',
  ],

  /** Deferred revenue (current) */
  deferredRevenueCurrent: [
    'ContractWithCustomerLiabilityCurrent',
    'DeferredRevenueCurrent',
    'DeferredRevenueAndCreditsCurrent',
  ],

  /** Accounts payable */
  accountsPayable: [
    'AccountsPayableCurrent',
    'AccountsPayable',
    'AccountsPayableAndAccruedLiabilitiesCurrent',
  ],

  /** Short-term debt */
  shortTermDebt: [
    'ShortTermBorrowings',
    'DebtCurrent',
    'CommercialPaper',
  ],

  /** Long-term debt */
  longTermDebt: [
    'LongTermDebtNoncurrent',
    'LongTermDebt',
    'LongTermDebtAndCapitalLeaseObligations',
  ],

  /** Total debt */
  totalDebt: [
    'DebtLongtermAndShorttermCombinedAmount',
  ],

  // -------------------------------------------------------------------------
  // Balance Sheet - Equity
  // -------------------------------------------------------------------------

  /** Stockholders' equity */
  stockholdersEquity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'TotalEquity',
  ],

  /** Retained earnings */
  retainedEarnings: [
    'RetainedEarningsAccumulatedDeficit',
    'RetainedEarnings',
  ],

  /** Common stock */
  commonStock: [
    'CommonStockValue',
    'CommonStocksIncludingAdditionalPaidInCapital',
  ],

  /** Treasury stock */
  treasuryStock: [
    'TreasuryStockValue',
    'TreasuryStockCommonValue',
  ],

  // -------------------------------------------------------------------------
  // Shares
  // -------------------------------------------------------------------------

  /** Common shares outstanding */
  sharesOutstanding: [
    'CommonStockSharesOutstanding',
    'CommonStockSharesIssued',
    'EntityCommonStockSharesOutstanding',
  ],

  /** Weighted average shares (basic) */
  weightedAverageShares: [
    'WeightedAverageNumberOfSharesOutstandingBasic',
    'CommonStockSharesOutstanding',
  ],

  /** Weighted average shares (diluted) */
  weightedAverageSharesDiluted: [
    'WeightedAverageNumberOfDilutedSharesOutstanding',
    'WeightedAverageNumberOfShareOutstandingBasicAndDiluted',
  ],
};

/**
 * Maps standard metric names to IFRS (`ifrs-full` / Form 20-F) XBRL tag variations.
 *
 * @constant {Object<string, string[]>}
 */
export const IFRS_TAG_MAP = {
  revenue: [
    'Revenue',
    'RevenueFromContractsWithCustomers',
    'Revenues',
    'InterestRevenueExpense',
  ],
  netIncome: [
    'ProfitLossAttributableToOwnersOfParent',
    'ProfitLoss',
    'ProfitLossFromContinuingOperations',
  ],
  grossProfit: [
    'GrossProfit',
  ],
  operatingIncome: [
    'ProfitLossFromOperatingActivities',
    'OperatingIncomeLoss',
    'ProfitLossBeforeTax',
  ],
  eps: [
    'BasicEarningsLossPerShare',
    'BasicEarningsLossPerShareFromContinuingOperations',
  ],
  epsDiluted: [
    'DilutedEarningsLossPerShare',
    'DilutedEarningsLossPerShareFromContinuingOperations',
  ],
  costOfRevenue: [
    'CostOfSales',
  ],
  researchAndDevelopment: [
    'ResearchAndDevelopmentExpense',
  ],
  sellingGeneralAdmin: [
    'SellingGeneralAndAdministrativeExpense',
    'AdministrativeExpense',
    'DistributionCosts',
    'OperatingExpense',
  ],
  interestExpense: [
    'InterestExpenseForFinancialLiabilitiesNotAtFairValueThroughProfitOrLoss',
    'InterestExpenseOnBorrowings',
    'InterestExpense',
    'FinanceCosts',
  ],
  incomeTaxExpense: [
    'IncomeTaxExpenseContinuingOperations',
    'CurrentTaxExpenseIncome',
    'DeferredTaxExpenseIncomeRecognisedInProfitOrLoss',
  ],
  operatingCashFlow: [
    'CashFlowsFromUsedInOperatingActivities',
    'CashFlowsFromUsedInOperatingActivitiesContinuingOperations',
  ],
  capitalExpenditures: [
    'PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets',
    'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
    'AdditionsOtherThanThroughBusinessCombinationsPropertyPlantAndEquipment',
    'AdditionsOtherThanThroughBusinessCombinationsPropertyPlantAndEquipmentIncludingRightofuseAssets',
  ],
  investingCashFlow: [
    'CashFlowsFromUsedInInvestingActivities',
  ],
  financingCashFlow: [
    'CashFlowsFromUsedInFinancingActivities',
  ],
  depreciationAmortization: [
    'DepreciationAndAmortisationExpense',
    'DepreciationRightofuseAssets',
  ],
  dividendsPaid: [
    'DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities',
    'DividendsPaidClassifiedAsFinancingActivities',
    'DividendsPaid',
  ],
  stockRepurchases: [
    'PurchaseOfTreasuryShares',
    'PaymentsToAcquireOrRedeemEntitysShares',
  ],
  stockBasedCompensation: [
    'ExpenseFromSharebasedPaymentTransactionsInWhichGoodsOrServicesReceivedDidNotQualifyForRecognitionAsAssets',
    'ExpenseFromEquitysettledShareBasedPaymentTransactionsInWhichGoodsOrServicesReceivedDidNotQualifyForRecognitionAsAssets',
    'AdjustmentsForSharebasedPayments',
  ],
  totalAssets: [
    'Assets',
  ],
  currentAssets: [
    'CurrentAssets',
  ],
  cash: [
    'CashAndCashEquivalents',
    'CashAndCashEquivalentsIfDifferentFromStatementOfFinancialPosition',
  ],
  shortTermInvestments: [
    'CurrentFinancialAssets',
    'OtherCurrentFinancialAssets',
  ],
  accountsReceivable: [
    'TradeAndOtherCurrentReceivables',
    'CurrentTradeReceivables',
  ],
  inventory: [
    'Inventories',
    'CurrentInventories',
  ],
  propertyPlantEquipment: [
    'PropertyPlantAndEquipment',
    'PropertyPlantAndEquipmentIncludingRightofuseAssets',
  ],
  goodwill: [
    'Goodwill',
  ],
  intangibleAssets: [
    'IntangibleAssetsOtherThanGoodwill',
  ],
  totalLiabilities: [
    'Liabilities',
  ],
  currentLiabilities: [
    'CurrentLiabilities',
  ],
  deferredRevenueCurrent: [
    'CurrentContractLiabilities',
    'CurrentDeferredIncomeIncludingCurrentContractLiabilities',
    'CurrentDeferredIncomeOtherThanCurrentContractLiabilities',
  ],
  accountsPayable: [
    'TradeAndOtherCurrentPayables',
  ],
  shortTermDebt: [
    'CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings',
    'ShorttermBorrowings',
    'CurrentLeaseLiabilities',
  ],
  longTermDebt: [
    'LongtermBorrowings',
    'NoncurrentFinancialLiabilities',
    'NoncurrentBorrowings',
    'Borrowings',
  ],
  totalDebt: [
    'Borrowings',
  ],
  stockholdersEquity: [
    'EquityAttributableToOwnersOfParent',
    'Equity',
  ],
  retainedEarnings: [
    'RetainedEarnings',
  ],
  commonStock: [
    'IssuedCapital',
  ],
  treasuryStock: [
    'TreasuryShares',
  ],
  sharesOutstanding: [
    'NumberOfSharesIssued',
    'NumberOfSharesOutstanding',
    'AdjustedWeightedAverageShares',
  ],
  weightedAverageShares: [
    'WeightedAverageShares',
    'AdjustedWeightedAverageShares',
  ],
  weightedAverageSharesDiluted: [
    'AdjustedWeightedAverageShares',
    'WeightedAverageShares',
  ],
};

/**
 * Metric categories for organization
 * @constant {Object<string, string[]>}
 */
export const METRIC_CATEGORIES = {
  incomeStatement: [
    'revenue',
    'netIncome',
    'grossProfit',
    'operatingIncome',
    'eps',
    'epsDiluted',
    'costOfRevenue',
    'researchAndDevelopment',
    'sellingGeneralAdmin',
    'interestExpense',
    'incomeTaxExpense',
  ],
  cashFlow: [
    'operatingCashFlow',
    'capitalExpenditures',
    'investingCashFlow',
    'financingCashFlow',
    'depreciationAmortization',
    'dividendsPaid',
    'stockRepurchases',
    'stockBasedCompensation',
  ],
  balanceSheetAssets: [
    'totalAssets',
    'currentAssets',
    'cash',
    'shortTermInvestments',
    'accountsReceivable',
    'inventory',
    'propertyPlantEquipment',
    'goodwill',
    'intangibleAssets',
  ],
  balanceSheetLiabilities: [
    'totalLiabilities',
    'currentLiabilities',
    'deferredRevenueCurrent',
    'accountsPayable',
    'shortTermDebt',
    'longTermDebt',
    'totalDebt',
  ],
  balanceSheetEquity: [
    'stockholdersEquity',
    'retainedEarnings',
    'commonStock',
    'treasuryStock',
  ],
  shares: [
    'sharesOutstanding',
    'weightedAverageShares',
    'weightedAverageSharesDiluted',
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Logs messages in development mode only
 * @param {string} level - Log level ('log', 'warn', 'error')
 * @param {string} message - Message to log
 * @param {*} [data] - Optional data to log
 * @private
 */
function devLog(level, message, data = undefined) {
  if (import.meta.env?.DEV) {
    const prefix = 'GaapNormalizer:';
    if (data !== undefined) {
      console[level](prefix, message, data);
    } else {
      console[level](prefix, message);
    }
  }
}

/**
 * Checks if a value is a valid number (not NaN, Infinity, or non-numeric)
 * @param {*} value - Value to check
 * @returns {boolean}
 * @private
 */
function isValidNumber(value) {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

/**
 * Parses a filing date string into a Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date|null}
 * @private
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Extracts fiscal year from a filing date or end date
 * @param {string} dateStr - Date string
 * @returns {number|null}
 * @private
 */
function extractFiscalYear(dateStr) {
  const date = parseDate(dateStr);
  return date ? date.getFullYear() : null;
}

/**
 * Extracts fiscal quarter from a filing date (approximation based on month)
 * @param {string} dateStr - Date string
 * @returns {number|null} Quarter (1-4) or null
 * @private
 */
function extractFiscalQuarter(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return null;
  const month = date.getMonth(); // 0-indexed
  return Math.floor(month / 3) + 1;
}

/**
 * Determines confidence level for a data point based on available metadata
 * @param {Object} dataPoint - The data point object
 * @param {string} metricName - Name of the metric
 * @param {number} tagIndex - Index in the priority list (0 = most common tag)
 * @returns {'high'|'medium'|'low'}
 * @private
 */
function determineConfidence(dataPoint, metricName, tagIndex) {
  // High confidence: Primary tag (index 0), has filing info
  if (tagIndex === 0 && dataPoint.form && dataPoint.filed) {
    return 'high';
  }
  // Medium confidence: Secondary tag or missing some metadata
  if (tagIndex <= 2 && (dataPoint.form || dataPoint.filed)) {
    return 'medium';
  }
  // Low confidence: Fallback tag or sparse metadata
  return 'low';
}

// =============================================================================
// Core Normalization Functions
// =============================================================================

/**
 * Finds the first matching GAAP tag in company facts for a given metric
 *
 * @param {Object} companyFacts - Raw SEC Company Facts JSON
 * @param {string} metricName - Standard metric name (e.g., 'revenue', 'netIncome')
 * @returns {{ tag: string, data: Object, index: number }|null} Matching tag info or null
 *
 * @example
 * const result = findGaapTag(companyFacts, 'revenue');
 * if (result) {
 *   console.log(`Found ${result.tag} at priority index ${result.index}`);
 * }
 */
function resolveActiveTaxonomy(companyFacts) {
  const facts = companyFacts?.facts ?? {};
  const usGaap = facts[GAAP_NAMESPACE];
  if (usGaap && Object.keys(usGaap).length > 0) {
    return {
      namespace: GAAP_NAMESPACE,
      accountingStandard: 'US-GAAP',
      factsMap: usGaap,
      tagMap: GAAP_TAG_MAP,
    };
  }
  const ifrs = facts[IFRS_NAMESPACE];
  if (ifrs && Object.keys(ifrs).length > 0) {
    return {
      namespace: IFRS_NAMESPACE,
      accountingStandard: 'IFRS',
      factsMap: ifrs,
      tagMap: IFRS_TAG_MAP,
    };
  }
  return null;
}

export function findGaapTag(companyFacts, metricName) {
  const taxonomy = resolveActiveTaxonomy(companyFacts);
  if (!taxonomy) {
    devLog('warn', 'No us-gaap or ifrs-full facts found in company data');
    return null;
  }

  const tags = taxonomy.tagMap[metricName];

  if (!tags || !Array.isArray(tags)) {
    devLog('warn', `Unknown metric: ${metricName}`);
    return null;
  }

  const activeFacts = taxonomy.factsMap;

  // Collect all present tags with their priority index
  const candidates = [];
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (activeFacts[tag] && activeFacts[tag].units) {
      candidates.push({ tag, data: activeFacts[tag], index: i });
    }
  }

  if (candidates.length === 0) {
    devLog('log', `No matching tag found for metric: ${metricName}`);
    return null;
  }

  // Single match — return immediately (unchanged behaviour)
  if (candidates.length === 1) {
    return candidates[0];
  }

  // Multiple matches — pick the tag with the most recent max(end date).
  // Tie-break: prefer lower priority index (earlier in the list).
  function maxEndDate(tagData) {
    const unitArrays = Object.values(tagData.units);
    let latest = '';
    for (const arr of unitArrays) {
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (entry.end && entry.end > latest) latest = entry.end;
      }
    }
    return latest;
  }

  let best = candidates[0];
  let bestEnd = maxEndDate(best.data);

  for (let c = 1; c < candidates.length; c++) {
    const candidate = candidates[c];
    const candidateEnd = maxEndDate(candidate.data);
    if (candidateEnd > bestEnd) {
      best = candidate;
      bestEnd = candidateEnd;
    }
    // tie: keep best (lower index wins — already set)
  }

  return best;
}

/**
 * Extracts time series data from a GAAP tag
 *
 * @param {Object} gaapTagData - Data for a specific GAAP tag
 * @param {'annual'|'quarterly'} periodType - Type of periods to extract
 * @param {Object} [options={}] - Extraction options
 * @param {number} [options.maxPeriods] - Maximum periods to return
 * @param {number} [options.tagIndex=0] - Priority index of the tag (for confidence)
 * @returns {Array<{
 *   value: number,
 *   period: string,
 *   fiscalYear: number,
 *   fiscalQuarter: number|null,
 *   filedDate: string,
 *   form: string,
 *   confidence: 'high'|'medium'|'low'
 * }>} Array of data points sorted by period (most recent first)
 *
 * @example
 * const annualData = extractTimeSeriesData(revenueTagData, 'annual', { maxPeriods: 5 });
 */
function selectUnitArray(units, preferredCurrency) {
  if (!units || typeof units !== 'object') return null;

  if (preferredCurrency) {
    if (Array.isArray(units[preferredCurrency]) && units[preferredCurrency].length > 0) {
      return units[preferredCurrency];
    }
    const perShareKey = `${preferredCurrency}/shares`;
    if (Array.isArray(units[perShareKey]) && units[perShareKey].length > 0) {
      return units[perShareKey];
    }
  }

  if (Array.isArray(units.USD) && units.USD.length > 0) return units.USD;
  if (Array.isArray(units.shares) && units.shares.length > 0) return units.shares;
  if (Array.isArray(units['USD/shares']) && units['USD/shares'].length > 0) return units['USD/shares'];

  // Pick longest available non-empty array (e.g., EUR or EUR/shares)
  let longest = null;
  for (const arr of Object.values(units)) {
    if (Array.isArray(arr) && (!longest || arr.length > longest.length)) {
      longest = arr;
    }
  }
  return longest;
}

export function extractTimeSeriesData(gaapTagData, periodType, options = {}) {
  const {
    fullHistory = false,
    maxPeriods = fullHistory ? Infinity : (periodType === 'annual' ? ANNUAL_YEARS : QUARTERLY_PERIODS),
    tagIndex = 0,
    preferredCurrency = null,
  } = options || {};

  if (!gaapTagData?.units) {
    return [];
  }

  const unitData = selectUnitArray(gaapTagData.units, preferredCurrency);

  if (!unitData || !Array.isArray(unitData)) {
    return [];
  }

  // Filter by form type
  const targetForms = periodType === 'annual' ? ANNUAL_FORMS : QUARTERLY_FORMS;

  const filteredData = unitData.filter(item => {
    // Must have a form that matches
    if (!item.form || !targetForms.includes(item.form)) {
      return false;
    }

    // For annual, prefer full-year periods (frames like CY2023, CY2023I4, or balance sheet instant CY2023Q4I)
    if (periodType === 'annual') {
      if (item.frame) {
        const isFullYear = /^CY\d{4}(I4|Q4I)?$/.test(item.frame);
        if (!isFullYear) return false;
      }
    }

    // For quarterly, we want Q1-Q4 periods (frames like CY2023Q1)
    if (periodType === 'quarterly') {
      if (item.frame) {
        const isQuarter = /^CY\d{4}Q[1-4]$/.test(item.frame);
        if (!isQuarter) return false;
      }
    }

    // Must have a valid value
    return isValidNumber(item.val);
  });

  // Sort by end date (most recent first), then by filed date (most recent first)
  // This ensures restated financials (later filings) take precedence
  const sortedData = filteredData.sort((a, b) => {
    const dateA = parseDate(a.end) || parseDate(a.filed);
    const dateB = parseDate(b.end) || parseDate(b.filed);
    if (!dateA || !dateB) return 0;

    const endCompare = dateB.getTime() - dateA.getTime();
    if (endCompare !== 0) return endCompare;

    // Tiebreaker: most recently filed first (for restated financials)
    const filedA = parseDate(a.filed);
    const filedB = parseDate(b.filed);
    if (filedA && filedB) {
      const filedCompare = filedB.getTime() - filedA.getTime();
      if (filedCompare !== 0) return filedCompare;
    }

    // Final tiebreaker: accession number (higher = more recent)
    if (a.accn && b.accn) {
      return b.accn.localeCompare(a.accn);
    }
    return 0;
  });

  // Deduplicate by period (keep most recent filing for each period)
  // For annual data: key on calendar/fiscal year from frame or end date so that
  // restatements with off-by-one-day end dates (e.g. 2023-09-30 vs 2023-10-01)
  // still collapse to one row per year, while multiple comparative years in the
  // same filing (which share the same filing item.fy) are preserved.
  // For quarterly data: keep existing frame/end keying so Q1-Q4 are not collapsed.
  const seenPeriods = new Set();
  const deduplicatedData = sortedData.filter(item => {
    let period;
    if (periodType === 'annual') {
      const frameMatch = typeof item.frame === 'string' ? item.frame.match(/^CY(\d{4})/) : null;
      period = frameMatch ? frameMatch[1] : (item.end ? String(item.end).slice(0, 4) : (item.fy != null ? String(item.fy) : item.frame));
    } else {
      period = item.frame || item.end;
    }
    if (seenPeriods.has(period)) {
      return false;
    }
    seenPeriods.add(period);
    return true;
  });

  // Limit to requested number of periods
  const limitedData = (fullHistory || maxPeriods === Infinity)
    ? deduplicatedData
    : deduplicatedData.slice(0, maxPeriods);

  // Transform to standardized format
  const result = limitedData.map(item => ({
    value: item.val,
    period: item.frame || item.end,
    frame: item.frame || null,
    fiscalYear: extractFiscalYear(item.end),
    fiscalQuarter: periodType === 'quarterly' ? extractFiscalQuarter(item.end) : null,
    filedDate: item.filed || null,
    form: item.form,
    confidence: determineConfidence(item, '', tagIndex),
  }));
  return result;
}

/**
 * Calculates Free Cash Flow from Operating Cash Flow and CapEx
 *
 * Free Cash Flow = Operating Cash Flow - Capital Expenditures
 *
 * @param {Array<Object>} operatingCashFlow - OCF time series
 * @param {Array<Object>} capitalExpenditures - CapEx time series
 * @returns {Array<Object>} Free cash flow time series
 *
 * @example
 * const fcf = calculateFreeCashFlow(ocfData, capexData);
 */
export function calculateFreeCashFlow(operatingCashFlow, capitalExpenditures) {
  if (!Array.isArray(operatingCashFlow) || !Array.isArray(capitalExpenditures)) {
    return [];
  }

  // Detect whether inputs represent quarterly data
  const isQuarterlyItem = (item) => {
    if (!item) return false;
    if (item.fiscalQuarter != null) return true;
    if (item.fp && item.fp !== 'FY') return true;
    if (item.form && item.form.includes('10-Q')) return true;
    if (typeof item.frame === 'string' && /Q[1-4]/i.test(item.frame)) return true;
    if (typeof item.period === 'string' && /Q[1-4]/i.test(item.period)) return true;
    return false;
  };

  const hasDuplicateYears = (arr) => {
    const seen = new Set();
    for (const item of arr) {
      if (item?.fiscalYear != null) {
        if (seen.has(item.fiscalYear)) return true;
        seen.add(item.fiscalYear);
      }
    }
    return false;
  };

  const isQuarterly =
    operatingCashFlow.some(isQuarterlyItem) ||
    capitalExpenditures.some(isQuarterlyItem) ||
    hasDuplicateYears(operatingCashFlow) ||
    hasDuplicateYears(capitalExpenditures);

  const getMatchKey = (item) => {
    if (!item) return null;
    if (isQuarterly) {
      if (item.frame) return item.frame;
      if (item.fiscalYear != null) {
        const sub = item.fp || (item.fiscalQuarter != null ? `Q${item.fiscalQuarter}` : null) || item.end || item.period;
        return sub ? `${item.fiscalYear}_${sub}` : String(item.fiscalYear);
      }
      return item.period || item.end || null;
    }
    return item.fiscalYear != null ? item.fiscalYear : (item.period || item.end || null);
  };

  // Create a map of CapEx by period key
  const capexByKey = new Map();
  capitalExpenditures.forEach(item => {
    const key = getMatchKey(item);
    if (key != null && isValidNumber(item.value)) {
      capexByKey.set(key, item.value);
    }
  });

  // Calculate FCF for each OCF period
  return operatingCashFlow
    .filter(ocf => {
      const key = getMatchKey(ocf);
      const capex = key != null ? capexByKey.get(key) : undefined;
      return isValidNumber(ocf.value) && isValidNumber(capex);
    })
    .map(ocf => {
      const key = getMatchKey(ocf);
      const capex = capexByKey.get(key);
      const fcf = ocf.value - Math.abs(capex);

      return {
        value: fcf,
        period: ocf.period,
        fiscalYear: ocf.fiscalYear,
        fiscalQuarter: ocf.fiscalQuarter,
        filedDate: ocf.filedDate,
        form: ocf.form,
        confidence: 'medium', // Calculated metric, not directly from filing
        calculated: true,
        components: {
          operatingCashFlow: ocf.value,
          capitalExpenditures: Math.abs(capex),
        },
      };
    });
}

/**
 * Detects whether a time series represents quarterly data (without misclassifying
 * annual balance sheet instant frames like CY2023Q4I as quarterly).
 * @param {Array<Object>} series
 * @returns {boolean}
 * @private
 */
function hasQuarterlyEntries(series) {
  if (!Array.isArray(series) || series.length === 0) return false;
  const seenYears = new Set();
  for (const item of series) {
    if (!item) continue;
    if (item.fiscalQuarter != null) return true;
    if (item.fp && item.fp !== 'FY') return true;
    if (item.form && QUARTERLY_FORMS.includes(item.form)) return true;
    if (typeof item.frame === 'string' && /^CY\d{4}Q([1-4]|[1-3]I)$/.test(item.frame)) return true;
    if (typeof item.period === 'string' && /^CY\d{4}Q([1-4]|[1-3]I)$/.test(item.period)) return true;
    if (item.fiscalYear != null) {
      if (seenYears.has(item.fiscalYear)) return true;
      seenYears.add(item.fiscalYear);
    }
  }
  return false;
}

/**
 * Resolves a matching period key for derived metric joins.
 * @param {Object} item
 * @param {boolean} isQuarterly
 * @returns {string|number|null}
 * @private
 */
function getDerivedMatchKey(item, isQuarterly) {
  if (!item) return null;
  if (isQuarterly) {
    if (item.frame) return item.frame;
    if (item.period) return item.period;
    if (item.fiscalYear != null && item.fiscalQuarter != null) {
      return `${item.fiscalYear}_Q${item.fiscalQuarter}`;
    }
    return item.end || null;
  }
  return item.fiscalYear != null ? item.fiscalYear : (item.period || item.end || null);
}

/**
 * Sorts derived time series most-recent-first.
 * @param {Array<Object>} items
 * @returns {Array<Object>}
 * @private
 */
function sortDerivedSeriesDescending(items) {
  return items.sort((a, b) => {
    const yearDiff = (b.fiscalYear ?? 0) - (a.fiscalYear ?? 0);
    if (yearDiff !== 0) return yearDiff;
    const quarterDiff = (b.fiscalQuarter ?? 0) - (a.fiscalQuarter ?? 0);
    if (quarterDiff !== 0) return quarterDiff;
    return String(b.frame || b.period || '').localeCompare(String(a.frame || a.period || ''));
  });
}

/**
 * Calculates derived Total Liabilities = Total Assets - Stockholders' Equity
 * when direct Total Liabilities XBRL tags are absent.
 *
 * @param {Array<Object>} totalAssetsSeries - Total assets time series
 * @param {Array<Object>} equitySeries - Stockholders' equity time series
 * @param {Object} [options={}]
 * @param {'annual'|'quarterly'} [options.periodType]
 * @returns {Array<Object>} Derived total liabilities time series
 */
export function calculateDerivedTotalLiabilities(totalAssetsSeries, equitySeries, options = {}) {
  if (!Array.isArray(totalAssetsSeries) || !Array.isArray(equitySeries)) {
    return [];
  }

  const isQuarterly =
    options?.periodType === 'quarterly'
      ? true
      : options?.periodType === 'annual'
      ? false
      : hasQuarterlyEntries(totalAssetsSeries) || hasQuarterlyEntries(equitySeries);

  const equityByKey = new Map();
  for (const item of equitySeries) {
    const key = getDerivedMatchKey(item, isQuarterly);
    if (key != null && isValidNumber(item.value) && !equityByKey.has(key)) {
      equityByKey.set(key, item);
    }
  }

  const derived = [];
  const seenKeys = new Set();
  for (const assets of totalAssetsSeries) {
    const key = getDerivedMatchKey(assets, isQuarterly);
    if (key == null || seenKeys.has(key) || !isValidNumber(assets.value)) continue;
    const equity = equityByKey.get(key);
    if (!equity || !isValidNumber(equity.value)) continue;

    seenKeys.add(key);
    derived.push({
      value: assets.value - equity.value,
      period: assets.period,
      frame: assets.frame || null,
      fiscalYear: assets.fiscalYear,
      fiscalQuarter: assets.fiscalQuarter ?? null,
      filedDate: assets.filedDate ?? null,
      form: assets.form,
      confidence: 'medium',
      calculated: true,
      components: {
        totalAssets: assets.value,
        stockholdersEquity: equity.value,
      },
    });
  }

  return sortDerivedSeriesDescending(derived);
}

/**
 * Calculates derived Total Debt = (shortTermDebt ?? 0) + (longTermDebt ?? 0)
 * for periods where at least one debt component is a valid finite number.
 *
 * @param {Array<Object>} shortTermDebtSeries - Short-term debt time series
 * @param {Array<Object>} longTermDebtSeries - Long-term debt time series
 * @param {Object} [options={}]
 * @param {'annual'|'quarterly'} [options.periodType]
 * @returns {Array<Object>} Derived total debt time series
 */
export function calculateDerivedTotalDebt(shortTermDebtSeries, longTermDebtSeries, options = {}) {
  const shortList = Array.isArray(shortTermDebtSeries) ? shortTermDebtSeries : [];
  const longList = Array.isArray(longTermDebtSeries) ? longTermDebtSeries : [];
  if (shortList.length === 0 && longList.length === 0) {
    return [];
  }

  const isQuarterly =
    options?.periodType === 'quarterly'
      ? true
      : options?.periodType === 'annual'
      ? false
      : hasQuarterlyEntries(shortList) || hasQuarterlyEntries(longList);

  const byKey = new Map();
  for (const item of shortList) {
    const key = getDerivedMatchKey(item, isQuarterly);
    if (key == null || !isValidNumber(item.value)) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { short: item, long: null });
    }
  }

  for (const item of longList) {
    const key = getDerivedMatchKey(item, isQuarterly);
    if (key == null || !isValidNumber(item.value)) continue;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.long) existing.long = item;
    } else {
      byKey.set(key, { short: null, long: item });
    }
  }

  const derived = [];
  for (const { short, long } of byKey.values()) {
    const template = long || short;
    const shortVal = short ? short.value : null;
    const longVal = long ? long.value : null;

    derived.push({
      value: (shortVal ?? 0) + (longVal ?? 0),
      period: template.period,
      frame: template.frame || null,
      fiscalYear: template.fiscalYear,
      fiscalQuarter: template.fiscalQuarter ?? null,
      filedDate: template.filedDate ?? null,
      form: template.form,
      confidence: 'medium',
      calculated: true,
      components: {
        shortTermDebt: shortVal,
        longTermDebt: longVal,
      },
    });
  }

  return sortDerivedSeriesDescending(derived);
}

/**
 * Gets the most recent value for a metric
 *
 * @param {Object} metric - Metric object with annual/quarterly arrays
 * @param {'annual'|'quarterly'} [preference='annual'] - Preferred period type
 * @returns {{ value: number, period: string, fiscalYear: number }|null}
 *
 * @example
 * const latest = getLatestValue(normalizedData.metrics.revenue);
 * console.log(`Latest revenue: ${latest.value}`);
 */
export function getLatestValue(metric, preference = 'annual') {
  if (!metric) return null;

  // Try preferred period type first
  const preferredData = metric[preference];
  if (Array.isArray(preferredData) && preferredData.length > 0) {
    const latest = preferredData[0]; // Already sorted most recent first
    return {
      value: latest.value,
      period: latest.period,
      fiscalYear: latest.fiscalYear,
    };
  }

  // Fall back to other period type
  const fallbackType = preference === 'annual' ? 'quarterly' : 'annual';
  const fallbackData = metric[fallbackType];
  if (Array.isArray(fallbackData) && fallbackData.length > 0) {
    const latest = fallbackData[0];
    return {
      value: latest.value,
      period: latest.period,
      fiscalYear: latest.fiscalYear,
    };
  }

  return null;
}

/**
 * Gets annual values for a specified number of years
 *
 * @param {Object} metric - Metric object with annual array
 * @param {number} [years=5] - Number of years to retrieve
 * @returns {Array<{ value: number, fiscalYear: number }>}
 *
 * @example
 * const fiveYearRevenue = getAnnualValues(normalizedData.metrics.revenue, 5);
 */
export function getAnnualValues(metric, years = 5) {
  if (!metric?.annual || !Array.isArray(metric.annual)) {
    return [];
  }

  return metric.annual
    .slice(0, years)
    .map(item => ({
      value: item.value,
      fiscalYear: item.fiscalYear,
    }));
}

/**
 * Gets quarterly values for a specified number of quarters
 *
 * @param {Object} metric - Metric object with quarterly array
 * @param {number} [quarters=8] - Number of quarters to retrieve
 * @returns {Array<{ value: number, fiscalYear: number, fiscalQuarter: number }>}
 *
 * @example
 * const twoYearQuarters = getQuarterlyValues(normalizedData.metrics.revenue, 8);
 */
export function getQuarterlyValues(metric, quarters = 8) {
  if (!metric?.quarterly || !Array.isArray(metric.quarterly)) {
    return [];
  }

  return metric.quarterly
    .slice(0, quarters)
    .map(item => ({
      value: item.value,
      fiscalYear: item.fiscalYear,
      fiscalQuarter: item.fiscalQuarter,
    }));
}

// =============================================================================
// Tag Stitching
// =============================================================================

/**
 * Extracts annual time series for a metric, stitching data from older XBRL tag
 * eras when the primary tag returns fewer than maxPeriods points.
 *
 * @param {Object} companyFacts - Raw SEC Company Facts JSON
 * @param {string} metricName - Standard metric name
 * @param {'annual'|'quarterly'} periodType
 * @param {Object} [options={}]
 * @returns {{ data: Array, stitched: boolean }} data sorted by fiscalYear descending;
 *   stitched is true when the primary tag was short and older era tags were scanned.
 */
export function stitchTimeSeriesData(companyFacts, metricName, periodType, options = {}) {
  const {
    fullHistory = false,
    maxPeriods = fullHistory ? Infinity : (periodType === 'annual' ? ANNUAL_YEARS : QUARTERLY_PERIODS),
  } = options || {};

  const primaryTag = findGaapTag(companyFacts, metricName);
  if (!primaryTag) return { data: [], stitched: false };

  const primaryData = extractTimeSeriesData(primaryTag.data, periodType, {
    ...options,
    tagIndex: primaryTag.index,
    fullHistory: true,
    maxPeriods: Infinity,
  });

  if (!fullHistory && primaryData.length >= maxPeriods) {
    return { data: primaryData.slice(0, maxPeriods), stitched: false };
  }

  const taxonomy = resolveActiveTaxonomy(companyFacts);
  if (!taxonomy) {
    const data = (fullHistory || maxPeriods === Infinity) ? primaryData : primaryData.slice(0, maxPeriods);
    return { data, stitched: false };
  }

  const allTags = taxonomy.tagMap[metricName] || [];
  const activeFacts = taxonomy.factsMap;
  const coveredYears = new Set(primaryData.map(d => d.fiscalYear));
  const merged = [...primaryData];

  for (let i = 0; i < allTags.length; i++) {
    const tag = allTags[i];
    if (tag === primaryTag.tag) continue;
    if (!activeFacts[tag]?.units) continue;

    const extraData = extractTimeSeriesData(activeFacts[tag], periodType, {
      ...options,
      tagIndex: i,
      fullHistory: true,
      maxPeriods: Infinity,
    });
    for (const point of extraData) {
      if (!coveredYears.has(point.fiscalYear)) {
        merged.push(point);
        coveredYears.add(point.fiscalYear);
      }
    }

    if (!fullHistory && merged.length >= maxPeriods) break;
  }

  merged.sort((a, b) => (b.fiscalYear ?? 0) - (a.fiscalYear ?? 0));
  const data = (fullHistory || maxPeriods === Infinity) ? merged : merged.slice(0, maxPeriods);
  const stitched = merged.length > primaryData.length;
  return { data, stitched };
}

// =============================================================================
// Main Normalization Function
// =============================================================================

/**
 * Detects the reporting currency from a companyfacts JSON blob.
 * Checks us-gaap first, then ifrs-full, returns first 3-letter uppercase
 * currency code found. Falls back to 'USD'.
 * @param {Object} companyFactsJson
 * @returns {string} ISO 4217 currency code
 */
export function detectFilingCurrency(companyFactsJson) {
  const facts = companyFactsJson?.facts;
  if (!facts) return DEFAULT_CURRENCY;

  // Prefer the active namespace (`us-gaap` if non-empty, else `ifrs-full`)
  for (const namespaceKey of [GAAP_NAMESPACE, IFRS_NAMESPACE]) {
    const namespace = facts[namespaceKey];
    if (!namespace || Object.keys(namespace).length === 0) continue;

    const counts = new Map();
    let bestCurrency = null;
    let bestCount = -1;

    for (const tag of Object.values(namespace)) {
      for (const [unit, arr] of Object.entries(tag?.units ?? {})) {
        if (/^[A-Z]{3}$/.test(unit)) {
          const weight = Array.isArray(arr) && arr.length > 0 ? arr.length : 1;
          const next = (counts.get(unit) || 0) + weight;
          counts.set(unit, next);
          if (next > bestCount) {
            bestCount = next;
            bestCurrency = unit;
          }
        }
      }
    }
    if (bestCurrency) return bestCurrency;
  }
  return DEFAULT_CURRENCY;
}

/**
 * Normalizes raw SEC Company Facts JSON into standardized financial metrics
 *
 * This is the main entry point for normalization. It:
 * 1. Maps GAAP tags to standard metric names
 * 2. Extracts annual and quarterly time series
 * 3. Calculates derived metrics (e.g., Free Cash Flow)
 * 4. Returns a consistent structure regardless of which GAAP tags the company uses
 *
 * @param {Object} companyFactsJson - Raw SEC Company Facts JSON
 * @returns {{
 *   ticker: string,
 *   cik: string,
 *   companyName: string,
 *   metrics: Object<string, { annual: Array, quarterly: Array, tag: string|null }>,
 *   metadata: {
 *     fiscalYearEnd: string|null,
 *     currency: string,
 *     normalized: boolean,
 *     normalizationVersion: number,
 *     normalizedAt: string,
 *     metricsFound: number,
 *     metricsTotal: number,
 *     missingMetrics: string[]
 *   }
 * }}
 *
 * @example
 * const { facts } = await fetchCompanyFactsByTicker('AAPL');
 * const normalized = normalizeCompanyFacts(facts);
 *
 * // Access standardized metrics
 * console.log(normalized.metrics.revenue.annual[0].value); // Latest annual revenue
 * console.log(normalized.metrics.netIncome.quarterly); // Last 20 quarters of net income
 * console.log(normalized.metrics.freeCashFlow.annual); // Calculated FCF
 */
export function normalizeCompanyFacts(companyFactsJson, options = {}) {
  if (!companyFactsJson) {
    throw new Error('Company facts JSON is required');
  }

  if (companyFactsJson.metadata?.normalized === true) {
    return companyFactsJson;
  }

  const fullHistory = options?.fullHistory === true;
  const taxonomy = resolveActiveTaxonomy(companyFactsJson);
  const accountingStandard = taxonomy ? taxonomy.accountingStandard : 'US-GAAP';
  const filingCurrency = detectFilingCurrency(companyFactsJson);
  const normOptions = {
    ...options,
    preferredCurrency: filingCurrency,
  };

  // Extract basic company info
  const ticker = companyFactsJson.ticker || '';
  const cik = companyFactsJson.cik ? String(companyFactsJson.cik).padStart(10, '0') : '';
  const companyName = companyFactsJson.entityName || '';

  // Initialize metrics object
  const metrics = {};
  const missingMetrics = [];
  let metricsFound = 0;

  // Process all standard metrics
  const allMetrics = Object.keys(taxonomy ? taxonomy.tagMap : GAAP_TAG_MAP);
  let anyStitched = false;

  for (const metricName of allMetrics) {
    const tagResult = findGaapTag(companyFactsJson, metricName);

    if (tagResult) {
      // Extract time series for both annual and quarterly
      const { data: annual, stitched } = stitchTimeSeriesData(companyFactsJson, metricName, 'annual', {
        ...normOptions,
        tagIndex: tagResult.index,
        fullHistory,
        maxPeriods: fullHistory ? Infinity : (options?.maxPeriods ?? ANNUAL_YEARS),
      });
      if (stitched) anyStitched = true;
      const quarterly = extractTimeSeriesData(tagResult.data, 'quarterly', {
        ...normOptions,
        tagIndex: tagResult.index,
        fullHistory,
        maxPeriods: fullHistory ? Infinity : (options?.maxPeriods ?? QUARTERLY_PERIODS),
      });

      metrics[metricName] = {
        annual,
        quarterly,
        tag: tagResult.tag, // Store which tag was used (useful for debugging)
      };

      if (annual.length > 0 || quarterly.length > 0) {
        metricsFound++;
      } else {
        // Tag exists but no usable data
        missingMetrics.push(metricName);
      }
    } else {
      // No matching tag found
      metrics[metricName] = {
        annual: [],
        quarterly: [],
        tag: null,
      };
      missingMetrics.push(metricName);
    }
  }

  // Helper to replace an empty primary metric with a fallback/derived metric
  const markMetricResolved = (metricName, resolvedMetric) => {
    metrics[metricName] = resolvedMetric;
    const missingIdx = missingMetrics.indexOf(metricName);
    if (missingIdx !== -1) {
      missingMetrics.splice(missingIdx, 1);
    }
    metricsFound++;
  };

  // Cash-basis fallback for interestExpense ONLY if accrual tags yielded zero points
  if (
    taxonomy?.namespace === GAAP_NAMESPACE &&
    metrics.interestExpense &&
    metrics.interestExpense.annual.length === 0 &&
    metrics.interestExpense.quarterly.length === 0
  ) {
    for (const fallbackTag of INTEREST_EXPENSE_CASH_FALLBACK_TAGS) {
      const fallbackData = taxonomy.factsMap[fallbackTag];
      if (!fallbackData?.units) continue;

      const fallbackAnnual = extractTimeSeriesData(fallbackData, 'annual', {
        ...normOptions,
        tagIndex: 2,
        fullHistory,
        maxPeriods: fullHistory ? Infinity : (options?.maxPeriods ?? ANNUAL_YEARS),
      });
      const fallbackQuarterly = extractTimeSeriesData(fallbackData, 'quarterly', {
        ...normOptions,
        tagIndex: 2,
        fullHistory,
        maxPeriods: fullHistory ? Infinity : (options?.maxPeriods ?? QUARTERLY_PERIODS),
      });

      if (fallbackAnnual.length > 0 || fallbackQuarterly.length > 0) {
        markMetricResolved('interestExpense', {
          annual: fallbackAnnual,
          quarterly: fallbackQuarterly,
          tag: fallbackTag,
          isCashFallback: true,
        });
        break;
      }
    }
  }

  // Calculate derived metrics
  // Total Liabilities fallback = Total Assets - Stockholders' Equity
  if (
    metrics.totalLiabilities &&
    metrics.totalLiabilities.annual.length === 0 &&
    metrics.totalLiabilities.quarterly.length === 0 &&
    metrics.totalAssets &&
    metrics.stockholdersEquity
  ) {
    const derivedLiabAnnual = calculateDerivedTotalLiabilities(
      metrics.totalAssets.annual,
      metrics.stockholdersEquity.annual,
      { periodType: 'annual' }
    );
    const derivedLiabQuarterly = calculateDerivedTotalLiabilities(
      metrics.totalAssets.quarterly,
      metrics.stockholdersEquity.quarterly,
      { periodType: 'quarterly' }
    );

    if (derivedLiabAnnual.length > 0 || derivedLiabQuarterly.length > 0) {
      markMetricResolved('totalLiabilities', {
        annual: derivedLiabAnnual,
        quarterly: derivedLiabQuarterly,
        tag: null,
        calculated: true,
      });
    }
  }

  // Total Debt fallback = Short-Term Debt + Long-Term Debt
  if (
    metrics.totalDebt &&
    metrics.totalDebt.annual.length === 0 &&
    metrics.totalDebt.quarterly.length === 0 &&
    (metrics.shortTermDebt || metrics.longTermDebt)
  ) {
    const derivedDebtAnnual = calculateDerivedTotalDebt(
      metrics.shortTermDebt?.annual || [],
      metrics.longTermDebt?.annual || [],
      { periodType: 'annual' }
    );
    const derivedDebtQuarterly = calculateDerivedTotalDebt(
      metrics.shortTermDebt?.quarterly || [],
      metrics.longTermDebt?.quarterly || [],
      { periodType: 'quarterly' }
    );

    if (derivedDebtAnnual.length > 0 || derivedDebtQuarterly.length > 0) {
      markMetricResolved('totalDebt', {
        annual: derivedDebtAnnual,
        quarterly: derivedDebtQuarterly,
        tag: null,
        calculated: true,
      });
    }
  }

  // Free Cash Flow = Operating Cash Flow - Capital Expenditures
  if (metrics.operatingCashFlow && metrics.capitalExpenditures) {
    const fcfAnnual = calculateFreeCashFlow(
      metrics.operatingCashFlow.annual,
      metrics.capitalExpenditures.annual
    );
    const fcfQuarterly = calculateFreeCashFlow(
      metrics.operatingCashFlow.quarterly,
      metrics.capitalExpenditures.quarterly
    );

    metrics.freeCashFlow = {
      annual: fcfAnnual,
      quarterly: fcfQuarterly,
      tag: null, // Calculated, not from a single tag
      calculated: true,
    };

    if (fcfAnnual.length > 0 || fcfQuarterly.length > 0) {
      metricsFound++;
    } else {
      missingMetrics.push('freeCashFlow');
    }
  } else {
    metrics.freeCashFlow = {
      annual: [],
      quarterly: [],
      tag: null,
      calculated: true,
    };
    missingMetrics.push('freeCashFlow');
  }

  // Try to determine fiscal year end from the data
  let fiscalYearEnd = null;
  let fiscalYearEndDefaulted = false;
  const revenueData = metrics.revenue?.annual?.[0];
  if (revenueData?.period) {
    // Extract from frame like CY2023I4 or end date
    fiscalYearEnd = revenueData.period;
  }

  // P1 #13: Default fiscal year end to December 31 if missing
  if (!fiscalYearEnd) {
    fiscalYearEnd = '12-31';
    fiscalYearEndDefaulted = true;
    devLog('log', 'Fiscal year end not found, defaulting to 12-31');
  }

  // P0 #5: Detect pre-revenue companies
  const isPreRevenue = (() => {
    const revMetric = metrics.revenue;
    if (!revMetric) return true;
    const hasAnnualRevenue = revMetric.annual?.some(d => d.value !== 0);
    const hasQuarterlyRevenue = revMetric.quarterly?.some(d => d.value !== 0);
    return !hasAnnualRevenue && !hasQuarterlyRevenue;
  })();

  // P0 #6: Detect negative equity (potential bankruptcy)
  const hasNegativeEquity = (() => {
    const equityMetric = metrics.stockholdersEquity;
    if (!equityMetric) return false;
    const latestAnnual = equityMetric.annual?.[0];
    const latestQuarterly = equityMetric.quarterly?.[0];
    const latestValue = latestAnnual?.value ?? latestQuarterly?.value ?? null;
    return latestValue !== null && latestValue < 0;
  })();

  // P1 #15: Detect missing shares outstanding
  const missingShares = (() => {
    const sharesMetric = metrics.sharesOutstanding;
    if (!sharesMetric) return true;
    return sharesMetric.annual?.length === 0 && sharesMetric.quarterly?.length === 0;
  })();

  // Build warnings array
  const warnings = [];
  if (accountingStandard === 'IFRS') {
    warnings.push(`IFRS filer (Form 20-F) — financials reported in ${filingCurrency}`);
  }
  if (BANK_REVENUE_TAGS.includes(metrics.revenue?.tag)) {
    warnings.push('Bank/fintech revenue tag used — total revenue includes interest income');
  }

  if (anyStitched) {
    warnings.push('Tag stitching applied — historical data merged from multiple XBRL era tags');
  }

  if (isPreRevenue) {
    warnings.push('Company appears to be pre-revenue (revenue is zero or missing)');
  }
  if (hasNegativeEquity) {
    warnings.push('Company has negative stockholders equity - may indicate financial distress');
  }
  if (missingShares) {
    warnings.push('Shares outstanding data is missing - EPS calculations unavailable');
  }
  if (fiscalYearEndDefaulted) {
    warnings.push('Fiscal year end not found in data - defaulted to December 31');
  }

  return {
    ticker,
    cik,
    companyName,
    metrics,
    metadata: {
      fiscalYearEnd,
      fiscalYearEndDefaulted,
      currency: filingCurrency,
      accountingStandard,
      normalized: true,
      normalizationVersion: NORMALIZATION_VERSION,
      normalizedAt: new Date().toISOString(),
      metricsFound,
      metricsTotal: allMetrics.length + 1, // +1 for freeCashFlow
      missingMetrics,
      isPreRevenue,
      hasNegativeEquity,
      missingShares,
      warnings,
    },
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets a summary of available metrics for a company
 *
 * @param {Object} normalizedData - Output from normalizeCompanyFacts
 * @returns {Object<string, { hasAnnual: boolean, hasQuarterly: boolean, tag: string|null }>}
 *
 * @example
 * const summary = getMetricsSummary(normalizedData);
 * console.log('Available metrics:', Object.keys(summary).filter(k => summary[k].hasAnnual));
 */
export function getMetricsSummary(normalizedData) {
  if (!normalizedData?.metrics) {
    return {};
  }

  const summary = {};

  for (const [name, data] of Object.entries(normalizedData.metrics)) {
    summary[name] = {
      hasAnnual: Array.isArray(data.annual) && data.annual.length > 0,
      hasQuarterly: Array.isArray(data.quarterly) && data.quarterly.length > 0,
      tag: data.tag,
      calculated: data.calculated || false,
    };
  }

  return summary;
}

/**
 * Gets metrics grouped by category
 *
 * @param {Object} normalizedData - Output from normalizeCompanyFacts
 * @returns {Object<string, Object>} Metrics grouped by METRIC_CATEGORIES
 *
 * @example
 * const grouped = getMetricsByCategory(normalizedData);
 * console.log('Income statement metrics:', grouped.incomeStatement);
 */
export function getMetricsByCategory(normalizedData) {
  if (!normalizedData?.metrics) {
    return {};
  }

  const result = {};

  for (const [category, metricNames] of Object.entries(METRIC_CATEGORIES)) {
    result[category] = {};
    for (const name of metricNames) {
      if (normalizedData.metrics[name]) {
        result[category][name] = normalizedData.metrics[name];
      }
    }
  }

  // Add calculated metrics
  if (normalizedData.metrics.freeCashFlow) {
    result.cashFlow.freeCashFlow = normalizedData.metrics.freeCashFlow;
  }

  return result;
}

/**
 * Validates if company has minimum required metrics for valuation analysis
 *
 * @param {Object} normalizedData - Output from normalizeCompanyFacts
 * @param {string[]} [requiredMetrics=['revenue', 'netIncome', 'operatingCashFlow']] - Required metric names
 * @returns {{ isValid: boolean, missing: string[], available: string[] }}
 *
 * @example
 * const validation = validateRequiredMetrics(normalizedData);
 * if (!validation.isValid) {
 *   console.warn('Missing required metrics:', validation.missing);
 * }
 */
export function validateRequiredMetrics(normalizedData, requiredMetrics = ['revenue', 'netIncome', 'operatingCashFlow']) {
  if (!normalizedData?.metrics) {
    return {
      isValid: false,
      missing: requiredMetrics,
      available: [],
    };
  }

  const available = [];
  const missing = [];

  for (const metric of requiredMetrics) {
    const data = normalizedData.metrics[metric];
    const hasData = data?.annual?.length > 0 || data?.quarterly?.length > 0;

    if (hasData) {
      available.push(metric);
    } else {
      missing.push(metric);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    available,
  };
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * GAAP Tag Normalizer Module
 * @namespace
 */
export default {
  // Main functions
  normalizeCompanyFacts,
  detectFilingCurrency,
  findGaapTag,
  extractTimeSeriesData,
  stitchTimeSeriesData,

  // Calculated metrics
  calculateFreeCashFlow,
  calculateDerivedTotalLiabilities,
  calculateDerivedTotalDebt,

  // Accessors
  getLatestValue,
  getAnnualValues,
  getQuarterlyValues,

  // Utilities
  getMetricsSummary,
  getMetricsByCategory,
  validateRequiredMetrics,

  // Constants
  GAAP_TAG_MAP,
  IFRS_TAG_MAP,
  METRIC_CATEGORIES,
  INTEREST_EXPENSE_CASH_FALLBACK_TAGS,
  BANK_REVENUE_TAGS,
  NORMALIZATION_VERSION,
  getCurrencySymbol,
};
