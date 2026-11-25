# Competitive Analysis — Stock Simplifier

**Date:** 2026-09-24
**Competitor:** [Stock Simplifier](https://app.stocksimplifier.com/) by *Long Term Mindset* (founder: Brian)
**Data source:** Fiscal.ai
**Method:** Full Pro-tier tour (MSFT), 24 full-page screenshots
**Full recon:** Obsidian vault `Assets/stocksimplifier/STOCKSIMPLIFIER-RECON-INDEX.md` (+ screenshots)

---

## TL;DR — Should we pivot? No. Ship Phase 1.5.

Stock Simplifier is the closest thing to EDGAR Value Miner that exists, and it's live, polished,
and monetized. It **validates the vision's shape** — a guided, educational, score-to-decision
research walkthrough. But it does **not** solve the two problems VIRE died on and that EVM's
architecture is built around:

1. **Source traceability** — its AI reports state figures as fact with zero attribution to the
   underlying filing. No "10-K p.42", no link, no reasoning trail. Unverifiable.
2. **The Bull-vs-Bear debate** — its analysis is single-directional AI summary. There is no
   adversarial two-sided thesis.

The wedge is real and still open. This is confirmation, not a reason to stop.

---

## What Stock Simplifier is

A guided 12-tab research stepper (Overview → Business → Phase → Moat → Growth → Management →
Risk → Valuation → Summary → Financials → Capital Return → Earnings). Each tab teaches a
concept, shows scored evidence cards, offers a PRO "Deep Dive" (full AI report), and asks the
**user to rate the dimension**. Ratings roll into a **Composite Score**, which leads to a
**Buy / Watch / Hold / Pass / Sell decision saved to a matching watchlist** on the Dashboard.

**Three things they nailed** (worth internalizing):
- **Woven education.** Every term has a `?` explainer; the screener labels each filter
  `What is Moat?` etc. Education is *in the workflow*, not a separate academy. (= our Learn Mode thesis.)
- **You-decide stance.** The AI informs; the human scores and decides. (= our Final Decision Authority.)
- **The Phase framework.** A 5-stage lifecycle (Startup→Hyper Growth→Operating Leverage→Capital
  Return→Decline) that *drives which valuation metric matters*. Simple, teachable, sticky.

---

## Feature overlap map

| Capability | Stock Simplifier | EDGAR Value Miner |
|---|---|---|
| Guided research tabs | ✅ 12-tab stepper | ✅ planned (6-tab company screen) |
| Financial statements grid | ✅ shipped, interactive | 🔜 **Phase 1.5** (spec #288) |
| Woven education / tooltips | ✅ `?` everywhere + videos | ✅ Learn Mode (stateful lens) |
| Score → decision → watchlist | ✅ end-to-end | ✅ Conviction → Decision loop |
| Long-form AI reports | ✅ Deep Dives (PRO) | ✅ planned |
| **Source traceability** | ❌ unattributed | ✅ **reasoning trail keystone** |
| **Bull vs Bear debate** | ❌ single-direction | ✅ **core differentiator** |
| **"My Voice" (personal methodology)** | ❌ generic | ✅ private knowledge layer |
| Dividend safety score | ✅ AI 0–5, sector-aware | — (not in current roadmap) |
| Phase/lifecycle framework | ✅ signature | — (worth considering) |

---

## Implications for our roadmap

1. **Phase 1.5 (Statements Grid) is the right next move.** Their Financials tab is the exact
   thing — interactive grid, click-to-chart, drill-into-components, common-size/%-change toggles.
   Building it validates parity. Our differentiator on top: **every cell traces to its SEC source.**

2. **Protect the two differentiators.** Traceability and the debate are not nice-to-haves — they
   are the entire reason to exist next to a shipped, polished competitor. Do not let scope creep
   erode them.

3. **Consider adopting (not copying):**
   - A **lifecycle/phase lens** — it makes valuation teachable and gives the "which metric matters"
     answer a beginner needs. Cheap to add, high pedagogical value.
   - **Editable Green/Red flags** on the thesis (they seed with AI, user edits) — a lightweight,
     high-value "what would change my mind" artifact that pairs naturally with the debate.
   - **Sector-aware safety scores** as a pattern (their Dividend Safety Score auto-tunes for
     REIT/bank/MLP). Not a priority, but a good model for any scoring we add.

4. **Their weakness is our GTM.** Free Bull-vs-Bear debates on Twitter for top-50 stocks (already
   our wedge) directly attacks their single-directional-summary blind spot.

---

## Screenshots

24 full-page PNGs in the Obsidian vault: `Assets/stocksimplifier/screenshots/`
(`01-overview` … `15-dividend-score`, incl. all Deep Dives and sub-tabs).
