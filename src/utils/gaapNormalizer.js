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
export const NORMALIZATION_VERSION = 1;

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
const ANNUAL_FORMS = ['10-K', '10-K/A'];

/**
 * Forms used for quarterly filings
 * @constant {string[]}
 */
const QUARTERLY_FORMS = ['10-Q', '10-Q/A'];

// =============================================================================
// GAAP Tag Mappings
// =============================================================================

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

  /** Interest expense */
  interestExpense: [
    'InterestExpense',
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
    'CapitalExpendituresIncurredButNotYetPaid',
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
    'IntangibleAssetsNetIncludingGoodwill',
  ],

  // -------------------------------------------------------------------------
  // Balance Sheet - Liabilities
  // -------------------------------------------------------------------------

  /** Total liabilities */
  totalLiabilities: [
    'Liabilities',
    'LiabilitiesAndStockholdersEquity',
  ],

  /** Current liabilities */
  currentLiabilities: [
    'LiabilitiesCurrent',
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
    'LongTermDebtAndCapitalLeaseObligationsCurrent',
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
  if (import.meta.env.DEV) {
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
export function findGaapTag(companyFacts, metricName) {
  const tags = GAAP_TAG_MAP[metricName];

  if (!tags || !Array.isArray(tags)) {
    devLog('warn', `Unknown metric: ${metricName}`);
    return null;
  }

  const usGaap = companyFacts?.facts?.['us-gaap'];

  if (!usGaap) {
    devLog('warn', 'No us-gaap facts found in company data');
    return null;
  }

  // Try each tag in priority order
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (usGaap[tag] && usGaap[tag].units) {
      return { tag, data: usGaap[tag], index: i };
    }
  }

  devLog('log', `No matching tag found for metric: ${metricName}`);
  return null;
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
export function extractTimeSeriesData(gaapTagData, periodType, options = {}) {
  const {
    maxPeriods = periodType === 'annual' ? ANNUAL_YEARS : QUARTERLY_PERIODS,
    tagIndex = 0,
  } = options;

  if (!gaapTagData?.units) {
    return [];
  }

  // Get USD data (most common), fall back to shares for share-based metrics
  const unitData = gaapTagData.units.USD ||
                   gaapTagData.units.shares ||
                   gaapTagData.units['USD/shares'] ||
                   Object.values(gaapTagData.units)[0];

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

    // For annual, prefer full-year periods (frame ends in I4 or CY[year])
    if (periodType === 'annual') {
      // Check frame pattern for annual data
      // Frames like CY2023 or CY2023I4 indicate full year
      if (item.frame) {
        const isFullYear = /^CY\d{4}(I4)?$/.test(item.frame);
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

  // Sort by end date (most recent first)
  const sortedData = filteredData.sort((a, b) => {
    const dateA = parseDate(a.end) || parseDate(a.filed);
    const dateB = parseDate(b.end) || parseDate(b.filed);
    if (!dateA || !dateB) return 0;
    return dateB.getTime() - dateA.getTime();
  });

  // Deduplicate by period (keep most recent filing for each period)
  const seenPeriods = new Set();
  const deduplicatedData = sortedData.filter(item => {
    const period = item.frame || item.end;
    if (seenPeriods.has(period)) {
      return false;
    }
    seenPeriods.add(period);
    return true;
  });

  // Limit to requested number of periods
  const limitedData = deduplicatedData.slice(0, maxPeriods);

  // Transform to standardized format
  return limitedData.map(item => ({
    value: item.val,
    period: item.frame || item.end,
    fiscalYear: extractFiscalYear(item.end),
    fiscalQuarter: periodType === 'quarterly' ? extractFiscalQuarter(item.end) : null,
    filedDate: item.filed || null,
    form: item.form,
    confidence: determineConfidence(item, '', tagIndex),
  }));
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

  // Create a map of CapEx by fiscal year
  const capexByYear = new Map();
  capitalExpenditures.forEach(item => {
    if (item.fiscalYear && isValidNumber(item.value)) {
      capexByYear.set(item.fiscalYear, item.value);
    }
  });

  // Calculate FCF for each OCF period
  return operatingCashFlow
    .filter(ocf => {
      const capex = capexByYear.get(ocf.fiscalYear);
      return isValidNumber(ocf.value) && isValidNumber(capex);
    })
    .map(ocf => {
      // CapEx is typically negative, so we add it (subtract the absolute value)
      const capex = capexByYear.get(ocf.fiscalYear);
      // If CapEx is already negative, adding gives FCF = OCF + (-CapEx) = OCF - CapEx
      // If CapEx is positive (unusual), we still subtract: FCF = OCF - abs(CapEx)
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
// Main Normalization Function
// =============================================================================

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
export function normalizeCompanyFacts(companyFactsJson) {
  if (!companyFactsJson) {
    throw new Error('Company facts JSON is required');
  }

  // Extract basic company info
  const ticker = companyFactsJson.ticker || '';
  const cik = companyFactsJson.cik ? String(companyFactsJson.cik).padStart(10, '0') : '';
  const companyName = companyFactsJson.entityName || '';

  // Initialize metrics object
  const metrics = {};
  const missingMetrics = [];
  let metricsFound = 0;

  // Process all standard metrics
  const allMetrics = Object.keys(GAAP_TAG_MAP);

  for (const metricName of allMetrics) {
    const tagResult = findGaapTag(companyFactsJson, metricName);

    if (tagResult) {
      // Extract time series for both annual and quarterly
      const annual = extractTimeSeriesData(tagResult.data, 'annual', {
        tagIndex: tagResult.index,
      });
      const quarterly = extractTimeSeriesData(tagResult.data, 'quarterly', {
        tagIndex: tagResult.index,
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

  // Calculate derived metrics
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
  const revenueData = metrics.revenue?.annual?.[0];
  if (revenueData?.period) {
    // Extract from frame like CY2023I4 or end date
    fiscalYearEnd = revenueData.period;
  }

  return {
    ticker,
    cik,
    companyName,
    metrics,
    metadata: {
      fiscalYearEnd,
      currency: 'USD',
      normalized: true,
      normalizationVersion: NORMALIZATION_VERSION,
      normalizedAt: new Date().toISOString(),
      metricsFound,
      metricsTotal: allMetrics.length + 1, // +1 for freeCashFlow
      missingMetrics,
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
  findGaapTag,
  extractTimeSeriesData,

  // Calculated metrics
  calculateFreeCashFlow,

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
  METRIC_CATEGORIES,
  NORMALIZATION_VERSION,
};
