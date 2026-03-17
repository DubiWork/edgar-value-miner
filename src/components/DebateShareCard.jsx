/**
 * DebateShareCard — Social sharing buttons for AI Bull vs Bear debates.
 *
 * Provides share buttons for Twitter, LinkedIn, Reddit, and Copy Link.
 * Fires `debate_shared` analytics event on each share action.
 *
 * @param {Object} props
 * @param {string} props.ticker        - Stock ticker (e.g. 'AAPL')
 * @param {string} props.companyName   - Company display name
 * @param {string} [props.sentiment]   - Overall sentiment: 'bullish' | 'bearish' | 'neutral'
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { Share2, Twitter, Linkedin, Copy, Check } from 'lucide-react';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Builds the public share URL for a debate.
 * e.g. https://example.com/debate/AAPL
 *
 * @param {string} ticker
 * @returns {string}
 */
function buildShareUrl(ticker) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/debate/${ticker}`;
}

/**
 * Fires a gtag analytics event if available.
 */
function fireAnalyticsEvent(eventName, params = {}) {
  if (typeof globalThis.gtag === 'function') {
    globalThis.gtag('event', eventName, params);
  }
}

// =============================================================================
// Sentiment display helpers
// =============================================================================

const SENTIMENT_LABELS = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
};

const SENTIMENT_COLORS = {
  bullish: '#10B981',
  bearish: '#EF4444',
  neutral: '#6B7280',
};

// =============================================================================
// DebateShareCard
// =============================================================================

export function DebateShareCard({ ticker, companyName, sentiment }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(ticker);
  const shareText = `Check out the AI Bull vs Bear Debate for $${ticker} — ${companyName}`;

  function handleTwitter() {
    fireAnalyticsEvent('debate_shared', { platform: 'twitter', ticker });
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }

  function handleLinkedin() {
    fireAnalyticsEvent('debate_shared', { platform: 'linkedin', ticker });
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  }

  function handleReddit() {
    fireAnalyticsEvent('debate_shared', { platform: 'reddit', ticker });
    const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
    window.open(redditUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleCopyLink() {
    fireAnalyticsEvent('debate_shared', { platform: 'copy_link', ticker });
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }

  const sentimentLabel = SENTIMENT_LABELS[sentiment] ?? 'Neutral';
  const sentimentColor = SENTIMENT_COLORS[sentiment] ?? SENTIMENT_COLORS.neutral;

  return (
    <div
      data-testid="debate-share-card"
      data-share-url={shareUrl}
      className="flex flex-wrap items-center gap-3"
    >
      {/* Share label */}
      <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <Share2 size={14} aria-hidden="true" />
        <span>Share</span>
      </div>

      {/* Company info + sentiment */}
      <div className="flex items-center gap-2 mr-auto">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {companyName} — AI Bull vs Bear Debate
        </span>
        <span
          data-testid="share-sentiment"
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: sentimentColor,
            backgroundColor: `${sentimentColor}20`,
            border: `1px solid ${sentimentColor}40`,
          }}
        >
          {sentimentLabel}
        </span>
      </div>

      {/* Share buttons */}
      <div className="flex items-center gap-2">
        {/* Twitter */}
        <button
          data-testid="share-twitter"
          type="button"
          aria-label={`Share ${ticker} debate on Twitter`}
          onClick={handleTwitter}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
          style={{
            backgroundColor: 'color-mix(in srgb, #1DA1F2 10%, transparent)',
            color: '#1DA1F2',
            border: '1px solid color-mix(in srgb, #1DA1F2 25%, transparent)',
          }}
        >
          <Twitter size={12} aria-hidden="true" />
          Twitter
        </button>

        {/* LinkedIn */}
        <button
          data-testid="share-linkedin"
          type="button"
          aria-label={`Share ${ticker} debate on LinkedIn`}
          onClick={handleLinkedin}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
          style={{
            backgroundColor: 'color-mix(in srgb, #0A66C2 10%, transparent)',
            color: '#0A66C2',
            border: '1px solid color-mix(in srgb, #0A66C2 25%, transparent)',
          }}
        >
          <Linkedin size={12} aria-hidden="true" />
          LinkedIn
        </button>

        {/* Reddit */}
        <button
          data-testid="share-reddit"
          type="button"
          aria-label={`Share ${ticker} debate on Reddit`}
          onClick={handleReddit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
          style={{
            backgroundColor: 'color-mix(in srgb, #FF4500 10%, transparent)',
            color: '#FF4500',
            border: '1px solid color-mix(in srgb, #FF4500 25%, transparent)',
          }}
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 0C4.478 0 0 4.478 0 10s4.478 10 10 10 10-4.478 10-10S15.522 0 10 0zm5.5 10.5c-.028.55-.228 1.063-.574 1.452-.345.39-.83.622-1.35.656-.176.01-.35-.007-.517-.053a3.999 3.999 0 01-3.057 1.445 3.999 3.999 0 01-3.057-1.445c-.167.046-.342.063-.518.053a1.93 1.93 0 01-1.35-.656 1.96 1.96 0 01-.573-1.452c.014-.549.23-1.072.603-1.467a1.987 1.987 0 01-.103-.611c0-.553.227-1.053.594-1.414A2.01 2.01 0 017.5 6.5c.445 0 .857.148 1.186.394A5.518 5.518 0 0110 6.5c.458 0 .908.066 1.338.191a1.974 1.974 0 011.162-.191c.553 0 1.053.227 1.414.594.367.361.594.861.594 1.414 0 .21-.036.413-.103.611.373.395.59.918.603 1.467v.414-.5zm-7-1a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5z" />
          </svg>
          Reddit
        </button>

        {/* Copy Link */}
        <button
          data-testid="share-copy"
          type="button"
          aria-label={`Copy link to ${ticker} debate`}
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            color: 'var(--color-accent-text)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
          }}
        >
          {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          {copied ? (
            <span data-testid="copy-confirmation">Copied!</span>
          ) : (
            'Copy Link'
          )}
        </button>
      </div>
    </div>
  );
}

DebateShareCard.propTypes = {
  ticker: PropTypes.string.isRequired,
  companyName: PropTypes.string.isRequired,
  sentiment: PropTypes.oneOf(['bullish', 'bearish', 'neutral']),
};

export default DebateShareCard;
