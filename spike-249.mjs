/**
 * Spike #249 — Run normalizeCompanyFacts against real SEC data for 5 companies.
 * Throwaway script. Run: node --import ./spike-249-env.mjs spike-249.mjs
 * (env shim sets import.meta.env so gaapNormalizer.js doesn't throw in Node)
 */
import { readFileSync } from 'fs';
import { normalizeCompanyFacts, extractTimeSeriesData } from './src/utils/gaapNormalizer.js';

// Polyfill import.meta.env for Node (gaapNormalizer checks import.meta.env.DEV)
// It's only used for dev logging so undefined is fine — nothing to do.

const TICKERS = ['AAPL', 'MSFT', 'SAP', 'SHOP', 'SOFI'];
const SPIKE_METRICS = ['revenue', 'netIncome', 'operatingCashFlow', 'capitalExpenditures', 'grossProfit'];

// ---------- helpers ----------

function fmt(val) {
  if (val == null) return 'n/a';
  return (val / 1e9).toFixed(2) + 'B';
}

function latestAnnual(metric) {
  return metric?.annual?.[0]?.value ?? null;
}

function annualYears(metric) {
  return metric?.annual?.map(d => d.fiscalYear) ?? [];
}

function detectNonUSD(companyFactsJson) {
  const us = companyFactsJson?.facts?.['us-gaap'] || {};
  const nonUSD = new Set();
  for (const tagName of Object.keys(us)) {
    const units = us[tagName]?.units || {};
    for (const key of Object.keys(units)) {
      if (key !== 'USD' && key !== 'shares' && key !== 'USD/shares' && key !== 'pure') {
        nonUSD.add(key);
      }
    }
  }
  return [...nonUSD];
}

function detectTagsPresent(companyFactsJson, metricTags) {
  const us = companyFactsJson?.facts?.['us-gaap'] || {};
  return metricTags.filter(t => !!us[t]);
}

// Revenue tag candidates from GAAP_TAG_MAP
const REVENUE_TAGS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueNet',
  'SalesRevenueGoodsNet',
  'SalesRevenueServicesNet',
  'NetRevenuesFromSalesOfProducts',
  'TotalRevenuesAndOtherIncome',
];

// ---------- main ----------

const results = {};

for (const ticker of TICKERS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${ticker}...`);

  const raw = JSON.parse(readFileSync(`C:/Users/I543234/AppData/Local/Temp/sec_spike/${ticker}.json`, 'utf-8'));

  // Detect non-USD units BEFORE normalization
  const nonUSDUnits = detectNonUSD(raw);
  const revTagsPresent = detectTagsPresent(raw, REVENUE_TAGS);

  // Run the normalizer
  const normalized = normalizeCompanyFacts(raw);

  // Harvest results
  const metrics = normalized.metrics;
  const meta = normalized.metadata;

  const row = {
    ticker,
    companyName: normalized.companyName,
    metadataCurrency: meta.currency,
    nonUSDUnitsInFacts: nonUSDUnits,
    metricsFound: meta.metricsFound,
    metricsTotal: meta.metricsTotal,
    missingMetrics: meta.missingMetrics,
    warnings: meta.warnings,
    revTagsPresent,
    tagUsed: {},
    latestAnnualValues: {},
    annualYearsCovered: {},
    fcfNote: null,
  };

  // Per spike metric: tag used, latest annual value, years covered
  for (const m of SPIKE_METRICS) {
    const metric = metrics[m];
    row.tagUsed[m] = metric?.tag ?? null;
    row.latestAnnualValues[m] = latestAnnual(metric);
    row.annualYearsCovered[m] = annualYears(metric);
  }

  // FCF (calculated)
  const fcf = metrics.freeCashFlow;
  row.tagUsed['freeCashFlow'] = 'calculated (OCF - CapEx)';
  row.latestAnnualValues['freeCashFlow'] = latestAnnual(fcf);
  row.annualYearsCovered['freeCashFlow'] = annualYears(fcf);
  if (!fcf?.annual?.length) {
    const ocf = metrics.operatingCashFlow;
    const capex = metrics.capitalExpenditures;
    row.fcfNote = `OCF annual points: ${ocf?.annual?.length ?? 0}, CapEx annual points: ${capex?.annual?.length ?? 0}`;
  }

  results[ticker] = row;
  console.log(JSON.stringify(row, null, 2));
}

// Print summary table
console.log('\n\n' + '='.repeat(80));
console.log('SUMMARY TABLE');
console.log('='.repeat(80));
const allMetrics = [...SPIKE_METRICS, 'freeCashFlow'];
console.log(['Ticker', ...allMetrics].map(h => h.padEnd(22)).join(''));
for (const ticker of TICKERS) {
  const r = results[ticker];
  const cols = [ticker.padEnd(22)];
  for (const m of allMetrics) {
    const v = r.latestAnnualValues[m];
    cols.push(fmt(v).padEnd(22));
  }
  console.log(cols.join(''));
}

console.log('\n\nNon-USD unit keys per company:');
for (const ticker of TICKERS) {
  const r = results[ticker];
  console.log(`  ${ticker}: [${r.nonUSDUnitsInFacts.join(', ')}] | metadata.currency = "${r.metadataCurrency}"`);
}

console.log('\n\nRevenue tags present in facts (candidates tried):');
for (const ticker of TICKERS) {
  const r = results[ticker];
  console.log(`  ${ticker}: present=[${r.revTagsPresent.join(', ')}] | used="${r.tagUsed.revenue}"`);
}

console.log('\n\nMissing metrics per company:');
for (const ticker of TICKERS) {
  const r = results[ticker];
  console.log(`  ${ticker}: [${r.missingMetrics.join(', ')}]`);
}

console.log('\n\nWarnings per company:');
for (const ticker of TICKERS) {
  const r = results[ticker];
  r.warnings.forEach(w => console.log(`  ${ticker}: ${w}`));
}

console.log('\n\nFCF notes:');
for (const ticker of TICKERS) {
  const r = results[ticker];
  if (r.fcfNote) console.log(`  ${ticker}: ${r.fcfNote}`);
}
