---
title: PR #263 — latestFiledDate review lessons
date: 2026-08-16
---

# What we learned

## AC writing patterns
- Name the exact fixture file in the AC — "using existing AAPL fixture" is ambiguous if no raw SEC fixture exists yet
- Each test must isolate one thing — duplicate tests with same input/assertion add zero coverage
- Scope guards in ACs prevent agents from touching unrelated files ("non-breaking — no changes to existing normalizer")

## IFRS boundary pattern
- Any utility reading `us-gaap` must explicitly test IFRS-only blob behavior
- Established `aaplCompanyFacts.js` as the canonical raw SEC fixture for us-gaap tests

## Why IFRS is deferred
- Different data model (different tag names), not just different currency
- `latestFiledDate` scoped to cacheWriter staleness detection — us-gaap sufficient for ~95% of analyzed companies
- IFRS support belongs in #252 (detectFilingCurrency + IFRS namespace detection)
