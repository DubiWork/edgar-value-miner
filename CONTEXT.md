# CONTEXT.md — edgar-value-miner

> Single-context onboarding doc for the project. Read this first. Architecture decisions live in `docs/adr/`. Product vision, principles, and the #247 architecture are summarized here.
> Last updated: 2026-08-07 (after #247 architecture resolution).

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

## Reference designs & scope

- **iCharts recon COMPLETE** (all 9 tabs + global UI) — the Phase 1.5 reference design. Specs/screenshots live in the private Obsidian vault at `Assets/icharts/` (master index `ICHARTS-RECON-INDEX.md`), **not** in this repo.
- **Phase 1.5** = full historical statement rebuild (iCharts-style). Plan: `docs/plans/6-phase-1.5-statements/FINAL-PLAN.md` (4 epics: Sprint 0 security → Data uncap → Statement grid 1.5a → Drill-down 1.5b).

## Roadmap — Wayfinder Map (GitHub #241)

Six decision tickets: #242 milestones · #243 debate data · #244 auth · #245 portfolio · #246 learn · **#247 architecture (RESOLVED, closed)**. #247 was the frontier and gated all others; #242–#246 are now unblocked.

## Working conventions

- Personal project (DubiWork org on github.com — NOT SAP). Issue → branch → PR → merge; never push straight to `develop`/`main`.
- **GitHub CLI, not MCP:** `unset GITHUB_TOKEN && gh …` is the only channel that resolves DubiWork repos.
- Full change review sequence is mandatory before "done": syntax-convention → security-style → architecture (or `/code-review`). Green CI + tests + logic-review is **not** a substitute.
- Engineering flow (Matt Pocock): `/grill-with-docs` → this CONTEXT.md + `docs/adr/` → `/to-spec` → `/to-tickets` → `/implement` per ticket.

## Next step

Domain modeling over this context, then `/to-spec` → `/to-tickets`. Do not start implementation until specs/tickets exist.
