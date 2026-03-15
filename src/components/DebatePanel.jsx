/**
 * DebatePanel — Hardcoded AAPL Bull vs Bear debate stub.
 *
 * This is a placeholder component clearly marked as "Coming Soon".
 * The JSON data format matches the future Debate schema.
 * A real implementation will fetch live AI-generated debate data.
 *
 * Schema:
 *   { ticker, companyName, generatedAt, bullThesis, bearThesis, synthesis }
 */

// =============================================================================
// Stub data (AAPL hardcoded for preview)
// =============================================================================

const AAPL_DEBATE_STUB = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  generatedAt: '2026-03-01T00:00:00Z',
  bullThesis: {
    title: 'Bull Case',
    summary: 'Apple continues to dominate premium consumer electronics with unmatched brand loyalty and ecosystem lock-in.',
    points: [
      'Services revenue growing at 16% YoY, now accounting for 22% of total revenue with 90%+ gross margins.',
      'iPhone installed base of 2.2B+ devices provides a durable, recurring upgrade cycle.',
      'Expanding into financial services (Apple Pay, Apple Card) and health (Apple Watch) opens multi-billion dollar TAMs.',
      'Net cash position of $50B+ funds aggressive buybacks, reducing share count by 3-4% annually.',
    ],
    score: 8.2,
  },
  bearThesis: {
    title: 'Bear Case',
    summary: 'Slowing iPhone growth and regulatory headwinds from the EU App Store ruling threaten Apple\'s high-margin revenue streams.',
    points: [
      'China iPhone revenue declined 13% last quarter as Huawei regains market share with 5G devices.',
      'EU Digital Markets Act forces Apple to allow third-party app stores, threatening $20B+ App Store revenue.',
      'Vision Pro adoption remains niche at $3,499 — no clear path to mass market within 3 years.',
      'Valuation at 28x earnings prices in significant growth that may not materialize in a slowing consumer cycle.',
    ],
    score: 5.8,
  },
  synthesis: {
    title: 'Synthesis',
    summary: 'Apple remains a high-quality compounder with durable competitive moats, but the current valuation leaves little margin of safety for near-term headwinds.',
    verdict: 'Quality at a Fair Price',
    weightedScore: 7.1,
    keyRisk: 'China revenue concentration (~19% of total) is the primary short-term risk.',
    keyOpportunity: 'Services mix-shift toward higher-margin revenues is the primary long-term value driver.',
  },
};

// =============================================================================
// Sub-components
// =============================================================================

function ThesisSection({ side, data }) {
  const isBull = side === 'bull';
  const testId = isBull ? 'bull-thesis' : 'bear-thesis';
  const accentColor = isBull ? 'var(--color-success)' : 'var(--color-danger)';
  const bgColor = isBull
    ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
    : 'color-mix(in srgb, var(--color-danger) 8%, transparent)';
  const borderColor = isBull
    ? 'color-mix(in srgb, var(--color-success) 25%, transparent)'
    : 'color-mix(in srgb, var(--color-danger) 25%, transparent)';

  return (
    <div
      data-testid={testId}
      className="rounded-xl p-5"
      style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm" style={{ color: accentColor }}>
          {isBull ? '🟢' : '🔴'} {data.title}
        </h4>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: bgColor, color: accentColor, border: `1px solid ${borderColor}` }}
        >
          {data.score}/10
        </span>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        {data.summary}
      </p>
      <ul className="space-y-1.5">
        {data.points.map((point, i) => (
          <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span style={{ color: accentColor, flexShrink: 0 }}>{isBull ? '↑' : '↓'}</span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

/**
 * DebatePanel renders the AI Bull vs Bear debate UI.
 *
 * Currently a stub with hardcoded AAPL data and a "Coming Soon" overlay.
 * Wire to live AI data in a future sprint.
 */
export function DebatePanel() {
  const { ticker, companyName, bullThesis, bearThesis, synthesis } = AAPL_DEBATE_STUB;

  return (
    <section
      aria-label="AI Bull vs Bear Debate"
      className="relative card mt-6"
    >
      {/* Coming Soon overlay badge */}
      <div
        data-testid="coming-soon-badge"
        className="absolute top-4 right-4 z-10 px-3 py-1 text-xs font-semibold rounded-full"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
          color: 'var(--color-warning)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
        }}
      >
        Coming Soon — AI Debate
      </div>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
              color: 'var(--color-accent-text)',
            }}
          >
            {ticker}
          </span>
          <h3 className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
            AI Debate — {companyName}
          </h3>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Placeholder data. Live AI-generated analysis coming in a future release.
        </p>
      </div>

      {/* Bull vs Bear grid */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <ThesisSection side="bull" data={bullThesis} />
        <ThesisSection side="bear" data={bearThesis} />
      </div>

      {/* Synthesis */}
      <div
        data-testid="synthesis"
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            ⚖️ {synthesis.title}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Weighted Score:
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--color-accent-text)' }}>
              {synthesis.weightedScore}/10
            </span>
          </div>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {synthesis.summary}
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span
            className="px-3 py-1 rounded-full font-medium"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
              color: 'var(--color-accent-text)',
            }}
          >
            Verdict: {synthesis.verdict}
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Risk: {synthesis.keyRisk}
          </span>
        </div>
      </div>
    </section>
  );
}

export default DebatePanel;
