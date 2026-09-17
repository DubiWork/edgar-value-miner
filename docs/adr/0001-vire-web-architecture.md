# 1. Web-native architecture for the VIRE research pipeline

- **Status:** Accepted
- **Date:** 2026-08-07
- **Deciders:** project owner (via 10-round grilling session)
- **Issue:** [#247](https://github.com/DubiWork/edgar-value-miner/issues/247) — *DECISION: How does VIRE relate to the web app — architecture of the integration?*
- **Supersedes:** none
- **Related:** unblocks Wayfinder tickets #242–#246 (issue [#241](https://github.com/DubiWork/edgar-value-miner/issues/241))

## Context

[VIRE](../PRODUCT_VISION.md) is a retired 9-step local Python CLI (Data Collection → Business Clarity → Feroldi+Antifragile Scoring → Bull/Bear Research → Adversarial Debate → DCF → Thesis Synthesis → Position Card+Monitoring → Podcast). It proved the research **pipeline logic** works — run on MSFT/AMD/AMZN/SHOP/SOFI/SAP — but **failed as a product**: its AI outputs had no source traceability, which destroyed user trust regardless of pipeline quality.

edgar-value-miner is the trustworthy, web-native successor. #247 was the frontier decision that gated all other roadmap tickets: **how does VIRE's local batch pipeline translate into a web-native architecture** that is free-first, multi-user-ready, AI-provider-swappable, and not dependent on the owner's employer tools or a single workstation.

The three core product principles constrain every choice: (1) **Trustworthy** — every claim *and every decision* traceable; (2) **Educational companion**; (3) **AI woven through the entire flow**.

## Decision

Adopt a **two-systems, one-engine** architecture with layered data, freshness metadata on every record, a private personal knowledge layer, a swappable AI provider, two product modes, and an append-only reasoning trail as the keystone.

### 1. Two systems, one engine
- **Back-office batch pipeline** — the VIRE steps as jobs (ingest, scrape, transcribe, score, generate insights). Writes to a shared store. Runs anywhere.
- **Runtime website** — a fast reader over that store plus rate-limited trigger points. Never does heavy ingestion live.

### 2. Three data tiers
- **Tier 1 — Live, any company:** price, SEC financials/charts, filings. Real-time, no pre-build (≈ Phase 1.5).
- **Tier 2 — Derived, on-demand, cached:** Feroldi score, DCF, margins — computed from Tier 1, then cached.
- **Tier 3 — Deep AI, pre-built or queued:** earnings-call insights, debate, companion wisdom, cross-company themes. Missing → surface "coming later" + queue. Trigger flag: **(c) owner-only now → (b) opt-in button later.** Never auto-queue (protects the AI budget).

### 3. Freshness / staleness (hard requirement)
Every stored record — **including AI insights** — carries `{source_type, last_fetched, refresh_policy, static|dynamic}`. Static insights (moat, business model, timeless scoring answers) are answered once and **reused across sessions AND users** (major cost lever). Dynamic insights re-run on new data. A back-office sweeper flags/refreshes stale records, event-driven where possible. The website *shows* freshness — serving principle #1.

### 4. Two-layer knowledge
- **Shared/global:** Warren Buffett — public, citable, a product feature.
- **Personal:** the owner's mentor's wisdom — a **PRIVATE knowledge base; the mentor's name NEVER appears on the site**, surfaced only as "my voice" (no consent given; content is public YouTube + a paid Discord). Sources: EDGAR 10-K/transcripts, own Python IR scraper, local Whisper transcriber, the `analyze` video-analysis skill (private Obsidian vault), Discord pastes. Indexed with wiki-link richness; **cross-company** retrieval, not only per-ticker.

### 5. AI layer
Server-side **provider abstraction** with a Firestore config flag for redeploy-free model swaps. Personal **Gemini** key (not an employer subscription). **Rate limiting:** per-user daily cap + global circuit-breaker; anonymous users get **data only**, AI requires signup. Cost monitored.

### 6. Two modes over the same engine
- **Research mode** — fast reader: charts, debate, insights.
- **Learn mode** — first-class. Two blocks: **terminology** (static definitions; can reference external/mentor videos for remedial help) and **guided process** (gated steps + per-area guidance; **skippable & configurable**). **Adaptive:** a per-user proficiency score unlocks advanced guidance and suppresses basics.

### 7. Keystone — personal layer = a reasoning trail
An **append-only, supersession-based per-user log** of what the user saw, engaged with, and concluded. Every AI flow (debate, grilling, insights, Learn answers) writes its outcome there, tagged to a company + decision. Portfolio decisions and the conviction ledger are **assembled from this traceable history**, not entered blind. The user can **revise, reverse, or regret** earlier conclusions — new entries supersede without erasing, preserving how conviction evolved. This is the deepest expression of principle #1.

### 8. Portability (hard constraint)
Nothing tied to a work machine or an employer AI subscription. Personal credentials, portable repo, Firestore-backed config, a web-based admin dashboard. Local execution is *one* place it runs — not the only one. Must survive losing the current workstation.

## Consequences

**Positive**
- Cost model works: static-insight reuse across users is the margin lever the retired product lacked.
- Trust is architectural, not cosmetic — freshness metadata + reasoning trail make claims and decisions traceable.
- Provider abstraction + Firestore config = redeploy-free model swaps and no employer-tool lock-in.
- Two modes and the reasoning trail give the product its educational and personal differentiation over a static data site.

**Negative / costs**
- Significant net-new surface: back-office pipeline, vector/knowledge store, sweeper, admin dashboard, auth — none exist yet.
- Reasoning-trail supersession semantics are non-trivial to model and store correctly.
- The current Cloud Functions hard-depend on `@anthropic-ai/sdk`; the provider-abstraction layer must be built before the Gemini-key decision is real.

**Deferred to feature tickets**
- Proficiency-state schema → #246 (learn)
- Reasoning-trail / conviction-ledger schema → #245 (portfolio) / #246 (learn)
- "Grill your thesis" (Socratic self-grilling) → later feature; another AI flow over the same engine
- SEO (static landing + `/app` SPA), demand monitoring (GA4) → confirmed, detail later

## Notes

Full working summary lives in [`CONTEXT.md`](../../CONTEXT.md). This ADR is the authoritative decision record; CONTEXT.md summarizes it for onboarding. The next step is domain modeling over this architecture, then `/to-spec` → `/to-tickets`.
