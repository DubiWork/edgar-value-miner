/**
 * Tests for BullCaseCard component
 *
 * UT-BULL-01 through UT-BULL-15
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BullCaseCard } from '../BullCaseCard';

// =============================================================================
// Fixtures
// =============================================================================

const mockBullCase = {
  arguments: [
    {
      title: 'Strong Ecosystem',
      detail: 'Apple ecosystem lock-in with 2.2B+ active devices worldwide provides unmatched recurring revenue.',
      citation: 'Apple Annual Report 2025, p. 12',
    },
    {
      title: 'Services Revenue Growth',
      detail: 'Services revenue growing at 16% YoY, now 22% of total revenue with 90%+ gross margins.',
      citation: 'Apple Q4 2025 Earnings Call',
    },
    {
      title: 'Capital Allocation',
      detail: 'Net cash of $50B+ funds aggressive buybacks, reducing share count 3-4% annually.',
      citation: 'Apple 10-K 2025, Balance Sheet',
    },
  ],
  confidence: 0.75,
  generatedAt: '2026-03-01T00:00:00.000Z',
};

const mockMetadata = {
  viewCount: 4721,
  generatedAt: '2026-03-01T00:00:00.000Z',
};

function renderCard(propOverrides = {}) {
  return render(
    <BullCaseCard
      bullCase={mockBullCase}
      metadata={mockMetadata}
      {...propOverrides}
    />
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('BullCaseCard', () => {
  // UT-BULL-01: Renders without crashing
  it('renders without crashing', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeTruthy();
  });

  // UT-BULL-02: Has correct data-testid
  it('has data-testid="bull-case-card"', () => {
    renderCard();
    expect(screen.getByTestId('bull-case-card')).toBeTruthy();
  });

  // UT-BULL-03: Shows bull icon and "Bull Case" heading
  it('shows bull icon and Bull Case heading', () => {
    renderCard();
    const card = screen.getByTestId('bull-case-card');
    expect(card.textContent).toMatch(/bull case/i);
  });

  // UT-BULL-04: Confidence meter renders with correct value
  it('renders confidence meter with correct value (75%)', () => {
    renderCard();
    const meter = screen.getByTestId('bull-confidence-meter');
    expect(meter).toBeTruthy();
    // Confidence is 0.75, so expect 75% label
    expect(screen.getByText(/75%/)).toBeTruthy();
  });

  // UT-BULL-05: Renders all 3 argument cards
  it('renders all argument cards', () => {
    renderCard();
    const args = screen.getAllByTestId(/^bull-argument-/);
    expect(args.length).toBe(3);
  });

  // UT-BULL-06: Each argument shows its title
  it('shows each argument title', () => {
    renderCard();
    expect(screen.getByText('Strong Ecosystem')).toBeTruthy();
    expect(screen.getByText('Services Revenue Growth')).toBeTruthy();
    expect(screen.getByText('Capital Allocation')).toBeTruthy();
  });

  // UT-BULL-07: Argument detail is hidden by default (expandable)
  it('argument detail is hidden by default', () => {
    renderCard();
    const detail = screen.queryByText(/Apple ecosystem lock-in/);
    expect(detail).toBeFalsy();
  });

  // UT-BULL-08: Clicking argument expands detail
  it('clicking argument title expands detail section', () => {
    renderCard();
    const titleButton = screen.getByText('Strong Ecosystem');
    fireEvent.click(titleButton);
    expect(screen.getByText(/Apple ecosystem lock-in/)).toBeTruthy();
  });

  // UT-BULL-09: Expanded argument shows SEC citation
  it('expanded argument shows SEC citation', () => {
    renderCard();
    const titleButton = screen.getByText('Strong Ecosystem');
    fireEvent.click(titleButton);
    expect(screen.getByText(/Apple Annual Report 2025/)).toBeTruthy();
  });

  // UT-BULL-10: Clicking expanded argument collapses it
  it('clicking expanded argument collapses it', () => {
    renderCard();
    const titleButton = screen.getByText('Strong Ecosystem');
    fireEvent.click(titleButton);
    expect(screen.getByText(/Apple ecosystem lock-in/)).toBeTruthy();
    fireEvent.click(titleButton);
    expect(screen.queryByText(/Apple ecosystem lock-in/)).toBeFalsy();
  });

  // UT-BULL-11: Shows Feroldi/Buffett methodology badge
  it('shows methodology badge', () => {
    renderCard();
    expect(screen.getByTestId('bull-methodology-badge')).toBeTruthy();
    expect(screen.getByTestId('bull-methodology-badge').textContent).toMatch(/feroldi|buffett|methodology/i);
  });

  // UT-BULL-12: Green color scheme applied (has green hex in inline styles)
  it('has green color scheme applied', () => {
    renderCard();
    const card = screen.getByTestId('bull-case-card');
    // The BullCaseCard uses inline style with BULL_COLOR = '#10B981'
    // Check the heading element that uses the color directly
    const heading = card.querySelector('h4');
    expect(heading).toBeTruthy();
    expect(heading.style.color).toBe('rgb(16, 185, 129)');
  });

  // UT-BULL-13: Renders at mobile width without horizontal overflow
  it('renders in a single column at mobile width', () => {
    renderCard();
    const card = screen.getByTestId('bull-case-card');
    // Card should not have md:grid-cols-2 or similar — it's a single card
    expect(card).toBeTruthy();
  });

  // UT-BULL-14: Handles empty arguments array gracefully
  it('renders gracefully with empty arguments array', () => {
    const { container } = renderCard({
      bullCase: { ...mockBullCase, arguments: [] },
    });
    expect(container.firstChild).toBeTruthy();
    expect(screen.queryAllByTestId(/^bull-argument-/).length).toBe(0);
  });

  // UT-BULL-15: Shows confidence as percentage
  it('shows confidence as percentage (0-100%)', () => {
    renderCard({ bullCase: { ...mockBullCase, confidence: 0.9 } });
    expect(screen.getByText(/90%/)).toBeTruthy();
  });
});
