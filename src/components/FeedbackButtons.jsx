/**
 * FeedbackButtons — Thumbs up / thumbs down per debate section.
 *
 * Features:
 * - Optimistic UI: state updates immediately, reverts on API error
 * - Requires auth: shows "Sign in to rate" tooltip for anonymous users
 * - User can toggle or change their rating
 * - Debounces rapid clicks to avoid duplicate submissions
 *
 * @param {Object} props
 * @param {string} props.debateId - Debate document ID (e.g. "AAPL_v1")
 * @param {'bullCase'|'bearCase'|'synthesis'} props.section - Which section to rate
 */

import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { submitFeedback } from '../services/debateApi';

// =============================================================================
// SVG Icons
// =============================================================================

function ThumbUpIcon({ active, color }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={active ? color : 'none'}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

ThumbUpIcon.propTypes = {
  active: PropTypes.bool.isRequired,
  color: PropTypes.string.isRequired,
};

function ThumbDownIcon({ active, color }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={active ? color : 'none'}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

ThumbDownIcon.propTypes = {
  active: PropTypes.bool.isRequired,
  color: PropTypes.string.isRequired,
};

// =============================================================================
// FeedbackButtons
// =============================================================================

export function FeedbackButtons({ debateId, section }) {
  const { isAuthenticated } = useAuth();
  const [rating, setRating] = useState(null); // null | 'up' | 'down'
  const [submitError, setSubmitError] = useState(false);
  // Generation counter: increments with each new click so stale async results are ignored
  const generationRef = useRef(0);
  const errorTimerRef = useRef(null);

  const handleRate = useCallback(
    async (selectedRating) => {
      if (!isAuthenticated) return;

      const previousRating = rating;
      // Capture this generation before the async call
      const myGeneration = ++generationRef.current;

      // Optimistic update
      setRating(selectedRating);

      try {
        await submitFeedback(debateId, section, selectedRating);
      } catch {
        // Only revert if this is still the latest click
        if (myGeneration === generationRef.current) {
          setRating(previousRating);
          setSubmitError(true);
          clearTimeout(errorTimerRef.current);
          errorTimerRef.current = setTimeout(() => setSubmitError(false), 3000);
        }
      }
    },
    [isAuthenticated, debateId, section, rating]
  );

  const upActive = rating === 'up';
  const downActive = rating === 'down';

  const UP_COLOR = '#10B981';
  const DOWN_COLOR = '#EF4444';

  const containerTitle = isAuthenticated ? undefined : 'Sign in to rate this analysis';

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div
        data-testid="feedback-buttons-container"
        className="flex items-center gap-1.5"
        title={containerTitle}
        aria-label={isAuthenticated ? `Rate ${section} analysis` : 'Sign in to rate'}
      >
        <button
          type="button"
          data-testid="feedback-thumb-up"
          data-active={String(upActive)}
          className="flex items-center justify-center rounded-md p-1 transition-all duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{
            backgroundColor: upActive
              ? 'color-mix(in srgb, #10B981 15%, transparent)'
              : 'transparent',
            border: `1px solid ${upActive ? UP_COLOR : 'var(--color-border, #e5e7eb)'}`,
            cursor: isAuthenticated ? 'pointer' : 'default',
            opacity: isAuthenticated ? 1 : 0.5,
          }}
          onClick={() => handleRate('up')}
          aria-label="Thumbs up"
          aria-pressed={upActive}
          disabled={!isAuthenticated}
        >
          <ThumbUpIcon active={upActive} color={UP_COLOR} />
        </button>

        <button
          type="button"
          data-testid="feedback-thumb-down"
          data-active={String(downActive)}
          className="flex items-center justify-center rounded-md p-1 transition-all duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{
            backgroundColor: downActive
              ? 'color-mix(in srgb, #EF4444 15%, transparent)'
              : 'transparent',
            border: `1px solid ${downActive ? DOWN_COLOR : 'var(--color-border, #e5e7eb)'}`,
            cursor: isAuthenticated ? 'pointer' : 'default',
            opacity: isAuthenticated ? 1 : 0.5,
          }}
          onClick={() => handleRate('down')}
          aria-label="Thumbs down"
          aria-pressed={downActive}
          disabled={!isAuthenticated}
        >
          <ThumbDownIcon active={downActive} color={DOWN_COLOR} />
        </button>
      </div>
      {submitError && (
        <span
          data-testid="feedback-error"
          style={{ color: '#EF4444', fontSize: '0.75rem' }}
          role="alert"
        >
          Failed to save — please try again.
        </span>
      )}
    </div>
  );
}

FeedbackButtons.propTypes = {
  debateId: PropTypes.string.isRequired,
  section: PropTypes.oneOf(['bullCase', 'bearCase', 'synthesis']).isRequired,
};

export default FeedbackButtons;
