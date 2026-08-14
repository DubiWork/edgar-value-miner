# Spike #249 — `normalizeCompanyFacts` Against Real SEC Data

**Date:** 2026-08-14  
**Script:** `spike-249.mjs` (throwaway, kept at repo root)  
**Data source:** SEC EDGAR `/api/xbrl/companyfacts/CIK{10-digit}.json`  
**Normalizer:** `src/utils/gaapNormalizer.js` — no code was modified

---

## Companies Tested

| Ticker | CIK         | Type                   |
|--------|-------------|------------------------|
| AAPL   | 0000320193  | Large-cap, 40yr history, USD |
| MSFT   | 0000789019  | Large-cap, known XBRL shifts, USD |
| SAP    | 0001000184  | Non-USD (EUR primary), IFRS filer |
| SHOP   | 0001594805  | Non-USD (CAD reporter), USD filer |
| SOFI   | 0001818874  | Small-cap fintech, sparse data |

---

## Per-Company Findings

### AAPL — Apple Inc.

| Metric              | Status | Tag Used                                             | Latest Annual (FY2025) | Years Covered     |
|---------------------|--------|------------------------------------------------------|------------------------|-------------------|
| revenue             | ok     | `RevenueFromContractWithCustomerExcludingAssessedTax` | $416.16B               | 2021–2025         |
| netIncome           | ok     | `NetIncomeLoss`                                      | $112.01B               | 2021–2025         |
| operatingCashFlow   | ok     | `NetCashProvidedByUsedInOperatingActivities`         | $111.48B               | 2021–2025         |
| capitalExpenditures | ok     | `PaymentsToAcquirePropertyPlantAndEquipment`         | $12.71B                | 2021–2025         |
| grossProfit         | ok     | `GrossProfit`                                        | $195.20B               | 2021–2025         |
| freeCashFlow        | ok     | calculated (OCF − CapEx)                             | $98.77B                | 2021–2025         |

**Notes:**
- **Tag shift — revenue:** Apple used `SalesRevenueNet` through 2017, `Revenues` through 2018, then switched to `RevenueFromContractWithCustomerExcludingAssessedTax` from 2019 onward. `findGaapTag` correctly picks the most-recent-end-date tag (`RevenueFromContractWithCustomerExcludingAssessedTax`), so FY2021–FY2025 are populated correctly with 5 years returned. **However**, if a user requests history beyond 5 years, they would lose pre-2019 data because only one tag's series is returned — the three eras are not stitched together.
- **Non-USD units:** `Year` and `Store` unit keys appear in facts (non-financial count metrics). Not relevant to financial extraction; no impact on normalizer.
- **Missing metrics:** `totalDebt` (AAPL uses `LongTermDebt` + `CommercialPaper` separately, no single `LongTermDebtNoncurrent` plus current aggregate tag), `treasuryStock` (uses buyback reporting differently). These are existing gaps unrelated to this spike.
- **metadata.currency:** hardcoded `"USD"` — correct for AAPL.
- **metricsFound:** 39/41 — strong coverage.

---

### MSFT — Microsoft Corporation

| Metric              | Status | Tag Used                                             | Latest Annual (FY2026) | Years Covered     |
|---------------------|--------|------------------------------------------------------|------------------------|-------------------|
| revenue             | ok     | `RevenueFromContractWithCustomerExcludingAssessedTax` | $331.84B               | 2022–2026         |
| netIncome           | ok     | `NetIncomeLoss`                                      | $133.75B               | 2022–2026         |
| operatingCashFlow   | ok     | `NetCashProvidedByUsedInOperatingActivities`         | $182.94B               | 2022–2026         |
| capitalExpenditures | ok     | `PaymentsToAcquirePropertyPlantAndEquipment`         | $115.95B               | 2022–2026         |
| grossProfit         | ok     | `GrossProfit`                                        | $225.47B               | 2022–2026         |
| freeCashFlow        | ok     | calculated (OCF − CapEx)                             | $67.00B                | 2022–2026         |

**Notes:**
- **Tag shift — revenue (most dramatic in dataset):** MSFT went through three distinct XBRL tag eras:
  - `Revenues` → used through FY2010 (max end: 2010-06-30)
  - `SalesRevenueNet` → used FY2012–FY2017 (max end: 2017-06-30)
  - `RevenueFromContractWithCustomerExcludingAssessedTax` → FY2018–present (max end: 2026-06-30)
  `findGaapTag` correctly picks the current tag, so the 5-year window (FY2022–FY2026) is complete. The pre-2018 history is silently inaccessible — 15+ years of data is not returned.
- **Non-USD units:** `EUR`, `Entity`, `Segment`, `USD/Contract`, `USD/Investment`, `Position`, `Job` appear in facts (lease obligations in EUR, headcount metrics, etc.). The normalizer's `extractTimeSeriesData` correctly falls back to `USD` first — EUR values are never accidentally used for financial metrics since the tag selection logic still picks USD.
- **metadata.currency:** hardcoded `"USD"` — correct for MSFT.
- **metricsFound:** 40/41. Only `treasuryStock` missing (MSFT tracks buybacks differently).

---

### SAP — SAP SE

| Metric              | Status            | Tag Used | Latest Annual | Years Covered |
|---------------------|-------------------|----------|---------------|---------------|
| revenue             | **missing (silent)** | null  | n/a           | —             |
| netIncome           | **missing (silent)** | null  | n/a           | —             |
| operatingCashFlow   | **missing (silent)** | null  | n/a           | —             |
| capitalExpenditures | **missing (silent)** | null  | n/a           | —             |
| grossProfit         | **missing (silent)** | null  | n/a           | —             |
| freeCashFlow        | **missing (silent)** | null  | n/a           | —             |

**Notes — critical: total silent failure for IFRS filer:**
- SAP files on SEC using the **IFRS taxonomy** (`ifrs-full` namespace), not US-GAAP. The `facts` object contains only two namespaces: `dei` and `ifrs-full`. There is **no `us-gaap` key** in the facts.
- `findGaapTag` hard-codes `companyFacts.facts['us-gaap']` (line 536). When `us-gaap` is absent, it returns `null` for every metric.
- **Result:** `normalizeCompanyFacts` returns **0 metrics found out of 41**, with all metrics in `missingMetrics`. The normalizer emits a `"Company appears to be pre-revenue"` warning — which is misleading since SAP FY2025 revenue was €36.8B (~$38.9B).
- **Actual data in facts:**
  - IFRS tag `Revenue` exists with **EUR** as primary unit (FY2015–FY2025 in EUR), with USD only through 2017.
  - FY2025 EUR revenue: €36,800,000,000
  - FY2024 EUR revenue: €34,176,000,000
- **metadata.currency:** hardcoded `"USD"` — **wrong** (SAP reports in EUR).
- This is not just a currency bug — it's a complete namespace miss. SAP, ASML, NVO, TTE, HSBC, and all other IFRS SEC filers are affected.
- **Non-USD units found in facts:** none detected in `us-gaap` (because there is no `us-gaap`). The IFRS namespace has EUR as primary unit.

---

### SHOP — Shopify Inc.

| Metric              | Status | Tag Used                                     | Latest Annual (FY2025) | Years Covered     |
|---------------------|--------|----------------------------------------------|------------------------|-------------------|
| revenue             | ok     | `Revenues`                                   | $11.56B                | 2024–2025 only    |
| netIncome           | ok     | `NetIncomeLoss`                              | $1.23B                 | 2024–2025 only    |
| operatingCashFlow   | ok     | `NetCashProvidedByUsedInOperatingActivities` | $2.03B                 | 2024–2025 only    |
| capitalExpenditures | ok     | `PaymentsToAcquirePropertyPlantAndEquipment` | $0.03B                 | 2024–2025 only    |
| grossProfit         | ok     | `GrossProfit`                                | $5.55B                 | 2024–2025 only    |
| freeCashFlow        | ok     | calculated (OCF − CapEx)                     | $2.01B                 | 2024–2025 only    |

**Notes:**
- **Shallow annual history (2 years only):** SHOP files 10-K (USD denomination) but the `frame` field for annual data is only populated for the most recent 2 fiscal years (FY2024, FY2025). Earlier 10-K filings exist but lack the `CY{year}` or `CY{year}I4` frame annotation that `extractTimeSeriesData` requires for annual deduplication. Earlier data (FY2017–FY2023) is present in the raw JSON but filtered out. This is a known EDGAR annotation gap for companies that didn't fully adopt the framing convention early. **Impact:** Only 2/5 possible annual years are returned instead of 5.
- **Tag shift — revenue:** Three tags present (`Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`, `SalesRevenueServicesNet`). `findGaapTag` selects `Revenues` because it has the most recent max end date (2025-12-31). `RevenueFromContractWithCustomerExcludingAssessedTax` has 0 annual USD points with frame annotations — selecting it would return nothing. So tag selection is correct here.
- **CAD currency:** `CAD` unit key is present in `RestrictedCashAndCashEquivalentsAtCarryingValue`. All primary financials (revenue, net income, OCF) report in USD — Shopify reports to SEC in USD even though it's a Canadian company. The normalizer correctly uses USD values. **metadata.currency = "USD"** is correct for SEC filings, but the UI should clarify these are USD-denominated Canadian company financials.
- **Non-USD units:** `CAD` (restricted cash), `segment`, `reporting_unit`, `parent_company`, `patent` — all non-financial count-type units. No impact on financial metrics.
- **Missing metrics:** `sharesOutstanding` (Shopify reports shares as Class A/B separately with no aggregate tag that matches the normalizer's list), `interestExpense`, `dividendsPaid`, `shortTermDebt`, `longTermDebt`, `totalDebt`, `treasuryStock`.

---

### SOFI — SoFi Technologies, Inc.

| Metric              | Status            | Tag Used                                             | Latest Annual (FY2025) | Years Covered |
|---------------------|-------------------|------------------------------------------------------|------------------------|---------------|
| revenue             | **wrong (partial)** | `RevenueFromContractWithCustomerExcludingAssessedTax` | $0.62B               | 2021–2025     |
| netIncome           | ok                | `NetIncomeLoss`                                      | $0.48B                 | 2021–2025     |
| operatingCashFlow   | ok (but unusual)  | `NetCashProvidedByUsedInOperatingActivities`         | −$3.74B                | 2021–2025     |
| capitalExpenditures | ok                | `PaymentsToAcquireProductiveAssets`                  | $0.24B                 | 2021–2025     |
| grossProfit         | **missing**       | null                                                 | n/a                    | —             |
| freeCashFlow        | ok (calculated)   | calculated (OCF − CapEx)                             | −$3.98B                | 2021–2025     |

**Notes:**
- **Revenue severely understated — fintech/bank reporting mismatch:** `RevenueFromContractWithCustomerExcludingAssessedTax` ($0.62B for FY2025) captures only SoFi's fee/service revenue. For a bank holding company the meaningful "total revenue" is `RevenuesNetOfInterestExpense` ($3.61B for FY2025) — a 6× difference. The tag `RevenuesNetOfInterestExpense` is not in the normalizer's `revenue` tag list. The normalizer silently returns the wrong (partial) value with no warning. This is a systematic issue for bank/fintech companies (SOFI, banks, insurance companies).
- **CapEx tag shift:** normalizer used `PaymentsToAcquireProductiveAssets` (index 1 fallback) instead of `PaymentsToAcquirePropertyPlantAndEquipment` (index 0). This is the correct fallback behavior — fintech companies acquire software/IP assets rather than physical PP&E.
- **GrossProfit missing:** Banks/fintechs do not report gross profit in the traditional sense. No `GrossProfit` tag exists in the filing. Silent failure is appropriate here, but the warning system doesn't surface this.
- **Negative OCF ($−3.74B):** SoFi originates loans as inventory (held-for-sale), so net loan originations flow through operating cash flow — making OCF highly negative even in profitable years. This is structurally correct per GAAP for bank/fintech entities but would look alarming to a non-specialist user with no contextual warning.
- **Non-USD units:** `segment`, `USN` (US Navy — SoFi's heritage from student loans), `acquisition` — count/label units. No impact on financial metrics.
- **metadata.currency:** hardcoded `"USD"` — correct.
- **metricsFound:** 33/41.

---

## Summary

### Summary Table — Latest Annual Values

| Metric              | AAPL       | MSFT       | SAP        | SHOP       | SOFI       |
|---------------------|------------|------------|------------|------------|------------|
| revenue             | $416.16B   | $331.84B   | **n/a**    | $11.56B    | $0.62B†    |
| netIncome           | $112.01B   | $133.75B   | **n/a**    | $1.23B     | $0.48B     |
| operatingCashFlow   | $111.48B   | $182.94B   | **n/a**    | $2.03B     | −$3.74B    |
| capitalExpenditures | $12.71B    | $115.95B   | **n/a**    | $0.03B     | $0.24B     |
| grossProfit         | $195.20B   | $225.47B   | **n/a**    | $5.55B     | **n/a**    |
| freeCashFlow        | $98.77B    | $67.00B    | **n/a**    | $2.01B     | −$3.98B    |

† SOFI revenue is underreported — $3.61B via `RevenuesNetOfInterestExpense` is the correct comparable figure.

---

### Cross-Company Patterns

#### 1. Tag-Shift Cases

All large, long-lived companies exhibit tag shifts. The normalizer's `findGaapTag` handles this correctly for **current** data (picks the tag with the most recent end date), but historical continuity is lost:

| Company | Metric  | Era 1 (oldest)       | Era 2 (middle)         | Era 3 (current)                                    |
|---------|---------|----------------------|------------------------|----------------------------------------------------|
| AAPL    | revenue | `SalesRevenueNet` (pre-2018) | `Revenues` (2018) | `RevenueFromContractWithCustomerExcludingAssessedTax` (2019+) |
| MSFT    | revenue | `Revenues` (pre-2011) | `SalesRevenueNet` (2012–2017) | `RevenueFromContractWithCustomerExcludingAssessedTax` (2018+) |

**Implication for #251 (tag normalization):** A stitching pass is needed to concatenate historical eras when the 5-year window is requested and the current tag doesn't reach back far enough. Priority: medium (current 5-year window works correctly; only affects requests for longer history).

#### 2. IFRS Filer — Total Namespace Miss (SAP)

The normalizer exclusively reads `facts['us-gaap']`. Foreign private issuers (20-F filers) that use IFRS taxonomy have **no `us-gaap` key** — the result is 0 metrics found with misleading warnings. This is not a currency bug; it's a fundamentally different data model.

**Affected companies:** SAP, ASML, NVO, TotalEnergies, Novartis, AstraZeneca, HSBC, and all other IFRS SEC filers.

**Implication for #252:** Before implementing currency normalization, the architecture must decide whether to support IFRS filers at all. If yes, a parallel IFRS tag map (`IFRS_TAG_MAP`) must be built alongside `GAAP_TAG_MAP`, and `findGaapTag` must be extended to check `facts['ifrs-full']` when `facts['us-gaap']` is absent. The currency issue for IFRS filers (EUR reporting) is a secondary concern — the namespace miss is the blocker.

#### 3. Non-USD Currency Cases

| Company | Primary Filing Currency | Non-USD Units in Facts | metadata.currency | Correctness |
|---------|------------------------|------------------------|-------------------|-------------|
| AAPL    | USD                    | Year, Store (counts)   | USD               | correct     |
| MSFT    | USD                    | EUR (leases), various counts | USD          | correct     |
| SAP     | EUR (IFRS)             | n/a (no us-gaap)       | USD               | **wrong** — SAP reports in EUR; metadata says USD |
| SHOP    | USD (CAD company)      | CAD (restricted cash), counts | USD        | correct (USD filings) |
| SOFI    | USD                    | segment/acquisition counts | USD           | correct     |

**Implication for #252:** `metadata.currency` is hardcoded to `'USD'` (line 1059). This must become dynamic. For US-GAAP filers the correct answer is always USD. For IFRS filers it must be derived from the actual unit keys used in the financial data tags.

#### 4. Silent Failures

The following failures produce no warning to the caller:

| Company | Failure                               | Warning Emitted? | Impact |
|---------|---------------------------------------|-----------------|--------|
| SAP     | 0 metrics (IFRS filer)                | `isPreRevenue` warning only — misleading | High — caller cannot distinguish "no data" from "wrong data" |
| SOFI    | revenue = fee-only ($0.62B vs $3.61B) | None            | High — 6× understatement with no signal |
| SHOP    | Only 2 annual years returned (vs 5)   | None            | Medium — user doesn't know history is truncated |
| MSFT    | Pre-2018 revenue history silently dropped | None         | Low for 5yr window, medium for longer requests |

#### 5. Fintech/Bank Revenue Reporting

Banks and fintech companies do not use standard `RevenueFromContractWithCustomer*` tags as their primary revenue line. The normalizer's `revenue` tag list lacks:
- `RevenuesNetOfInterestExpense` (bank total revenue)
- `NetInterestIncome` + `NoninterestIncome` (bank components)
- `InterestAndDividendIncomeOperating`

For SOFI specifically, the mapped tag returned $0.62B vs the correct $3.61B — a **6× understatement**. The error is silent.

---

### Recommendations

#### For Issue #251 — Tag Normalization

1. **Tag stitching across eras:** When fewer than `ANNUAL_YEARS` data points are found from the winning tag, fall back and merge data from older tag eras to fill the window. Needed for AAPL, MSFT, and any company with a multi-era XBRL history.
2. **Add bank/fintech revenue tags** to the `revenue` entry in `GAAP_TAG_MAP`:
   - `RevenuesNetOfInterestExpense`
   - `BankingInterestIncome` (when relevant)
3. **SHOP frame-annotation gap:** Companies with missing `frame` annotations on older 10-K filings get only 1–2 years of annual data. Consider falling back to filtering by `start`/`end` date span (≥ 350 days) instead of requiring a `frame` match.

#### For Issue #252 — Currency Normalization

1. **Fix `metadata.currency`:** Replace the hardcoded `'USD'` (line 1059) with a function that inspects the actual unit keys used for the selected revenue tag. For US-GAAP filers this will always resolve to USD; for IFRS filers it would surface EUR, CHF, etc.
2. **IFRS namespace support (prerequisite):** `findGaapTag` must be extended to also search `facts['ifrs-full']` with a companion `IFRS_TAG_MAP`. Until this is implemented, IFRS filers are completely unsupported — they should be detected early and surface a clear `"IFRS filer — not supported"` error rather than the misleading `isPreRevenue` warning.
3. **CAD-filing companies (SHOP):** Shopify files in USD despite being a Canadian company. No action needed for currency normalization — USD is correct. Document this nuance.
4. **Detection helper:** Add a utility function `detectFilingCurrency(companyFactsJson)` that returns `{ namespace: 'us-gaap'|'ifrs-full'|null, primaryCurrency: 'USD'|'EUR'|... }` — useful for both the UI and the normalizer's metadata.

---

### Spike Artifacts

- **Spike script:** `spike-249.mjs` + `spike-249-env.mjs` (Node `import.meta.env` shim — needed because `gaapNormalizer.js` calls `import.meta.env.DEV` which is undefined in Node)
- **SEC JSON cache:** `C:/Users/I543234/AppData/Local/Temp/sec_spike/` (local temp, not committed)
