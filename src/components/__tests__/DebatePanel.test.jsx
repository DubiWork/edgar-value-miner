/**
 * Tests for DebatePanel component
 *
 * UT-DEBATE-01 through UT-DEBATE-07
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebatePanel } from '../DebatePanel';

describe('DebatePanel', () => {
  // UT-DEBATE-01: Renders without crashing
  it('renders without crashing', () => {
    const { container } = render(<DebatePanel />);
    expect(container.firstChild).toBeTruthy();
  });

  // UT-DEBATE-02: Shows AAPL as the stub ticker
  it('shows AAPL as the stub company ticker', () => {
    render(<DebatePanel />);
    expect(screen.getByText(/AAPL/)).toBeTruthy();
  });

  // UT-DEBATE-03: Shows "Coming Soon" badge overlay
  it('shows a "Coming Soon" badge', () => {
    render(<DebatePanel />);
    expect(screen.getByTestId('coming-soon-badge')).toBeTruthy();
    expect(screen.getByTestId('coming-soon-badge').textContent).toMatch(/coming soon/i);
  });

  // UT-DEBATE-04: Renders bull thesis section
  it('renders bull thesis section', () => {
    render(<DebatePanel />);
    expect(screen.getByTestId('bull-thesis')).toBeTruthy();
  });

  // UT-DEBATE-05: Renders bear thesis section
  it('renders bear thesis section', () => {
    render(<DebatePanel />);
    expect(screen.getByTestId('bear-thesis')).toBeTruthy();
  });

  // UT-DEBATE-06: Renders synthesis section
  it('renders synthesis section', () => {
    render(<DebatePanel />);
    expect(screen.getByTestId('synthesis')).toBeTruthy();
  });

  // UT-DEBATE-07: Has placeholder / AI Debate label
  it('has an "AI Debate" label', () => {
    render(<DebatePanel />);
    const elements = screen.getAllByText(/AI Debate/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});
