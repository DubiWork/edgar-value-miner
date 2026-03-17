/**
 * Tests for DebateShareCard component
 *
 * UT-SHARE-01 through UT-SHARE-12
 * Covers acceptance criteria for #161:
 *  - Share buttons: Twitter, LinkedIn, Reddit, Copy Link
 *  - Share URL generation (/debate/:ticker)
 *  - analytics event (debate_shared) fires on share click
 *  - Copy Link copies URL to clipboard with confirmation toast
 *  - Mobile responsive share buttons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DebateShareCard } from '../DebateShareCard';

// =============================================================================
// Helpers
// =============================================================================

function renderCard(props = {}) {
  return render(
    <DebateShareCard
      ticker={props.ticker ?? 'AAPL'}
      companyName={props.companyName ?? 'Apple Inc.'}
      sentiment={props.sentiment ?? 'bullish'}
      {...props}
    />
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('DebateShareCard', () => {
  let gtagMock;
  let originalOpen;
  let originalClipboard;

  beforeEach(() => {
    gtagMock = vi.fn();
    globalThis.gtag = gtagMock;

    originalOpen = window.open;
    window.open = vi.fn();

    // Mock clipboard API
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    delete globalThis.gtag;
    window.open = originalOpen;
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  // UT-SHARE-01: Renders share card without crashing
  it('renders without crashing', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeTruthy();
  });

  // UT-SHARE-02: Has correct data-testid
  it('has data-testid="debate-share-card"', () => {
    renderCard();
    expect(screen.getByTestId('debate-share-card')).toBeTruthy();
  });

  // UT-SHARE-03: Share URL format is /debate/:ticker
  it('generates share URL in format /debate/:ticker', () => {
    renderCard({ ticker: 'AAPL' });
    const shareCard = screen.getByTestId('debate-share-card');
    expect(shareCard.dataset.shareUrl).toMatch(/\/debate\/AAPL/);
  });

  // UT-SHARE-04: Twitter button opens Twitter intent URL
  it('Twitter button opens twitter intent URL with ticker and share text', () => {
    renderCard({ ticker: 'AAPL' });
    const twitterBtn = screen.getByTestId('share-twitter');
    fireEvent.click(twitterBtn);
    expect(window.open).toHaveBeenCalledOnce();
    const [url] = window.open.mock.calls[0];
    expect(url).toContain('twitter.com/intent/tweet');
    expect(url).toContain('AAPL');
  });

  // UT-SHARE-05: LinkedIn button opens LinkedIn share URL
  it('LinkedIn button opens LinkedIn sharing URL', () => {
    renderCard({ ticker: 'AAPL' });
    const linkedinBtn = screen.getByTestId('share-linkedin');
    fireEvent.click(linkedinBtn);
    expect(window.open).toHaveBeenCalledOnce();
    const [url] = window.open.mock.calls[0];
    expect(url).toContain('linkedin.com/sharing/share-offsite');
  });

  // UT-SHARE-06: Reddit button opens Reddit submit URL
  it('Reddit button opens Reddit submit URL', () => {
    renderCard({ ticker: 'AAPL' });
    const redditBtn = screen.getByTestId('share-reddit');
    fireEvent.click(redditBtn);
    expect(window.open).toHaveBeenCalledOnce();
    const [url] = window.open.mock.calls[0];
    expect(url).toContain('reddit.com/submit');
  });

  // UT-SHARE-07: Copy Link writes share URL to clipboard
  it('Copy Link button writes share URL to clipboard', async () => {
    renderCard({ ticker: 'MSFT' });
    const copyBtn = screen.getByTestId('share-copy');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
      const [written] = navigator.clipboard.writeText.mock.calls[0];
      expect(written).toContain('/debate/MSFT');
    });
  });

  // UT-SHARE-08: Copy Link shows confirmation toast
  it('shows "Copied!" confirmation after clicking Copy Link', async () => {
    renderCard();
    const copyBtn = screen.getByTestId('share-copy');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(screen.getByTestId('copy-confirmation')).toBeTruthy();
      expect(screen.getByTestId('copy-confirmation').textContent).toMatch(/copied/i);
    });
  });

  // UT-SHARE-09: debate_shared analytics event fires on Twitter click
  it('fires debate_shared analytics event on Twitter share', () => {
    renderCard({ ticker: 'AAPL' });
    const twitterBtn = screen.getByTestId('share-twitter');
    fireEvent.click(twitterBtn);
    expect(gtagMock).toHaveBeenCalledWith('event', 'debate_shared', expect.objectContaining({
      platform: 'twitter',
      ticker: 'AAPL',
    }));
  });

  // UT-SHARE-10: debate_shared analytics event fires on LinkedIn click
  it('fires debate_shared analytics event on LinkedIn share', () => {
    renderCard({ ticker: 'NVDA' });
    const linkedinBtn = screen.getByTestId('share-linkedin');
    fireEvent.click(linkedinBtn);
    expect(gtagMock).toHaveBeenCalledWith('event', 'debate_shared', expect.objectContaining({
      platform: 'linkedin',
      ticker: 'NVDA',
    }));
  });

  // UT-SHARE-11: debate_shared analytics event fires on Reddit click
  it('fires debate_shared analytics event on Reddit share', () => {
    renderCard({ ticker: 'TSLA' });
    const redditBtn = screen.getByTestId('share-reddit');
    fireEvent.click(redditBtn);
    expect(gtagMock).toHaveBeenCalledWith('event', 'debate_shared', expect.objectContaining({
      platform: 'reddit',
      ticker: 'TSLA',
    }));
  });

  // UT-SHARE-12: debate_shared analytics event fires on Copy Link click
  it('fires debate_shared analytics event on Copy Link', async () => {
    renderCard({ ticker: 'AAPL' });
    const copyBtn = screen.getByTestId('share-copy');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(gtagMock).toHaveBeenCalledWith('event', 'debate_shared', expect.objectContaining({
        platform: 'copy_link',
        ticker: 'AAPL',
      }));
    });
  });

  // UT-SHARE-13: Shows company name and "AI Bull vs Bear Debate" label
  it('shows company name and "AI Bull vs Bear Debate" label', () => {
    renderCard({ ticker: 'AAPL', companyName: 'Apple Inc.' });
    const card = screen.getByTestId('debate-share-card');
    expect(card.textContent).toContain('Apple Inc.');
    expect(card.textContent).toMatch(/AI Bull vs Bear Debate/i);
  });

  // UT-SHARE-14: Shows sentiment indicator
  it('shows sentiment indicator', () => {
    renderCard({ sentiment: 'bullish' });
    expect(screen.getByTestId('share-sentiment')).toBeTruthy();
    expect(screen.getByTestId('share-sentiment').textContent).toMatch(/bullish/i);
  });

  // UT-SHARE-15: Share buttons have aria-labels for accessibility
  it('all share buttons have aria-labels', () => {
    renderCard();
    expect(screen.getByTestId('share-twitter').getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByTestId('share-linkedin').getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByTestId('share-reddit').getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByTestId('share-copy').getAttribute('aria-label')).toBeTruthy();
  });
});
