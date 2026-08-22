# Spike #267: SHOP 40-F Filing History

**Date:** 2026-08-22  
**Issue:** #267  
**Result:** 40-F data IS accessible via companyconcept API — recommend implementing

---

## 1. Root Cause Confirmed

SHOP (CIK 0001594805) filed as a 40-F (Canadian foreign private issuer) from 2017–2024 before switching to 10-K in 2025. The SEC `/api/xbrl/companyfacts` blob **does not include 40-F entries** — confirmed empirically: zero 40-F rows appear in the companyfacts JSON.

Submissions API shows 8 40-F filings (2017–2024) + 2 10-K filings (2025–2026).

---

## 2. Feasibility: 40-F Data IS Accessible

The per-concept API **does** return 40-F data:

```
GET /api/xbrl/companyconcept/CIK0001594805/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax.json
```

Returns annual FY revenue tagged in 40-F filings:

| Year | Revenue (USD) | Form |
|------|-------------|------|
| 2017 | $673M | 40-F |
| 2018 | $1.07B | 40-F |
| 2019 | $1.58B | 40-F |
| 2020 | $2.93B | 40-F |
| 2021 | $4.61B | 40-F |
| 2022 | $5.60B | 40-F |
| 2023 | $7.06B | 40-F |

The 40-F iXBRL files use standard US-GAAP tags (`RevenueFromContractWithCustomerExcludingAssessedTax`), confirmed via the XBRL calculation linkbase (`shop-20211231_cal.xml`).

**Note:** SHOP's 10-K filings use the `Revenues` tag (not `RevenueFromContractWithCustomerExcludingAssessedTax`). The existing normalizer's `Revenues` tag already covers 10-K entries — no conflict.

---

## 3. Recommendation: Implement via companyconcept API

The fix is to fetch revenue via the per-concept endpoint and include `40-F` as an accepted form type alongside `10-K`.

Current flow (companyfacts): filters to `form === '10-K'` → misses all pre-2022 SHOP history.

Proposed flow (companyconcept): fetch `/api/xbrl/companyconcept/CIK{cik}/us-gaap/{tag}.json` → filter `form in ['10-K', '40-F']` → full history back to 2017.

**Scope estimate:** Medium. The companyconcept endpoint returns the same shape as companyfacts units arrays, so deduplication and normalization logic is unchanged. The main change is in the data-fetching layer (how we retrieve concept data per company) and adding `40-F` to accepted form types.

---

## 4. Frame-Annotation Fallback Assessment

The original Fix 3 (frame-annotation fallback using end − start ≥ 350 days) was designed to recover no-frame annual entries. For SHOP:

- 2023 and 2024 10-K entries exist with `frame=False`, but each also has a `frame=True` duplicate for the same year.
- Existing deduplication already selects the framed entry — the fallback adds no value for SHOP.

**For other companies:** The frame-fallback is a defensive guard for companies whose only annual entry lacks a frame annotation. It remains potentially useful in that edge case. However, given that companyconcept already returns richer data including 40-F, and deduplication handles same-year duplicates, the fallback is low-value complexity.

**Decision: Drop the frame-annotation fallback from scope.** It was designed for a SHOP problem that doesn't exist. If a real company surfaces the no-frame-only case, add it then.

---

## Acceptance Criteria

- [x] Root cause confirmed: 40-F vs 10-K filing type documented
- [x] Feasibility of 40-F extraction assessed — accessible via companyconcept API
- [x] Recommendation documented — implement via companyconcept, include `40-F` form
- [x] Frame-annotation fallback assessed — drop from scope
