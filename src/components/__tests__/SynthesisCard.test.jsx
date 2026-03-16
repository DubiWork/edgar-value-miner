/**
 * Tests for SynthesisCard component
 *
 * UT-SYN-01 through UT-SYN-12
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SynthesisCard } from '../SynthesisCard';

// =============================================================================
// Fixtures
// =============================================================================

const mockSynthesis = {
  keyFactors: [
    { title: 'Services Growth', analysis: 'Strong recurring revenue mix driving margin expansion.' },
    { title: 'China Risk', analysis: 'Geographic concentration is the primary near-term risk.' },
    { title: 'Valuation', analysis: 'Premium valuation requires continued execution on services.' },
  ],
  recommendation: 'Quality at a Fair Price — Hold with upside on Services mix-shift',
  confidence: 0.65,
  disclaimer: 'AI-generated analysis for educational purposes only. Not financial advice.',
  generatedAt: '2026-03-01T00:00:00.000Z',
};

const mockMetadata = {
  viewCount: 4721,
  generatedAt: '2026-03-01T00:00:00.000Z',
};

function renderCard(propOverrides = {}) {
  return render(
    <SynthesisCard
      synthesis={mockSynthesis}
      metadata={mockMetadata}
      {...propOverrides}
    />
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('SynthesisCard', () => {
  // UT-SYN-01: Renders without crashing
  it('renders without crashing', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeTruthy();
  });

  // UT-SYN-02: Has correct data-testid
  it('has data-testid="synthesis-card"', () => {
    renderCard();
    expect(screen.getByTestId('synthesis-card')).toBeTruthy();
  });

  // UT-SYN-03: Shows "Synthesis" heading
  it('shows Synthesis heading', () => {
    renderCard();
    const card = screen.getByTestId('synthesis-card');
    expect(card.textContent).toMatch(/synthesis/i);
  });

  // UT-SYN-04: Shows recommendation/summary
  it('shows the recommendation text', () => {
    renderCard();
    expect(screen.getByText(/Quality at a Fair Price/)).toBeTruthy();
  });

  // UT-SYN-05: Renders all key factors
  it('renders all key decision factors', () => {
    renderCard();
    const factors = screen.getAllByTestId(/^synthesis-factor-/);
    expect(factors.length).toBe(3);
  });

  // UT-SYN-06: Each key factor shows its title and analysis
  it('shows each key factor title and analysis', () => {
    renderCard();
    expect(screen.getByText('Services Growth')).toBeTruthy();
    expect(screen.getByText(/Strong recurring revenue mix/)).toBeTruthy();
    expect(screen.getByText('China Risk')).toBeTruthy();
  });

  // UT-SYN-07: Sentiment indicator present
  it('shows sentiment indicator', () => {
    renderCard();
    expect(screen.getByTestId('sentiment-indicator')).toBeTruthy();
  });

  // UT-SYN-08: Disclaimer visible and not dismissible
  it('shows investment disclaimer', () => {
    renderCard();
    const disclaimer = screen.getByTestId('investment-disclaimer');
    expect(disclaimer).toBeTruthy();
    expect(disclaimer.textContent).toMatch(/not financial advice/i);
  });

  // UT-SYN-09: Disclaimer does not have a close/dismiss button
  it('disclaimer does not have a dismiss button', () => {
    renderCard();
    const disclaimer = screen.getByTestId('investment-disclaimer');
    const closeButton = disclaimer.querySelector('button');
    expect(closeButton).toBeFalsy();
  });

  // UT-SYN-10: Blue color scheme applied
  it('has blue color scheme applied', () => {
    renderCard();
    const card = screen.getByTestId('synthesis-card');
    // The SynthesisCard uses inline style with BLUE_COLOR = '#3B82F6'
    const heading = card.querySelector('h4');
    expect(heading).toBeTruthy();
    expect(heading.style.color).toBe('rgb(59, 130, 246)');
  });

  // UT-SYN-11: Shows viewCount from metadata
  it('shows investor viewCount from metadata', () => {
    renderCard();
    expect(screen.getByTestId('view-count')).toBeTruthy();
    expect(screen.getByTestId('view-count').textContent).toMatch(/4[,.]?721|4721/);
  });

  // UT-SYN-12: Shows generatedAt date in human-readable format
  it('shows the generatedAt date in a readable format', () => {
    renderCard();
    expect(screen.getByTestId('generated-at')).toBeTruthy();
    // The date 2026-03-01 should show in some readable form
    const dateEl = screen.getByTestId('generated-at');
    expect(dateEl.textContent).toMatch(/Mar|march|2026|updated/i);
  });
});
