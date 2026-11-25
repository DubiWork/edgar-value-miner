/**
 * Inversion & Red-Flag Engine (Step 1 — "Guilty Until Proven Innocent")
 *
 * Archetype-aware quantitative + qualitative red-flag detector implementing:
 * - Locked A1 Guardrails:
 *   1. Buyback Cannibals (negative/thin book equity from buybacks with strong cash & coverage)
 *   2. SaaS Deferred Revenue (adjusted Current Ratio excluding prepaid unearned revenue)
 * - Locked A2 Financial Spread Split:
 *   - DEPOSIT_BANK (Equity/Assets >= 6% cushion, Current Ratio N/A)
 *   - NON_BANK_FINANCE (L/E >= 4.5x red, operating interest-adjusted coverage)
 * - Multi-Year (3Y) Resilience Checks:
 *   - 3Y Cumulative Cash Conversion (ΣOCF / ΣNetIncome < 0.85x warn / < 0.80x red)
 *   - 3Y FCF ex-SBC & SBC/Revenue dilution check
 *   - 3Y Debt-Funded Dividends & Buybacks check
 * - Roll-Up / Goodwill Trap (>= 50% assets paired with low ROIC, high debt, or dilution)
 * - Plain-Hebrew educational copy & verified public quotes (Benjamin Graham / Warren Buffett)
 *
 * @module inversionEngine
 */

import { BANK_REVENUE_TAGS, calculateFreeCashFlow } from './gaapNormalizer.js';

// =============================================================================
// Verbatim Public Education Quotes (Graham / Buffett / Quality Compounders)
// =============================================================================

const ATTRIBUTION = {
  buffett: {
    attributionHe: 'מכתבי וורן באפט לבעלי המניות',
    attributionEn: 'Warren Buffett Shareholder Letters',
  },
  graham: {
    attributionHe: 'המשקיע הנבון — בנג׳מין גראהם',
    attributionEn: 'The Intelligent Investor — Benjamin Graham',
  },
  quality: {
    attributionHe: 'מתודולוגיית Quality Compounders / Antifragile',
    attributionEn: 'Quality Compounders / Antifragile Methodology',
  },
};

export const WISDOM_QUOTES = {
  grossMarginFail: {
    ...ATTRIBUTION.graham,
    insightHe: 'בלי רווח גולמי חיובי, כל מכירה נוספת מגדילה את ההפסד.',
    insightEn: 'Without positive gross margin, every extra dollar sold deepens the loss.',
    quoteEn: null,
  },
  revenueDecline: {
    ...ATTRIBUTION.buffett,
    insightHe: 'צמיחה שווה רק כשהיא יוצרת יותר מדולר ערך לכל דולר מושקע.',
    insightEn: 'Growth creates value only when incremental capital earns above its cost.',
    quoteEn: 'Growth benefits investors only when each dollar used to finance the growth creates over a dollar of long-term market value.',
  },
  marginLossYear: {
    ...ATTRIBUTION.graham,
    insightHe: 'חברה שספגה שנת הפסד בעשור האחרון דורשת זהירות כפולה.',
    insightEn: 'A historical loss year violates classic earnings-stability margin of safety.',
    quoteEn: 'No deficit in the last five years covered in the Stock Guide.',
  },
  cyclicalTiptoes: {
    ...ATTRIBUTION.buffett,
    insightHe: 'כשהתעשייה כולה עומדת על קצות האצבעות, היתרון התחרותי מתאפס.',
    insightEn: 'Cyclical capacity booms often neutralize returns across the entire industry.',
    quoteEn: "Viewed individually, each company's capital investment decision appeared cost-effective and rational; viewed collectively, the decisions neutralized each other and were irrational (just as happens when each person watching a parade decides he can see a little better if he stands on tiptoes).",
  },
  cashBurnFinancing: {
    ...ATTRIBUTION.graham,
    insightHe: 'תלות מתמדת בגיוסי הון היא נורת אזהרה למשקיע השמרן.',
    insightEn: 'Consistent negative operating cash flow funded by financing reveals cash dependency.',
    quoteEn: 'If cash from operating activities is consistently negative, while cash from financing activities is consistently positive, the company has a habit of craving more cash than its own businesses can produce.',
  },
  cashConversionQuality: {
    ...ATTRIBUTION.buffett,
    insightHe: 'הרווח החשבונאי הוא רק נקודת ההתחלה — המזומן בפועל קובע.',
    insightEn: 'Accounting earnings are only the starting point; cash conversion is reality.',
    quoteEn: 'Managers and investors alike must understand that accounting numbers are the beginning, not the end, of business valuation.',
  },
  leverageZipWallet: {
    ...ATTRIBUTION.buffett,
    insightHe: 'מינוף שאינו מכוסה בקלות מתזרים שוטף מחייב לסגור את הארנק.',
    insightEn: 'If cash flow cannot comfortably cover interest and CapEx, zip up your wallet.',
    quoteEn: 'Whenever someone creates a capital structure that does not allow all interest... to be comfortably met out of current cash flow net of ample capital expenditures – zip up your wallet.',
  },
  bankLeverage20x: {
    ...ATTRIBUTION.buffett,
    insightHe: 'במינוף בנקאי של פי עשרים, טעות קטנה בנכסים מוחקת את ההון.',
    insightEn: 'At 20:1 bank leverage, even small asset losses rapidly wipe out equity.',
    quoteEn: 'The banking business is no favorite of ours. When assets are twenty times equity — a common ratio in this industry — mistakes that involve only a small portion of assets can destroy a major portion of equity.',
  },
  currentRatio2to1: {
    ...ATTRIBUTION.graham,
    insightHe: 'גראהם דרש נכסים שוטפים כפולים מהתחייבויות שוטפות למרווח ביטחון.',
    insightEn: 'Graham required current assets comfortably exceeding short-term obligations for safety.',
    quoteEn: 'For industrial companies current assets should be at least twice current liabilities.',
  },
  sbcExpense: {
    ...ATTRIBUTION.buffett,
    insightHe: 'תגמול במניות הוא הוצאה כלכלית לכל דבר ולא כסף חינם.',
    insightEn: 'Stock-based compensation is a real economic expense diluting owners.',
    quoteEn: "If options aren't a form of compensation, what are they?",
  },
  dilutionChainLetter: {
    ...ATTRIBUTION.buffett,
    insightHe: 'הנפקת מניות סדרתית שוחקת את חלקך בעוגה שנה אחר שנה.',
    insightEn: 'Persistent share issuance erodes your ownership stake every year.',
    quoteEn: "Wall Street's version of a chain-letter scheme.",
  },
  goodwillNoWill: {
    ...ATTRIBUTION.buffett,
    insightHe: 'תשלום יתר ברכישות מנפח מוניטין שלעיתים ראוי לשם אי-רצון.',
    insightEn: 'Overpaying for acquisitions bloats goodwill without lifting economic returns.',
    quoteEn: "When an overexcited management purchases a business at a silly price, the silliness ends up in the Goodwill account... it might better be labeled 'No-Will'.",
  },
  debtFundedPayouts: {
    ...ATTRIBUTION.buffett,
    insightHe: 'אסור לממן דיבידנדים או בייבאק בהלוואות מעל התזרים החופשי.',
    insightEn: 'Payouts exceeding free cash flow financed with new debt weaken solvency.',
    quoteEn: 'Other companies sell newly issued shares to Peter in order to pay dividends to Paul.',
  },
};

// =============================================================================
// Numeric & Time-Series Helpers
// =============================================================================

function isNum(val) {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
}

/**
 * Extracts deduplicated fiscal-year values sorted ascending (oldest -> newest).
 */
function extractAnnualSeries(metric) {
  const arr = metric?.annual;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const byYear = new Map();
  for (const pt of arr) {
    if (pt && isNum(pt.fiscalYear) && isNum(pt.value)) {
      byYear.set(pt.fiscalYear, pt.value);
    }
  }
  return Array.from(byYear.entries())
    .map(([fiscalYear, value]) => ({ fiscalYear, value }))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
}

function getLatestAndPrior(series) {
  if (!series || series.length === 0) return { latest: null, prior: null };
  return {
    latest: series[series.length - 1],
    prior: series.length >= 2 ? series[series.length - 2] : null,
  };
}

function buildAnnualFcfSeries(metrics) {
  const explicitFcf = extractAnnualSeries(metrics?.freeCashFlow);
  if (explicitFcf.length > 0) return explicitFcf;

  const ocf = extractAnnualSeries(metrics?.operatingCashFlow);
  const capex = extractAnnualSeries(metrics?.capitalExpenditures);
  if (ocf.length === 0 || capex.length === 0) return [];

  const computed = calculateFreeCashFlow(ocf, capex);
  return extractAnnualSeries({ annual: computed });
}

function resolveDerivedLiabilitiesSeries(metrics) {
  const direct = extractAnnualSeries(metrics?.totalLiabilities);
  if (direct.length > 0) return direct;
  const assets = extractAnnualSeries(metrics?.totalAssets);
  const equity = extractAnnualSeries(metrics?.stockholdersEquity);
  if (assets.length === 0 || equity.length === 0) return [];
  const eqByYear = new Map(equity.map((p) => [p.fiscalYear, p.value]));
  return assets
    .filter((a) => eqByYear.has(a.fiscalYear))
    .map((a) => ({ fiscalYear: a.fiscalYear, value: a.value - eqByYear.get(a.fiscalYear) }));
}

function resolveDerivedDebtSeries(metrics) {
  const direct = extractAnnualSeries(metrics?.totalDebt);
  if (direct.length > 0) return direct;
  const st = extractAnnualSeries(metrics?.shortTermDebt);
  const lt = extractAnnualSeries(metrics?.longTermDebt);
  if (st.length === 0 && lt.length === 0) return [];
  const stMap = new Map(st.map((p) => [p.fiscalYear, p.value]));
  const ltMap = new Map(lt.map((p) => [p.fiscalYear, p.value]));
  const years = Array.from(new Set([...stMap.keys(), ...ltMap.keys()])).sort((a, b) => a - b);
  return years.map((yr) => ({
    fiscalYear: yr,
    value: (stMap.get(yr) ?? 0) + (ltMap.get(yr) ?? 0),
  }));
}

function resolveCashTotalSeries(metrics) {
  const cashSeries = extractAnnualSeries(metrics?.cash);
  const stInvSeries = extractAnnualSeries(metrics?.shortTermInvestments);
  const combinedCashTag = metrics?.cash?.tag === 'CashCashEquivalentsAndShortTermInvestments';
  if (cashSeries.length === 0 && stInvSeries.length === 0) return [];
  const cashMap = new Map(cashSeries.map((p) => [p.fiscalYear, p.value]));
  const invMap = new Map(stInvSeries.map((p) => [p.fiscalYear, p.value]));
  const years = Array.from(new Set([...cashMap.keys(), ...invMap.keys()])).sort((a, b) => a - b);
  return years.map((yr) => ({
    fiscalYear: yr,
    value: (cashMap.get(yr) ?? 0) + (combinedCashTag ? 0 : (invMap.get(yr) ?? 0)),
  }));
}

function sumWindow(series, windowYears) {
  if (!series || series.length === 0 || windowYears.length === 0) return null;
  const byYear = new Map(series.map((p) => [p.fiscalYear, p.value]));
  let total = 0;
  let matched = 0;
  for (const yr of windowYears) {
    if (byYear.has(yr)) {
      total += byYear.get(yr);
      matched += 1;
    }
  }
  return matched > 0 ? { total, matched } : null;
}

function formatRatio(val, decimals = 1) {
  return isNum(val) ? `${val.toFixed(decimals)}x` : 'N/A';
}

function formatPct(val, decimals = 1) {
  return isNum(val) ? `${val.toFixed(decimals)}%` : 'N/A';
}

// =============================================================================
// Structured Finding Builders
// =============================================================================

function createFlag({
  id,
  tier,
  category,
  overlapGroup = null,
  source = 'quant',
  badgeHe,
  badgeEn,
  titleHe,
  titleEn,
  valueDisplayHe = null,
  valueDisplayEn = null,
  explanationHe,
  explanationEn,
  quote = null,
  metricsSnapshot = null,
}) {
  const severity = tier === 1 ? 'red' : tier === 2 ? 'yellow' : 'info';
  return {
    id,
    tier,
    severity,
    category,
    ...(overlapGroup ? { overlapGroup } : {}),
    source,
    badgeHe,
    badgeEn,
    titleHe,
    titleEn,
    ...(valueDisplayHe ? { valueDisplayHe } : {}),
    ...(valueDisplayEn ? { valueDisplayEn } : {}),
    explanationHe,
    explanationEn,
    quote: quote ? { ...quote } : null,
    ...(metricsSnapshot ? { metricsSnapshot } : {}),
  };
}

/**
 * Deduplicates overlapping warnings within the same overlapGroup while preserving
 * non-overlapping distinct findings (keeps highest severity: Tier 1 Red > Tier 2 Yellow).
 */
function mergeOverlappingFlags(tier1Red, tier2Yellow) {
  const redGroups = new Set(tier1Red.map((f) => f.overlapGroup).filter(Boolean));
  const seenRed = new Set();
  const dedupedRed = [];
  for (const flag of tier1Red) {
    if (flag.overlapGroup) {
      if (seenRed.has(flag.overlapGroup)) continue;
      seenRed.add(flag.overlapGroup);
    }
    dedupedRed.push(flag);
  }

  const seenYellow = new Set();
  const dedupedYellow = [];
  for (const flag of tier2Yellow) {
    if (flag.overlapGroup) {
      if (redGroups.has(flag.overlapGroup) || seenYellow.has(flag.overlapGroup)) continue;
      seenYellow.add(flag.overlapGroup);
    }
    dedupedYellow.push(flag);
  }

  return { tier1Red: dedupedRed, tier2Yellow: dedupedYellow };
}

// =============================================================================
// Financial Snapshot Extractor
// =============================================================================

function extractFinancialSnapshot(metrics, sharesMetric, archetype, financialSubType) {
  const revSeries = extractAnnualSeries(metrics?.revenue);
  const grossSeries = extractAnnualSeries(metrics?.grossProfit);
  const costRevSeries = extractAnnualSeries(metrics?.costOfRevenue);
  const opIncSeries = extractAnnualSeries(metrics?.operatingIncome);
  const netIncSeries = extractAnnualSeries(metrics?.netIncome);
  const ocfSeries = extractAnnualSeries(metrics?.operatingCashFlow);
  const capExSeries = extractAnnualSeries(metrics?.capitalExpenditures);
  const finCfSeries = extractAnnualSeries(metrics?.financingCashFlow);
  const sbcSeries = extractAnnualSeries(metrics?.stockBasedCompensation);
  const divSeries = extractAnnualSeries(metrics?.dividendsPaid);
  const buybackSeries = extractAnnualSeries(metrics?.stockRepurchases);
  const fcfSeries = buildAnnualFcfSeries(metrics);

  const assetsSeries = extractAnnualSeries(metrics?.totalAssets);
  const equitySeries = extractAnnualSeries(metrics?.stockholdersEquity);
  const liabilitiesSeries = resolveDerivedLiabilitiesSeries(metrics);
  const debtSeries = resolveDerivedDebtSeries(metrics);
  const shortDebtSeries = extractAnnualSeries(metrics?.shortTermDebt);
  const cashSeries = resolveCashTotalSeries(metrics);
  const retainedSeries = extractAnnualSeries(metrics?.retainedEarnings);
  const treasurySeries = extractAnnualSeries(metrics?.treasuryStock);
  const goodwillSeries = extractAnnualSeries(metrics?.goodwill);
  const currAssetsSeries = extractAnnualSeries(metrics?.currentAssets);
  const currLiabSeries = extractAnnualSeries(metrics?.currentLiabilities);
  const defRevSeries = extractAnnualSeries(metrics?.deferredRevenueCurrent);
  const interestSeries = extractAnnualSeries(metrics?.interestExpense);
  const taxSeries = extractAnnualSeries(metrics?.incomeTaxExpense);
  const invSeries = extractAnnualSeries(metrics?.inventory);

  const latestRev = getLatestAndPrior(revSeries);
  const latestGross = getLatestAndPrior(grossSeries);
  const latestCost = getLatestAndPrior(costRevSeries);
  const latestOpInc = getLatestAndPrior(opIncSeries);
  const latestNetInc = getLatestAndPrior(netIncSeries);
  const latestOcf = getLatestAndPrior(ocfSeries);
  const latestFcf = getLatestAndPrior(fcfSeries);
  const latestAssets = getLatestAndPrior(assetsSeries);
  const latestEquity = getLatestAndPrior(equitySeries);
  const latestLiab = getLatestAndPrior(liabilitiesSeries);
  const latestDebt = getLatestAndPrior(debtSeries);
  const latestShortDebt = getLatestAndPrior(shortDebtSeries);
  const latestCash = getLatestAndPrior(cashSeries);
  const latestRetained = getLatestAndPrior(retainedSeries);
  const latestTreasury = getLatestAndPrior(treasurySeries);
  const latestGoodwill = getLatestAndPrior(goodwillSeries);
  const latestCurrAssets = getLatestAndPrior(currAssetsSeries);
  const latestCurrLiab = getLatestAndPrior(currLiabSeries);
  const latestDefRev = getLatestAndPrior(defRevSeries);
  const latestInterest = getLatestAndPrior(interestSeries);
  const latestTax = getLatestAndPrior(taxSeries);
  const latestSbc = getLatestAndPrior(sbcSeries);
  const latestInv = getLatestAndPrior(invSeries);

  const revVal = latestRev.latest?.value ?? null;
  const grossVal =
    latestGross.latest?.value ??
    (isNum(revVal) && isNum(latestCost.latest?.value) ? revVal - latestCost.latest.value : null);
  const grossMarginLatestPct =
    isNum(revVal) && revVal > 0 && isNum(grossVal) ? (grossVal / revVal) * 100 : null;

  const priorRevVal = latestRev.prior?.value ?? null;
  const priorGrossVal =
    latestGross.prior?.value ??
    (isNum(priorRevVal) && isNum(latestCost.prior?.value) ? priorRevVal - latestCost.prior.value : null);
  const grossMarginPriorPct =
    isNum(priorRevVal) && priorRevVal > 0 && isNum(priorGrossVal)
      ? (priorGrossVal / priorRevVal) * 100
      : null;

  const assets = latestAssets.latest?.value ?? null;
  const equity = latestEquity.latest?.value ?? null;
  const liabilities = latestLiab.latest?.value ?? null;
  const totalDebt = latestDebt.latest?.value ?? null;
  const shortTermDebt = latestShortDebt.latest?.value ?? null;
  const cashTotal = latestCash.latest?.value ?? null;
  const netDebt = isNum(totalDebt) ? totalDebt - (cashTotal ?? 0) : null;
  const ocf = latestOcf.latest?.value ?? null;
  const fcf = latestFcf.latest?.value ?? null;
  const ebit = latestOpInc.latest?.value ?? null;
  const netIncome = latestNetInc.latest?.value ?? null;
  const netMarginLatestPct =
    isNum(revVal) && revVal > 0 && isNum(netIncome) ? (netIncome / revVal) * 100 : null;

  const interestRaw = latestInterest.latest?.value;
  const interestExp = isNum(interestRaw) ? Math.abs(interestRaw) : null;
  const usesOperatingInterest =
    metrics?.interestExpense?.tag === 'InterestExpenseOperating' ||
    (archetype === 'FINANCIAL_SPREAD' &&
      financialSubType === 'NON_BANK_FINANCE' &&
      metrics?.interestExpense?.tag !== 'InterestExpense');

  let ebitInterestCoverage = null;
  if (isNum(ebit) && isNum(interestExp) && interestExp > 0) {
    ebitInterestCoverage = usesOperatingInterest
      ? (ebit + interestExp) / interestExp
      : ebit / interestExp;
  } else if (isNum(ebit) && ebit > 0 && interestExp === 0) {
    ebitInterestCoverage = Infinity;
  }

  const netDebtToFcf =
    isNum(netDebt) && isNum(fcf)
      ? fcf > 0
        ? netDebt / fcf
        : netDebt > 0
        ? Infinity
        : null
      : null;

  const liabilitiesToEquity =
    isNum(liabilities) && isNum(equity) && equity > 0 ? liabilities / equity : null;
  const equityToAssetsPct =
    isNum(equity) && isNum(assets) && assets > 0 ? (equity / assets) * 100 : null;
  const goodwillToAssetsPct =
    isNum(latestGoodwill.latest?.value) && isNum(assets) && assets > 0
      ? (latestGoodwill.latest.value / assets) * 100
      : null;

  // ROIC = NOPAT / (Equity + Debt - Cash)
  let roicPct = null;
  if (isNum(ebit) && isNum(equity)) {
    const netInvestedDebt = isNum(netDebt) ? netDebt : (totalDebt ?? 0) - (cashTotal ?? 0);
    const investedCapital = equity + netInvestedDebt;
    if (investedCapital > 0) {
      const pretax = ebit - (interestExp ?? 0);
      const taxVal = latestTax.latest?.value;
      const effTax =
        isNum(taxVal) && pretax > 0 && taxVal >= 0 && taxVal <= pretax * 0.5
          ? taxVal / pretax
          : 0.21;
      const nopat = ebit * (1 - effTax);
      roicPct = (nopat / investedCapital) * 100;
    }
  }

  // 5Y average ROE (when >= 2 positive equity years exist)
  let roe5YAvgPct = null;
  if (netIncSeries.length > 0 && equitySeries.length > 0) {
    const eqMap = new Map(equitySeries.map((p) => [p.fiscalYear, p.value]));
    const roePts = netIncSeries
      .slice(-5)
      .filter((n) => eqMap.has(n.fiscalYear) && eqMap.get(n.fiscalYear) > 0)
      .map((n) => (n.value / eqMap.get(n.fiscalYear)) * 100);
    if (roePts.length > 0) {
      roe5YAvgPct = roePts.reduce((acc, v) => acc + v, 0) / roePts.length;
    }
  }

  // Latest Buybacks + Treasury Stock evidence
  const treasuryStock = latestTreasury.latest?.value ?? null;
  const retainedEarnings = latestRetained.latest?.value ?? null;
  const totalBuybacksHistorical = buybackSeries.reduce((sum, p) => sum + Math.abs(p.value), 0);
  const cumulativeShareChangePct = sharesMetric?.totalChangePct ?? null;

  // Liquidity / Deferred Revenue
  const currAssets = latestCurrAssets.latest?.value ?? null;
  const currLiab = latestCurrLiab.latest?.value ?? null;
  const defRevCurrent = latestDefRev.latest?.value ?? null;

  // Multi-year 3Y resilience window anchored on latest annual points
  const anchorYears = (
    ocfSeries.length >= 2
      ? ocfSeries
      : revSeries.length >= 2
      ? revSeries
      : netIncSeries
  )
    .slice(-3)
    .map((p) => p.fiscalYear);

  const ocf3YObj = sumWindow(ocfSeries, anchorYears);
  const ni3YObj = sumWindow(netIncSeries, anchorYears);
  const fcf3YObj = sumWindow(fcfSeries, anchorYears);
  const capEx3YObj = sumWindow(capExSeries, anchorYears);
  const sbc3YObj = sumWindow(sbcSeries, anchorYears);
  const rev3YObj = sumWindow(revSeries, anchorYears);
  const div3YObj = sumWindow(divSeries.map((p) => ({ ...p, value: Math.abs(p.value) })), anchorYears);
  const buyback3YObj = sumWindow(
    buybackSeries.map((p) => ({ ...p, value: Math.abs(p.value) })),
    anchorYears
  );

  const sumOcf3Y = ocf3YObj?.total ?? null;
  const sumNetIncome3Y = ni3YObj?.total ?? null;
  const cashConversionRatio =
    isNum(sumOcf3Y) && isNum(sumNetIncome3Y) && sumNetIncome3Y > 0
      ? sumOcf3Y / sumNetIncome3Y
      : null;

  const sumFcf3Y = fcf3YObj?.total ?? null;
  const sumSbc3Y = sbc3YObj?.total ?? null;
  const fcfExSbc3Y =
    isNum(sumFcf3Y) && isNum(sumSbc3Y) ? sumFcf3Y - sumSbc3Y : null;
  const sbcToRevenueLatestPct =
    isNum(latestSbc.latest?.value) && isNum(revVal) && revVal > 0
      ? (latestSbc.latest.value / revVal) * 100
      : null;
  const sbcToRev3YPct =
    isNum(sumSbc3Y) && isNum(rev3YObj?.total) && rev3YObj.total > 0
      ? (sumSbc3Y / rev3YObj.total) * 100
      : null;

  const capitalReturns3Y =
    div3YObj || buyback3YObj ? (div3YObj?.total ?? 0) + (buyback3YObj?.total ?? 0) : null;

  let netDebtChange3Y = null;
  if (debtSeries.length >= 2 && anchorYears.length >= 2) {
    const startYear = anchorYears[0];
    const endYear = anchorYears[anchorYears.length - 1];
    const debtMap = new Map(debtSeries.map((p) => [p.fiscalYear, p.value]));
    const cashMap = new Map(cashSeries.map((p) => [p.fiscalYear, p.value]));
    if (debtMap.has(startYear) && debtMap.has(endYear)) {
      const startNd = debtMap.get(startYear) - (cashMap.get(startYear) ?? 0);
      const endNd = debtMap.get(endYear) - (cashMap.get(endYear) ?? 0);
      netDebtChange3Y = endNd - startNd;
    }
  }

  // Cash Runway (Quarters) for negative OCF companies
  const cashRunwayQuarters =
    isNum(ocf) && ocf < 0 && isNum(cashTotal) && cashTotal >= 0
      ? cashTotal / (Math.abs(ocf) / 4)
      : null;

  return {
    revSeries,
    opIncSeries,
    netIncSeries,
    ocfSeries,
    finCfSeries,
    capEx3YAbs: capEx3YObj ? Math.abs(capEx3YObj.total) : null,
    revVal,
    priorRevVal,
    grossMarginLatestPct,
    grossMarginPriorPct,
    ebit,
    netIncome,
    netMarginLatestPct,
    interestExp,
    ebitInterestCoverage,
    assets,
    equity,
    liabilities,
    totalDebt,
    shortTermDebt,
    cashTotal,
    netDebt,
    ocf,
    fcf,
    netDebtToFcf,
    liabilitiesToEquity,
    equityToAssetsPct,
    goodwillToAssetsPct,
    roicPct,
    roe5YAvgPct,
    treasuryStock,
    retainedEarnings,
    totalBuybacksHistorical,
    cumulativeShareChangePct,
    currAssets,
    currLiab,
    defRevCurrent,
    yearsEvaluated: anchorYears.length,
    sumOcf3Y,
    sumNetIncome3Y,
    cashConversionRatio,
    sumFcf3Y,
    sumSbc3Y,
    fcfExSbc3Y,
    sbcToRevenueLatestPct,
    sbcToRev3YPct,
    capitalReturns3Y,
    netDebtChange3Y,
    cashRunwayQuarters,
    invLatest: latestInv.latest?.value ?? null,
    invPrior: latestInv.prior?.value ?? null,
    hasAnyMetrics:
      revSeries.length > 0 ||
      assetsSeries.length > 0 ||
      ocfSeries.length > 0 ||
      equitySeries.length > 0,
  };
}

// =============================================================================
// Locked A1 Guardrails Evaluator (exported for triageCalculator CR gating too)
// =============================================================================

export function evaluateSaaSDeferredRevenueGuardrail(metrics, archetype = null) {
  const caList = extractAnnualSeries(metrics?.currentAssets);
  const clList = extractAnnualSeries(metrics?.currentLiabilities);
  const drList = extractAnnualSeries(metrics?.deferredRevenueCurrent);
  const latestCa = caList[caList.length - 1]?.value ?? null;
  const latestCl = clList[clList.length - 1]?.value ?? null;
  const latestDr = drList[drList.length - 1]?.value ?? null;

  if (!isNum(latestCa) || !isNum(latestCl) || latestCl <= 0 || !isNum(latestDr) || latestDr <= 0) {
    return { active: false };
  }

  const deferredSharePct = (latestDr / latestCl) * 100;
  const isEligible = archetype === 'TECH_SAAS' || deferredSharePct >= 15;
  const adjustedCl = latestCl - latestDr;

  if (!isEligible || adjustedCl <= 0) {
    return { active: false };
  }

  const reportedRatio = Math.round((latestCa / latestCl) * 100) / 100;
  const adjustedRatio = Math.round((latestCa / adjustedCl) * 100) / 100;
  const adjDisplay = adjustedRatio.toFixed(1);
  const repDisplay = reportedRatio.toFixed(1);

  return {
    active: true,
    reportedRatio,
    adjustedRatio,
    deferredSharePct: Math.round(deferredSharePct * 10) / 10,
    adjustedDisplayHe: `${adjDisplay}x (מתואם)`,
    adjustedDisplayEn: `${adjDisplay}x (Adjusted)`,
    reportedSublabelHe: `מדווח: ${repDisplay}x`,
    reportedSublabelEn: `Reported: ${repDisplay}x`,
    tagHe: 'ℹ️ תשלומי מנויים מראש — לא חוב',
    tagEn: 'ℹ️ Prepaid Subscriptions — Not Debt',
    explanationHe:
      'הלקוחות כבר שילמו מראש במזומן על מנויים לשנה הקרובה, ובחשבונאות הסכום נרשם כהתחייבות עד למתן השירות — אף שבפועל זהו כסף שכבר בקופה ואינו חוב שיש להחזיר לבנק.',
    explanationEn:
      'Customers already paid cash upfront for upcoming subscriptions, which accounting records as a current liability until service delivery—even though it is cash already collected rather than debt owed to a bank.',
  };
}

function evaluateBuybackCannibalGuardrail(snap, archetype) {
  if (archetype === 'FINANCIAL_SPREAD') return { active: false };
  if (!isNum(snap.equity)) return { active: false };

  const hasEquityDeficit = snap.equity <= 0;
  const hasHighLeverage = isNum(snap.liabilitiesToEquity) && snap.liabilitiesToEquity >= 3.0;
  if (!hasEquityDeficit && !hasHighLeverage) return { active: false };

  const hasPositiveOcf = isNum(snap.ocf) && snap.ocf > 0;
  const hasStrongCoverage =
    snap.ebitInterestCoverage === Infinity ||
    (isNum(snap.ebitInterestCoverage) && snap.ebitInterestCoverage >= 4.0) ||
    (snap.interestExp === null && isNum(snap.netDebt) && snap.netDebt <= 0 && isNum(snap.ebit) && snap.ebit > 0);
  const hasSafeNetDebtToFcf =
    isNum(snap.fcf) && snap.fcf > 0 && isNum(snap.netDebt) && snap.netDebt / snap.fcf <= 4.0;
  const hasPositiveRetained = isNum(snap.retainedEarnings) && snap.retainedEarnings > 0;
  const hasBuybackEvidence =
    (isNum(snap.treasuryStock) && Math.abs(snap.treasuryStock) > 0) ||
    snap.totalBuybacksHistorical > 0 ||
    (isNum(snap.cumulativeShareChangePct) && snap.cumulativeShareChangePct <= -5);

  if (!hasPositiveOcf || !hasStrongCoverage || !hasSafeNetDebtToFcf || !hasPositiveRetained || !hasBuybackEvidence) {
    return { active: false };
  }

  const covLabelHe =
    isNum(snap.ebitInterestCoverage) && Number.isFinite(snap.ebitInterestCoverage)
      ? `כיסוי ריבית ${snap.ebitInterestCoverage.toFixed(1)}x`
      : 'N/M (רכישה עצמית)';
  const covLabelEn =
    isNum(snap.ebitInterestCoverage) && Number.isFinite(snap.ebitInterestCoverage)
      ? `Interest Coverage ${snap.ebitInterestCoverage.toFixed(1)}x`
      : 'N/M (Buybacks)';

  return {
    active: true,
    exemptedEquityDeficit: hasEquityDeficit,
    exemptedHighLeverage: !hasEquityDeficit && hasHighLeverage,
    badgeHe: 'מאזן יציב',
    badgeEn: 'Sound Balance Sheet',
    primaryValueHe: covLabelHe,
    primaryValueEn: covLabelEn,
    tagHe: hasEquityDeficit
      ? 'ℹ️ הון שלילי מרכישה עצמית — תקין'
      : 'ℹ️ מינוף חשבונאי מרכישה עצמית — תקין',
    tagEn: hasEquityDeficit
      ? 'ℹ️ Negative Equity from Buybacks — OK'
      : 'ℹ️ Accounting Leverage from Buybacks — OK',
    explanationHe:
      'החברה השתמשה ברווחים אדירים כדי לקנות בחזרה מניות של עצמה, פעולה חשבונאית שמקטינה או מאפסת את ההון העצמי בספרים — אך כל עוד התזרים חיובי והחוב מכוסה בקלות, זהו סימן לעוצמה ולא לפשיטת רגל.',
    explanationEn:
      'The company used strong profits to buy back its own shares, an accounting deduction that can make book equity negative—yet positive cash flow and comfortable interest coverage signal strength rather than insolvency.',
  };
}

// =============================================================================
// Domain Check Evaluators
// =============================================================================

function evaluateSolvencyAndLeverage(snap, guardrails, archetype, financialSubType, pushRed, pushYellow, pushContext) {
  const isBank = archetype === 'FINANCIAL_SPREAD' && financialSubType === 'DEPOSIT_BANK';
  const isNonBankFin = archetype === 'FINANCIAL_SPREAD' && financialSubType !== 'DEPOSIT_BANK';
  const buybackExempt = guardrails.buybackCannibal?.active === true;

  if (buybackExempt) {
    const gc = guardrails.buybackCannibal;
    pushContext(
      createFlag({
        id: 'a1-buyback-cannibal',
        tier: 3,
        category: 'solvency',
        badgeHe: gc.tagHe,
        badgeEn: gc.tagEn,
        titleHe: 'מאזן יציב (הון חשבונאי מרכישה עצמית)',
        titleEn: 'Sound Balance Sheet (Buyback-Driven Book Equity)',
        valueDisplayHe: gc.primaryValueHe,
        valueDisplayEn: gc.primaryValueEn,
        explanationHe: gc.explanationHe,
        explanationEn: gc.explanationEn,
        metricsSnapshot: {
          equity: snap.equity,
          retainedEarnings: snap.retainedEarnings,
          ebitInterestCoverage: snap.ebitInterestCoverage,
          netDebtToFcf: snap.netDebtToFcf,
        },
      })
    );
  } else if (isBank) {
    if (isNum(snap.equity) && snap.equity <= 0) {
      pushRed(
        createFlag({
          id: 'bank-negative-equity',
          tier: 1,
          category: 'solvency',
          overlapGroup: 'leverage',
          badgeHe: 'הון בנקאי שלילי',
          badgeEn: 'Negative Bank Equity',
          titleHe: 'הון עצמי שלילי בבנק / פינטק',
          titleEn: 'Negative Stockholders’ Equity in Deposit Institution',
          explanationHe:
            'לבנק או פינטק מקבל פיקדונות חייבת להיות כרית הון חיובית הסופגת הפסדי אשראי. הון שלילי מעמיד את המוסד בסיכון חדלות פירעון חמור.',
          explanationEn:
            'Deposit-taking institutions require positive equity capital to absorb loan losses. Negative equity signals severe insolvency risk.',
          quote: WISDOM_QUOTES.bankLeverage20x,
        })
      );
    } else if (isNum(snap.equityToAssetsPct) && snap.equityToAssetsPct < 6) {
      pushRed(
        createFlag({
          id: 'bank-thin-capital-cushion',
          tier: 1,
          category: 'solvency',
          overlapGroup: 'leverage',
          badgeHe: 'כרית הון דקה (< 6%)',
          badgeEn: 'Thin Bank Capital (< 6%)',
          titleHe: `כרית הון בנקאית דקה (${formatPct(snap.equityToAssetsPct)})`,
          titleEn: `Thin Bank Capital Cushion (Equity/Assets ${formatPct(snap.equityToAssetsPct)})`,
          valueDisplayHe: `Equity/Assets ${formatPct(snap.equityToAssetsPct)}`,
          valueDisplayEn: `Equity/Assets ${formatPct(snap.equityToAssetsPct)}`,
          explanationHe:
            'יחס הון לנכסים מתחת ל-6% משקף מינוף בנקאי של מעל פי 16–20. במצב זה הפסד קטן בתיק ההלוואות עלול למחוק חלק ניכר מהון בעלי המניות.',
          explanationEn:
            'Equity below 6% of total assets implies >16x–20x banking leverage, where small credit losses can wipe out shareholders.',
          quote: WISDOM_QUOTES.bankLeverage20x,
          metricsSnapshot: { equityToAssetsPct: snap.equityToAssetsPct },
        })
      );
    } else if (isNum(snap.equityToAssetsPct) && snap.equityToAssetsPct < 8) {
      pushYellow(
        createFlag({
          id: 'bank-borderline-capital',
          tier: 2,
          category: 'solvency',
          overlapGroup: 'leverage',
          badgeHe: 'כרית הון גבולית',
          badgeEn: 'Moderate Bank Cushion',
          titleHe: `כרית הון בנקאית גבולית (${formatPct(snap.equityToAssetsPct)})`,
          titleEn: `Borderline Bank Capital Cushion (${formatPct(snap.equityToAssetsPct)})`,
          explanationHe:
            'כרית ההון נמצאת בין 6% ל-8% מהנכסים — טווח שדורש מעקב אחרי איכות תיק האשראי וההפרשות להפסדים.',
          explanationEn:
            'Equity sits between 6% and 8% of assets—warranting close attention to credit loss provisions.',
          quote: WISDOM_QUOTES.bankLeverage20x,
        })
      );
    }
  } else {
    // Non-bank solvency checks
    if (isNum(snap.equity) && snap.equity <= 0) {
      pushRed(
        createFlag({
          id: 'negative-equity-fail',
          tier: 1,
          category: 'solvency',
          overlapGroup: 'leverage',
          badgeHe: 'הון עצמי שלילי',
          badgeEn: 'Negative Equity',
          titleHe: 'הון עצמי שלילי (התחייבויות עולות על הנכסים)',
          titleEn: 'Negative Book Equity (Liabilities Exceed Assets)',
          explanationHe:
            'ההתחייבויות של החברה גבוהות מסך הנכסים שלה, וללא גיבוי של תזרים חזק ורכישה עצמית מתועדת הדבר מאותת על מצוקת חוב וסיכון מאזני.',
          explanationEn:
            'Total liabilities exceed total assets without an offsetting cash-rich buyback profile, signaling balance-sheet distress risk.',
          quote: WISDOM_QUOTES.leverageZipWallet,
          metricsSnapshot: { equity: snap.equity },
        })
      );
    } else if (isNum(snap.liabilitiesToEquity)) {
      const redLeThreshold = isNonBankFin ? 4.5 : 3.0;
      const warnLeThreshold = isNonBankFin ? 3.0 : 1.6;
      const isUtilitySoftened =
        archetype === 'STAPLES_GENERAL' &&
        isNum(snap.totalDebt) &&
        snap.equity > 0 &&
        snap.totalDebt / snap.equity <= 2.0 &&
        isNum(snap.ebitInterestCoverage) &&
        snap.ebitInterestCoverage >= 3.0;

      if (snap.liabilitiesToEquity >= redLeThreshold && !isUtilitySoftened) {
        pushRed(
          createFlag({
            id: 'high-leverage-fail',
            tier: 1,
            category: 'solvency',
            overlapGroup: 'leverage',
            badgeHe: `מינוף גבוה (${formatRatio(snap.liabilitiesToEquity)})`,
            badgeEn: `High Leverage (${formatRatio(snap.liabilitiesToEquity)})`,
            titleHe: isNonBankFin
              ? `מינוף מסוכן במימון/ליסינג (L/E ${formatRatio(snap.liabilitiesToEquity)})`
              : `מינוף מאזני גבוה (L/E ${formatRatio(snap.liabilitiesToEquity)})`,
            titleEn: isNonBankFin
              ? `Excessive Non-Bank Finance Leverage (L/E ${formatRatio(snap.liabilitiesToEquity)})`
              : `High Balance-Sheet Leverage (L/E ${formatRatio(snap.liabilitiesToEquity)})`,
            valueDisplayHe: `L/E ${formatRatio(snap.liabilitiesToEquity)}`,
            valueDisplayEn: `L/E ${formatRatio(snap.liabilitiesToEquity)}`,
            explanationHe: `יחס ההתחייבויות להון העצמי (${formatRatio(snap.liabilitiesToEquity)}) חוצה את סף הסיכון (${redLeThreshold.toFixed(1)}x) ומותיר מרווח טעות צר בהאטה או עליית ריבית.`,
            explanationEn: `Liabilities-to-equity (${formatRatio(snap.liabilitiesToEquity)}) exceeds the ${redLeThreshold.toFixed(1)}x danger threshold, leaving little margin for downturns or refinancing shocks.`,
            quote: WISDOM_QUOTES.leverageZipWallet,
            metricsSnapshot: { liabilitiesToEquity: snap.liabilitiesToEquity },
          })
        );
      } else if (
        snap.liabilitiesToEquity >= warnLeThreshold &&
        (isNum(snap.netDebt) ? snap.netDebt > 0 : true)
      ) {
        pushYellow(
          createFlag({
            id: 'moderate-leverage-warn',
            tier: 2,
            category: 'solvency',
            overlapGroup: 'leverage',
            badgeHe: `מינוף בינוני (${formatRatio(snap.liabilitiesToEquity)})`,
            badgeEn: `Elevated Leverage (${formatRatio(snap.liabilitiesToEquity)})`,
            titleHe: `מינוף מאזני מוגבר (L/E ${formatRatio(snap.liabilitiesToEquity)})`,
            titleEn: `Elevated Balance-Sheet Leverage (L/E ${formatRatio(snap.liabilitiesToEquity)})`,
            explanationHe:
              'החברה פועלת עם מינוף נטו מוגבר; מומלץ לוודא שפריסת מועדי הפירעון ותזרים המזומנים מאפשרים שירות חוב נוח.',
            explanationEn:
              'Net debt leverage is elevated; verify debt maturity schedules and free cash flow coverage.',
            quote: WISDOM_QUOTES.leverageZipWallet,
            metricsSnapshot: { liabilitiesToEquity: snap.liabilitiesToEquity },
          })
        );
      }
    }

    // Interest Coverage (non-deposit-bank)
    if (isNum(snap.ebitInterestCoverage) && Number.isFinite(snap.ebitInterestCoverage)) {
      const redCov = 1.5;
      const warnCov = isNonBankFin ? 2.0 : archetype === 'CYCLICAL_INDUSTRIAL' ? 5.0 : 4.0;

      if (snap.ebitInterestCoverage < redCov) {
        pushRed(
          createFlag({
            id: 'weak-interest-coverage-fail',
            tier: 1,
            category: 'solvency',
            overlapGroup: 'interest-coverage',
            badgeHe: `כיסוי ריבית ${formatRatio(snap.ebitInterestCoverage)}`,
            badgeEn: `Interest Cov. ${formatRatio(snap.ebitInterestCoverage)}`,
            titleHe: `כיסוי ריבית מסוכן (${formatRatio(snap.ebitInterestCoverage)} — מתחת ל-1.5x)`,
            titleEn: `Dangerous Interest Coverage (${formatRatio(snap.ebitInterestCoverage)} < 1.5x)`,
            valueDisplayHe: `כיסוי ריבית ${formatRatio(snap.ebitInterestCoverage)}`,
            valueDisplayEn: `EBIT / Interest ${formatRatio(snap.ebitInterestCoverage)}`,
            explanationHe:
              'הרווח התפעולי מכסה בקושי את תשלומי הריבית על החוב (< 1.5x). כל ירידה קטנה בהכנסות עלולה להוביל לקשיי פירעון.',
            explanationEn:
              'Operating profit barely covers interest payments (< 1.5x). Even a minor earnings dip can create debt-service strain.',
            quote: WISDOM_QUOTES.leverageZipWallet,
            metricsSnapshot: { ebitInterestCoverage: snap.ebitInterestCoverage },
          })
        );
      } else if (snap.ebitInterestCoverage < warnCov && !buybackExempt) {
        pushYellow(
          createFlag({
            id: 'borderline-interest-coverage-warn',
            tier: 2,
            category: 'solvency',
            overlapGroup: 'interest-coverage',
            badgeHe: `כיסוי ריבית ${formatRatio(snap.ebitInterestCoverage)}`,
            badgeEn: `Interest Cov. ${formatRatio(snap.ebitInterestCoverage)}`,
            titleHe: `כיסוי ריבית צר (${formatRatio(snap.ebitInterestCoverage)} — יעד >= ${warnCov.toFixed(1)}x)`,
            titleEn: `Narrow Interest Coverage (${formatRatio(snap.ebitInterestCoverage)} < ${warnCov.toFixed(1)}x)`,
            explanationHe: `מרווח הכיסוי של הוצאות הריבית (${formatRatio(snap.ebitInterestCoverage)}) מצומצם יחסית לסיכון הענפי.`,
            explanationEn: `Interest coverage (${formatRatio(snap.ebitInterestCoverage)}) provides a narrower cushion than preferred for this sector.`,
            quote: WISDOM_QUOTES.leverageZipWallet,
            metricsSnapshot: { ebitInterestCoverage: snap.ebitInterestCoverage },
          })
        );
      }
    }
  }
}

function evaluateResilience3Y(snap, pushRed, pushYellow) {
  // 1. 3Y Cumulative Cash Conversion: ΣOCF / ΣNetIncome
  if (isNum(snap.cashConversionRatio)) {
    const ratioFmt = snap.cashConversionRatio.toFixed(2);
    if (snap.cashConversionRatio < 0.8) {
      pushRed(
        createFlag({
          id: 'resilience-3y-cash-conversion-fail',
          tier: 1,
          category: 'cashflow',
          overlapGroup: 'cash-conversion',
          badgeHe: `המרת מזומן ${ratioFmt}x`,
          badgeEn: `Cash Conv. ${ratioFmt}x`,
          titleHe: `איכות רווחים ירודה: המרת מזומן 3Y היא ${ratioFmt}x (< 0.80x)`,
          titleEn: `Weak Earnings Quality: 3Y Cash Conversion ${ratioFmt}x (< 0.80x)`,
          valueDisplayHe: `ΣOCF / ΣNI = ${ratioFmt}x`,
          valueDisplayEn: `ΣOCF / ΣNI = ${ratioFmt}x`,
          explanationHe:
            'לאורך 3 השנים האחרונות התזרים התפעולי נמוך מ-80% מהרווח הנקי המדווח — סימן אזהרה לכך שהרווח החשבונאי "תקוע" במלאי, בחובות לקוחות או בהיוונים ואינו נכנס לקופה.',
          explanationEn:
            'Over the past 3 years, cumulative operating cash flow captured under 80% of net income—warning that reported earnings are not converting into real cash.',
          quote: WISDOM_QUOTES.cashConversionQuality,
          metricsSnapshot: {
            cashConversionRatio: snap.cashConversionRatio,
            sumOcf3Y: snap.sumOcf3Y,
            sumNetIncome3Y: snap.sumNetIncome3Y,
          },
        })
      );
    } else if (snap.cashConversionRatio < 0.85) {
      pushYellow(
        createFlag({
          id: 'resilience-3y-cash-conversion-warn',
          tier: 2,
          category: 'cashflow',
          overlapGroup: 'cash-conversion',
          badgeHe: `המרת מזומן ${ratioFmt}x`,
          badgeEn: `Cash Conv. ${ratioFmt}x`,
          titleHe: `המרת מזומן 3Y גבולית (${ratioFmt}x — מתחת ל-0.85x)`,
          titleEn: `Borderline 3Y Cash Conversion (${ratioFmt}x < 0.85x)`,
          explanationHe:
            'התזרים התפעולי המצטבר ב-3 שנים נמוך מ-85% מהרווח הנקי — יש לבדוק גידול בהון חוזר או רישום הכנסות אגרסיבי.',
          explanationEn:
            '3-year operating cash flow lags reported net income (< 0.85x); inspect working capital build or revenue recognition.',
          quote: WISDOM_QUOTES.cashConversionQuality,
          metricsSnapshot: { cashConversionRatio: snap.cashConversionRatio },
        })
      );
    }
  }

  // OCF negative consistently while Financing CF positive
  if (snap.ocfSeries.length >= 2 && snap.finCfSeries.length >= 2) {
    const recentOcf = snap.ocfSeries.slice(-3);
    const finMap = new Map(snap.finCfSeries.map((p) => [p.fiscalYear, p.value]));
    const negOcfCount = recentOcf.filter((p) => p.value < 0).length;
    const posFinCount = recentOcf.filter((p) => (finMap.get(p.fiscalYear) ?? 0) > 0).length;
    if (isNum(snap.ocf) && snap.ocf < 0 && negOcfCount >= 2 && posFinCount >= 2) {
      pushRed(
        createFlag({
          id: 'cash-burn-financing-dependency',
          tier: 1,
          category: 'cashflow',
          overlapGroup: 'cash-burn',
          badgeHe: 'שריפת מזומנים',
          badgeEn: 'Financing Dependent',
          titleHe: 'תזרים תפעולי שלילי מתמשך לצד תלות בגיוסי הון/חוב',
          titleEn: 'Consistent Negative Operating Cash Flow Funded by Financing',
          explanationHe:
            'העסק שורף מזומנים מפעילותו השוטפת שנה אחר שנה ומממן את הפער באמצעות הלוואות או הנפקות מניות חוזרות.',
          explanationEn:
            'Core operations consistently burn cash while financing inflows keep the company afloat.',
          quote: WISDOM_QUOTES.cashBurnFinancing,
        })
      );
    }
  }

  // 2. 3Y FCF ex-SBC & High SBC/Revenue
  if (isNum(snap.fcfExSbc3Y)) {
    const sbcPct = snap.sbcToRev3YPct ?? snap.sbcToRevenueLatestPct;
    if (snap.fcfExSbc3Y <= 0 && isNum(sbcPct) && sbcPct >= 20) {
      pushRed(
        createFlag({
          id: 'resilience-3y-fcf-ex-sbc-fail',
          tier: 1,
          category: 'dilution',
          overlapGroup: 'sbc-burden',
          badgeHe: '3Y FCF ex-SBC שלילי',
          badgeEn: 'Negative 3Y FCF ex-SBC',
          titleHe: `תזרים 3Y בניכוי תגמול במניות שלילי לצד SBC כבד (${formatPct(sbcPct)})`,
          titleEn: `Negative 3Y FCF After SBC with Heavy Equity Pay (${formatPct(sbcPct)} of Rev)`,
          explanationHe:
            'התזרים החופשי נראה חיובי רק מפני שמנטרלים את התגמול העצום במניות לעובדים (מעל 20% מההכנסות). בפועל, בניכוי העלות לבעלי המניות, התזרים של 3 השנים הוא שלילי.',
          explanationEn:
            'Reported FCF only stays positive by adding back heavy stock-based compensation (>= 20% of revenue). Deducting true SBC leaves negative 3-year FCF.',
          quote: WISDOM_QUOTES.sbcExpense,
          metricsSnapshot: { fcfExSbc3Y: snap.fcfExSbc3Y, sbcToRevenuePct: sbcPct },
        })
      );
    } else if (snap.fcfExSbc3Y <= 0) {
      pushYellow(
        createFlag({
          id: 'resilience-3y-fcf-ex-sbc-warn',
          tier: 2,
          category: 'dilution',
          overlapGroup: 'sbc-burden',
          badgeHe: '3Y FCF ex-SBC שלילי',
          badgeEn: '3Y FCF ex-SBC <= 0',
          titleHe: 'תזרים 3Y בניכוי תגמול במניות (SBC) שלילי או אפסי',
          titleEn: '3Y Cumulative Free Cash Flow Net of SBC Is Negative/Zero',
          explanationHe:
            'כאשר מפחיתים את עלות התגמול במניות (SBC) מהתזרים החופשי של 3 השנים האחרונות, העסק לא ייצר עודף מזומן נקי לבעלי המניות.',
          explanationEn:
            'After subtracting stock-based compensation from 3Y free cash flow, net cash retained for owners is zero or negative.',
          quote: WISDOM_QUOTES.sbcExpense,
          metricsSnapshot: { fcfExSbc3Y: snap.fcfExSbc3Y },
        })
      );
    } else if (isNum(snap.sbcToRevenueLatestPct) && snap.sbcToRevenueLatestPct >= 15) {
      pushYellow(
        createFlag({
          id: 'high-sbc-to-revenue-warn',
          tier: 2,
          category: 'dilution',
          overlapGroup: 'sbc-burden',
          badgeHe: `SBC ${formatPct(snap.sbcToRevenueLatestPct)} מההכנסות`,
          badgeEn: `High SBC (${formatPct(snap.sbcToRevenueLatestPct)})`,
          titleHe: `תגמול גבוה במניות (${formatPct(snap.sbcToRevenueLatestPct)} מההכנסות)`,
          titleEn: `Elevated Stock-Based Compensation (${formatPct(snap.sbcToRevenueLatestPct)} of Revenue)`,
          explanationHe:
            'נתח משמעותי מההכנסות (15%+) מחולק כתגמול במניות, מה ששוחק את שיעור הרווח האמיתי לבעל המניות.',
          explanationEn:
            'More than 15% of revenue is absorbed by stock-based compensation, diluting real economic earnings.',
          quote: WISDOM_QUOTES.sbcExpense,
          metricsSnapshot: { sbcToRevenueLatestPct: snap.sbcToRevenueLatestPct },
        })
      );
    }
  }

  // 3. 3Y (Dividends + Buybacks) > FCF
  if (isNum(snap.capitalReturns3Y) && snap.capitalReturns3Y > 0 && isNum(snap.sumFcf3Y)) {
    const exceedsFcf = snap.sumFcf3Y <= 0 || snap.capitalReturns3Y > snap.sumFcf3Y * 1.05;
    if (exceedsFcf) {
      const netDebtRose = isNum(snap.netDebtChange3Y) && snap.netDebtChange3Y > 0 && isNum(snap.netDebt) && snap.netDebt > 0;
      const cashBelowShortDebt =
        isNum(snap.cashTotal) &&
        isNum(snap.shortTermDebt) &&
        snap.shortTermDebt > 0 &&
        snap.cashTotal < snap.shortTermDebt &&
        isNum(snap.netDebt) &&
        snap.netDebt > 0;

      if (netDebtRose || cashBelowShortDebt) {
        pushRed(
          createFlag({
            id: 'resilience-3y-debt-funded-returns-fail',
            tier: 1,
            category: 'capital-allocation',
            overlapGroup: 'capital-returns',
            badgeHe: 'חלוקה ממומנת חוב',
            badgeEn: 'Debt-Funded Payouts',
            titleHe: 'דיבידנדים ורכישה עצמית ב-3 שנים עולים על ה-FCF וממומנים בחוב',
            titleEn: '3Y Dividends & Buybacks Exceed FCF Alongside Rising Debt / Tight Cash',
            explanationHe:
              'החברה מחזירה לבעלי המניות יותר מזומן מכפי שהעסק ייצר ב-3 שנים, תוך הגדלת החוב נטו או שחיקת המזומן מול חוב קצר-טווח — דגל אדום ליציבות עתידית.',
            explanationEn:
              'Cumulative 3Y dividends and buybacks exceeded 3Y free cash flow while net debt increased or cash fell below short-term debt.',
            quote: WISDOM_QUOTES.debtFundedPayouts,
            metricsSnapshot: {
              capitalReturns3Y: snap.capitalReturns3Y,
              sumFcf3Y: snap.sumFcf3Y,
              netDebtChange3Y: snap.netDebtChange3Y,
            },
          })
        );
      } else {
        pushYellow(
          createFlag({
            id: 'resilience-3y-cash-drawn-returns-warn',
            tier: 2,
            category: 'capital-allocation',
            overlapGroup: 'capital-returns',
            badgeHe: 'חלוקה מעל 3Y FCF',
            badgeEn: 'Payouts > 3Y FCF',
            titleHe: 'חלוקת דיבידנד ובייבאק ב-3 שנים עלתה על ה-FCF (מתוך יתרות מזומן)',
            titleEn: '3Y Capital Returns Exceeded FCF (Funded from Cash Reserves)',
            explanationHe:
              'סך הדיבידנדים והרכישות העצמיות עלה על התזרים החופשי ב-3 השנים, אם כי כרגע הוא נתמך ביתרות מזומן ולא בעליית חוב נטו מסוכנת.',
            explanationEn:
              'Total dividends and buybacks topped 3Y free cash flow; currently cushioned by balance-sheet cash rather than rising net debt.',
            quote: WISDOM_QUOTES.debtFundedPayouts,
            metricsSnapshot: { capitalReturns3Y: snap.capitalReturns3Y, sumFcf3Y: snap.sumFcf3Y },
          })
        );
      }
    }
  }

  // Capital intensity 3Y CapEx / OCF >= 70%
  if (isNum(snap.capEx3YAbs) && isNum(snap.sumOcf3Y) && snap.sumOcf3Y > 0) {
    const capexIntensityPct = (snap.capEx3YAbs / snap.sumOcf3Y) * 100;
    if (capexIntensityPct >= 70) {
      pushYellow(
        createFlag({
          id: 'high-capex-intensity-warn',
          tier: 2,
          category: 'cashflow',
          overlapGroup: 'capex-intensity',
          badgeHe: `CapEx ${Math.round(capexIntensityPct)}% מ-OCF`,
          badgeEn: `CapEx ${Math.round(capexIntensityPct)}% of OCF`,
          titleHe: `עסק זולל הון (CapEx בולע ${Math.round(capexIntensityPct)}% מהתזרים התפעולי)`,
          titleEn: `Heavy Capital Intensity (3Y CapEx Consumes ${Math.round(capexIntensityPct)}% of OCF)`,
          explanationHe:
            'למעלה מ-70% מהמזומן שהעסק מייצר מנותב לרכישת ציוד ותשתיות כדי לשרוד ולהתחרות, ומותיר מעט תזרים פנוי.',
          explanationEn:
            'Over 70% of operating cash flow goes back into capital expenditures, leaving slim free cash flow for owners.',
          quote: WISDOM_QUOTES.cyclicalTiptoes,
        })
      );
    }
  }
}

function evaluateGoodwillAndReturns(snap, sharesMetric, isBuybackCannibal, pushRed, pushYellow) {
  if (isNum(snap.goodwillToAssetsPct) && snap.goodwillToAssetsPct >= 40) {
    const isHeavy = snap.goodwillToAssetsPct >= 50;
    const hasLowRoic = isNum(snap.roicPct) && snap.roicPct < 10;
    const hasHighDebt =
      snap.netDebtToFcf === Infinity ||
      (isNum(snap.netDebtToFcf) && snap.netDebtToFcf > 4.0);
    const hasExcessDilution =
      (isNum(sharesMetric?.changePct) && sharesMetric.changePct > 2.5) ||
      (isNum(sharesMetric?.totalChangePct) && sharesMetric.totalChangePct > 7.5);

    if (isHeavy && (hasLowRoic || hasHighDebt || hasExcessDilution)) {
      const debtLabel =
        snap.netDebtToFcf === Infinity ? 'Neg FCF' : formatRatio(snap.netDebtToFcf);
      const reasonsHe = [];
      const reasonsEn = [];
      if (hasLowRoic) {
        const roicText = `ROIC ${formatPct(snap.roicPct)}`;
        reasonsHe.push(roicText);
        reasonsEn.push(roicText);
      }
      if (hasHighDebt) {
        const debtText = `Net Debt/FCF ${debtLabel}`;
        reasonsHe.push(debtText);
        reasonsEn.push(debtText);
      }
      if (hasExcessDilution) {
        const dilVal = isNum(sharesMetric?.changePct)
          ? sharesMetric.changePct.toFixed(1)
          : sharesMetric.totalChangePct.toFixed(1);
        reasonsHe.push(`דילול ${dilVal}%`);
        reasonsEn.push(`Dilution ${dilVal}%`);
      }

      pushRed(
        createFlag({
          id: 'goodwill-rollup-red',
          tier: 1,
          category: 'goodwill',
          overlapGroup: 'goodwill',
          badgeHe: `Roll-Up (${Math.round(snap.goodwillToAssetsPct)}% מוניטין)`,
          badgeEn: `Roll-Up Risk (${Math.round(snap.goodwillToAssetsPct)}% GW)`,
          titleHe: `מלכודת Roll-Up: מוניטין ${formatPct(snap.goodwillToAssetsPct)} מהנכסים לצד חולשה פיננסית`,
          titleEn: `Roll-Up Trap: Goodwill ${formatPct(snap.goodwillToAssetsPct)} of Assets with Deteriorating Quality`,
          valueDisplayHe: `${formatPct(snap.goodwillToAssetsPct)} (${reasonsHe.join(' · ')})`,
          valueDisplayEn: `${formatPct(snap.goodwillToAssetsPct)} (${reasonsEn.join(' · ')})`,
          explanationHe:
            'למעלה ממחצית מנכסי החברה הם מוניטין — הפרמיה ששולמה מעל שווי הנכסים המוחשיים ברכישת חברות אחרות — ובמקביל התשואה על ההון המושקע (ROIC — הרווח הכלכלי שהעסק מפיק ביחס לסך ההון והחוב המושקעים בו), עומס החוב או דילול המניות מצביעים על תשלום יתר וסיכון למחיקות ערך.',
          explanationEn:
            'Goodwill (the premium paid above tangible assets in past acquisitions) exceeds 50% of total assets while paired with weak return on invested capital (ROIC < 10%), heavy Net Debt/FCF (> 4.0x), or dilution (> 2.5%/yr).',
          quote: WISDOM_QUOTES.goodwillNoWill,
          metricsSnapshot: {
            goodwillToAssetsPct: snap.goodwillToAssetsPct,
            roicPct: snap.roicPct,
            netDebtToFcf: snap.netDebtToFcf,
            shareChangePct: sharesMetric?.changePct ?? null,
          },
        })
      );
    } else {
      pushYellow(
        createFlag({
          id: 'goodwill-elevated-warn',
          tier: 2,
          category: 'goodwill',
          overlapGroup: 'goodwill',
          badgeHe: `מוניטין ${Math.round(snap.goodwillToAssetsPct)}%`,
          badgeEn: `Goodwill ${Math.round(snap.goodwillToAssetsPct)}%`,
          titleHe: `משקל מוניטין גבוה במאזן (${formatPct(snap.goodwillToAssetsPct)} מהנכסים)`,
          titleEn: `High Goodwill Weight (${formatPct(snap.goodwillToAssetsPct)} of Assets)`,
          explanationHe:
            'למעלה מ-40% מנכסי החברה הם מוניטין — הפרמיה ששולמה מעל שווי הנכסים המוחשיים ברכישת חברות אחרות. כל עוד התשואה על ההון המושקע (ROIC — הרווח הכלכלי ביחס לסך הכסף המושקע בעסק) גבוהה והחוב נשלט מדובר בנקודה למעקב בלבד ולא בפסילה, אך חשוב לוודא שהרכישות מצדיקות את מחירן.',
          explanationEn:
            'Goodwill (the premium paid above tangible net assets in acquisitions) exceeds 40% of assets; while strong ROIC (profit relative to total invested capital) and controlled debt prevent disqualification, monitor acquisition discipline.',
          quote: WISDOM_QUOTES.goodwillNoWill,
          metricsSnapshot: { goodwillToAssetsPct: snap.goodwillToAssetsPct, roicPct: snap.roicPct },
        })
      );
    }
  }

  if (!isBuybackCannibal && isNum(snap.roe5YAvgPct) && snap.roe5YAvgPct < 10) {
    pushYellow(
      createFlag({
        id: 'low-multiyear-roe-warn',
        tier: 2,
        category: 'capital-allocation',
        overlapGroup: 'returns',
        badgeHe: `ROE ${formatPct(snap.roe5YAvgPct)}`,
        badgeEn: `ROE ${formatPct(snap.roe5YAvgPct)}`,
        titleHe: `תשואה נמוכה על ההון (${formatPct(snap.roe5YAvgPct)} בממוצע רב-שנתי)`,
        titleEn: `Sub-Par Multi-Year ROE (${formatPct(snap.roe5YAvgPct)})`,
        explanationHe:
          'תשואה ממוצעת על ההון מתחת ל-10% מעידה על עסק איכותי פחות המתקשה לייצר ערך מואץ מההון המושקע בו.',
        explanationEn:
          'Multi-year ROE below 10% points to modest capital efficiency and thinner moat economics.',
        quote: WISDOM_QUOTES.revenueDecline,
        metricsSnapshot: { roe5YAvgPct: snap.roe5YAvgPct },
      })
    );
  }
}

function evaluateCorePillarsAndArchetype(
  snap,
  triageMetrics,
  guardrails,
  archetype,
  financialSubType,
  isLowCostRetailException,
  pushRed,
  pushYellow,
  pushContext
) {
  const { revenue, margins, shares, currentRatio } = triageMetrics;
  const isBank = archetype === 'FINANCIAL_SPREAD' && financialSubType === 'DEPOSIT_BANK';
  const isFinancial = archetype === 'FINANCIAL_SPREAD';

  // Pre-revenue / Gross Margin stop sign
  if (snap.revVal === 0 || (isNum(snap.grossMarginLatestPct) && snap.grossMarginLatestPct <= 0)) {
    if (archetype === 'HEALTHCARE_PHARMA' && isNum(snap.cashRunwayQuarters)) {
      if (snap.cashRunwayQuarters < 8) {
        pushRed(
          createFlag({
            id: 'pharma-cash-runway-red',
            tier: 1,
            category: 'archetype',
            overlapGroup: 'cash-burn',
            badgeHe: `מזומן ל-${Math.round(snap.cashRunwayQuarters)} רבעונים`,
            badgeEn: `${Math.round(snap.cashRunwayQuarters)}Q Cash Runway`,
            titleHe: `חברת ביוטק/פארמה על זמן שאול (אופק מזומנים ${snap.cashRunwayQuarters.toFixed(1)} רבעונים)`,
            titleEn: `Short Cash Runway in Pre-Revenue Biotech (${snap.cashRunwayQuarters.toFixed(1)} Quarters)`,
            explanationHe:
              'יתרת המזומנים מספיקה לפחות משנתיים (8 רבעונים) בקצב השריפה הנוכחי — סיכון גבוה להנפקת מניות מדללת לפני אישור FDA.',
            explanationEn:
              'Cash covers fewer than 8 quarters at current burn—high risk of dilutive financing before clinical milestones.',
            quote: WISDOM_QUOTES.cashBurnFinancing,
          })
        );
      } else {
        pushYellow(
          createFlag({
            id: 'pharma-pre-revenue-warn',
            tier: 2,
            category: 'archetype',
            badgeHe: 'Pre-Revenue ביוטק',
            badgeEn: 'Pre-Revenue Pharma',
            titleHe: 'עסק בשלב טרום-הכנסות (תלות בניסויים ואישורי FDA)',
            titleEn: 'Pre-Revenue Healthcare Profile (Binary Approval Risk)',
            explanationHe:
              'לחברה עדיין אין הכנסות מסחריות קבועות; ההשקעה תלויה בהצלחה קלינית ורגולטורית.',
            explanationEn:
              'No commercial revenue stream yet; thesis depends heavily on regulatory and trial outcomes.',
            quote: WISDOM_QUOTES.cashBurnFinancing,
          })
        );
      }
    } else if (!isFinancial) {
      pushRed(
        createFlag({
          id: 'gross-margin-zero-or-negative',
          tier: 1,
          category: 'margins',
          overlapGroup: 'gross-margin',
          badgeHe: 'רווח גולמי שלילי/אפס',
          badgeEn: 'Negative/Zero Gross Margin',
          titleHe: 'תמרור עצור: אין רווח גולמי חיובי או אפס הכנסות',
          titleEn: 'Stop Sign: Zero Revenue or Non-Positive Gross Margin',
          explanationHe:
            'עלות המכר עולה על מחיר המכירה (או שאין הכנסות כלל). ללא רווח גולמי חיובי, הגדלת המכירות אינה בונה רווחיות.',
          explanationEn:
            'Direct production costs meet or exceed sales price (or revenue is zero), blocking unit-economic profitability.',
          quote: WISDOM_QUOTES.grossMarginFail,
        })
      );
    }
  } else if (archetype === 'TECH_SAAS' && isNum(snap.grossMarginLatestPct) && snap.grossMarginLatestPct < 50) {
    pushYellow(
      createFlag({
        id: 'saas-low-gross-margin-warn',
        tier: 2,
        category: 'archetype',
        badgeHe: `רווח גולמי ${formatPct(snap.grossMarginLatestPct)}`,
        badgeEn: `GM ${formatPct(snap.grossMarginLatestPct)}`,
        titleHe: `שולי רווח גולמי נמוכים לחברת תוכנה (${formatPct(snap.grossMarginLatestPct)} < 50%)`,
        titleEn: `Low SaaS Gross Margin (${formatPct(snap.grossMarginLatestPct)} < 50%)`,
        explanationHe:
          'חברות תוכנה טהורות מציגות לרוב שוליים גולמיים של 70%+. שוליים מתחת ל-50% רומזים על מרכיב גבוה של שירותי ייעוץ, חומרה או עלויות ענן כבדות.',
        explanationEn:
          'Pure software peers usually exceed 70% gross margin; below 50% points to heavy hosting or services overhead.',
        quote: WISDOM_QUOTES.grossMarginFail,
      })
    );
  }

  // Revenue Growth Flags
  if (revenue.status === 'fail') {
    pushRed(
      createFlag({
        id: 'revenue-contraction-fail',
        tier: 1,
        category: 'growth',
        overlapGroup: 'growth',
        badgeHe: revenue.badgeHe,
        badgeEn: revenue.badge,
        titleHe: `התכווצות בהכנסות (${revenue.detail})`,
        titleEn: `Revenue Contraction (${revenue.detailEn || revenue.badge})`,
        explanationHe:
          'ירידה מתמשכת או שלילית בהכנסות מסכנת את המינוף התפעולי ועלולה להעיד על דעיכה מבנית בביקוש למוצר.',
        explanationEn:
          'Persistent top-line contraction erodes operating leverage and signals weakening demand or market share loss.',
        quote: WISDOM_QUOTES.revenueDecline,
      })
    );
  } else if (revenue.status === 'warn') {
    pushYellow(
      createFlag({
        id: 'revenue-growth-warn',
        tier: 2,
        category: 'growth',
        overlapGroup: 'growth',
        badgeHe: revenue.badgeHe,
        badgeEn: revenue.badge,
        titleHe: revenue.detail,
        titleEn: revenue.detailEn || revenue.badge,
        explanationHe:
          'צמיחה תת-אינפלציונית (< 5%), מחזורית או מואטת בחדות מצמצמת את קצב בניית הערך העתידי.',
        explanationEn:
          'Slow (< 5% CAGR), cyclical, or sharply decelerating sales limits compounding potential.',
        quote: WISDOM_QUOTES.revenueDecline,
      })
    );
  }

  // Margins (Financial vs Low-Cost Retail Exception vs General)
  if (isFinancial) {
    if (isNum(snap.netIncome) && snap.netIncome < 0) {
      pushRed(
        createFlag({
          id: 'financial-net-loss-fail',
          tier: 1,
          category: 'margins',
          overlapGroup: 'margins',
          badgeHe: 'הפסד נקי',
          badgeEn: 'Net Loss',
          titleHe: 'שורת רווח נקי שלילית בחברת מימון/בנקאות',
          titleEn: 'Negative Net Income in Financial Institution',
          explanationHe:
            'בעסקי מימון והשכרה שולי הרווח התפעולי מושפעים מהוצאות ריבית מובנות, ולכן ההפסד הנקי בשורה התחתונה מעיד על שחיקת הון ממשית.',
          explanationEn:
            'For spread-driven finance companies, negative bottom-line net income directly erodes book capital.',
          quote: WISDOM_QUOTES.marginLossYear,
        })
      );
    } else if (isNum(snap.netMarginLatestPct) && snap.netMarginLatestPct < 10) {
      pushYellow(
        createFlag({
          id: 'financial-low-net-margin-warn',
          tier: 2,
          category: 'margins',
          overlapGroup: 'margins',
          badgeHe: `רווח נקי ${formatPct(snap.netMarginLatestPct)}`,
          badgeEn: `Net Margin ${formatPct(snap.netMarginLatestPct)}`,
          titleHe: `שולי רווח נקי נמוכים יחסית במימון (${formatPct(snap.netMarginLatestPct)} < 10%)`,
          titleEn: `Tight Financial Net Margin (${formatPct(snap.netMarginLatestPct)} < 10%)`,
          explanationHe:
            'שולי רווח נקי מתחת ל-10% במימון מותירים מרווח ספיגה דק מול תנודות ריבית והפרשות אשראי.',
          explanationEn:
            'Net margins under 10% leave thinner buffer against funding-cost spikes or credit losses.',
          quote: WISDOM_QUOTES.marginLossYear,
        })
      );
    }
  } else if (isLowCostRetailException) {
    pushContext(
      createFlag({
        id: 'retail-low-cost-margin-ok',
        tier: 3,
        category: 'margins',
        badgeHe: 'ℹ️ מודל קמעונאות עלות-נמוכה — יציב',
        badgeEn: 'ℹ️ Low-Cost Retail Margin — Stable',
        titleHe: 'שולי רווח צרים ויציבים אופייניים לקמעונאות מועדון/מוזלת',
        titleEn: 'Consistent Narrow Operating Margins Typical of Low-Cost Scale Retail',
        explanationHe:
          'בקמעונאות עלות-נמוכה (כמו רשתות מועדון וסופרמרקטים יעילים), שוליים יציבים של 2%–6% ללא שנות הפסד ועם תזרים מזומנים גבוה מהרווח הם חלק טבעי מהחפיר.',
        explanationEn:
          'Scale low-cost retailers structurally maintain steady 2%–6% margins without loss years while converting profits efficiently to cash.',
      })
    );
  } else if (margins.status === 'fail') {
    const isCyclicalFail = archetype === 'CYCLICAL_INDUSTRIAL' || margins.historyMeta?.minVal < 0;
    pushRed(
      createFlag({
        id: 'operating-margins-fail',
        tier: 1,
        category: 'margins',
        overlapGroup: 'margins',
        badgeHe: margins.badgeHe,
        badgeEn: margins.badge,
        titleHe: margins.detail,
        titleEn: margins.detailEn || margins.badge,
        explanationHe:
          margins.historyMeta?.minVal < 0
            ? 'החברה רשמה לפחות שנת הפסד תפעולית אחת בטווח ההיסטורי — אינדיקציה לפגיעות במחזורי שפל.'
            : 'שולי רווח תפעולי מתחת ל-10% אינם משאירים כרית הגנה בפני אינפלציית עלויות או תחרות מחירים.',
        explanationEn:
          margins.historyMeta?.minVal < 0
            ? 'At least one operating loss year in the historical window exposes downside cyclical fragility.'
            : 'Sub-10% operating margins offer weak cushion against cost inflation or price competition.',
        quote: isCyclicalFail && archetype === 'CYCLICAL_INDUSTRIAL'
          ? WISDOM_QUOTES.cyclicalTiptoes
          : WISDOM_QUOTES.marginLossYear,
      })
    );
  } else if (margins.status === 'warn') {
    pushYellow(
      createFlag({
        id: 'operating-margins-warn',
        tier: 2,
        category: 'margins',
        overlapGroup: 'margins',
        badgeHe: margins.badgeHe,
        badgeEn: margins.badge,
        titleHe: margins.detail,
        titleEn: margins.detailEn || margins.badge,
        explanationHe:
          'קפיצות חדות או שחיקה רב-שנתית בשוליים עלולות לרמז על תלות במחזור העסקי או היחלשות כוח התמחור (חפיר).',
        explanationEn:
          'Wide cyclical margin swings or steady multi-year erosion warn of weakening pricing power.',
        quote:
          archetype === 'CYCLICAL_INDUSTRIAL'
            ? WISDOM_QUOTES.cyclicalTiptoes
            : WISDOM_QUOTES.marginLossYear,
      })
    );
  }

  // Liquidity / Current Ratio + A1 Guardrail #2 (SaaS) + Deposit Bank Exemption
  const saasGc = guardrails.saasDeferredRevenue;
  if (isBank) {
    pushContext(
      createFlag({
        id: 'a2-bank-liquidity-exempt',
        tier: 3,
        category: 'liquidity',
        badgeHe: 'ℹ️ יחס שוטף לא רלוונטי לבנק',
        badgeEn: 'ℹ️ Current Ratio N/A (Bank)',
        titleHe: 'פיקדונות לקוחות מסווגים בהגדרה כהתחייבות שוטפת',
        titleEn: 'Customer Deposits Make Standard Current Ratio Non-Applicable',
        explanationHe:
          'בבנקים ובפינטקים מקבלי פיקדונות, כספי הפיקדונות של הלקוחות נרשמים כהתחייבות קצרת-טווח; לכן בוחנים את כרית ההון לנכסים (Equity/Assets) במקום יחס שוטף.',
        explanationEn:
          'In deposit-taking banks, customer deposits are classified as short-term liabilities; capital adequacy is measured via Equity/Assets instead.',
      })
    );
  } else if (saasGc?.active) {
    pushContext(
      createFlag({
        id: 'a1-saas-deferred-revenue',
        tier: 3,
        category: 'liquidity',
        badgeHe: saasGc.tagHe,
        badgeEn: saasGc.tagEn,
        titleHe: `יחס שוטף מתואם ${saasGc.adjustedDisplayHe} · ${saasGc.reportedSublabelHe}`,
        titleEn: `Adjusted Current Ratio ${saasGc.adjustedDisplayEn} · ${saasGc.reportedSublabelEn}`,
        valueDisplayHe: `${saasGc.adjustedDisplayHe} (${saasGc.reportedSublabelHe})`,
        valueDisplayEn: `${saasGc.adjustedDisplayEn} (${saasGc.reportedSublabelEn})`,
        explanationHe: saasGc.explanationHe,
        explanationEn: saasGc.explanationEn,
        metricsSnapshot: {
          reportedRatio: saasGc.reportedRatio,
          adjustedRatio: saasGc.adjustedRatio,
          deferredSharePct: saasGc.deferredSharePct,
        },
      })
    );
    if (saasGc.adjustedRatio < 1.0) {
      pushRed(
        createFlag({
          id: 'saas-adjusted-liquidity-fail',
          tier: 1,
          category: 'liquidity',
          overlapGroup: 'liquidity',
          badgeHe: `נזילות מתואמת ${saasGc.adjustedRatio.toFixed(1)}x`,
          badgeEn: `Adj. CR ${saasGc.adjustedRatio.toFixed(1)}x`,
          titleHe: `סיכון נזילות גם לאחר נטרול הכנסות נדחות (${saasGc.adjustedDisplayHe})`,
          titleEn: `Short-Term Liquidity Risk Even After Adjusting Deferred Revenue (${saasGc.adjustedDisplayEn})`,
          explanationHe:
            'אפילו לאחר ניכוי תשלומי המנויים מראש, הנכסים השוטפים אינם מכסים את ההתחייבויות התזרימיות לשנה הקרובה (< 1.0x).',
          explanationEn:
            'Even after removing prepaid subscription liabilities, liquid current assets fall short of remaining obligations (< 1.0x).',
          quote: WISDOM_QUOTES.currentRatio2to1,
        })
      );
    } else if (saasGc.adjustedRatio < 1.5) {
      pushYellow(
        createFlag({
          id: 'saas-adjusted-liquidity-warn',
          tier: 2,
          category: 'liquidity',
          overlapGroup: 'liquidity',
          badgeHe: `נזילות מתואמת ${saasGc.adjustedRatio.toFixed(1)}x`,
          badgeEn: `Adj. CR ${saasGc.adjustedRatio.toFixed(1)}x`,
          titleHe: `כרית נזילות בינונית גם לאחר התאמת מנויים (${saasGc.adjustedDisplayHe})`,
          titleEn: `Borderline Adjusted Liquidity (${saasGc.adjustedDisplayEn})`,
          explanationHe:
            'לאחר נטרול הכנסות נדחות היחס השוטף תקין חלקית (1.0x–1.49x), מה שמשאיר כרית נזילות מתונה.',
          explanationEn:
            'Adjusted liquidity excluding unearned revenue sits in the borderline 1.0x–1.49x range.',
          quote: WISDOM_QUOTES.currentRatio2to1,
        })
      );
    }
  } else if (currentRatio.status === 'fail') {
    pushRed(
      createFlag({
        id: 'current-ratio-fail',
        tier: 1,
        category: 'liquidity',
        overlapGroup: 'liquidity',
        badgeHe: `יחס שוטף ${currentRatio.value}`,
        badgeEn: `CR ${currentRatio.value}`,
        titleHe: currentRatio.detail,
        titleEn: currentRatio.detailEn || currentRatio.badge,
        explanationHe:
          'התחייבויות השנה הקרובה גבוהות מהנכסים השוטפים הזמינים (< 1.0x), מצב שעלול לאלץ מימון מחדש בתנאי שוק קשים.',
        explanationEn:
          'Near-term obligations exceed liquid current assets (< 1.0x), risking tight short-term refinancing pressure.',
        quote: WISDOM_QUOTES.currentRatio2to1,
      })
    );
  } else if (currentRatio.status === 'warn') {
    pushYellow(
      createFlag({
        id: 'current-ratio-warn',
        tier: 2,
        category: 'liquidity',
        overlapGroup: 'liquidity',
        badgeHe: `יחס שוטף ${currentRatio.value}`,
        badgeEn: `CR ${currentRatio.value}`,
        titleHe: currentRatio.detail,
        titleEn: currentRatio.detailEn || currentRatio.badge,
        explanationHe:
          'יחס שוטף בין 1.0x ל-1.5x מספק הגנה קצרה צנועה לעומת כלל האצבע השמרני.',
        explanationEn:
          'Current ratio between 1.0x and 1.5x offers a modest buffer compared with classic defensive standards.',
        quote: WISDOM_QUOTES.currentRatio2to1,
      })
    );
  }

  // Share Dilution
  if (shares.status === 'fail') {
    pushRed(
      createFlag({
        id: 'share-dilution-fail',
        tier: 1,
        category: 'dilution',
        overlapGroup: 'share-dilution',
        badgeHe: `דילול ${shares.value}`,
        badgeEn: `Dilution ${shares.value}`,
        titleHe: shares.detail,
        titleEn: shares.detailEn || shares.badge,
        explanationHe:
          'הנפקת מניות בקצב של מעל 3% בשנה מדללת את אחזקת המשקיע ונוגסת בצמיחת הרווח למניה (EPS).',
        explanationEn:
          'Annual share count growth above 3% materially shrinks each investor’s ownership slice.',
        quote: WISDOM_QUOTES.dilutionChainLetter,
      })
    );
  } else if (shares.status === 'warn') {
    pushYellow(
      createFlag({
        id: 'share-dilution-warn',
        tier: 2,
        category: 'dilution',
        overlapGroup: 'share-dilution',
        badgeHe: shares.badgeHe,
        badgeEn: shares.badge,
        titleHe: shares.detail,
        titleEn: shares.detailEn || shares.badge,
        explanationHe:
          'גידול קל במספר המניות המדוללות מפחית מעט את חלקך בחברה לאורך זמן.',
        explanationEn:
          'Modest share-count creep gradually nibbles away at per-share compounding.',
        quote: WISDOM_QUOTES.dilutionChainLetter,
      })
    );
  }

  // TECH_SAAS Rule of 40 (< 40%)
  if (archetype === 'TECH_SAAS' && isNum(revenue.growthRate)) {
    const fcfMarginPct =
      isNum(snap.fcf) && isNum(snap.revVal) && snap.revVal > 0
        ? (snap.fcf / snap.revVal) * 100
        : null;
    const opMarginPct = isNum(margins.latestValue) ? margins.latestValue : null;
    const profitMarginPct =
      isNum(fcfMarginPct) && isNum(opMarginPct)
        ? Math.max(fcfMarginPct, opMarginPct)
        : fcfMarginPct ?? opMarginPct;
    if (isNum(profitMarginPct)) {
      const ruleOf40 = revenue.growthRate + profitMarginPct;
      if (ruleOf40 < 40) {
        pushYellow(
          createFlag({
            id: 'saas-rule-of-40-warn',
            tier: 2,
            category: 'archetype',
            badgeHe: `Rule of 40: ${Math.round(ruleOf40)}%`,
            badgeEn: `Rule of 40: ${Math.round(ruleOf40)}%`,
            titleHe: `מדד SaaS מתחת לרף Rule of 40 (${ruleOf40.toFixed(1)}% < 40%)`,
            titleEn: `SaaS Rule of 40 Below Target (${ruleOf40.toFixed(1)}% < 40%)`,
            explanationHe:
              'חיבור צמיחת ההכנסות השנתית ושיעור ה-FCF/רווח תפעולי נמוך מ-40%, תמהיל חלש יחסית לתוכנה איכותית.',
            explanationEn:
              'Combined YoY revenue growth plus FCF/operating margin falls below the 40% software efficiency benchmark.',
            quote: WISDOM_QUOTES.revenueDecline,
          })
        );
      }
    }
  }

  // RETAIL_ECOMMERCE Inventory Bloat & Margin Erosion
  if (archetype === 'RETAIL_ECOMMERCE') {
    if (
      isNum(snap.invLatest) &&
      isNum(snap.invPrior) &&
      snap.invPrior > 0 &&
      isNum(snap.revVal) &&
      isNum(snap.priorRevVal) &&
      snap.priorRevVal > 0 &&
      snap.invLatest / snap.revVal >= 0.03
    ) {
      const invYoy = ((snap.invLatest - snap.invPrior) / snap.invPrior) * 100;
      const revYoy = ((snap.revVal - snap.priorRevVal) / snap.priorRevVal) * 100;
      if (invYoy > revYoy + 10) {
        pushYellow(
          createFlag({
            id: 'retail-inventory-bloat-warn',
            tier: 2,
            category: 'archetype',
            badgeHe: 'ניפוח מלאי',
            badgeEn: 'Inventory Bloat',
            titleHe: `צמיחת מלאי חריגה (${invYoy.toFixed(1)}% מול ${revYoy.toFixed(1)}% במכירות)`,
            titleEn: `Inventory Outpacing Sales (${invYoy.toFixed(1)}% vs ${revYoy.toFixed(1)}% Revenue YoY)`,
            explanationHe:
              'כשמלאי הקמעונאי גדל ביותר מ-10% מעל קצב צמיחת המכירות, עולה הסיכון להנחות סוף-עונה ושחיקת רווחים.',
            explanationEn:
              'Retail inventory growing >10 percentage points faster than revenue raises markdown and cash-tie-up risk.',
            quote: WISDOM_QUOTES.cashConversionQuality,
          })
        );
      }
    }
    if (
      isNum(snap.grossMarginLatestPct) &&
      isNum(snap.grossMarginPriorPct) &&
      snap.grossMarginPriorPct - snap.grossMarginLatestPct >= 2.0
    ) {
      const drop = (snap.grossMarginPriorPct - snap.grossMarginLatestPct).toFixed(1);
      pushYellow(
        createFlag({
          id: 'retail-gross-margin-squeeze-warn',
          tier: 2,
          category: 'margins',
          overlapGroup: 'gross-margin',
          badgeHe: `שחיקת רווח גולמי -${drop}pp`,
          badgeEn: `GM Drop -${drop}pp`,
          titleHe: `שחיקה חדה של ${drop} נק׳ אחוז בשולי הרווח הגולמי`,
          titleEn: `Gross Margin Compression of ${drop} Percentage Points YoY`,
          explanationHe:
            'ירידה בשיעור הרווח הגולמי בקמעונאות משקפת לעיתים מכירות חיסול, גניבות מלאי או אובדן כוח תמחור.',
          explanationEn:
            'Shrinking retail gross margins often signal promotional discounting, shrink, or higher input costs.',
          quote: WISDOM_QUOTES.grossMarginFail,
        })
      );
    }
  }

  // STAPLES_GENERAL low growth + low ROIC/ROE trap
  if (
    archetype === 'STAPLES_GENERAL' &&
    revenue.status === 'warn' &&
    ((isNum(snap.roicPct) && snap.roicPct <= 10) || (isNum(snap.roe5YAvgPct) && snap.roe5YAvgPct <= 10))
  ) {
    pushYellow(
      createFlag({
        id: 'staples-low-growth-low-return-warn',
        tier: 2,
        category: 'archetype',
        overlapGroup: 'returns',
        badgeHe: 'צמיחה ותשואה חלשות',
        badgeEn: 'Sluggish Compounding',
        titleHe: 'צמיחה תת-אינפלציונית לצד תשואה נמוכה על ההון',
        titleEn: 'Sub-Inflationary Growth Combined with Low Return on Capital',
        explanationHe:
          'שילוב של צמיחה איטית ותשואה נמוכה מ-10% על ההון מקשה על החברה להתמודד עם שחיקה אינפלציונית.',
        explanationEn:
          'Slow top-line growth paired with <= 10% return on capital struggles to compound ahead of inflation.',
        quote: WISDOM_QUOTES.revenueDecline,
      })
    );
  }
}

function mergeQualitativeAiFlags(aiSummary, pushRed, pushYellow, pushContext) {
  if (!aiSummary || typeof aiSummary !== 'object') return;
  const qualFlags = Array.isArray(aiSummary.qualitativeFlags) ? aiSummary.qualitativeFlags : [];
  const presentKeys = new Set();

  for (const item of qualFlags) {
    if (!item || typeof item !== 'object') continue;
    const cat = String(item.category || 'qualitative').trim().toLowerCase();
    const itemId = String(item.id || '').trim().toLowerCase();
    presentKeys.add(cat);
    if (itemId) presentKeys.add(itemId);
    const tier = item.severity === 'fail' ? 1 : item.severity === 'info' ? 3 : 2;
    const flag = createFlag({
      id: item.id || `qual-${cat}`,
      tier,
      category: 'qualitative',
      overlapGroup: `qual-${item.id || cat}`,
      source: 'ai-qualitative',
      badgeHe: 'ממצא SEC',
      badgeEn: 'SEC Filing Note',
      titleHe: item.titleHe || item.title || '',
      titleEn: item.titleEn || item.title || '',
      explanationHe: item.rationaleHe || item.rationale || '',
      explanationEn: item.rationaleEn || item.rationale || '',
      quote: item.quoteEn
        ? {
            attributionHe: `מתוך דיווח SEC${item.sourceRef ? ` (${item.sourceRef})` : ''}`,
            attributionEn: `SEC Filing${item.sourceRef ? ` (${item.sourceRef})` : ''}`,
            insightHe: 'ציטוט מאומת מתוך הדיווח התקופתי של החברה.',
            insightEn: 'Verified excerpt from the company’s SEC filing.',
            quoteEn: item.quoteEn,
            sourceRef: item.sourceRef || null,
          }
        : null,
    });
    if (tier === 1) pushRed(flag);
    else if (tier === 3) pushContext(flag);
    else pushYellow(flag);
  }

  const conc = aiSummary.customerConcentration;
  const hasCustomerConcFlag =
    presentKeys.has('customer-concentration') ||
    presentKeys.has('concentration') ||
    presentKeys.has('qual-customer-concentration');
  if (conc?.detected && !hasCustomerConcFlag) {
    const isRed = isNum(conc.maxCustomerPct) && conc.maxCustomerPct > 20;
    const pctLabel = isNum(conc.maxCustomerPct) ? `${conc.maxCustomerPct}%` : '>10%';
    const targetPush = isRed ? pushRed : pushYellow;
    targetPush(
      createFlag({
        id: 'qual-customer-concentration',
        tier: isRed ? 1 : 2,
        category: 'qualitative',
        source: 'ai-qualitative',
        badgeHe: `ריכוזיות לקוחות ${pctLabel}`,
        badgeEn: `Customer Conc. ${pctLabel}`,
        titleHe: `תלות בלקוח מרכזי (${pctLabel} מההכנסות)`,
        titleEn: `Customer Concentration Risk (${pctLabel} of Revenue)`,
        explanationHe:
          conc.detailHe ||
          'הדוח מציין תלות גבוהה בלקוח בודד; אובדן של לקוח כזה עלול לפגוע בחדות במכירות וברווח.',
        explanationEn:
          conc.detailEn ||
          'SEC filing discloses reliance on a single major customer, increasing revenue shock exposure.',
        quote: conc.quoteEn
          ? {
              attributionHe: 'מתוך דוח ה-10-K / 20-F',
              attributionEn: 'SEC Annual Filing',
              insightHe: 'גילוי מהותי על ריכוזיות הכנסות בלקוח יחיד.',
              insightEn: 'Material single-customer concentration disclosure.',
              quoteEn: conc.quoteEn,
            }
          : null,
      })
    );
  }

  const gov = aiSummary.governanceAndMoatRisks;
  if (gov && typeof gov === 'object') {
    const hasSevereGovFlag =
      presentKeys.has('governance') ||
      presentKeys.has('restatement') ||
      presentKeys.has('option-repricing') ||
      presentKeys.has('qual-governance-severe');
    const hasWatchGovFlag =
      presentKeys.has('governance') ||
      presentKeys.has('executive-turnover') ||
      presentKeys.has('turnover') ||
      presentKeys.has('supply-chain') ||
      presentKeys.has('sovereign-risk') ||
      presentKeys.has('eroding-moat') ||
      presentKeys.has('moat-erosion') ||
      presentKeys.has('qual-governance-watch');

    if ((gov.hasRestatement || gov.hasOptionRepricing) && !hasSevereGovFlag) {
      pushRed(
        createFlag({
          id: 'qual-governance-severe',
          tier: 1,
          category: 'qualitative',
          source: 'ai-qualitative',
          badgeHe: 'דגל ממשל תאגידי',
          badgeEn: 'Governance Flag',
          titleHe: gov.hasRestatement
            ? 'תיקון דוחות כספיים רטרואקטיבי (Restatement / 10-K/A)'
            : 'תמחור אופציות מחדש (Option Repricing) לטובת הנהלה',
          titleEn: gov.hasRestatement
            ? 'Financial Restatement Reported (10-K/A)'
            : 'Executive Option Repricing Disclosed',
          explanationHe:
            gov.summaryHe ||
            'נמצא סימן אזהרה בממשל התאגידי המחייב בדיקה יסודית של אמינות הדיווחים ושיקולי ההנהלה.',
          explanationEn:
            gov.summaryEn ||
            'Serious corporate governance disclosure warrants extra scrutiny of accounting integrity.',
        })
      );
    } else if (
      (gov.hasExecutiveTurnover || gov.supplyChainOrSovereignRisk || gov.erodingMoatRisk) &&
      !hasWatchGovFlag
    ) {
      pushYellow(
        createFlag({
          id: 'qual-governance-watch',
          tier: 2,
          category: 'qualitative',
          source: 'ai-qualitative',
          badgeHe: 'זהירות איכותית',
          badgeEn: 'Qualitative Watch',
          titleHe: gov.summaryHe || 'סיכון ממשל תאגידי, שרשרת אספקה או שחיקת חפיר בדוח',
          titleEn: gov.summaryEn || 'Executive Turnover, Supply-Chain, or Moat Erosion Risk Disclosed',
          explanationHe:
            gov.summaryHe ||
            'זוהו בדיווח הרשמי אותות לחילופי הנהלה, תלות גיאופוליטית/שרשרת אספקה או החרפת התחרות.',
          explanationEn:
            gov.summaryEn ||
            'Filing notes leadership turnover, geopolitical/supply concentration, or intensifying competition.',
        })
      );
    }
  }
}

// =============================================================================
// Capital Structure Summary & Top Banner Helpers
// =============================================================================

function buildCapitalStructureSummary(snap, guardrails, archetype, financialSubType) {
  if (!snap.hasAnyMetrics && !isNum(snap.equity)) {
    return {
      status: 'unavailable',
      badgeHe: 'אין נתוני SEC',
      badgeEn: 'No SEC Data',
      primaryValueHe: 'אין נתוני SEC',
      primaryValueEn: 'No SEC Data',
      guardrailTagHe: null,
      guardrailTagEn: null,
      tooltipHe: 'לא נמצאו נתוני מאזן מספקים בדיווחי SEC להערכת מבנה ההון.',
      tooltipEn: 'Insufficient SEC balance-sheet data to evaluate capital structure.',
    };
  }

  if (guardrails.buybackCannibal?.active) {
    const gc = guardrails.buybackCannibal;
    return {
      status: 'pass',
      badgeHe: gc.badgeHe,
      badgeEn: gc.badgeEn,
      primaryValueHe: gc.primaryValueHe,
      primaryValueEn: gc.primaryValueEn,
      guardrailTagHe: gc.tagHe,
      guardrailTagEn: gc.tagEn,
      tooltipHe: gc.explanationHe,
      tooltipEn: gc.explanationEn,
    };
  }

  if (archetype === 'FINANCIAL_SPREAD' && financialSubType === 'DEPOSIT_BANK') {
    const eqAssets = snap.equityToAssetsPct;
    const isFail = !isNum(snap.equity) || snap.equity <= 0 || (isNum(eqAssets) && eqAssets < 6);
    const isWarn = !isFail && isNum(eqAssets) && eqAssets < 8;
    return {
      status: isFail ? 'fail' : isWarn ? 'warn' : 'pass',
      badgeHe: isFail ? 'כרית הון דקה' : isWarn ? 'כרית הון גבולית' : 'כרית הון תקינה',
      badgeEn: isFail ? 'Thin Capital' : isWarn ? 'Borderline Cushion' : 'Sound Bank Capital',
      primaryValueHe: isNum(eqAssets) ? `Equity/Assets ${formatPct(eqAssets)}` : 'N/A',
      primaryValueEn: isNum(eqAssets) ? `Equity/Assets ${formatPct(eqAssets)}` : 'N/A',
      guardrailTagHe: 'ℹ️ הערכת הון בנקאית (Equity/Assets)',
      guardrailTagEn: 'ℹ️ Bank Capital Evaluation',
      tooltipHe: 'בבנקים נמדדת כרית ההון כיחס הון עצמי לנכסים (מעל 6%–8% להגנה מהפסדי אשראי).',
      tooltipEn: 'Banks are evaluated via Equity-to-Assets cushion (>= 6%–8% to absorb loan losses).',
    };
  }

  if (isNum(snap.equity) && snap.equity <= 0) {
    return {
      status: 'fail',
      badgeHe: 'הון עצמי שלילי',
      badgeEn: 'Negative Equity',
      primaryValueHe: 'הון שלילי',
      primaryValueEn: 'Negative Equity',
      guardrailTagHe: null,
      guardrailTagEn: null,
      tooltipHe: 'הון עצמי שלילי ללא כיסוי תזרימי של רכישה עצמית מעיד על סיכון מאזני גבוה.',
      tooltipEn: 'Negative equity without strong buyback-backed cash flow indicates elevated balance-sheet risk.',
    };
  }

  const le = snap.liabilitiesToEquity;
  const redLe = archetype === 'FINANCIAL_SPREAD' ? 4.5 : 3.0;
  const warnLe = archetype === 'FINANCIAL_SPREAD' ? 3.0 : 1.6;
  const covFail = isNum(snap.ebitInterestCoverage) && snap.ebitInterestCoverage < 1.5;
  const isFail = (isNum(le) && le >= redLe) || covFail;
  const isWarn = !isFail && ((isNum(le) && le >= warnLe && (isNum(snap.netDebt) ? snap.netDebt > 0 : true)) || (isNum(snap.ebitInterestCoverage) && snap.ebitInterestCoverage < 4.0));

  return {
    status: isFail ? 'fail' : isWarn ? 'warn' : 'pass',
    badgeHe: isFail ? 'סיכון מינוף' : isWarn ? 'מינוף מוגבר' : 'מאזן יציב',
    badgeEn: isFail ? 'Leverage Risk' : isWarn ? 'Moderate Leverage' : 'Sound Balance Sheet',
    primaryValueHe: isNum(le) ? `L/E ${formatRatio(le)}` : isNum(snap.ebitInterestCoverage) && Number.isFinite(snap.ebitInterestCoverage) ? `כיסוי ריבית ${snap.ebitInterestCoverage.toFixed(1)}x` : 'N/A',
    primaryValueEn: isNum(le) ? `L/E ${formatRatio(le)}` : isNum(snap.ebitInterestCoverage) && Number.isFinite(snap.ebitInterestCoverage) ? `Interest Cov. ${snap.ebitInterestCoverage.toFixed(1)}x` : 'N/A',
    guardrailTagHe: null,
    guardrailTagEn: null,
    tooltipHe: 'יחס התחייבויות להון וכיסוי ריבית מול תזרים החוב של החברה.',
    tooltipEn: 'Liabilities-to-equity leverage alongside operating interest coverage.',
  };
}

function buildCompactBannerText(redCount, yellowCount, contextCount, isUnavailable) {
  if (redCount > 0 || yellowCount > 0) {
    const heParts = [];
    const enParts = [];
    if (redCount > 0) {
      heParts.push(redCount === 1 ? '🚩 דגל אדום אחד' : `🚩 ${redCount} דגלים אדומים`);
      enParts.push(redCount === 1 ? '🚩 1 Red Flag' : `🚩 ${redCount} Red Flags`);
    }
    if (yellowCount > 0) {
      heParts.push(yellowCount === 1 ? '⚠️ אזהרה אחת' : `⚠️ ${yellowCount} אזהרות`);
      enParts.push(yellowCount === 1 ? '⚠️ 1 Warning' : `⚠️ ${yellowCount} Warnings`);
    }
    return {
      bannerHe: `${heParts.join(' · ')} · לפירוט ↓`,
      bannerEn: `${enParts.join(' · ')} · Details ↓`,
    };
  }

  if (isUnavailable && contextCount === 0) {
    return {
      bannerHe: 'אין מספיק נתוני SEC להפקת סינון סיכונים מלא',
      bannerEn: 'Insufficient SEC data for full risk inversion screen',
    };
  }

  if (contextCount > 0) {
    return {
      bannerHe: isUnavailable
        ? `ℹ️ ${contextCount} הערת SEC · לפירוט ↓`
        : `ℹ️ ${contextCount} הקשר מאזני · סינון נקי ↓`,
      bannerEn: isUnavailable
        ? `ℹ️ ${contextCount} SEC Note · Details ↓`
        : `ℹ️ ${contextCount} Balance-Sheet Context · Clean Pass ↓`,
    };
  }

  return {
    bannerHe: '✓ 0 דגלים אדומים · סינון נקי · לסיכום ↓',
    bannerEn: '✓ 0 Red Flags · Clean Pass · Summary ↓',
  };
}

// =============================================================================
// Public Inversion Engine Entry Point
// =============================================================================

/**
 * Evaluates Step 1 Inversion & Red-Flag Matrix across all 6 archetypes, A1 guardrails,
 * 3Y multi-year resilience checks, roll-up goodwill traps, and qualitative AI flags.
 *
 * @param {Object|null} companyFacts - Normalized (or metrics-bearing) SEC company data
 * @param {Object} [options={}]
 * @param {string} [options.archetype='STAPLES_GENERAL']
 * @param {string} [options.financialSubType='NONE']
 * @param {Object} [options.aiSummary]
 * @param {Object} [options.triageMetrics] - Precomputed 4 pillar metrics (revenue, margins, shares, currentRatio)
 * @param {boolean} [options.isLowCostRetailException=false]
 * @returns {Object} Structured inversion result with tier1Red, tier2Yellow, tier3Context, summary, guardrails, resilience3Y, capitalStructure
 */
export function evaluateInversionFlags(companyFacts, options = {}) {
  const metrics = companyFacts?.metrics || null;
  const {
    archetype = metrics?.revenue?.tag && BANK_REVENUE_TAGS.includes(metrics.revenue.tag)
      ? 'FINANCIAL_SPREAD'
      : 'STAPLES_GENERAL',
    financialSubType = metrics?.revenue?.tag && BANK_REVENUE_TAGS.includes(metrics.revenue.tag)
      ? 'DEPOSIT_BANK'
      : archetype === 'FINANCIAL_SPREAD'
      ? 'NON_BANK_FINANCE'
      : 'NONE',
    aiSummary = null,
    triageMetrics = {
      revenue: { status: 'unavailable' },
      margins: { status: 'unavailable' },
      shares: { status: 'unavailable' },
      currentRatio: { status: 'unavailable' },
    },
    isLowCostRetailException = false,
  } = options;

  const snap = extractFinancialSnapshot(metrics, triageMetrics.shares, archetype, financialSubType);
  const saasDeferredRevenue = evaluateSaaSDeferredRevenueGuardrail(metrics, archetype);
  const buybackCannibal = evaluateBuybackCannibalGuardrail(snap, archetype);
  const bankDepositExempt =
    archetype === 'FINANCIAL_SPREAD' && financialSubType === 'DEPOSIT_BANK'
      ? { active: true, equityToAssetsPct: snap.equityToAssetsPct }
      : { active: false };

  const guardrails = {
    buybackCannibal,
    saasDeferredRevenue,
    bankDepositExempt,
  };

  const rawRed = [];
  const rawYellow = [];
  const tier3Context = [];

  const pushRed = (flag) => rawRed.push(flag);
  const pushYellow = (flag) => rawYellow.push(flag);
  const pushContext = (item) => tier3Context.push(item);

  const isUnavailable = !snap.hasAnyMetrics;

  if (!isUnavailable) {
    evaluateSolvencyAndLeverage(
      snap,
      guardrails,
      archetype,
      financialSubType,
      pushRed,
      pushYellow,
      pushContext
    );
    evaluateResilience3Y(snap, pushRed, pushYellow);
    evaluateGoodwillAndReturns(
      snap,
      triageMetrics.shares,
      buybackCannibal.active,
      pushRed,
      pushYellow
    );
    evaluateCorePillarsAndArchetype(
      snap,
      triageMetrics,
      guardrails,
      archetype,
      financialSubType,
      isLowCostRetailException,
      pushRed,
      pushYellow,
      pushContext
    );
  }

  mergeQualitativeAiFlags(aiSummary, pushRed, pushYellow, pushContext);

  const { tier1Red, tier2Yellow } = mergeOverlappingFlags(rawRed, rawYellow);
  const redCount = tier1Red.length;
  const yellowCount = tier2Yellow.length;
  const contextCount = tier3Context.length;

  const hasRedFlags = redCount > 0;
  const hasYellowWarnings = yellowCount > 0;
  const overallStatus = hasRedFlags
    ? 'fail'
    : hasYellowWarnings
    ? 'warn'
    : isUnavailable
    ? 'unavailable'
    : 'pass';
  const isCleanPass = !isUnavailable && redCount === 0 && yellowCount === 0;
  const { bannerHe, bannerEn } = buildCompactBannerText(
    redCount,
    yellowCount,
    contextCount,
    isUnavailable
  );

  return {
    archetype,
    financialSubType,
    tier1Red,
    tier2Yellow,
    tier3Context,
    summary: {
      redCount,
      yellowCount,
      contextCount,
      overallStatus,
      isCleanPass,
      hasRedFlags,
      hasYellowWarnings,
      bannerHe,
      bannerEn,
    },
    guardrails,
    resilience3Y: {
      yearsEvaluated: snap.yearsEvaluated,
      cashConversionRatio: snap.cashConversionRatio,
      sumOcf3Y: snap.sumOcf3Y,
      sumNetIncome3Y: snap.sumNetIncome3Y,
      sumFcf3Y: snap.sumFcf3Y,
      sumSbc3Y: snap.sumSbc3Y,
      fcfExSbc3Y: snap.fcfExSbc3Y,
      sbcToRevenueLatestPct: snap.sbcToRevenueLatestPct,
      capitalReturns3Y: snap.capitalReturns3Y,
      netDebtChange3Y: snap.netDebtChange3Y,
      goodwillToAssetsPct: snap.goodwillToAssetsPct,
      roicPct: snap.roicPct,
      roe5YAvgPct: snap.roe5YAvgPct,
      netDebtToFcf: snap.netDebtToFcf,
      ebitInterestCoverage: snap.ebitInterestCoverage,
      liabilitiesToEquity: snap.liabilitiesToEquity,
      equityToAssetsPct: snap.equityToAssetsPct,
      grossMarginLatestPct: snap.grossMarginLatestPct,
      cashRunwayQuarters: snap.cashRunwayQuarters,
    },
    capitalStructure: buildCapitalStructureSummary(
      snap,
      guardrails,
      archetype,
      financialSubType
    ),
  };
}

export default evaluateInversionFlags;
