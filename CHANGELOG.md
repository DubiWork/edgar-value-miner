# Changelog

All notable changes to **EDGAR Value Miner** are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

> Active `1.2.4` release train on `develop` (staged prior to `main` promotion).

### Added
- Step 1 Triage Gatekeeper UI, Vertex AI `generateAiSummary` Cloud Function, and admin cache/ingestion controls (`PR #316`).
- Step 1 `10-K`/`8-K` & transcript SEC grounding pipeline with Firestore L2 cache and filing freshness check (`#318`, `PR #320`).
- Step 1 Generative UI Tear Sheet Blade with Hebrew RTL/LTR toggle, 4-stage Business Flow Infographic, relative-scale peer chips, Industry Jargon Glossary, and Moat rating guardrails (`#319`, `PR #320`).
- Hebrew Fundamentals Check localization, true `5Y CAGR` & long-span CAGR fix, cyclical sparklines, unambiguous dilution/buyback pace trends, and mobile viewport-safe tooltips (`#322`, `#323`, `PR #320`).
- Repository governance & release tracking documentation: `ROADMAP.md`, `CHANGELOG.md`, `AGENTS.md`, `.github/pull_request_template.md`, refreshed `README.md`, and synchronized SemVer `1.2.0` (`#337`, part of `#335`).

### Changed
- Standardized package name to `edgar-value-miner` and synchronized `1.2.0` SemVer across root frontend and `functions/` manifests (`#337`).
- Pinned Playwright E2E workflow runners to `ubuntu-24.04` (`PR #316`) and enabled `CodeQL Advanced` on `develop` (`PR #320`).

### Fixed
- Eliminated `secTickers` HTTP `502` / SEC `429` directory outages via a 4-tier resilient Cloud Functions loader (24h in-memory cache + in-flight deduplication, shared Firestore `systemCache/secTickers`, bounded `429`/`503` retries with a valid contact User-Agent, and bundled `sec-tickers-snapshot.json.gz` fallback) plus client `localStorage` caching and dot/hyphen share-class resolution (`#349`).
- Fixed company-name search UX by adding `sanitizeSearchQuery` (preserving spaces and up to 60 characters), ranked multi-word & company-name matching (`scoreTickerMatches`), smart `Enter` auto-resolution to best matching ticker, friendly inline guidance instead of error-page crashes on unmatched company names, and classified error feedback (`#347`).
- Added full IFRS (`ifrs-full` / Form `20-F`) normalization support (`IFRS_TAG_MAP`, `CY\d{4}(I4|Q4I)?` balance-sheet frames, highest-frequency primary filing currency detection, empty share-array fallthrough, and multi-currency formatting in Step 1 & Key Metrics — unblocking foreign filers such as `SAP SE`) (`#348`).
- Rendered touch/mobile and tablet tooltips (`< 1024px` or coarse pointer) via `ReactDOM.createPortal` onto `document.body` with backdrop dismissal, safe-area bottom padding, and `max-h-[75dvh]` scroll containment (`#327`, `PR #346`).
- Rendered an active-search loading banner (`search-loading-banner`) and `DashboardSkeleton` when switching between tickers (`loading && data`) instead of leaving `<main>` blank white (`#342`, `PR #346`).
- Collapsed the header Sign-In button (`header-signin-btn`) to a uniform `44×44` icon button on `< 640px` phones while preserving the text pill on `sm:`+ screens (`#343`, `PR #346`).
- Improved Hebrew-first wording and added `<bdi dir="ltr">` BiDi isolation across Step 1 Fundamentals cards so `CAGR`, percentages, signs, and ranges render cleanly in RTL (`#344`, `PR #346`).
- Prevented SEC EDGAR `HTTP 429` rate-limit failures in `companyContext.ts` by forwarding known numeric CIKs from client/Firestore (`companyContext`/`edgarCache`), caching `company_tickers.json` in memory for 24 hours, and adding bounded `Retry-After` / exponential backoff retries on `429`/`503` responses (`#324`, `PR #345`).
- Eliminated ungrounded stale AI summary cache hits (e.g. `MA`) by stopping IndexedDB persistence of `mock-*` fallback summaries, distinguishing server-reachable missing Firestore context (`_contextMissing`) from offline errors, auto-upgrading missing or ungrounded SEC `10-K`/`8-K` summaries with live progress feedback, and guarding existing caches when monthly AI budget is exhausted (`#328`, `PR #345`).
- Responsive single-row mobile header: icon-only clickable logo returning to the Welcome screen, guaranteed in-viewport `ThemeToggle` on `360px`+ phones without horizontal overflow, and a centered Portal `MobileSearchModal` triggered by a magnifying-glass icon on `< 640px` viewports (`#330`, `#331`, `PR #341`).
- Tailwind v4 light-mode contrast, short-ticker autocomplete (`BA`), duplicate clear button, and Firebase auth error banner (`#321`, `PR #320`).

### Security
- Replaced HTML filtering regexes and chained entity unescaping in `companyContext.ts` with a deterministic single-pass HTML scanner and single-pass entity decoder, resolving CodeQL `js/bad-tag-filter` and `js/double-escaping` alerts (`PR #320`).

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
