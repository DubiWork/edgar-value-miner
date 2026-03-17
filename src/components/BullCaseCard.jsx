/**
 * BullCaseCard — Renders the bull (optimistic) case for an AI debate.
 *
 * Displays:
 * - Bull icon and heading with green color scheme
 * - Confidence meter (0-100%)
 * - Expandable argument cards with SEC filing citations
 * - Feroldi/Buffett methodology badge
 *
 * @param {Object} props
 * @param {import('../services/debateApi').BullCase} props.bullCase
 * @param {{ viewCount: number, generatedAt: string }} props.metadata
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfidenceMeter } from './ConfidenceMeter';
import { FeedbackButtons } from './FeedbackButtons';

const BULL_COLOR = '#10B981';
const BULL_BG = 'color-mix(in srgb, #10B981 8%, transparent)';
const BULL_BORDER = 'color-mix(in srgb, #10B981 25%, transparent)';

// =============================================================================
// ExpandableArgument
// =============================================================================

function ExpandableArgument({ argument, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={`bull-argument-${index}`}
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${BULL_BORDER}` }}
    >
      <button
        type="button"
        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: BULL_COLOR }} aria-hidden="true">↑</span>
          {argument.title}
        </span>
        <span
          className="text-xs flex-shrink-0"
          style={{ color: 'var(--color-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block' }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 pt-1 text-xs space-y-2"
          style={{ backgroundColor: BULL_BG }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>{argument.detail}</p>
          <p className="font-medium" style={{ color: BULL_COLOR }}>
            SEC: {argument.citation}
          </p>
        </div>
      )}
    </div>
  );
}

ExpandableArgument.propTypes = {
  argument: PropTypes.shape({
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
    citation: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

// =============================================================================
// BullCaseCard
// =============================================================================

export function BullCaseCard({ bullCase, debateId }) {
  const { arguments: args = [], confidence } = bullCase;

  return (
    <div
      data-testid="bull-case-card"
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{
        backgroundColor: BULL_BG,
        border: `1px solid ${BULL_BORDER}`,
        color: 'var(--color-text-primary)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: BULL_COLOR }}>
          <span aria-hidden="true">🐂</span>
          Bull Case
        </h4>
        <span
          data-testid="bull-methodology-badge"
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: BULL_BG,
            color: BULL_COLOR,
            border: `1px solid ${BULL_BORDER}`,
          }}
        >
          Feroldi / Buffett Methodology
        </span>
      </div>

      {/* Confidence meter */}
      <ConfidenceMeter
        confidence={confidence}
        color={BULL_COLOR}
        testId="bull-confidence-meter"
      />

      {/* Arguments */}
      <div className="flex flex-col gap-2">
        {args.map((arg, i) => (
          <ExpandableArgument key={i} argument={arg} index={i} />
        ))}
      </div>

      {/* Feedback */}
      {debateId && (
        <div className="flex items-center justify-end pt-1">
          <FeedbackButtons debateId={debateId} section="bullCase" />
        </div>
      )}
    </div>
  );
}

BullCaseCard.propTypes = {
  bullCase: PropTypes.shape({
    arguments: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        detail: PropTypes.string.isRequired,
        citation: PropTypes.string.isRequired,
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

export default BullCaseCard;
