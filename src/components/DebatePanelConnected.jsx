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
 * - Loading spinner
 * - Error with retry
 * - Rate limited with upgrade CTA
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

// =============================================================================
// Loading state
// =============================================================================

function DebateLoading() {
  return (
    <div
      data-testid="debate-loading"
      className="card mt-6 animate-pulse"
      aria-label="Loading AI debate analysis"
      role="status"
    >
      <div className="h-5 w-48 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="h-40 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
        <div className="h-40 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
      </div>
      <div className="h-32 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
      <span className="sr-only">Loading AI debate analysis...</span>
    </div>
  );
}

// =============================================================================
// Error state
// =============================================================================

function DebateError({ message, onRetry }) {
  return (
    <div
      data-testid="debate-error"
      className="card mt-6 flex flex-col items-center gap-3 py-8 text-center"
    >
      <span className="text-2xl" aria-hidden="true">⚠️</span>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </p>
      {onRetry && (
        <button
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
  onRetry: PropTypes.func,
};

// =============================================================================
// Rate limit state
// =============================================================================

function DebateRateLimit({ info }) {
  return (
    <div
      data-testid="debate-rate-limit"
      className="card mt-6 flex flex-col items-center gap-3 py-8 text-center"
    >
      <span className="text-2xl" aria-hidden="true">🔒</span>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        Debate generation limit reached
      </p>
      {info && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {info.currentCount} / {info.maxCount} debates used this period
        </p>
      )}
      {info?.upgradeUrl && (
        <a
          href={info.upgradeUrl}
          className="px-4 py-2 text-sm font-medium rounded-lg"
          style={{
            backgroundColor: '#3B82F6',
            color: '#fff',
          }}
          rel="noreferrer"
        >
          Upgrade to generate more
        </a>
      )}
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
  const { debate, loading, error, isRateLimited, rateLimitInfo, refresh } = useDebate(ticker);

  if (loading) return <DebateLoading />;
  if (isRateLimited) return <DebateRateLimit info={rateLimitInfo} />;
  if (error) return <DebateError message={error} onRetry={refresh} />;
  if (!debate) return null;

  const metadata = {
    viewCount: debate.metadata?.viewCount,
    generatedAt: debate.generatedAt,
  };

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
        <BullCaseCard bullCase={debate.bullCase} metadata={metadata} />
        <BearCaseCard bearCase={debate.bearCase} metadata={metadata} />
      </div>

      {/* Synthesis — full width below */}
      <SynthesisCard synthesis={debate.synthesis} metadata={metadata} />
    </section>
  );
}

DebatePanelConnected.propTypes = {
  ticker: PropTypes.string,
};

export default DebatePanelConnected;
