/**
 * WelcomeScreen — Redesigned landing screen for EDGAR Value Miner
 *
 * Highlights the AI Bull vs Bear debate as the core value proposition.
 * Replaces the old generic "Find gems in the market" welcome state.
 *
 * Sections:
 * 1. Hero: "Your AI Research Analyst" + debate preview + value proposition
 * 2. Primary CTA: "Try a Free AI Debate" → hero search bar
 * 3. Social proof: debates generated counter
 * 4. Feature highlights: AI Debate (primary), Personal Notes, Financial Charts
 * 5. Methodology badges: Feroldi Quality Framework, Buffett Methodology, SEC EDGAR
 *
 * @param {Object} props
 * @param {Function} [props.onSearch] - Called when user submits a ticker search
 * @param {boolean} [props.isSearching] - Whether a search is in progress
 * @param {number|null} [props.debateCount] - Total debates generated (for social proof)
 */

import { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { MessageSquare, BookOpen, BarChart3 } from 'lucide-react';
import { TickerSearch } from './TickerSearch';

// =============================================================================
// Analytics helper (mirrors pattern in DebatePanelConnected)
// =============================================================================

function fireAnalyticsEvent(eventName, params = {}) {
  if (typeof globalThis.gtag === 'function') {
    globalThis.gtag('event', eventName, params);
  }
}

// =============================================================================
// Debate Preview — static mini-preview showing Bull vs Bear concept
// =============================================================================

function DebatePreview() {
  return (
    <div
      data-testid="debate-preview"
      className="w-full max-w-2xl mx-auto mt-6 rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-tertiary)',
      }}
    >
      {/* Preview header */}
      <div
        className="px-4 py-2 flex items-center justify-between text-xs"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>AI Debate Preview — AAPL</span>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
            color: 'var(--color-warning)',
          }}
        >
          Sample
        </span>
      </div>

      {/* Bull vs Bear side-by-side */}
      <div className="grid sm:grid-cols-2 gap-0">
        {/* Bull side */}
        <div
          className="px-4 py-3"
          style={{
            borderRight: '1px solid var(--color-border)',
            backgroundColor: 'color-mix(in srgb, var(--color-success) 5%, transparent)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--color-success)' }}
            >
              Bull Case
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
                color: 'var(--color-success)',
              }}
            >
              8.2/10
            </span>
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Services revenue growing 16% YoY. Ecosystem lock-in with 2.2B+ devices.
          </p>
        </div>

        {/* Bear side */}
        <div
          className="px-4 py-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 5%, transparent)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--color-danger)' }}
            >
              Bear Case
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
                color: 'var(--color-danger)',
              }}
            >
              5.8/10
            </span>
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            China revenue down 13%. EU App Store ruling threatens $20B+ annually.
          </p>
        </div>
      </div>

      {/* Synthesis bar */}
      <div
        className="px-4 py-2 flex items-center justify-between text-xs"
        style={{
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-secondary)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Synthesis: Quality at a Fair Price</span>
        <span
          className="font-semibold"
          style={{ color: 'var(--color-accent-text)' }}
        >
          Weighted: 7.1/10
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// FeatureCard — single feature highlight card
// =============================================================================

function FeatureCard({ testId, icon, title, description, isPrimary = false, accentColor, bgColor }) {
  const IconComponent = icon;
  return (
    <div
      data-testid={testId}
      data-primary={isPrimary ? 'true' : 'false'}
      className="card text-left"
      style={isPrimary ? {
        border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${accentColor} 5%, var(--color-bg-tertiary))`,
      } : {}}
    >
      <div className="flex items-center space-x-3 mb-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: bgColor }}
        >
          <IconComponent
            className="h-6 w-6"
            style={{ color: accentColor }}
            aria-hidden="true"
          />
        </div>
        <h3
          className="font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h3>
        {isPrimary && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium ml-auto"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              color: accentColor,
            }}
          >
            Core Feature
          </span>
        )}
      </div>
      <p
        className="text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {description}
      </p>
    </div>
  );
}

FeatureCard.propTypes = {
  testId: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  isPrimary: PropTypes.bool,
  accentColor: PropTypes.string.isRequired,
  bgColor: PropTypes.string.isRequired,
};

// =============================================================================
// MethodologyBadge — single methodology badge
// =============================================================================

function MethodologyBadge({ label }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      {label}
    </span>
  );
}

MethodologyBadge.propTypes = {
  label: PropTypes.string.isRequired,
};

// =============================================================================
// WelcomeScreen — main export
// =============================================================================

export function WelcomeScreen({
  onSearch,
  isSearching = false,
  debateCount = null,
}) {
  const searchRef = useRef(null);

  const handleCtaClick = useCallback(() => {
    fireAnalyticsEvent('welcome_cta_clicked', {
      source: 'hero_cta',
    });
    // Scroll to / focus the search input
    if (searchRef.current) {
      const input = searchRef.current.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  }, []);

  const formattedCount = debateCount != null
    ? debateCount.toLocaleString()
    : '1,000+';

  return (
    <div
      data-testid="welcome-screen"
      className="text-center py-12"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Hero section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="max-w-3xl mx-auto px-4">
        {/* Eyebrow label */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
              color: 'var(--color-accent-text)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
            }}
          >
            AI-Powered Investment Research
          </span>
        </div>

        {/* Main headline */}
        <h1
          className="text-4xl sm:text-5xl font-bold mb-4 leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Your AI Research Analyst
        </h1>

        {/* Value proposition */}
        <p
          data-testid="value-proposition"
          className="text-xl mb-6 max-w-2xl mx-auto leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Research any S&P 500 company in{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>30 minutes</strong>
          , not{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>4–6 hours</strong>
          . Get an AI Bull vs Bear debate powered by SEC EDGAR data.
        </p>

        {/* Primary CTA button */}
        <button
          data-testid="welcome-cta"
          type="button"
          onClick={handleCtaClick}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold mb-6 transition-colors duration-200"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#ffffff',
          }}
        >
          Try a Free AI Debate
        </button>

        {/* Hero search bar */}
        <div ref={searchRef} className="mb-4">
          <TickerSearch
            variant="hero"
            onSearch={onSearch}
            isSearching={isSearching}
            autoFocus
          />
        </div>

        {/* Debate preview */}
        <DebatePreview />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Social proof                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="social-proof"
        className="mt-8 mb-8"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="text-sm">
          <strong
            className="text-base"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {formattedCount}
          </strong>
          {' '}debates generated for investors like you
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Feature highlights                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="feature-highlights"
        className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto px-4 mb-10"
      >
        <FeatureCard
          testId="feature-card-debate"
          icon={MessageSquare}
          title="AI Bull vs Bear Debate"
          description="Two AI agents argue both sides of every stock. Get a clear investment thesis in minutes, not hours."
          isPrimary
          accentColor="var(--color-accent)"
          bgColor="color-mix(in srgb, var(--color-accent) 12%, transparent)"
        />

        <FeatureCard
          testId="feature-card-notes"
          icon={BookOpen}
          title="Personal Research Notes"
          description="Add your own analysis, track your conviction, and build a private research journal for each company."
          isPrimary={false}
          accentColor="var(--color-info)"
          bgColor="color-mix(in srgb, var(--color-info) 12%, transparent)"
        />

        <FeatureCard
          testId="feature-card-charts"
          icon={BarChart3}
          title="Financial Charts"
          description="Beautiful visualizations of revenue, free cash flow, and margin trends — all from official SEC EDGAR filings."
          isPrimary={false}
          accentColor="var(--color-success)"
          bgColor="color-mix(in srgb, var(--color-success) 12%, transparent)"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Methodology badges                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="methodology-badges"
        className="flex flex-wrap items-center justify-center gap-3 px-4"
      >
        <span
          className="text-xs mr-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Powered by:
        </span>
        <MethodologyBadge label="Feroldi Quality Framework" />
        <MethodologyBadge label="Buffett Methodology" />
        <MethodologyBadge label="SEC EDGAR Data" />
      </div>
    </div>
  );
}

WelcomeScreen.propTypes = {
  onSearch: PropTypes.func,
  isSearching: PropTypes.bool,
  debateCount: PropTypes.number,
};

export default WelcomeScreen;
