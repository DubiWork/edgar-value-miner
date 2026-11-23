<div align="center">

# 💎 EDGAR Value Miner

### *The AI Research Analyst for Serious Retail Investors*

[![Version](https://img.shields.io/badge/Version-1.2.4--develop-blue.svg)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12-ffca28.svg)](https://firebase.google.com/)

**A trustworthy, SEC EDGAR-powered value investing research workbench built to take investors from ticker lookup to a convicted, source-traceable investment thesis.**

[Production App](https://edgar-value-miner.web.app) · [Staging App](https://edgar-value-miner-staging.web.app) · [Roadmap](./ROADMAP.md) · [Changelog](./CHANGELOG.md) · [Product Context](./CONTEXT.md)

</div>

---

## Why EDGAR Value Miner?

- **Trustworthy & Source-Grounded:** Built on official SEC EDGAR filings (`10-K`, `10-Q`, `8-K`, `20-F`, `40-F`, `IFRS`) with source traceability — never an unverifiable black box.
- **Structured Research Flow:** Guides analysis through progressive triage and fundamental checks instead of noisy trader charts.
- **AI Woven Into the Flow:** Step 1 Business Clarity summaries powered by Vertex AI Gemini over SEC filing context.
- **Responsive & Theme-Aware:** Works across desktop and mobile with Dark and Light modes.

---

## Current Capabilities

- **Step 1 Triage Gatekeeper:** Initial business-clarity screening with Vertex AI (`generateAiSummary`) and admin cache controls.
- **Multi-Year SEC EDGAR Financial Analysis:** Full-history Revenue, Free Cash Flow, and Gross / Operating / Net Margins charts via Recharts, plus Key Metrics cards with YoY growth and `40-F` / `IFRS` tag-shift normalization.
- **3-Tier Caching Architecture:** Fast client-side `IndexedDB` → `Firestore` shared cache → `secProxy` & `cacheWriter` Firebase Cloud Functions.
- **Valuation & Tracking:** P/E Fair Value estimator and Watchlist persistence.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite 7, Tailwind CSS 4, Lucide Icons |
| **Charts** | Recharts 3 |
| **Backend & Auth** | Firebase 12 (Hosting, Auth, Firestore, Cloud Functions Node 22 / TypeScript) |
| **AI Engine** | Google Cloud Vertex AI (`@google-cloud/vertexai`) & Anthropic SDK (debate engine) |
| **Market / Filing Data** | SEC EDGAR API (via `secProxy` Cloud Function) & Financial Modeling Prep (FMP) |
| **Quality & CI/CD** | Vitest, Testing Library, Playwright E2E, ESLint 9, CodeQL, GitHub Actions |

---

## Getting Started

### Prerequisites

- **Node.js 20+** for frontend (`Node.js 22` targeted by `functions/package.json`)
- **npm**

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/DubiWork/edgar-value-miner.git
cd edgar-value-miner

# 2. Install frontend and Cloud Functions dependencies
npm install
cd functions && npm install && cd ..

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your Firebase, SEC User-Agent, and FMP settings

# 4. Start the Vite development server
npm run dev
```

### Common Scripts

**Frontend (root):**
- `npm run dev` — Start local Vite dev server (`http://localhost:5173`)
- `npm run lint` — Run ESLint
- `npm test -- --run` — Run Vitest unit & component test suite
- `npm run build` — Build production bundle to `dist/`
- `npm run test:e2e` — Run Playwright end-to-end suite

**Cloud Functions (`functions/`):**
- `cd functions && npm run build` — Compile TypeScript (`tsc`)
- `cd functions && npm test` — Run Cloud Functions unit test suite

---

## Branching, Versioning & Releases

This project follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the repository automation rules in [`AGENTS.md`](./AGENTS.md):

1. **Feature Branches → `develop`:** Every change is tracked by a GitHub Issue under a parent Epic (`Part of #...`, `Closes #...`). Opening a PR against `develop` runs lint, unit tests, functions tests, Playwright E2E, and deploys a live GitHub Pages preview (`pr-<number>`). Merging to `develop` deploys to [Firebase Staging](https://edgar-value-miner-staging.web.app).
2. **`develop` → `main`:** Production releases promote `develop` into `main` only after explicit owner review, finalizing `CHANGELOG.md` and cutting a `vX.Y.Z` tag (which triggers [`.github/workflows/deploy-production.yml`](./.github/workflows/deploy-production.yml)).
3. **Version Sync:** Package versions are synchronized in `package.json`, `functions/package.json`, and lockfiles alongside `CHANGELOG.md` and `ROADMAP.md`.

---

## Roadmap Summary

- ✅ **v1.0.0 — Phase 1 Foundation:** SEC EDGAR search, core charts, P/E Fair Value, Watchlist, CI/CD.
- ✅ **v1.1.0 — Full-History Data Layer:** `40-F` & `IFRS` normalization, `cacheWriter` Cloud Function, Phase 1.5 design specs.
- ⏳ **1.2.0 (`develop`) — Step 1 Triage, Clarity & Discovery:** 10-K/8-K pipeline, Generative UI Tear Sheet Blade, stabilization, and discovery UX ([`#335`](https://github.com/DubiWork/edgar-value-miner/issues/335), [`#336`](https://github.com/DubiWork/edgar-value-miner/issues/336)).
- 📋 **Next Phases:** Phase 1.5 Statements Grid ([`#288`](https://github.com/DubiWork/edgar-value-miner/issues/288)), Scoring & DCF, AI Bull vs Bear Debate ([`#143`](https://github.com/DubiWork/edgar-value-miner/issues/143)), Auth & Reasoning Trail.

See [`ROADMAP.md`](./ROADMAP.md) for live Epic tracking and [`CHANGELOG.md`](./CHANGELOG.md) for release history.

---

## License & Acknowledgments

Released under the **MIT License**.

- Financial filings & XBRL facts sourced from [SEC EDGAR](https://www.sec.gov/edgar).
- Scoring & value-investing workflow inspired by the value investing community.
