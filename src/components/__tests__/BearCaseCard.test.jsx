/**
 * Tests for BearCaseCard component
 *
 * UT-BEAR-01 through UT-BEAR-15
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BearCaseCard } from '../BearCaseCard';

// =============================================================================
// Fixtures
// =============================================================================

const mockBearCase = {
  riskFactors: [
    {
      title: 'China Revenue Risk',
      detail: 'China iPhone revenue declined 13% last quarter as Huawei regains market share.',
      dataPoint: 'Q4 2025 China revenue: -13% YoY',
    },
    {
      title: 'Regulatory Headwinds',
      detail: 'EU Digital Markets Act forces Apple to allow third-party app stores, threatening $20B+ App Store revenue.',
      dataPoint: 'EU DMA enforcement begins Q1 2026',
    },
    {
      title: 'Valuation Premium',
      detail: 'Valuation at 28x earnings prices in significant growth that may not materialize.',
      dataPoint: 'P/E: 28x vs sector avg 22x',
    },
  ],
  confidence: 0.6,
  generatedAt: '2026-03-01T00:00:00.000Z',
};

const mockMetadata = {
  viewCount: 4721,
  generatedAt: '2026-03-01T00:00:00.000Z',
};

function renderCard(propOverrides = {}) {
  return render(
    <BearCaseCard
      bearCase={mockBearCase}
      metadata={mockMetadata}
      {...propOverrides}
    />
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('BearCaseCard', () => {
  // UT-BEAR-01: Renders without crashing
  it('renders without crashing', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeTruthy();
  });

  // UT-BEAR-02: Has correct data-testid
  it('has data-testid="bear-case-card"', () => {
    renderCard();
    expect(screen.getByTestId('bear-case-card')).toBeTruthy();
  });

  // UT-BEAR-03: Shows bear icon and "Bear Case" heading
  it('shows bear icon and Bear Case heading', () => {
    renderCard();
    const card = screen.getByTestId('bear-case-card');
    expect(card.textContent).toMatch(/bear case/i);
  });

  // UT-BEAR-04: Confidence meter renders with correct value
  it('renders confidence meter with correct value (60%)', () => {
    renderCard();
    const meter = screen.getByTestId('bear-confidence-meter');
    expect(meter).toBeTruthy();
    expect(screen.getByText(/60%/)).toBeTruthy();
  });

  // UT-BEAR-05: Renders all 3 risk factor cards
  it('renders all risk factor cards', () => {
    renderCard();
    const factors = screen.getAllByTestId(/^bear-factor-/);
    expect(factors.length).toBe(3);
  });

  // UT-BEAR-06: Each risk factor shows its title
  it('shows each risk factor title', () => {
    renderCard();
    expect(screen.getByText('China Revenue Risk')).toBeTruthy();
    expect(screen.getByText('Regulatory Headwinds')).toBeTruthy();
    expect(screen.getByText('Valuation Premium')).toBeTruthy();
  });

  // UT-BEAR-07: Risk factor detail is hidden by default
  it('risk factor detail is hidden by default', () => {
    renderCard();
    const detail = screen.queryByText(/China iPhone revenue declined/);
    expect(detail).toBeFalsy();
  });

  // UT-BEAR-08: Clicking risk factor expands detail
  it('clicking risk factor title expands detail section', () => {
    renderCard();
    const titleButton = screen.getByText('China Revenue Risk');
    fireEvent.click(titleButton);
    expect(screen.getByText(/China iPhone revenue declined/)).toBeTruthy();
  });

  // UT-BEAR-09: Expanded risk factor shows data point
  it('expanded risk factor shows specific data point', () => {
    renderCard();
    const titleButton = screen.getByText('China Revenue Risk');
    fireEvent.click(titleButton);
    expect(screen.getByText(/Q4 2025 China revenue/)).toBeTruthy();
  });

  // UT-BEAR-10: Clicking expanded factor collapses it
  it('clicking expanded risk factor collapses it', () => {
    renderCard();
    const titleButton = screen.getByText('China Revenue Risk');
    fireEvent.click(titleButton);
    expect(screen.getByText(/China iPhone revenue declined/)).toBeTruthy();
    fireEvent.click(titleButton);
    expect(screen.queryByText(/China iPhone revenue declined/)).toBeFalsy();
  });

  // UT-BEAR-11: Shows risk severity indicator
  it('shows risk severity indicators for each factor', () => {
    renderCard();
    const severities = screen.getAllByTestId(/^bear-severity-/);
    expect(severities.length).toBe(3);
  });

  // UT-BEAR-12: Red color scheme applied
  it('has red color scheme applied', () => {
    renderCard();
    const card = screen.getByTestId('bear-case-card');
    // The BearCaseCard uses inline style with BEAR_COLOR = '#EF4444'
    const heading = card.querySelector('h4');
    expect(heading).toBeTruthy();
    expect(heading.style.color).toBe('rgb(239, 68, 68)');
  });

  // UT-BEAR-13: Renders gracefully with empty riskFactors array
  it('renders gracefully with empty riskFactors array', () => {
    const { container } = renderCard({
      bearCase: { ...mockBearCase, riskFactors: [] },
    });
    expect(container.firstChild).toBeTruthy();
    expect(screen.queryAllByTestId(/^bear-factor-/).length).toBe(0);
  });

  // UT-BEAR-14: Confidence meter has severity coloring
  it('confidence meter reflects low confidence with appropriate styling', () => {
    renderCard({ bearCase: { ...mockBearCase, confidence: 0.3 } });
    expect(screen.getByText(/30%/)).toBeTruthy();
  });

  // UT-BEAR-15: Shows methodology badge
  it('shows methodology badge', () => {
    renderCard();
    expect(screen.getByTestId('bear-methodology-badge')).toBeTruthy();
    expect(screen.getByTestId('bear-methodology-badge').textContent).toMatch(/feroldi|buffett|methodology/i);
  });

  // UT-BEAR-16: Expandable risk factor button has aria-expanded=false by default
  it('risk factor button has aria-expanded="false" by default', () => {
    renderCard();
    const buttons = screen.getAllByRole('button');
    const riskButton = buttons.find((btn) => btn.textContent.includes('China Revenue Risk'));
    expect(riskButton).toBeTruthy();
    expect(riskButton.getAttribute('aria-expanded')).toBe('false');
  });

  // UT-BEAR-17: Risk factor button aria-expanded becomes "true" on click
  it('risk factor button aria-expanded becomes "true" when expanded', () => {
    renderCard();
    const buttons = screen.getAllByRole('button');
    const riskButton = buttons.find((btn) => btn.textContent.includes('China Revenue Risk'));
    fireEvent.click(riskButton);
    expect(riskButton.getAttribute('aria-expanded')).toBe('true');
  });

  // UT-BEAR-18: Confidence meter has role="progressbar"
  it('confidence meter has role="progressbar" for accessibility', () => {
    renderCard();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
  });

  // UT-BEAR-19: Severity labels High, Medium, Low assigned by index order
  it('assigns severity labels by index — first is High, second is Medium, third is Low', () => {
    renderCard();
    expect(screen.getByTestId('bear-severity-0').textContent).toBe('High');
    expect(screen.getByTestId('bear-severity-1').textContent).toBe('Medium');
    expect(screen.getByTestId('bear-severity-2').textContent).toBe('Low');
  });
});
