# Roadmap — EDGAR Value Miner

> Top-level product and delivery roadmap connecting product strategy ([`CONTEXT.md`](./CONTEXT.md)), shipped releases ([`CHANGELOG.md`](./CHANGELOG.md)), and active [GitHub Epics](https://github.com/DubiWork/edgar-value-miner/issues?q=label%3Aepic).

**Related Docs:** [`README.md`](./README.md) · [`CHANGELOG.md`](./CHANGELOG.md) · [`CONTEXT.md`](./CONTEXT.md) · [`AGENTS.md`](./AGENTS.md)

---

## Release & Version Timeline

| Version | Target / Tag Date | Environment | Scope & Key Milestones |
| :--- | :--- | :--- | :--- |
| **`v1.0.0`** | `2026-03-11` | Production (`v1.0.0` tag) | **Phase 1 Foundation:** SEC EDGAR search, Revenue / FCF / Margins charts, Key Metrics, P/E Fair Value panel, local Watchlist, Dark/Light theme. |
| **`v1.1.0`** | `2026-09-17` | `main` | **Full-History Data Layer:** `40-F` & `IFRS` normalization, tag-shift stitching, currency normalization, `latestFiledDate` freshness, `cacheWriter` Cloud Function (`#248`, `#285`, `#286`), and Phase 1.5 architecture planning (`#287`, `#288`). |
| **`1.2.1`** | `2026-11-23` *(In Progress)* | `develop` / Staging | **Step 1 Triage & Mobile Header Fix:** Step 1 Triage Gatekeeper (`PR #316`), `10-K`/`8-K` context pipeline & Tear Sheet (`PR #320`), repo governance (`PR #338`), mobile header/search modal fix (`#330`, `#331`), plus Step 1 Stabilization & Discovery (`#335`, `#336`). |

---

## Active & Planned Epics

| Epic | Phase / Track | Scope | Current Status |
| :--- | :--- | :--- | :--- |
| **[#335](https://github.com/DubiWork/edgar-value-miner/issues/335)** | Step 1 Triage — Core & Stabilization | `10-K`/`8-K` pipeline & Tear Sheet Blade (`#318`, `#319`, `#321`–`#323` merged in `PR #320`), release governance (`#337` merged in `PR #338`), mobile header & search modal (`#330`, `#331` in PR), SEC 429 prevention (`#324`), mobile portal tooltips (`#327`), cache grounding verification (`#328`) | **Active** (`#330`/`#331` PR open; stabilization backlog next) |
| **[#336](https://github.com/DubiWork/edgar-value-miner/issues/336)** | Step 1 Discovery & UX Polish | Foreign `6-K`/`40-F`/`20-F` filings (`#325`), recent IPO `S-1`/`10-Q` fallback (`#332`), URL state persistence (`#326`), multi-watchlists (`#329`), Circle of Competence Sector Heatmap (`#333`), Landing/Step 1 declutter (`#334`) | **Queued (Next)** |
| **[#288](https://github.com/DubiWork/edgar-value-miner/issues/288)** (`#310`–`#313`) | Phase 1.5 — Statements Grid | iCharts-style full financial statements grid, React Router split, multi-metric chart drill-down, visual baselines & CI pipeline hardening (`#340`) | **Spec & Epic Scaffolded** |
| **[#143](https://github.com/DubiWork/edgar-value-miner/issues/143)** | Phase 3 — AI Bull vs Bear Debate | Full-stack multi-round Bull vs Bear AI debate UI wired to backend engine with SEC citations | **Planned** |

---

## 7-Phase Product Spine *(from [`CONTEXT.md`](./CONTEXT.md))*

1. **Phase 1 — Foundation (`✅ v1.0.0` + `✅ v1.1.0`):** SEC EDGAR 3-tier cache, full historical GAAP/`40-F`/`IFRS` charts, P/E Fair Value, Watchlist, theme support.
2. **Step 1 Triage & Discovery (`⏳ 1.2.0` on `develop` — `#335`, `#336`):** Business Clarity Tear Sheet (`10-K` / `8-K` / transcripts + Vertex AI Gemini), Fundamentals Check, Sector Heatmap, Multi-Watchlist triage.
3. **Phase 1.5 — Statements Grid (`⏳ #288`, `#310`–`#313`):** 9-tab financial statements workbench, `/statements` route split, multi-metric overlay drill-down.
4. **Phase 2 — Scoring & Valuation:** AI-augmented Feroldi/Town scorecard with filing citations, interactive 6-slider DCF + implied CAGR, Reverse DCF, historical P/E & P/FCF bands.
5. **Phase 3 — Debate & Deep AI Insights (`#143`):** Bull vs Bear multi-round debate UI, Source Filings viewer with citation jump targets, back-office sweeper & freshness metadata.
6. **Phase 4 — Auth, Personal Layer & Reasoning Trail:** Firebase Auth, append-only Conviction Ledger / Reasoning Trail, Guided Learn Mode sidebar & terminology layer.
7. **Phase 5–7 — Portfolio Dashboard, Learn Retrospective & Scale:** Conviction Dashboard, 4-class alert system, weekly digests, "Grill your thesis", SEO landing split, and monetization tiers.

---

## Time Tracking & Delivery Cadence

- Every PR includes a standardized **`⏱️ Time Log`** table (via [`.github/pull_request_template.md`](./.github/pull_request_template.md)) recording **Session Start**, **PR Ready / Merged**, **Active Dev Time**, and **Calendar Lead Time**.
- Each child PR rolls up into its parent Epic's **`⏱️ Time & Cycle Log`** table (starting with [`#335`](https://github.com/DubiWork/edgar-value-miner/issues/335) and [`#336`](https://github.com/DubiWork/edgar-value-miner/issues/336)).
