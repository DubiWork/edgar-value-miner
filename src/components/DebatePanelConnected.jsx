/**
 * DebatePanelConnected — Real AI Bull vs Bear debate panel.
 *
 * Orchestrates BullCaseCard, BearCaseCard, and SynthesisCard.
 * Wired to the useDebate hook for live data from the Cloud Function.
 *
 * Layout:
 * - Desktop (>768px): Bull | Bear side-by-side, Synthesis below
 * - Mobile (375px): All stacked vertically
 *
 * States:
 * - Loading: shimmer skeleton matching DebatePanel layout (3 cards)
 * - Error: distinct messages per error type (network, server, timeout, not-found)
 * - Rate limited with upgrade CTA and analytics event
 * - Success (Bull + Bear + Synthesis)
 *
 * @param {Object} props
 * @param {string} props.ticker - Stock ticker to fetch debate for
 */

import PropTypes from 'prop-types';
import { useDebate } from '../hooks/useDebate';
import { BullCaseCard } from './BullCaseCard';
import { BearCaseCard } from './BearCaseCard';
import { SynthesisCard } from './SynthesisCard';
import { DebateShareCard } from './DebateShareCard';

// =============================================================================
// Analytics helper
// =============================================================================

/**
 * Fires a gtag event if the gtag function is available.
 * Falls back silently when analytics is not configured.
 *
 * @param {string} eventName - Event name (e.g. 'upgrade_cta_clicked')
 * @param {Object} [params]  - Additional event parameters
 */
function fireAnalyticsEvent(eventName, params = {}) {
  if (typeof globalThis.gtag === 'function') {
    globalThis.gtag('event', eventName, params);
  }
}

// =============================================================================
// Error codes that are NOT retryable (no retry button shown)
// =============================================================================

const NON_RETRYABLE_CODES = new Set(['not-found', 'auth']);

// =============================================================================
// Loading state — 3-card shimmer skeleton
// =============================================================================

/**
 * SkeletonBone — single animated gray rectangle used inside the skeleton.
 */
function SkeletonBone({ className = '' }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`.trim()}
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    />
  );
}

SkeletonBone.propTypes = {
  className: PropTypes.string,
};

/**
 * DebateCardSkeleton — skeleton placeholder for one debate card
 * (Bull, Bear, or Synthesis). Matches the rough dimensions of the real cards.
 */
function DebateCardSkeleton({ testId }) {
  return (
    <div
      data-testid={testId}
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header row: icon + title */}
      <div className="flex items-center justify-between gap-2">
        <SkeletonBone className="h-4 w-24" />
        <SkeletonBone className="h-4 w-20" />
      </div>
      {/* Confidence bar */}
      <SkeletonBone className="h-2 w-full" />
      {/* 3 argument/factor rows */}
      <SkeletonBone className="h-8 w-full" />
      <SkeletonBone className="h-8 w-full" />
      <SkeletonBone className="h-8 w-full" />
    </div>
  );
}

DebateCardSkeleton.propTypes = {
  testId: PropTypes.string.isRequired,
};

/**
 * DebateLoading — full loading skeleton for the debate panel.
 *
 * Renders 3 skeleton cards (Bull, Bear, Synthesis) with:
 * - Company name in the loading message
 * - Time estimate ("This usually takes 10–15 seconds")
 */
function DebateLoading({ ticker }) {
  return (
    <div
      data-testid="debate-loading"
      className="card mt-6"
      aria-label="Loading AI debate analysis"
      role="status"
    >
      {/* Loading message */}
      <div className="mb-4">
        <p
          data-testid="debate-loading-message"
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Generating AI debate for {ticker}...
        </p>
        <p
          data-testid="debate-loading-time-estimate"
          className="text-xs mt-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          This usually takes 10–15 seconds
        </p>
      </div>

      {/* Bull + Bear side-by-side (stacked on mobile) */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <DebateCardSkeleton testId="debate-skeleton-card-bull" />
        <DebateCardSkeleton testId="debate-skeleton-card-bear" />
      </div>

      {/* Synthesis below */}
      <DebateCardSkeleton testId="debate-skeleton-card-synthesis" />

      <span className="sr-only">Loading AI debate analysis...</span>
    </div>
  );
}

DebateLoading.propTypes = {
  ticker: PropTypes.string,
};

// =============================================================================
// Error state
// =============================================================================

/**
 * DebateError — contained error display within the debate section.
 *
 * Does NOT break the Dashboard. Shows a contextual message per error type
 * and a retry button for retryable errors.
 *
 * @param {Object} props
 * @param {string} props.message   - User-friendly error message
 * @param {string|null} props.errorCode - Machine-readable code ('network' | 'internal' | 'timeout' | 'not-found' | 'auth' | ...)
 * @param {Function|null} props.onRetry - Retry callback; omitted for non-retryable errors
 */
function DebateError({ message, errorCode, onRetry }) {
  const isRetryable = !NON_RETRYABLE_CODES.has(errorCode);

  return (
    <div
      data-testid="debate-error"
      className="card mt-6 flex flex-col items-center gap-3 py-8 text-center"
    >
      <span className="text-2xl" aria-hidden="true">⚠️</span>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </p>
      {isRetryable && onRetry && (
        <button
          data-testid="debate-error-retry"
          type="button"
          className="px-4 py-2 text-sm font-medium rounded-lg"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-bg-primary)',
          }}
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

DebateError.propTypes = {
  message: PropTypes.string.isRequired,
  errorCode: PropTypes.string,
  onRetry: PropTypes.func,
};

// =============================================================================
// Rate limit state — visually distinct from error (upgrade opportunity)
// =============================================================================

/**
 * DebateRateLimit — upgrade CTA shown when the free tier limit is reached.
 *
 * Visually distinct from the error state: uses a lock icon and upgrade-focused
 * language rather than a warning icon and retry.
 *
 * Fires `upgrade_cta_clicked` analytics event when the CTA is clicked.
 *
 * @param {Object} props
 * @param {{ currentCount: number, maxCount: number, upgradeUrl: string }|null} props.info
 */
function DebateRateLimit({ info }) {
  const upgradeUrl =
    info?.upgradeUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_UPGRADE_URL) ||
    '#';

  function handleCtaClick() {
    fireAnalyticsEvent('upgrade_cta_clicked', {
      source: 'debate_rate_limit',
      current_count: info?.currentCount,
      max_count: info?.maxCount,
    });
  }

  return (
    <div
      data-testid="debate-rate-limit"
      className="card mt-6 flex flex-col items-center gap-4 py-10 text-center"
      style={{
        border: '1px solid color-mix(in srgb, #3B82F6 30%, transparent)',
        backgroundColor: 'color-mix(in srgb, #3B82F6 5%, transparent)',
      }}
    >
      <span className="text-3xl" aria-hidden="true">🔒</span>

      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          You&rsquo;ve reached your debate limit
        </p>
        {info && (
          <p
            data-testid="rate-limit-usage"
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {info.currentCount} of {info.maxCount} free debates used this month
          </p>
        )}
      </div>

      <p
        data-testid="rate-limit-upgrade-message"
        className="text-sm max-w-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Unlock unlimited debates for $9.99/month and get AI analysis for any stock.
      </p>

      <a
        data-testid="rate-limit-cta"
        href={upgradeUrl}
        className="px-6 py-2.5 text-sm font-semibold rounded-lg"
        style={{
          backgroundColor: '#3B82F6',
          color: '#fff',
        }}
        rel="noreferrer"
        onClick={handleCtaClick}
      >
        Upgrade — Unlimited Debates
      </a>
    </div>
  );
}

DebateRateLimit.propTypes = {
  info: PropTypes.shape({
    currentCount: PropTypes.number,
    maxCount: PropTypes.number,
    upgradeUrl: PropTypes.string,
  }),
};

// =============================================================================
// DebatePanelConnected
// =============================================================================

export function DebatePanelConnected({ ticker }) {
  const { debate, loading, error, errorCode, isRateLimited, rateLimitInfo, refresh } = useDebate(ticker);

  if (loading) return <DebateLoading ticker={ticker} />;
  if (isRateLimited) return <DebateRateLimit info={rateLimitInfo} />;
  if (error) return <DebateError message={error} errorCode={errorCode} onRetry={refresh} />;
  if (!debate) return null;

  const metadata = {
    viewCount: debate.metadata?.viewCount,
    generatedAt: debate.generatedAt,
  };

  // Debate document ID follows the pattern {TICKER}_v{version}
  const debateId = `${debate.ticker}_v${debate.metadata?.version ?? 1}`;

  // Derive sentiment from bull vs bear confidence
  const bullConf = debate.bullCase?.confidence ?? 0.5;
  const bearConf = debate.bearCase?.confidence ?? 0.5;
  let sentiment = 'neutral';
  if (bullConf - bearConf > 0.05) sentiment = 'bullish';
  else if (bearConf - bullConf > 0.05) sentiment = 'bearish';

  return (
    <section
      data-testid="debate-panel-container"
      aria-label="AI Bull vs Bear Debate"
      className="card mt-6"
    >
      {/* Panel header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
              color: 'var(--color-accent-text)',
            }}
          >
            {debate.ticker}
          </span>
          <h3 className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
            {debate.companyName}
          </h3>
        </div>
        <span
          data-testid="methodology-citation"
          className="text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Analysis based on Feroldi Quality Framework
        </span>
      </div>

      {/* Bull vs Bear grid — side-by-side on desktop, stacked on mobile */}
      <div
        data-testid="debate-grid"
        className="grid md:grid-cols-2 gap-4 mb-4"
      >
        <BullCaseCard bullCase={debate.bullCase} metadata={metadata} debateId={debateId} />
        <BearCaseCard bearCase={debate.bearCase} metadata={metadata} debateId={debateId} />
      </div>

      {/* Synthesis — full width below */}
      <SynthesisCard synthesis={debate.synthesis} metadata={metadata} debateId={debateId} />

      {/* Share card — social sharing buttons */}
      <div
        className="mt-4 pt-4"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <DebateShareCard
          ticker={debate.ticker}
          companyName={debate.companyName}
          sentiment={sentiment}
        />
      </div>
    </section>
  );
}

DebatePanelConnected.propTypes = {
  ticker: PropTypes.string,
};

export default DebatePanelConnected;
