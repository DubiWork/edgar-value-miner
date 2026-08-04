# ADR: Chart library for Phase 1.5 — stay on Recharts

**Date:** 2026-07-26
**Status:** Accepted
**Decision owner:** Architect (Phase 1.5 planning)
**Confidence:** 85%

## Context

Phase 1.5 ("Full Financial Statements", milestone #6) adds a statement-grid view with: full-history line/bar charts (annual + quarterly), a range selector (1Y/3Y/5Y/10Y/MAX presets + draggable brush minimap syncing all charts), and a line-item drill-down chart with up to 3 comparison overlays. Inline sparklines (30-50 per page, 60×28px) were already decided as **raw SVG** — not the chart library's concern. The 3 existing charts (Revenue, FCF, Margins) use **Recharts v3.7**.

## Decision

**Stay on Recharts.** Build the range brush, range-sync, and drill-down using Recharts' native `<Brush>` + controlled `startIndex`/`endIndex` state. Do NOT adopt Apache ECharts.

## Rationale

- **Data scale is small:** drill-down = max 4 lines × ~60 quarterly points (~240 points). 2-3 orders of magnitude below where Recharts (SVG) strains (~10K points). ECharts' canvas advantage is irrelevant here.
- **Brush native:** Recharts `<Brush>` renders the 200×24px area-preview + draggable window; presets = compute indices, pass as props; multi-chart sync = lifted state. Simpler (declarative props) than ECharts' imperative `setOption`.
- **Theming:** `useChartTheme()` (CSS-var driven) already feeds Recharts via inline props — zero-cost. ECharts would need a new CSS-var→theme bridge.
- **Bundle:** Recharts already paid (~45KB gz); Phase 1.5 adds ~2-3KB app code. ECharts would add ~130-180KB gz.
- **Migration:** staying = 0 migration; ECharts = rewrite ~900 LOC of 3 charts + theming bridge + learning curve (5-8 days) before any 1.5 work.

## Counterargument (revisit trigger)

If Phase 2 introduces real-time streaming, candlestick/OHLC, or multi-company simultaneous charting (5+ companies × 60 quarters × 30 line items = 9000+ points in one view), Recharts' SVG will hit a ceiling. **Then** migrate ONLY the drill-down chart to a canvas lib (ECharts or Lightweight Charts) — a bounded refactor, not a rewrite. YAGNI until that materializes.

## Consequences

- Phase 1.5 builds on Recharts: new `<RangeBrush>`, `useRangeControl()` hook (presets + brush + URL-sync + per-company localStorage), `<DrillDownChart>` (4 series, `strokeDasharray` variation — proven in MarginsChart), `<ComparisonOverlay>`.
- Hooks into the generic `FinancialBarChart` (#228) as its base.
- Sparklines remain raw SVG (separate decision).
