/**
 * Tests for FeedbackButtons component
 *
 * UT-FB-01 through UT-FB-10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock debateApi
vi.mock('../../services/debateApi', () => ({
  submitFeedback: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';
import { submitFeedback } from '../../services/debateApi';
import { FeedbackButtons } from '../FeedbackButtons';

// =============================================================================
// Helpers
// =============================================================================

function makeAuthenticatedUser() {
  useAuth.mockReturnValue({
    user: { uid: 'user-123', email: 'test@example.com' },
    isAuthenticated: true,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  });
}

function makeUnauthenticatedUser() {
  useAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  });
}

function renderFeedback(props = {}) {
  const defaultProps = {
    debateId: 'AAPL_v1',
    section: 'bullCase',
    ...props,
  };
  return render(<FeedbackButtons {...defaultProps} />);
}

// =============================================================================
// Tests
// =============================================================================

describe('FeedbackButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitFeedback.mockResolvedValue({ success: true });
  });

  // UT-FB-01: Renders thumbs up and thumbs down buttons
  it('renders thumbs up and thumbs down buttons', () => {
    makeAuthenticatedUser();
    renderFeedback();
    expect(screen.getByTestId('feedback-thumb-up')).toBeTruthy();
    expect(screen.getByTestId('feedback-thumb-down')).toBeTruthy();
  });

  // UT-FB-02: Initial state is unrated (neither button highlighted)
  it('starts in unrated state with neither button active', () => {
    makeAuthenticatedUser();
    renderFeedback();
    const up = screen.getByTestId('feedback-thumb-up');
    const down = screen.getByTestId('feedback-thumb-down');
    expect(up.getAttribute('data-active')).toBe('false');
    expect(down.getAttribute('data-active')).toBe('false');
  });

  // UT-FB-03: Clicking thumbs up for authenticated user submits feedback and marks as active
  it('clicking thumbs up marks it active (optimistic update)', async () => {
    makeAuthenticatedUser();
    renderFeedback();
    const upButton = screen.getByTestId('feedback-thumb-up');
    fireEvent.click(upButton);
    // Optimistic — should update immediately
    expect(upButton.getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('feedback-thumb-down').getAttribute('data-active')).toBe('false');
  });

  // UT-FB-04: Clicking thumbs up calls submitFeedback with correct args
  it('clicking thumbs up calls submitFeedback with correct debateId, section, rating', async () => {
    makeAuthenticatedUser();
    renderFeedback({ debateId: 'AAPL_v1', section: 'bullCase' });
    fireEvent.click(screen.getByTestId('feedback-thumb-up'));
    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith('AAPL_v1', 'bullCase', 'up');
    });
  });

  // UT-FB-05: Toggle — clicking thumbs down after thumbs up switches active state
  it('clicking thumbs down after thumbs up switches to down', async () => {
    makeAuthenticatedUser();
    renderFeedback();
    fireEvent.click(screen.getByTestId('feedback-thumb-up'));
    expect(screen.getByTestId('feedback-thumb-up').getAttribute('data-active')).toBe('true');
    fireEvent.click(screen.getByTestId('feedback-thumb-down'));
    expect(screen.getByTestId('feedback-thumb-down').getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('feedback-thumb-up').getAttribute('data-active')).toBe('false');
  });

  // UT-FB-06: On API error, optimistic state is reverted
  it('reverts optimistic state when submitFeedback throws', async () => {
    makeAuthenticatedUser();
    submitFeedback.mockRejectedValueOnce(new Error('Network error'));
    renderFeedback();
    const upButton = screen.getByTestId('feedback-thumb-up');
    fireEvent.click(upButton);
    // Initially optimistic
    expect(upButton.getAttribute('data-active')).toBe('true');
    // Wait for revert
    await waitFor(() => {
      expect(upButton.getAttribute('data-active')).toBe('false');
    });
  });

  // UT-FB-07: Unauthenticated user — buttons render but show sign-in tooltip on hover
  it('renders buttons for unauthenticated user with sign-in tooltip', () => {
    makeUnauthenticatedUser();
    renderFeedback();
    expect(screen.getByTestId('feedback-thumb-up')).toBeTruthy();
    expect(screen.getByTestId('feedback-thumb-down')).toBeTruthy();
    // Should have a tooltip or aria-label indicating sign in is needed
    const container = screen.getByTestId('feedback-buttons-container');
    expect(container.getAttribute('title') || container.textContent).toMatch(/sign in/i);
  });

  // UT-FB-08: Unauthenticated user clicking thumb does NOT call submitFeedback
  it('unauthenticated user clicking thumb does not call submitFeedback', () => {
    makeUnauthenticatedUser();
    renderFeedback();
    fireEvent.click(screen.getByTestId('feedback-thumb-up'));
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  // UT-FB-09: User can change their rating (up → down updates call)
  it('changing rating from up to down calls submitFeedback with new rating', async () => {
    makeAuthenticatedUser();
    renderFeedback({ debateId: 'AAPL_v1', section: 'synthesis' });
    fireEvent.click(screen.getByTestId('feedback-thumb-up'));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledWith('AAPL_v1', 'synthesis', 'up'));
    submitFeedback.mockClear();
    fireEvent.click(screen.getByTestId('feedback-thumb-down'));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledWith('AAPL_v1', 'synthesis', 'down'));
  });

  // UT-FB-10: Section prop passed correctly for bearCase
  it('passes bearCase section to submitFeedback', async () => {
    makeAuthenticatedUser();
    renderFeedback({ debateId: 'TSLA_v1', section: 'bearCase' });
    fireEvent.click(screen.getByTestId('feedback-thumb-down'));
    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith('TSLA_v1', 'bearCase', 'down');
    });
  });
});
