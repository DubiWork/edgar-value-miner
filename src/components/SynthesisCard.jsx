/**
 * SynthesisCard — Balanced summary of both sides of the AI debate.
 *
 * Displays:
 * - Balance icon and heading with blue color scheme
 * - Recommendation / overall summary
 * - Key decision factors list
 * - Overall sentiment indicator (bullish / neutral / bearish)
 * - Community framing: "X investors researched this"
 * - Freshness: "Updated [date]"
 * - Mandatory, non-dismissible investment disclaimer
 *
 * @param {Object} props
 * @param {import('../services/debateApi').Synthesis} props.synthesis
 * @param {{ viewCount: number, generatedAt: string }} props.metadata
 */

import PropTypes from 'prop-types';

const BLUE_COLOR = '#3B82F6';
const BLUE_BG = 'color-mix(in srgb, #3B82F6 8%, transparent)';
const BLUE_BORDER = 'color-mix(in srgb, #3B82F6 25%, transparent)';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns a sentiment label and emoji based on confidence (0-1).
 * >0.70 = Bullish, 0.40-0.70 = Neutral, <0.40 = Bearish
 */
function getSentiment(confidence) {
  if (confidence > 0.7) return { label: 'Bullish', emoji: '📈' };
  if (confidence >= 0.4) return { label: 'Neutral', emoji: '⚖️' };
  return { label: 'Bearish', emoji: '📉' };
}

/**
 * Formats an ISO date string to "Updated Mar 1, 2026"
 * @param {string} isoString
 */
function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Unknown';
  return `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Formats a view count with comma separator.
 * @param {number} count
 */
function formatViewCount(count) {
  if (typeof count !== 'number') return '0';
  return count.toLocaleString('en-US');
}

// =============================================================================
// SynthesisCard
// =============================================================================

export function SynthesisCard({ synthesis, metadata }) {
  const { keyFactors = [], recommendation, confidence, disclaimer } = synthesis;
  const sentiment = getSentiment(confidence);
  const { viewCount, generatedAt } = metadata || {};

  return (
    <div
      data-testid="synthesis-card"
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{
        backgroundColor: BLUE_BG,
        border: `1px solid ${BLUE_BORDER}`,
        color: 'var(--color-text-primary)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: BLUE_COLOR }}>
          <span aria-hidden="true">⚖️</span>
          Synthesis
        </h4>

        {/* Sentiment indicator */}
        <span
          data-testid="sentiment-indicator"
          className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
          style={{
            backgroundColor: BLUE_BG,
            color: BLUE_COLOR,
            border: `1px solid ${BLUE_BORDER}`,
          }}
          aria-label={`Sentiment: ${sentiment.label}`}
        >
          <span aria-hidden="true">{sentiment.emoji}</span>
          {sentiment.label}
        </span>
      </div>

      {/* Recommendation */}
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {recommendation}
      </p>

      {/* Key factors */}
      {keyFactors.length > 0 && (
        <div className="flex flex-col gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Key Decision Factors
          </h5>
          {keyFactors.map((factor, i) => (
            <div
              key={i}
              data-testid={`synthesis-factor-${i}`}
              className="text-xs rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: `1px solid ${BLUE_BORDER}` }}
            >
              <p className="font-medium mb-0.5" style={{ color: BLUE_COLOR }}>{factor.title}</p>
              <p style={{ color: 'var(--color-text-secondary)' }}>{factor.analysis}</p>
            </div>
          ))}
        </div>
      )}

      {/* Community stats */}
      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
        {viewCount !== undefined && (
          <span data-testid="view-count">
            {formatViewCount(viewCount)} investors researched this
          </span>
        )}
        {generatedAt && (
          <span data-testid="generated-at">
            {formatDate(generatedAt)}
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ backgroundColor: BLUE_BG, color: BLUE_COLOR, border: `1px solid ${BLUE_BORDER}` }}>
          Feroldi Quality Framework
        </span>
      </div>

      {/* Disclaimer — mandatory, no close button */}
      <div
        data-testid="investment-disclaimer"
        className="text-xs rounded-lg px-3 py-2"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
        role="note"
        aria-label="Investment disclaimer"
      >
        {disclaimer || 'AI-generated analysis for educational purposes only. Not financial advice.'}
      </div>
    </div>
  );
}

SynthesisCard.propTypes = {
  synthesis: PropTypes.shape({
    keyFactors: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        analysis: PropTypes.string.isRequired,
      })
    ).isRequired,
    recommendation: PropTypes.string.isRequired,
    confidence: PropTypes.number.isRequired,
    disclaimer: PropTypes.string.isRequired,
    generatedAt: PropTypes.string,
  }).isRequired,
  metadata: PropTypes.shape({
    viewCount: PropTypes.number,
    generatedAt: PropTypes.string,
  }),
};

export default SynthesisCard;
