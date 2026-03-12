# Edgar Miner Execution Plan

**Date:** 2026-03-12
**Source:** CEO Strategic Audit (Score: 27.9/100 -- Critical)
**Decision:** Option A -- Personal Productivity Tool First
**Constraint:** Solo developer, 10 hrs/week, 2-week sprints, max 3 stories per sprint
**Goal:** Go from "2 metrics, no display" to "usable personal tool replacing Google Sheets"

---

## Strategic Context

The CEO audit diagnosed Edgar Miner as **strategically misaligned** -- building SaaS infrastructure with solo-developer resources. The path forward is brutally simple: narrow to ONE workflow (ticker -> Feroldi score -> DCF -> buy/pass/watch), ship it as a personal tool, then decide about SaaS based on real usage.

**What we are building:** An opinionated investment evaluation system that automates the founder's manual 3-spreadsheet workflow. Not a generic financial data tool.

**What we are NOT building (explicitly deferred):**
- Authentication / multi-tenancy
- Portfolio tracking
- Company comparison views
- Alerts and notifications
- Report export / PDF generation
- Azure Functions
- Database (keep file-based for personal tool)

---

## Technical Approach

### Architecture (Simplified for Personal Tool)

```
[React UI] --> [.NET 8.0 API] --> [SEC EDGAR]
     |                |
     |                +--> [FMP API] (via backend proxy -- NOT from frontend)
     |                |
     |                +--> [File Cache]
     |
     +--> Express Server (workspace persistence -- existing)
```

**Key architectural decisions:**
1. **Move FMP API key to backend** -- proxy all FMP calls through .NET API. Fixes OWASP A01.
2. **Keep file-based storage** -- personal tool, no need for database.
3. **Keep Clean Architecture** -- it already exists, ripping it out wastes time.
4. **Defer Vite migration** -- CRA works, migration is pure tech debt that does not ship features.
5. **Add TypeScript incrementally** -- new files only, do not rewrite existing JS files.

### Data Strategy

SEC EDGAR XBRL taxonomy provides hundreds of metrics. We need exactly **20 metrics** to power the Feroldi score + DCF calculations. The backend already has the scaffolding in `UsGaap.cs` (200+ commented-out properties). We uncomment and wire the ones we need.

**Required metrics (grouped by financial statement):**

Income Statement:
1. Revenue (DONE -- 7 GAAP variants handled)
2. Cost of Goods Sold / Cost of Revenue
3. Gross Profit
4. Operating Income (DONE)
5. Net Income
6. Earnings Per Share (Diluted)
7. Shares Outstanding

Balance Sheet:
8. Total Assets
9. Total Current Assets
10. Total Liabilities
11. Total Current Liabilities
12. Stockholders Equity
13. Long Term Debt

Cash Flow Statement:
14. Cash Flow from Operations
15. Capital Expenditures
16. Free Cash Flow (calculated: CFO - CapEx)
17. Dividends Paid
18. Share Repurchases

Market Data (from FMP, proxied through backend):
19. Current Stock Price
20. P/E Ratio (TTM)

---

## Phase Structure

| Phase | Name | Sprints | Focus | Outcome |
|-------|------|---------|-------|---------|
| 0 | Security & Foundation | 1 | Fix API key, backend proxy | No more OWASP violations |
| 1 | Data Engine | 3 | Parse 20 metrics from SEC EDGAR | Backend returns all needed data |
| 2 | Scoring Engine | 2 | Feroldi Quality Score calculation | Automated 13-point checklist |
| 3 | Valuation Engine | 2 | P/E DCF + Gordon Growth DCF | Buy/pass/watch recommendation |
| 4 | UI: Evaluation Dashboard | 3 | Display scores, DCF, recommendation | Usable personal tool (V0.1) |
| 5 | Polish & Self-Use | 1 | Bug fixes from real usage | Stable daily driver |

**Total: 12 sprints = 24 weeks = ~6 months**
**Hours: ~240 hrs (12 sprints x 2 weeks x 10 hrs/week)**

---

## Phase 0: Security & Foundation (Sprint 1)

**Goal:** Fix the CRITICAL security issue and establish backend-proxied API pattern.

### Epic: Security Hardening & API Proxy

#### Story 0.1: Move FMP API Key to Backend Proxy
**Repo:** EDGARMiner (backend) + edgar-miner-ui (frontend)
**Description:** As a developer, I want FMP API calls routed through my .NET backend so that the API key is never exposed in frontend JavaScript.

**Acceptance Criteria:**
- [ ] New endpoint `GET /api/fmp/search?query={ticker}` proxies FMP company search
- [ ] New endpoint `GET /api/fmp/quote/{symbol}` proxies FMP stock quote
- [ ] FMP API key stored in appsettings.json (gitignored) and/or environment variable
- [ ] Frontend `useCompanyTickers.js` updated to call backend proxy instead of FMP directly
- [ ] No FMP API key present in any frontend code
- [ ] CORS configured to allow frontend origin only

**Sub-tasks:**
1. Create `FmpProxyController.cs` with search and quote endpoints [4h]
2. Create `IFmpService.cs` and `FmpService.cs` with HttpClient to FMP API [3h]
3. Add FMP API key to appsettings.json + environment variable fallback [1h]
4. Configure CORS in `Program.cs` for localhost origins [1h]
5. Update frontend `useCompanyTickers.js` hook to call backend proxy [2h]
6. Remove FMP API key from all frontend files (search all `.js`, `.env`) [1h]
7. Test end-to-end: search works through proxy [1h]
8. Add `.env` and `appsettings.Development.json` to `.gitignore` if not already [0.5h]

**Estimated total:** 13.5h (Sprint 1)
**Dependencies:** None
**Backend issues to close:** None (new work)
**Frontend issues to close:** None (new work)

#### Story 0.2: Clean Up Dead Code
**Repo:** EDGARMiner (backend)
**Description:** Remove broken Azure Functions project and WeatherForecast boilerplate.

**Acceptance Criteria:**
- [ ] `EDGARFunctions` project removed from solution
- [ ] `WeatherForecastController.cs` and `WeatherForecast.cs` deleted
- [ ] Solution builds and tests pass

**Sub-tasks:**
1. Remove `EDGARFunctions` project reference from `EDGARMiner.sln` [0.5h]
2. Delete `WeatherForecastController.cs` and `WeatherForecast.cs` [0.5h]
3. Verify build + existing tests pass [0.5h]

**Estimated total:** 1.5h
**Dependencies:** None

---

## Phase 1: Data Engine (Sprints 2-4)

**Goal:** Expand SEC EDGAR parsing from 2 metrics to all 18 needed from EDGAR (metrics 19-20 come from FMP, already proxied in Phase 0).

### Epic: Comprehensive Financial Data Extraction

The existing `UsGaap.cs` already has 200+ metrics as commented-out properties with their XBRL class stubs. The work is: uncomment the ~18 we need, ensure their parser classes extract annual data correctly, create a unified `FinancialSummary` response model, and expose it through a new API endpoint.

#### Story 1.1: Income Statement Metrics Extraction
**Repo:** EDGARMiner (backend)
**Description:** As a user, I want to retrieve complete income statement data for any public company so that I can evaluate profitability trends.

**Metrics:** Gross Profit, Net Income, EPS (Diluted), Shares Outstanding
(Revenue and Operating Income already done.)

**Acceptance Criteria:**
- [ ] `UsGaap.cs` properties uncommented for: `GrossProfit`, `NetIncomeLoss`, `EarningsPerShareDiluted`, `CommonStockSharesOutstanding` (+ GAAP variants for each)
- [ ] Each metric returns 5+ years of annual data (10-K filings only, filtered by `form` field)
- [ ] Cost of Revenue calculable as Revenue - Gross Profit
- [ ] Integration test verifying data retrieval for AAPL, MSFT (known tickers)

**Sub-tasks:**
1. Identify all GAAP taxonomy variants for each metric (SEC EDGAR XBRL docs) [2h]
2. Uncomment and create/update parser classes for Gross Profit variants [2h]
3. Uncomment and create/update parser classes for Net Income variants [2h]
4. Uncomment and create/update parser classes for EPS Diluted variants [2h]
5. Uncomment and create/update parser classes for Shares Outstanding variants [2h]
6. Add annual-data filtering logic (10-K only, deduplicate by fiscal year) [3h]
7. Write integration tests for each metric against AAPL and MSFT [3h]

**Estimated total:** 16h (Sprint 2)
**Dependencies:** None
**Backend issues addressed:** #16 (Net Income), #17 (EPS), #18 (Gross Margin), #19 (Operating Margin), #20 (Net Profit Margin), #21 (Shares Outstanding)

#### Story 1.2: Balance Sheet Metrics Extraction
**Repo:** EDGARMiner (backend)
**Description:** As a user, I want balance sheet data to evaluate financial health and leverage.

**Metrics:** Total Assets, Total Current Assets, Total Liabilities, Total Current Liabilities, Stockholders Equity, Long Term Debt

**Acceptance Criteria:**
- [ ] All 6 balance sheet metrics return 5+ years of annual data
- [ ] Current Ratio calculable as Current Assets / Current Liabilities
- [ ] Debt-to-Equity calculable as Total Liabilities / Stockholders Equity
- [ ] Integration test for AAPL, MSFT

**Sub-tasks:**
1. Uncomment and wire parser classes for Assets, AssetsCurrent [2h]
2. Uncomment and wire parser classes for Liabilities, LiabilitiesCurrent [2h]
3. Uncomment and wire parser classes for StockholdersEquity [2h]
4. Uncomment and wire parser classes for LongTermDebt / LongTermDebtNoncurrent [2h]
5. Annual-data filtering (same pattern as Story 1.1) [1h]
6. Integration tests [2h]

**Estimated total:** 11h (Sprint 3, part 1)
**Dependencies:** Story 1.1 (shared annual filtering logic)
**Backend issues addressed:** #7 (Shareholders Equity), #8 (Cash), #9 (Long Term Debt), #10 (Current Assets), #11 (Current Liabilities), #12 (Total Assets), #13 (Total Liabilities)

#### Story 1.3: Cash Flow Statement Metrics Extraction
**Repo:** EDGARMiner (backend)
**Description:** As a user, I want cash flow data to evaluate cash generation quality.

**Metrics:** Cash Flow from Operations, Capital Expenditures, Dividends Paid, Share Repurchases

**Acceptance Criteria:**
- [ ] All 4 cash flow metrics return 5+ years of annual data
- [ ] Free Cash Flow calculated as CFO - CapEx (derived metric)
- [ ] Integration tests for AAPL, MSFT

**Sub-tasks:**
1. Uncomment and wire parser classes for NetCashProvidedByOperatingActivities [2h]
2. Uncomment and wire parser classes for PaymentsToAcquirePropertyPlantAndEquipment (CapEx) [2h]
3. Uncomment and wire parser classes for PaymentsOfDividendsCommonStock [2h]
4. Uncomment and wire parser classes for PaymentsForRepurchaseOfCommonStock [2h]
5. Integration tests [2h]

**Estimated total:** 10h (Sprint 3, part 2)
**Dependencies:** Story 1.1 (shared filtering logic)
**Backend issues addressed:** #14 (Dividends), #15 (Equity Repurchase), #23 (FCF), #25 (CFO), #26 (CapEx)

#### Story 1.4: Unified Financial Summary API Endpoint
**Repo:** EDGARMiner (backend)
**Description:** As a frontend developer, I want a single API call that returns all financial data needed for scoring and valuation, structured by fiscal year.

**Acceptance Criteria:**
- [ ] New endpoint `GET /api/edgar/summary/{symbol}` returns structured JSON
- [ ] Response includes 5 years of income statement, balance sheet, cash flow data
- [ ] Response includes derived metrics: FCF, Current Ratio, Debt/Equity, margins (gross, operating, net)
- [ ] Response includes YoY growth rates for key metrics
- [ ] FMP stock quote data (current price, P/E) included in response
- [ ] Swagger documentation complete
- [ ] Integration test validates response shape

**Response shape:**
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc",
  "currentPrice": 178.50,
  "peRatio": 28.5,
  "annualData": [
    {
      "fiscalYear": 2024,
      "revenue": 383285000000,
      "grossProfit": 170782000000,
      "operatingIncome": 119437000000,
      "netIncome": 93736000000,
      "epsDiluted": 6.13,
      "sharesOutstanding": 15287000000,
      "totalAssets": 352583000000,
      "totalCurrentAssets": 143566000000,
      "totalLiabilities": 290437000000,
      "totalCurrentLiabilities": 176392000000,
      "stockholdersEquity": 62146000000,
      "longTermDebt": 95281000000,
      "cashFlowFromOperations": 110543000000,
      "capitalExpenditures": 10959000000,
      "dividendsPaid": 15025000000,
      "shareRepurchases": 77550000000,
      "freeCashFlow": 99584000000,
      "grossMargin": 0.4457,
      "operatingMargin": 0.3116,
      "netMargin": 0.2446,
      "currentRatio": 0.8138,
      "debtToEquity": 4.674,
      "roe": 1.508,
      "revenueGrowth": 0.02,
      "netIncomeGrowth": -0.03,
      "fcfGrowth": 0.05
    }
  ]
}
```

**Sub-tasks:**
1. Create `FinancialSummaryDto` response model [2h]
2. Create `FinancialSummaryService` that aggregates all metrics by fiscal year [4h]
3. Implement derived metric calculations (FCF, margins, ratios, growth rates) [3h]
4. Create `FinancialSummaryController` with the new endpoint [2h]
5. Integrate FMP quote data into the response [1h]
6. Write integration tests for the summary endpoint [3h]
7. Update Swagger documentation [1h]

**Estimated total:** 16h (Sprint 4)
**Dependencies:** Stories 1.1, 1.2, 1.3
**Backend issues addressed:** #22 (FCF/Share), #24 (ROIC), #28 (Market Cap) -- partial

---

## Phase 2: Scoring Engine (Sprints 5-6)

**Goal:** Implement the Feroldi Quality Score -- the core differentiator.

### Epic: Feroldi Quality Score Engine

The Feroldi Quality Score is a 13-point checklist that evaluates company quality. Each criterion is pass/fail, scored numerically. Total score determines quality tier.

#### Story 2.1: Feroldi Score Calculation Engine
**Repo:** EDGARMiner (backend)
**Description:** As a value investor, I want to automatically calculate the Feroldi Quality Score for any company so that I can quickly assess quality without manually checking each criterion.

**The 13 Feroldi Criteria (from user's Google Sheets):**
1. Stable and consistent revenue growth (5yr CAGR > 10%)
2. Stable and wide gross profit margins (> 40%, stable or expanding)
3. Stable and wide operating profit margins (> 15%, stable or expanding)
4. EPS growing faster than revenues (EPS CAGR > Revenue CAGR)
5. Share buybacks / share count reduction (shares declining)
6. Current ratio > 1
7. Financial leverage ratio < 1 (Debt/Equity)
8. Cash flow from operations > net income
9. Growing cash flow (5yr CFO CAGR > 0%)
10. CapEx < 50% of cash flow from operations
11. FCF > 50% of cash flow from operations
12. P/E ratio reasonable (< 30 or < industry average)
13. Return on equity > 15%

**Acceptance Criteria:**
- [ ] New service `IFeroldiScoreService` evaluates all 13 criteria
- [ ] Each criterion returns: name, pass/fail, actual value, threshold, explanation
- [ ] Total score is sum of passed criteria (0-13)
- [ ] Quality tier: Excellent (11-13), Good (8-10), Fair (5-7), Poor (0-4)
- [ ] All data-driven criteria auto-calculated from `FinancialSummary`
- [ ] Unit tests for each criterion with known-good company data
- [ ] Endpoint: `GET /api/scoring/feroldi/{symbol}`

**Sub-tasks:**
1. Create `FeroldiCriterion` model (name, pass, value, threshold, explanation) [1h]
2. Create `FeroldiScoreResult` model (criteria list, total, tier) [1h]
3. Implement revenue growth criterion (5yr CAGR calculation) [2h]
4. Implement gross margin criterion (level + stability check) [2h]
5. Implement operating margin criterion [1.5h]
6. Implement EPS vs revenue growth comparison [1.5h]
7. Implement share count change criterion [1.5h]
8. Implement current ratio criterion [1h]
9. Implement leverage ratio criterion [1h]
10. Implement CFO > net income criterion [1h]
11. Implement CFO growth criterion [1.5h]
12. Implement CapEx/CFO ratio criterion [1h]
13. Implement FCF/CFO ratio criterion [1h]
14. Implement P/E criterion [1h]
15. Implement ROE criterion [1h]
16. Create `FeroldiScoreController` with endpoint [1.5h]
17. Unit tests for all 13 criteria [4h]
18. Integration test for full score against AAPL [2h]

**Estimated total:** 25h (Sprints 5-6, primary story)
**Dependencies:** Story 1.4 (needs FinancialSummary data)
**Backend issues addressed:** #30-#41 (all CAGR and ratio calculations)

#### Story 2.2: Financial Health Checklist (DCF Pre-check)
**Repo:** EDGARMiner (backend)
**Description:** As a value investor, I want the 13-point financial health checklist from my DCF spreadsheet auto-evaluated, since it overlaps with but is distinct from the Feroldi score.

**Note:** This checklist is embedded in the user's DCF spreadsheet. 11 of 13 items overlap with Feroldi criteria. The 2 unique items are: "Positive and growing FCF > 50% of CF" and the specific margin thresholds. Rather than building a separate engine, this story extends the Feroldi engine with a "health check" variant.

**Acceptance Criteria:**
- [ ] `GET /api/scoring/health-check/{symbol}` returns the 13-item financial health checklist
- [ ] Each item shows pass/fail with actual value
- [ ] Reuses existing calculation logic from Feroldi service

**Sub-tasks:**
1. Create `HealthCheckService` delegating to shared calculation logic [3h]
2. Map health check criteria to existing Feroldi calculations [2h]
3. Create controller endpoint [1h]
4. Unit tests [2h]

**Estimated total:** 8h (Sprint 6, secondary story)
**Dependencies:** Story 2.1

---

## Phase 3: Valuation Engine (Sprints 7-8)

**Goal:** Implement both DCF methods from the user's Google Sheets.

### Epic: Dual DCF Valuation Calculator

#### Story 3.1: P/E Multiple DCF Valuation
**Repo:** EDGARMiner (backend)
**Description:** As a value investor, I want to calculate intrinsic value using the P/E multiple forward projection method so that I can determine buy prices at various margins of safety.

**Method (from user's spreadsheet):**
1. Take current EPS
2. Project forward 5 years using estimated earnings growth rate
3. Apply terminal P/E multiple to projected Year 5 EPS
4. Discount back to present value using discount rate
5. Apply margin of safety (35%, 45%, 55%, 65%)
6. Output: fair value + buy prices at each safety margin

**Acceptance Criteria:**
- [ ] Input: symbol, earningsGrowthRate (default: 5yr EPS CAGR), discountRate (default: 10%), terminalPE (default: historical avg P/E)
- [ ] Output: fair value per share, buy prices at 35/45/55/65% margin of safety
- [ ] Shows year-by-year projection table
- [ ] Endpoint: `POST /api/valuation/pe-dcf`
- [ ] Unit tests with hand-calculated expected values

**Sub-tasks:**
1. Create `PeDcfRequest` and `PeDcfResult` models [1.5h]
2. Implement 5-year EPS projection logic [2h]
3. Implement terminal value calculation [1.5h]
4. Implement present value discounting [2h]
5. Implement margin of safety price calculations [1h]
6. Create default parameter estimation from historical data [2h]
7. Create controller endpoint [1.5h]
8. Unit tests with AAPL/MSFT hand-verified values [3h]

**Estimated total:** 14.5h (Sprint 7)
**Dependencies:** Story 1.4 (financial summary for defaults), Story 2.1 (for CAGR logic reuse)

#### Story 3.2: Gordon Growth Model DCF Valuation
**Repo:** EDGARMiner (backend)
**Description:** As a value investor, I want to calculate intrinsic value using the Gordon Growth Model so that I have a second independent valuation method.

**Method (from user's spreadsheet):**
1. Take current FCF per share
2. Apply perpetual growth rate (growth to infinity, typically 2-3%)
3. Discount using required rate of return (8-12%)
4. Fair Value = FCF * (1 + g) / (r - g)
5. Apply margin of safety

**Acceptance Criteria:**
- [ ] Input: symbol, perpetualGrowthRate (default: 2.5%), discountRate (default: 10%)
- [ ] Output: fair value per share, buy prices at 35/45/55/65% margin of safety
- [ ] Endpoint: `POST /api/valuation/gordon-growth`
- [ ] Unit tests with hand-calculated expected values

**Sub-tasks:**
1. Create `GordonGrowthRequest` and `GordonGrowthResult` models [1h]
2. Implement FCF per share calculation [1h]
3. Implement Gordon Growth formula [1.5h]
4. Implement margin of safety calculations [1h]
5. Create controller endpoint [1h]
6. Unit tests [2.5h]

**Estimated total:** 8h (Sprint 8, story 1)
**Dependencies:** Story 1.4

#### Story 3.3: Combined Evaluation Report Endpoint
**Repo:** EDGARMiner (backend)
**Description:** As a user, I want a single API call that returns the full evaluation: financial summary + Feroldi score + both DCF valuations + buy/pass/watch recommendation.

**Recommendation Logic:**
- **BUY:** Feroldi score >= 8 AND current price < lower of the two fair values at 35% margin
- **WATCH:** Feroldi score >= 5 AND current price within 20% of fair value
- **PASS:** Everything else

**Acceptance Criteria:**
- [ ] Endpoint: `GET /api/evaluate/{symbol}` returns complete evaluation
- [ ] Response includes: financial summary, Feroldi score, health check, P/E DCF result, Gordon Growth result, recommendation (BUY/WATCH/PASS) with explanation
- [ ] Default parameters used unless overridden via query params
- [ ] Integration test for full evaluation flow

**Sub-tasks:**
1. Create `EvaluationResult` composite model [2h]
2. Create `EvaluationService` orchestrating all sub-services [3h]
3. Implement recommendation logic [2h]
4. Create controller endpoint [1.5h]
5. Integration test [2.5h]

**Estimated total:** 11h (Sprint 8, story 2)
**Dependencies:** Stories 2.1, 3.1, 3.2

---

## Phase 4: UI -- Evaluation Dashboard (Sprints 9-11)

**Goal:** Build the frontend that makes the backend usable. One page, one workflow: enter ticker, see everything.

### Epic: Company Evaluation Dashboard

**Design principle:** Single-page evaluation view. No navigation maze. Enter ticker at top, results cascade below. Think "TurboTax for stock evaluation" -- guided, opinionated, clear.

#### Story 4.1: Migrate to Vite + TypeScript Foundation
**Repo:** edgar-miner-ui (frontend)
**Description:** As a developer, I want the frontend on a modern, maintained build tool with TypeScript support so that new components have type safety and builds are fast.

**Why now (not deferred):** Every Phase 4 component will be written in TypeScript. Starting the migration BEFORE building new components avoids rewriting them later. Existing JS files keep working -- Vite handles mixed JS/TS.

**Acceptance Criteria:**
- [ ] CRA replaced with Vite 5+
- [ ] TypeScript configured (strict mode for new files, loose for existing JS)
- [ ] All existing JS components still work without modification
- [ ] New files use `.tsx` / `.ts` extension
- [ ] Build and dev server work
- [ ] `tsconfig.json` with path aliases configured

**Sub-tasks:**
1. Initialize Vite project structure alongside existing code [2h]
2. Move source files to Vite structure [2h]
3. Configure TypeScript (tsconfig.json with `allowJs: true`) [1h]
4. Update build scripts in package.json [1h]
5. Remove CRA dependencies (react-scripts) [1h]
6. Verify all existing functionality works [2h]
7. Update CI/CD if applicable [1h]

**Estimated total:** 10h (Sprint 9, story 1)
**Dependencies:** None (frontend-only)
**Frontend issues addressed:** Part of audit recommendation CEO-TECH-01

#### Story 4.2: Ticker Evaluation Page -- Layout & Search
**Repo:** edgar-miner-ui (frontend)
**Description:** As a value investor, I want to enter a ticker symbol and trigger a full evaluation, seeing results organized in clear sections.

**Acceptance Criteria:**
- [ ] New page/route: `/evaluate` (or make it the home page)
- [ ] Ticker input at top with search-as-you-type (existing search component reused)
- [ ] On ticker selection, calls `GET /api/evaluate/{symbol}`
- [ ] Loading state while fetching
- [ ] Error handling for invalid tickers or API failures
- [ ] Layout skeleton: sections for Summary, Feroldi Score, DCF, Recommendation

**Sub-tasks:**
1. Create `EvaluationPage.tsx` with layout structure [3h]
2. Create `TickerSearch.tsx` component (adapt from existing search) [2h]
3. Create `useEvaluation` hook calling the evaluate endpoint [2h]
4. Add TypeScript types for the evaluation API response [2h]
5. Loading and error states [1.5h]
6. Route configuration [0.5h]

**Estimated total:** 11h (Sprint 9, story 2)
**Dependencies:** Story 3.3 (evaluate endpoint)
**Frontend issues addressed:** #53 (Ticker Search), #54 (Dashboard Layout) -- adapted

#### Story 4.3: Financial Summary Section
**Repo:** edgar-miner-ui (frontend)
**Description:** As a value investor, I want to see key financial metrics displayed in a clear, scannable format with trend indicators.

**Acceptance Criteria:**
- [ ] Key metrics cards: Revenue, Net Income, EPS, FCF, Gross Margin, Operating Margin, ROE, Current Ratio, Debt/Equity
- [ ] Each card shows: latest value, 5-year trend direction (up/down/flat arrow), 5-year CAGR
- [ ] Revenue and FCF trend mini-charts (sparklines)
- [ ] Color coding: green for improving, red for deteriorating, gray for stable
- [ ] All values properly formatted (currency, percentage, ratios)

**Sub-tasks:**
1. Create `MetricCard.tsx` reusable component [3h]
2. Create `FinancialSummarySection.tsx` with metric card grid [3h]
3. Create `SparklineChart.tsx` using a lightweight chart lib (recharts or similar) [3h]
4. Number formatting utilities (currency, pct, ratio) [2h]
5. Trend calculation logic (direction + color) [1.5h]
6. Responsive layout (desktop-first, readable on tablet) [1.5h]

**Estimated total:** 14h (Sprint 10, primary story)
**Dependencies:** Story 4.2
**Frontend issues addressed:** #46 (Revenue Chart), #47 (FCF Chart), #48 (Profit Margins Chart), #49 (Key Metrics Cards)

#### Story 4.4: Feroldi Score Display
**Repo:** edgar-miner-ui (frontend)
**Description:** As a value investor, I want to see the Feroldi Quality Score as a visual checklist with pass/fail indicators and the overall score prominently displayed.

**Acceptance Criteria:**
- [ ] Large score display at top (e.g., "9/13 -- Good")
- [ ] Quality tier badge with color (Excellent=green, Good=blue, Fair=yellow, Poor=red)
- [ ] 13-item checklist with pass/fail icons
- [ ] Each item shows: criterion name, threshold, actual value, pass/fail
- [ ] Expanding detail on click (optional -- simple tooltip OK)

**Sub-tasks:**
1. Create `FeroldiScoreSection.tsx` with score header [2h]
2. Create `CriterionRow.tsx` for individual checklist items [2h]
3. Create `QualityTierBadge.tsx` component [1h]
4. Style the checklist (pass=green check, fail=red X) [1.5h]
5. TypeScript types for Feroldi API response [1h]

**Estimated total:** 7.5h (Sprint 10, secondary story)
**Dependencies:** Story 4.2

#### Story 4.5: DCF Valuation Display & Recommendation
**Repo:** edgar-miner-ui (frontend)
**Description:** As a value investor, I want to see both DCF valuations side-by-side with buy prices at different margins of safety, plus the final buy/pass/watch recommendation.

**Acceptance Criteria:**
- [ ] Two-column layout: P/E DCF (left) + Gordon Growth (right)
- [ ] Each shows: fair value, current price, margin of safety %, buy prices at 35/45/55/65%
- [ ] Visual price bar: current price position relative to fair value and buy prices
- [ ] Editable inputs: growth rate, discount rate, terminal P/E -- recalculates on change
- [ ] Prominent recommendation banner: BUY (green), WATCH (amber), PASS (red)
- [ ] Recommendation includes 1-sentence explanation

**Sub-tasks:**
1. Create `DcfSection.tsx` with two-column layout [3h]
2. Create `DcfCard.tsx` for individual method display [3h]
3. Create `PriceBar.tsx` visual component [3h]
4. Create editable parameter inputs with re-fetch logic [3h]
5. Create `RecommendationBanner.tsx` component [2h]
6. TypeScript types for DCF API responses [1h]

**Estimated total:** 15h (Sprint 11)
**Dependencies:** Stories 4.2, 3.1, 3.2
**Frontend issues addressed:** #50 (P/E Fair Value)

---

## Phase 5: Polish & Self-Use (Sprint 12)

**Goal:** Use the tool for 5 real company evaluations. Fix what breaks.

#### Story 5.1: Real-World Testing & Bug Fixes
**Repo:** Both
**Description:** Evaluate 5 real companies (AAPL, MSFT, GOOGL, META, KO) end-to-end. Document and fix issues.

**Acceptance Criteria:**
- [ ] All 5 companies produce complete evaluations without errors
- [ ] Results manually verified against Google Sheets for at least 2 companies
- [ ] All bugs found during testing are fixed
- [ ] Performance is acceptable (< 10 seconds for full evaluation)

**Sub-tasks:**
1. Test each of the 5 companies, document discrepancies [5h]
2. Fix data extraction bugs (GAAP taxonomy edge cases) [5h]
3. Fix calculation bugs (verify against spreadsheet) [3h]
4. Fix UI display issues [3h]
5. Performance tuning if needed (caching, parallel API calls) [2h]

**Estimated total:** 18h (Sprint 12)
**Dependencies:** All previous stories

---

## Dependency Graph

```
Phase 0:
  Story 0.1 (API Key Proxy) ────────────────────────┐
  Story 0.2 (Dead Code Cleanup) ─── independent      │
                                                      v
Phase 1:                                         [All Phase 2+
  Story 1.1 (Income Statement) ──┐                need proxy]
  Story 1.2 (Balance Sheet) ─────┤
  Story 1.3 (Cash Flow) ─────────┤
                                  v
  Story 1.4 (Summary API) ───────────────────────────┐
                                                      v
Phase 2:                                         [Scoring needs
  Story 2.1 (Feroldi Score) ──┐                  Summary API]
  Story 2.2 (Health Check) ───┘─── (2.2 depends on 2.1)
                                  │
Phase 3:                          v
  Story 3.1 (P/E DCF) ───────────┤ (needs 1.4)
  Story 3.2 (Gordon Growth) ─────┤ (needs 1.4)
                                  v
  Story 3.3 (Combined Eval) ─────────────────────────┐
                                                      v
Phase 4:                                         [UI needs
  Story 4.1 (Vite + TS) ──── independent, start     backend]
  Story 4.2 (Eval Page) ────── depends on 4.1 + 3.3
  Story 4.3 (Fin Summary) ──── depends on 4.2
  Story 4.4 (Feroldi UI) ───── depends on 4.2
  Story 4.5 (DCF + Rec UI) ── depends on 4.2
                                  │
Phase 5:                          v
  Story 5.1 (Polish) ───── depends on ALL above
```

**Critical path:** 0.1 -> 1.1 -> 1.4 -> 2.1 -> 3.3 -> 4.2 -> 4.5 -> 5.1

**Parallel opportunities:**
- Stories 1.1, 1.2, 1.3 can be done in parallel (same sprint)
- Stories 3.1 and 3.2 can be done in parallel
- Story 4.1 (Vite migration) can start while Phase 3 backend work is finishing
- Stories 4.3, 4.4, 4.5 are parallel once 4.2 is done (but budget says sequential)

---

## Sprint Plan (2-week sprints, 20h each)

| Sprint | Stories | Hours | Backend/Frontend |
|--------|---------|-------|------------------|
| 1 | 0.1, 0.2 | 15h | Backend + Frontend |
| 2 | 1.1 | 16h | Backend |
| 3 | 1.2, 1.3 | 21h | Backend |
| 4 | 1.4 | 16h | Backend |
| 5 | 2.1 (part 1: criteria 1-7) | 16h | Backend |
| 6 | 2.1 (part 2: criteria 8-13 + tests), 2.2 | 17h | Backend |
| 7 | 3.1 | 14.5h | Backend |
| 8 | 3.2, 3.3 | 19h | Backend |
| 9 | 4.1, 4.2 | 21h | Frontend |
| 10 | 4.3, 4.4 | 21.5h | Frontend |
| 11 | 4.5 | 15h | Frontend |
| 12 | 5.1 | 18h | Both |

**Total estimated: ~210h across 12 sprints (24 weeks)**

Note: Sprint 3 is slightly over 20h. Move integration tests from Story 1.3 to Sprint 4 if needed.

---

## Milestones

| Date (approx) | Milestone | Validation |
|---|---|---|
| End Sprint 1 (~late Mar) | Security fixed, no API key in frontend | `grep -r "FMP" client/src/` returns no keys |
| End Sprint 4 (~late May) | Backend returns all 20 metrics | `GET /api/edgar/summary/AAPL` returns full data |
| End Sprint 6 (~late Jun) | Feroldi score works | `GET /api/scoring/feroldi/AAPL` returns 13 criteria |
| End Sprint 8 (~late Jul) | Full evaluation works | `GET /api/evaluate/AAPL` returns complete result |
| End Sprint 11 (~early Sep) | UI displays everything | Open browser, type AAPL, see full evaluation |
| End Sprint 12 (~mid Sep) | V0.1 shipped | Used for 5 real evaluations, matches Google Sheets |

**Hard deadline (CEO-RSK-01 mitigation):** If V0.1 is not usable by end of September 2026, stop and evaluate whether to continue or switch to Koyfin/GuruFocus.

---

## GitHub Issue Creation Plan

### What to do with existing issues

**Backend (EDGARMiner):**
- Issues #7-#27 (individual metrics): Close with comment linking to the new Stories 1.1-1.3 that batch them. These per-metric issues are too granular for efficient execution.
- Issues #28-#41 (calculated metrics): Close with comment linking to Stories 1.4 (derived metrics) and 2.1 (Feroldi criteria).

**Frontend (edgar-miner-ui):**
- Issues #13-#33 (old dashboard/card/snapshot design): Close. The new evaluation-first design supersedes the card-based dashboard approach.
- Issues #44-#54 (Phase 1 Dashboard Epic): Close #44 epic. Individual issues (#45-#54) are partially addressed by Phase 4 stories.

**Rationale:** The audit fundamentally changed the product direction from "dashboard with cards and progression tracking" to "single evaluation workflow." Keeping 80+ stale issues creates confusion. Fresh issues aligned to the new plan.

### New Issue Structure

**Backend repo (EDGARMiner):**

| Type | Title | Labels | Sprint |
|------|-------|--------|--------|
| Epic | V0.1: Personal Investment Evaluation Tool | `epic`, `v0.1` | 1-12 |
| Story | Move FMP API key to backend proxy | `security`, `P0-critical`, `sprint-1` | 1 |
| Story | Remove dead code (Azure Functions, WeatherForecast) | `cleanup`, `sprint-1` | 1 |
| Story | Income Statement metrics extraction (GP, NI, EPS, Shares) | `data-engine`, `sprint-2` | 2 |
| Story | Balance Sheet metrics extraction (Assets, Liabilities, Equity, Debt) | `data-engine`, `sprint-3` | 3 |
| Story | Cash Flow metrics extraction (CFO, CapEx, Dividends, Buybacks) | `data-engine`, `sprint-3` | 3 |
| Story | Unified Financial Summary API endpoint | `data-engine`, `API`, `sprint-4` | 4 |
| Story | Feroldi Quality Score calculation engine | `scoring`, `core-feature`, `sprint-5-6` | 5-6 |
| Story | Financial Health Checklist service | `scoring`, `sprint-6` | 6 |
| Story | P/E Multiple DCF valuation calculator | `valuation`, `core-feature`, `sprint-7` | 7 |
| Story | Gordon Growth Model DCF valuation calculator | `valuation`, `sprint-8` | 8 |
| Story | Combined Evaluation Report endpoint | `evaluation`, `API`, `core-feature`, `sprint-8` | 8 |

**Frontend repo (edgar-miner-ui):**

| Type | Title | Labels | Sprint |
|------|-------|--------|--------|
| Epic | V0.1: Evaluation Dashboard | `epic`, `v0.1` | 9-12 |
| Story | Migrate from CRA to Vite + TypeScript foundation | `infrastructure`, `sprint-9` | 9 |
| Story | Evaluation page layout with ticker search | `UI`, `core-feature`, `sprint-9` | 9 |
| Story | Financial Summary section with metric cards and sparklines | `UI`, `component`, `sprint-10` | 10 |
| Story | Feroldi Quality Score display with checklist | `UI`, `component`, `sprint-10` | 10 |
| Story | DCF valuation display with recommendation banner | `UI`, `component`, `core-feature`, `sprint-11` | 11 |
| Story | V0.1 real-world testing and bug fixes | `QA`, `polish`, `sprint-12` | 12 |

---

## Risks & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | SEC EDGAR XBRL taxonomy inconsistencies across companies | HIGH | HIGH | Test against 10+ companies with different reporting patterns. Build fallback logic for missing metrics. |
| 2 | GAAP variant proliferation (7+ ways to report Revenue) | HIGH | MEDIUM | Already handled for Revenue. Apply same multi-variant pattern to all metrics. |
| 3 | Feroldi score thresholds may not match user's exact spreadsheet | MEDIUM | LOW | Verify against user's spreadsheet for 3 companies. Make thresholds configurable. |
| 4 | Vite migration breaks existing functionality | LOW | MEDIUM | Vite supports JS/TS mixed mode. Existing JS files do not need changes. Test thoroughly before adding new TS code. |
| 5 | Scope creep into portfolio tracking or comparison features | HIGH | HIGH | This plan explicitly defers those features. Resist the urge. Ship V0.1 first. |
| 6 | Burnout from 6-month solo development | MEDIUM | CRITICAL | 10h/week hard cap. Each sprint delivers something testable. Take breaks between phases. |
| 7 | AI tools make the project obsolete before V0.1 ships | LOW | HIGH | The structured, repeatable, auditable nature of a dedicated tool has value over ad-hoc AI queries. But the hard deadline exists for a reason. |

---

## What This Plan Does NOT Include (Explicitly Deferred)

1. **Authentication** -- personal tool, runs on localhost
2. **Database migration** -- file cache is fine for one user
3. **Portfolio tracking** -- V2 feature, only after V0.1 is daily-driven
4. **Company comparison** -- V2 feature
5. **Alerts and notifications** -- V2 feature
6. **Report export / PDF** -- V2 feature
7. **Anti-Fragile Checklist** -- V2 (many items are qualitative/subjective, hard to automate)
8. **Mentor's Checklist** -- V2 (same reason as above)
9. **Azure deployment** -- run locally until there is a reason to deploy
10. **Mobile responsive design** -- desktop only for personal use

---

## Success Criteria (V0.1 = Done)

1. Enter any S&P 500 ticker
2. See complete financial summary (5 years of data)
3. See automated Feroldi Quality Score (13 criteria, auto-evaluated)
4. See two DCF valuations with buy prices
5. See clear BUY / WATCH / PASS recommendation
6. Results match Google Sheets calculations within 5% tolerance
7. Full evaluation completes in under 10 seconds
8. No API keys exposed in frontend code

**When all 8 criteria are met, V0.1 is shipped. Use it for 3 months. Then decide what is next.**

---

*Plan generated by solution-designer agent based on CEO Strategic Audit (27.9/100) and codebase analysis of EDGARMiner (.NET 8.0) + edgar-miner-ui (React 19).*
