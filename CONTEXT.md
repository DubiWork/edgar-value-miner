# CONTEXT.md — edgar-value-miner

> Single-context onboarding doc for the project. Read this first. Architecture decisions live in `docs/adr/`. Product vision, principles, and the #247 architecture are summarized here.
> Last updated: 2026-09-17 (full product roadmap added after grilling session).

---

## What this is

**"The AI Research Analyst for Serious Retail Investors."** Not a charting tool — a research *methodology* tool with an AI **Bull vs Bear debate** at its core. It takes an investor from a ticker to a convicted, traceable investment decision in ~30 minutes instead of 4–6 hours of fragmented manual work.

It is the trustworthy, web-native successor to **VIRE** — a retired 9-step local Python CLI that proved the research pipeline works but failed as a product because its AI outputs had no source traceability (→ user distrust). We reuse VIRE's validated pipeline *logic*; we never reuse its black-box delivery.

## Three core principles (govern every decision)

1. **Trustworthy** — every claim, and every *decision*, is traceable to its source. No unverifiable black boxes.
2. **Educational companion** — teaches investing step by step, not just data display.
3. **AI woven through the entire flow** — not a bolt-on feature.

## Persona & positioning

- **"Methodical Marcus"** — 35–55, $150k+ income, $500k–2M investable assets, researches 2–5 companies/month, pain = 4–6h per company across fragmented tools.
- Undercuts Morningstar ($249), Seeking Alpha ($299), Simply Wall St ($180).
- Pricing (later): Free (3 researches/mo, cached only) / $9.99 (unlimited cached + personal layer) / $29.99 (+ fresh analyses).
- GTM wedge: free Bull vs Bear debates on Twitter/X for top-50 stocks. Free-first to test demand; monitor demand from day one; gate premium features later.

## Full investor lifecycle (the product's spine)

Portfolio → Research → Conviction → Valuation → Decision → Alerts → Monitor → Learn

---

## Architecture (#247 — RESOLVED 2026-08-07)

Decided via a 10-round grilling session. GitHub #247 is closed; this section is the working summary. It unblocks Wayfinder tickets #242–#246.

### Core: two systems, one engine

- **Back-office batch pipeline** — the VIRE steps as jobs: ingest, scrape, transcribe, score, generate insights. Writes to a shared store. Runs anywhere (see Portability).
- **Runtime website** — a fast reader over that store, plus rate-limited trigger points. **Never** does heavy ingestion live.

### Data tiers (how a company lookup behaves)

| Tier | What | Behavior |
|------|------|----------|
| **1 — Live** | price, SEC financials/charts, filings | Real-time, any company, no pre-build (≈ Phase 1.5) |
| **2 — Derived** | Feroldi score, DCF, margins | Computed from Tier 1 on-demand, then cached |
| **3 — Deep AI** | earnings-call insights, debate, companion wisdom, cross-company themes | Pre-built or queued. Missing → surface "coming later" + queue |

Tier 3 trigger flag: **(c) owner-only now → (b) opt-in "request deep analysis" button later.** Never auto-queue (protects the AI budget from spikes).

### Freshness / staleness (hard requirement)

Every stored record — **including AI insights** — carries `{source_type, last_fetched, refresh_policy, static|dynamic}`.

- **Static** insights (moat, business model, timeless scoring answers) — answered once, **reused across sessions AND across users.** Major cost lever.
- **Dynamic** insights (latest strategy, current risks) — re-run when new data arrives.
- A back-office **sweeper** flags/refreshes stale records, event-driven where possible (new filing detected → refresh).
- The website *shows* freshness ("data as of Q2 2026") — directly serving Trustworthy.

### Knowledge layer (two-layer)

- **Shared / global:** Warren Buffett — public, citable, a product feature.
- **Personal:** the owner's mentor's wisdom — a **PRIVATE knowledge base. The mentor's name NEVER appears on the site.** Surfaced only as **"my voice."** (Content is public YouTube + a paid Discord; mentor has not consented to being a product feature.)
- Static vs dynamic knowledge separated. Sources: EDGAR 10-K / transcripts, the owner's Python IR-page scraper, a local Whisper transcriber, the `analyze` video-analysis skill (writes to a private Obsidian vault), Discord pastes.
- Indexed with wiki-link richness. **Cross-company** retrieval (moats / strategies / industry across all companies), not only per-ticker.

### AI layer

- **Provider abstraction** — server-side, with a Firestore config flag for redeploy-free model swaps.
- Personal **Gemini** key (not any employer AI subscription). Cost monitored.
- **Rate limiting:** per-user daily cap + a global circuit-breaker. Anonymous users get **data only**; AI requires signup.

### Two modes over the same engine

- **Research mode** — fast reader: charts, debate, insights. For someone doing the work.
- **Learn mode** — first-class, built progressively. Two building blocks:
  - **Terminology** — vocabulary (margin, revenue, OCF, FCF…). Static definitions; can reference external/mentor videos for remedial help.
  - **Guided process** — the step-by-step investigation, with **gating** (finish Step 1 before Step 2) and **per-area guidance** (business understanding / evaluation / verdict / monitoring). **Skippable & configurable** — experienced users turn it off.
  - **Adaptive:** a per-user proficiency score unlocks advanced guidance and suppresses basics.

### Keystone — the personal layer is a *reasoning trail*

An **append-only, supersession-based per-user log** of what the user saw, engaged with, and concluded. Every AI flow (debate, grilling, insights, Learn answers) writes its outcome there, tagged to a company + a decision. Portfolio decisions and the conviction ledger are **assembled from this traceable history**, not entered blind.

The user can **revise, reverse, or regret** earlier conclusions — new entries supersede without erasing, preserving how conviction evolved over time. This is what makes the product dynamic and user-specific rather than a static data site. It is the deepest expression of principle #1: every *decision* is traceable, not just every data point.

### Portability (hard constraint)

Nothing tied to a work machine or an employer AI subscription. Personal credentials, portable repo, Firestore-backed config, a web-based admin dashboard. Local execution is *one* place it runs — not the only one. Must survive losing the current workstation.

### Deferred to feature tickets

- Proficiency-state schema → **#246 (learn)**
- Reasoning-trail / conviction-ledger schema → **#245 (portfolio)** / **#246 (learn)**
- "Grill your thesis" (Socratic self-grilling that questions the user until convicted) → later feature; needs nothing new — another AI flow over the same engine, writing to the personal layer.
- SEO (static landing page at root + SPA at `/app`), demand monitoring (GA4) → confirmed, detail later.

---

## Current shipped code (as-is, 2026-08-07)

**Stack:** Vite 7 + React 19 (`.jsx`, not `.tsx`), Tailwind 4, Recharts 3, Firebase 12 (hosting + Cloud Functions), Vitest + Testing Library (unit), Playwright (E2E), CodeQL, ESLint 9.

**Frontend (`src/`):**
- `App.jsx` — single-page, **no routing yet**. Header with `<Gem>` logo, skip-link.
- `components/Dashboard/` — RevenueChart, FCFChart, MarginsChart, ValuationPanel, CompanyBanner, MetricCard, ChartContainer, DashboardLayout (+ skeletons, + extensive tests/snapshots).
- `hooks/` — useCompanySearch, useStockQuote, useKeyMetrics, useWatchlist, useTheme, useChartTheme, useReducedMotion, useRecentSearches, useTickerAutocomplete.
- `utils/` — gaapNormalizer, calculateMargins, calculateFairValue, calculateYoY, calculateDebtToEquity, formatCurrency, formatTimeAgo, inputSanitization, storage.
- `services/` — edgarApi, edgarCache, fmpApi, firestoreCache, cacheCoordinator, cacheInvalidation.
- `lib/firebase.js`.

**Backend (`functions/src/`):**
- `functions/secProxy.ts` — SEC proxy Cloud Function (SSRF-hardened: endpoint key + numeric CIK).
- `index.ts` — debate-engine backend. **Built but NOT wired to the UI.**
- Deps: `@anthropic-ai/sdk`, `firebase-admin`, `firebase-functions`.

**Data sources:** EDGAR (financials/filings) via the SEC proxy; **FMP** (Financial Modeling Prep) for Estimates — same API iCharts uses.

**Known gaps vs the #247 decision (not yet built):**
- No AI **provider abstraction** — functions hard-depend on `@anthropic-ai/sdk`; the decision calls for a swappable layer + personal Gemini key.
- No **routing** — Research/Learn two-mode split needs it (static landing + `/app`).
- No **freshness metadata** on records, no sweeper.
- No **personal layer / reasoning trail**, no auth wired.
- Debate backend exists but is **not connected** to the UI.
- No back-office pipeline, no vector/knowledge store, no admin dashboard.

## UX decisions (resolved 2026-09-17)

### Home screen
Day-0 home = **Research/Discovery launchpad** (hero search + top 50 debate showcase cards + "test existing holdings" secondary CTA). Portfolio is an earned state — shown as home only after ≥1 conviction exists. Empty portfolio shows conviction-ledger framing with "Start First Analysis" CTA, never a blank table.

### Company screen — 6 top-level tabs
1. **Overview & Debate** — price banner, AI Bull vs Bear debate (front and center), Feroldi/Town score, company description
2. **Business & Insights** — moat/business model AI analysis (static), earnings call summaries (dynamic), "My Voice" personal knowledge layer
3. **Financial Statements** — iCharts-style with 9 sub-tabs: Summary, Income, Balance Sheet, Cash Flow, Margins, Ratios, Returns, Segments, Estimates
4. **Valuation** — interactive DCF (6 sliders), implied CAGR output, reverse DCF, historical P/E & P/FCF bands
5. **Source Filings** — raw 10-K/10-Q/8-K viewer, earnings transcripts, citation jump targets from Debate/Insights
6. **My Thesis** — per-company reasoning trail, verdict (Buy/Watch/Avoid), conviction score, alert triggers

### Learn Mode
Learn Mode is a **stateful lens** (sidebar + canvas constraints) over the same route — never a separate route. No context loss on toggle. Two layers:
- **Terminology** (universal primitive, always on): dashed underlines on financial terms → contextual popover. Active in both modes.
- **Guided Process** (what the Learn Mode toggle controls): gated step sequence (business → margins → EPS → balance sheet → valuation → CAGR → decision) using Roni's checklist. Tabs constrained by sidebar step.

### Feroldi/Town scoring
AI-augmented Feroldi/Town hybrid scorecard. AI pre-fills every criterion with SEC filing citations. User reviews, overrides any score, and override is immediately logged in the Reasoning Trail. Output: a per-company quality score + sourced rationale.

### Roni's methodology (embedded as "My Voice")
Target return: **14-15% CAGR** (pass if <12%). Checklist order: moat → revenue growth trend → operating margins (>10% min, >20% good, >30% exceptional) → EPS trend → share count (buybacks = positive) → balance sheet (equity ≥ liabilities, leverage ≤ 2) → valuation (project EPS 5yr at consensus growth × exit P/E → discount back → implied CAGR). Red flags: margin compression, dilution, debt rising, P/E far above historical average.

### Portfolio screen
**Conviction Dashboard** — not a holdings tracker. No share counts required. Optional strategic sizing: Small/Medium/Large or target %. Three sections: Active Holdings (by conviction), Watchlist, Graveyard (Avoid). Columns: Ticker/Status, Price vs Fair Value (MoS bar), Conviction Score, Thesis Freshness (🟢/🟡/🔴), Active Alerts, Verdict snippet. Top banner: health check summary.

### Alerts — 4 classes
1. **Price/Valuation**: target price hit, margin of safety breached
2. **Fundamentals**: metric thresholds (e.g., gross margin < 70%), Feroldi score drop
3. **Event-driven** (system defaults): new 10-K/10-Q, earnings transcript available
4. **Behavioral**: time-based ("re-evaluate in 6 months")

Monitoring runs in the **back-office sweeper** (Cloud Scheduler cron + SEC RSS). Sweeper writes new data to Firestore → Cloud Function checks alert thresholds → creates Alert document. Sweeper never auto-triggers AI re-analysis — flags thesis stale, user triggers refresh manually.

Notifications: in-app primary (bell + health banner + red dots). Email: immediate for thesis-breakers only + weekly Sunday digest. Push: strictly opt-in, Class 1/2 alerts only.

### Two-screen mobile UX
Desktop = 30-min workbench (full DCF, debate, filings). Mobile = 3-min check-in (portfolio health, alerts, quick thesis note). Mobile = responsive web / PWA. No separate native app.

### Auth timing (#244 — resolved)
Auth in **Phase 4**, not Phase 3. Phase 3 ships Debate/Insights with pre-cached AI for top 50 stocks (anonymous read-only). Anonymous users requesting fresh AI on uncached tickers hit a CTA to sign up → fulfilled by Phase 4 Auth + Reasoning Trail. PLG funnel preserved, AI budget protected.

### Back-office pipeline
100% serverless Cloud Functions (Firebase). Google Cloud Scheduler cron. Gemini API key stored in Firestore config (swappable). Portability = developer independence (not user CLI) — same scripts can run locally pointing at prod Firestore if needed.

---

## Reference designs & scope

- **iCharts recon COMPLETE** (all 9 tabs + global UI) — the Phase 1.5 reference design. Specs/screenshots live in the private Obsidian vault at `Assets/icharts/` (master index `ICHARTS-RECON-INDEX.md`), **not** in this repo.
- `docs/plans/6-phase-1.5-statements/FINAL-PLAN.md` — **OBSOLETE**. Superseded by the roadmap below.

---

## Full Product Roadmap (zero to hero — resolved 2026-09-17)

### Phase 1 — Foundation ✅ SHIPPED
**Checkpoint gate:** User can search any ticker, see revenue/FCF/margins charts from SEC EDGAR, and get a P/E fair value estimate.
- SEC EDGAR 3-tier cache (IndexedDB → Firestore → cacheWriter CF)
- Full historical financials (40-F + IFRS support, tag-shift normalization, fullHistory flag)
- Revenue, FCF, Margins charts
- P/E fair value estimate (FMP)
- Watchlist (3 companies), dark/light theme

### Phase 1.5 — Statements Grid (iCharts-style)
**Checkpoint gate:** User can see full historical statements for any company across all 9 tabs, drill into any metric on a chart. Data correct for 40-F (SHOP) and IFRS (SAP) filers.

**Epic 1 — Sprint 0 (security + pre-work):** #221 Firestore rules · #226 FMP key secret · #222 markStaleInIndexedDB fix · #233 gaapNormalizer SRP split · #231 normalizeTicker dedup · #227 console.log · #217 CI permissions · #223/#224/#225 test coverage debt · #228/#229/#230 chart/metrics pre-work · #232 route architecture decision · #240 CI build order · #262 cleanup

**Epic 2 — Data layer + routing:** Full history uncap (wire fullHistory to UI) · React Router · `/statements` route split

**Epic 3 — Statement Grid 1.5a:** 6-tab company screen scaffold (Overview/Business/Valuation/Filings/Thesis as placeholders) · Financial Statements tab with 9 sub-tabs · sparklines · Annual/Quarterly toggle · period range selector

**Epic 4 — Chart Drill-Down 1.5b:** Same-company multi-metric overlay (up to 3) · Playwright visual regression baselines · mobile responsive layout

### Phase 2 — Scoring & Valuation
**Checkpoint gate:** User can see an AI-generated Feroldi/Town scorecard with citations and run an interactive DCF producing an implied CAGR (Roni's model).
- AI provider abstraction layer (replace hardcoded `@anthropic-ai/sdk` → Firestore-config-driven + personal Gemini key)
- AI-augmented Feroldi/Town scorecard (AI pre-fills with SEC citations, user overrides → Reasoning Trail)
- Feroldi score on Overview tab
- Interactive DCF: 6 sliders, implied CAGR output (Roni's EPS-projection model)
- Reverse DCF ("what growth does this price assume?")
- Historical P/E + P/FCF bands (5-10yr)
- SBC field in gaapNormalizer

### Phase 3 — Debate & AI Insights
**Checkpoint gate:** Anonymous user can read pre-cached Bull vs Bear debate for top 50 stocks with source citations. Every AI claim links to raw SEC filing. Uncached tickers show lock CTA.
- Bull vs Bear debate UI (wire existing backend to frontend)
- Debate rounds display (multi-question, two-sides, verdict)
- Business & Insights tab: moat analysis (static AI), earnings call summaries (dynamic AI)
- AI Infographics (Mermaid.js/React-flow unit economics diagrams in Business tab)
- Source Filings tab (raw SEC viewer, citation jump targets)
- Citation links from Debate/Insights → Source Filings
- Back-office sweeper (Cloud Scheduler + SEC RSS → Firestore)
- FreshnessMeta on every AI record
- Tier 3 trigger flag (owner-only pre-compute → opt-in "request deep analysis" CTA for anonymous)
- Lock state for uncached tickers → Phase 4 Auth CTA

### Phase 4 — Auth + Personal Layer + Reasoning Trail
**Checkpoint gate:** User can log in, write their thesis, override AI scorecard items, and conviction history is preserved and traceable.
- Firebase Auth (sign-up/login, anonymous → authenticated migration)
- Reasoning Trail service (append-only Firestore: Conclusion/supersession/UserNote/stale-evidence-flag)
- "My Thesis" tab (per-company reasoning trail, verdict, conviction score, alert triggers)
- AI scorecard override → Reasoning Trail
- Guided Process / Learn Mode sidebar (gated steps using Roni's checklist)
- Terminology layer (dashed underlines → popover definitions)
- ProficiencyState (per-user global skill level)
- Personal KnowledgeItem layer ("My Voice" — Roni's wisdom, private, never named on site)
- ProcessProgress (per-user per-company step position)

### Phase 5 — Portfolio & Conviction Dashboard
**Checkpoint gate:** User can see all active theses in one place, monitor thesis freshness, set alerts, and get weekly digest email. Mobile PWA available.
- Global Portfolio screen (Conviction Dashboard: Active Holdings, Watchlist, Graveyard)
- Strategic sizing (Small/Medium/Large, no share counts)
- Price vs Fair Value bar (margin of safety visual)
- Thesis Freshness indicator (🟢/🟡/🔴)
- Conviction Score + Health Check banner
- 4-class alert system (Price/Valuation, Fundamentals, Event-Driven, Behavioral)
- Firestore alerts collection + Cloud Function threshold checker
- In-app notifications (bell + red dots)
- Email: immediate thesis-breaker + weekly Sunday digest (retention loop)
- PWA (save to home screen)
- "Audio Insights" — NotebookLM-style AI podcast summary of debate for mobile commuting
- Mobile two-screen UX (Portfolio/Alerts on mobile, workbench on desktop)

### Phase 6 — Learn & Grow
**Checkpoint gate:** A new investor can follow the Guided Process for their first company and arrive at a documented conviction without prior knowledge.
- Learn Mode toggle (stateful lens — sidebar + canvas constraints, same route)
- GuidedProcess full implementation (gated steps: business → margins → EPS → balance sheet → valuation → CAGR → decision)
- Tab gating in Learn Mode (constrained by sidebar step)
- Adaptive guidance (ProficiencyState unlocks/suppresses)
- "Grill your thesis" (Socratic self-grilling AI flow → Reasoning Trail)
- Learn from past decisions (conviction vs outcome retrospective)

### Phase 7 — GTM, Virality & Scale
**Checkpoint gate:** Product is publicly launchable. Free tier drives top-50 virality. Stripe billing gates premium features.
- SEO static landing page (`/` vs `/app` SPA split)
- Dynamic OpenGraph social share cards (Bull vs Bear verdict images for Twitter/X GTM wedge)
- Stripe billing (Free / $9.99 / $29.99 tiers)
- Demand monitoring (GA4)
- Admin dashboard (sweeper pipeline monitoring, AI cost visibility)

---

## Wayfinder decisions (all resolved 2026-09-17)

| # | Decision | Resolution |
|---|----------|-----------|
| #242 | Milestone structure | 7 phases map cleanly to lifecycle spine |
| #243 | Debate data needs | Phase 3: pre-cached top-50, lock CTA for uncached |
| #244 | Auth timing | Phase 4 — after Debate (PLG: attract then trap) |
| #245 | Portfolio scope | Conviction Dashboard, no share counts, strategic sizing |
| #246 | Learn from past decisions | Phase 6: conviction vs outcome retrospective |
| #247 | Architecture | RESOLVED Aug 2026 — two systems, one engine |

---

## Reference designs & scope

- **iCharts recon COMPLETE** (all 9 tabs + global UI) — the Phase 1.5 reference design. Specs/screenshots live in the private Obsidian vault at `Assets/icharts/` (master index `ICHARTS-RECON-INDEX.md`), **not** in this repo.

---

## Working conventions

- Personal project (DubiWork org on github.com — NOT SAP). Issue → branch → PR → merge; never push straight to `develop`/`main`.
- **GitHub CLI only** for DubiWork repos (`gh` with `GITHUB_TOKEN` env var set — never unset it).
- Full change review sequence is mandatory before "done": syntax-convention → security-style → architecture (or `/code-review`). Green CI + tests + logic-review is **not** a substitute.
- Engineering flow (Matt Pocock): `/grill-with-docs` → this CONTEXT.md + `docs/adr/` → `/to-spec` → `/to-tickets` → `/implement` per ticket.
- Epic-branch workflow: one PR per epic, one squash commit per issue. TDD + 3-agent + Matt review before every squash.

## Next step

Close Wayfinder decision tickets #242–#246. Update #241 with full roadmap. Start Phase 1.5 Epic 1 (Sprint 0) — issues #221, #222, #226 are the critical gates.
