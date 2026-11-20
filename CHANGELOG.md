# Changelog

All notable changes to **EDGAR Value Miner** are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

> Active `1.2.0` release train on `develop` (staged prior to `main` promotion).

### Added
- Step 1 Triage Gatekeeper UI, Vertex AI `generateAiSummary` Cloud Function, and admin cache/ingestion controls (`PR #316`).
- Repository governance & release tracking documentation: `ROADMAP.md`, `CHANGELOG.md`, `AGENTS.md`, `.github/pull_request_template.md`, refreshed `README.md`, and synchronized SemVer `1.2.0` (`#337`, part of `#335`).
- _(Note: PR `#320` changes — `10-K`/`8-K` context pipeline, Generative UI Tear Sheet Blade, Hebrew Fundamentals Check, cyclical sparklines, and mobile tooltips for `#318`, `#319`, `#321`, `#322`, `#323` — are tracked under `#335` and will be recorded here upon merge.)_

### Changed
- Standardized package name to `edgar-value-miner` and synchronized `1.2.0` SemVer across root frontend and `functions/` manifests (`#337`).
- Pinned Playwright E2E workflow runners to `ubuntu-24.04` (`PR #316`).

---

## [1.1.0] - 2026-09-17

> Shipped on `main` (Full-History SEC EDGAR Data Layer & Architecture Foundation).

### Added
- Full-History SEC EDGAR Data Layer (`#248`, `#285`, `#286`) supporting full multi-year company histories across `10-K`, `40-F` (`#267`, e.g. `SHOP`), and `IFRS` (`SAP`) filers.
- Tag-shift stitching (`#251`), currency normalization (`#252`), and `latestFiledDate` freshness metadata (`#250`).
- Server-side `cacheWriter` Cloud Function (`#257`) paired with Firestore security rules and removal of direct client Firestore writes (`#256`).
- Uniform 400px full-history chart styling and axis label thinning (`#300`).
- Architecture & product roadmap documentation: `CONTEXT.md`, ADR-0001 (`#287`), and Phase 1.5 Statements Grid specification (`#288`).

### Fixed
- Replaced top-level `await` imports in `src/lib/firebase.js` with static imports for Vite build stability.

---

## [1.0.0] - 2026-03-11

> Production release tagged [`v1.0.0`](https://github.com/DubiWork/edgar-value-miner/releases/tag/v1.0.0).

### Added
- Initial Phase 1 Foundation release:
  - SEC EDGAR company search and ticker autocomplete.
  - Responsive Dashboard grid layout with Dark & Light theme support (`ThemeContext`).
  - Interactive Recharts visualizations for Revenue, Free Cash Flow (dual-color bars), and Gross / Operating / Net Margins.
  - Animated Key Metrics cards and P/E Fair Value estimation panel.
  - LocalStorage-persisted Watchlist.
  - Automated CI/CD pipelines for PR previews (GitHub Pages), Firebase Staging, and Firebase Production.
