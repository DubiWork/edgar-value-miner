/**
 * BearCaseCard — Renders the bear (pessimistic) case for an AI debate.
 *
 * Displays:
 * - Bear icon and heading with red color scheme
 * - Confidence meter (0-100%)
 * - Expandable risk factor cards with specific data points
 * - Risk severity indicators
 * - Feroldi/Buffett methodology badge
 *
 * @param {Object} props
 * @param {import('../services/debateApi').BearCase} props.bearCase
 * @param {{ viewCount: number, generatedAt: string }} props.metadata
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfidenceMeter } from './ConfidenceMeter';
import { FeedbackButtons } from './FeedbackButtons';

const BEAR_COLOR = '#EF4444';
const BEAR_BG = 'color-mix(in srgb, #EF4444 8%, transparent)';
const BEAR_BORDER = 'color-mix(in srgb, #EF4444 25%, transparent)';

// =============================================================================
// Severity helpers
// =============================================================================

/**
 * Assigns a severity level based on index order (first is highest risk).
 * MVP: 0 = High, 1 = Medium, 2 = Low, rest = Low
 */
function getSeverity(index) {
  if (index === 0) return 'High';
  if (index === 1) return 'Medium';
  return 'Low';
}

// =============================================================================
// ExpandableRiskFactor
// =============================================================================

function ExpandableRiskFactor({ factor, index }) {
  const [expanded, setExpanded] = useState(false);
  const severity = getSeverity(index);

  return (
    <div
      data-testid={`bear-factor-${index}`}
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${BEAR_BORDER}` }}
    >
      <button
        type="button"
        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span style={{ color: BEAR_COLOR }} aria-hidden="true">↓</span>
          <span className="truncate">{factor.title}</span>
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span
            data-testid={`bear-severity-${index}`}
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: BEAR_BG,
              color: BEAR_COLOR,
              border: `1px solid ${BEAR_BORDER}`,
            }}
          >
            {severity}
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block' }}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 pt-1 text-xs space-y-2"
          style={{ backgroundColor: BEAR_BG }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>{factor.detail}</p>
          <p className="font-medium" style={{ color: BEAR_COLOR }}>
            Data: {factor.dataPoint}
          </p>
        </div>
      )}
    </div>
  );
}

ExpandableRiskFactor.propTypes = {
  factor: PropTypes.shape({
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
    dataPoint: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

// =============================================================================
// BearCaseCard
// =============================================================================

export function BearCaseCard({ bearCase, debateId }) {
  const { riskFactors = [], confidence } = bearCase;

  return (
    <div
      data-testid="bear-case-card"
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{
        backgroundColor: BEAR_BG,
        border: `1px solid ${BEAR_BORDER}`,
        color: 'var(--color-text-primary)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: BEAR_COLOR }}>
          <span aria-hidden="true">🐻</span>
          Bear Case
        </h4>
        <span
          data-testid="bear-methodology-badge"
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: BEAR_BG,
            color: BEAR_COLOR,
            border: `1px solid ${BEAR_BORDER}`,
          }}
        >
          Feroldi / Buffett Methodology
        </span>
      </div>

      {/* Confidence meter */}
      <ConfidenceMeter
        confidence={confidence}
        color={BEAR_COLOR}
        testId="bear-confidence-meter"
      />

      {/* Risk factors */}
      <div className="flex flex-col gap-2">
        {riskFactors.map((factor, i) => (
          <ExpandableRiskFactor key={i} factor={factor} index={i} />
        ))}
      </div>

      {/* Feedback */}
      {debateId && (
        <div className="flex items-center justify-end pt-1">
          <FeedbackButtons debateId={debateId} section="bearCase" />
        </div>
      )}
    </div>
  );
}

BearCaseCard.propTypes = {
  bearCase: PropTypes.shape({
    riskFactors: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        detail: PropTypes.string.isRequired,
        dataPoint: PropTypes.string.isRequired,
      })
    ).isRequired,
    confidence: PropTypes.number.isRequired,
    generatedAt: PropTypes.string,
  }).isRequired,
  debateId: PropTypes.string,
  metadata: PropTypes.shape({
    viewCount: PropTypes.number,
    generatedAt: PropTypes.string,
  }),
};

export default BearCaseCard;
