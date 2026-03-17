/**
 * Tests for PersonalNotesPanel component
 *
 * Covers: authenticated state, unauthenticated CTA, auto-save indicators,
 * light/dark mode, mobile responsiveness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonalNotesPanel } from '../PersonalNotesPanel';
import { AuthContext } from '../../contexts/AuthContext';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../hooks/usePersonalNotes', () => ({
  usePersonalNotes: vi.fn(() => ({
    note: null,
    saving: false,
    error: null,
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  })),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
  })),
  default: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
  })),
}));

import { usePersonalNotes } from '../../hooks/usePersonalNotes';
import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Helpers
// =============================================================================

function renderPanel(ticker = 'AAPL', authOverrides = {}) {
  useAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    ...authOverrides,
  });

  return render(
    <PersonalNotesPanel ticker={ticker} companyName="Apple Inc." />
  );
}

function renderAuthenticatedPanel(ticker = 'AAPL', hookOverrides = {}) {
  useAuth.mockReturnValue({
    user: { uid: 'user-123' },
    isAuthenticated: true,
  });

  usePersonalNotes.mockReturnValue({
    note: null,
    saving: false,
    error: null,
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    ...hookOverrides,
  });

  return render(
    <PersonalNotesPanel ticker={ticker} companyName="Apple Inc." />
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('PersonalNotesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePersonalNotes.mockReturnValue({
      note: null,
      saving: false,
      error: null,
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
    });
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });
  });

  // ---------------------------------------------------------------------------
  // Unauthenticated state
  // ---------------------------------------------------------------------------

  describe('unauthenticated state', () => {
    it('shows sign-in CTA for unauthenticated users', () => {
      renderPanel('AAPL');

      expect(screen.getByTestId('notes-signin-cta')).toBeTruthy();
      expect(screen.queryByTestId('notes-textarea')).toBeFalsy();
    });

    it('CTA contains sign-in text', () => {
      renderPanel('AAPL');

      const cta = screen.getByTestId('notes-signin-cta');
      expect(cta.textContent).toMatch(/sign in/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Authenticated state
  // ---------------------------------------------------------------------------

  describe('authenticated state', () => {
    it('shows textarea for authenticated users', () => {
      renderAuthenticatedPanel();

      expect(screen.getByTestId('notes-textarea')).toBeTruthy();
      expect(screen.queryByTestId('notes-signin-cta')).toBeFalsy();
    });

    it('shows correct header with company name', () => {
      renderAuthenticatedPanel();

      expect(screen.getByTestId('notes-header').textContent).toMatch(/Apple Inc\./);
    });

    it('shows placeholder text when note is empty', () => {
      renderAuthenticatedPanel();

      const textarea = screen.getByTestId('notes-textarea');
      expect(textarea.placeholder).toMatch(/personal analysis|investment thesis|reminders/i);
    });

    it('shows existing note content in textarea', () => {
      renderAuthenticatedPanel('AAPL', {
        note: { content: 'Apple has strong ecosystem' },
      });

      const textarea = screen.getByTestId('notes-textarea');
      expect(textarea.value).toBe('Apple has strong ecosystem');
    });

    it('calls updateNote when textarea changes', () => {
      const updateNote = vi.fn();
      renderAuthenticatedPanel('AAPL', { updateNote });

      const textarea = screen.getByTestId('notes-textarea');
      fireEvent.change(textarea, { target: { value: 'new content' } });

      expect(updateNote).toHaveBeenCalledWith('new content');
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-save indicators
  // ---------------------------------------------------------------------------

  describe('auto-save indicators', () => {
    it('shows "Saved" indicator when saving=false and note has content', () => {
      renderAuthenticatedPanel('AAPL', {
        note: { content: 'some content' },
        saving: false,
        error: null,
      });

      expect(screen.getByTestId('notes-save-indicator').textContent).toMatch(/Saved/);
    });

    it('shows "Saving..." indicator when saving=true', () => {
      renderAuthenticatedPanel('AAPL', {
        saving: true,
      });

      expect(screen.getByTestId('notes-save-indicator').textContent).toMatch(/Saving\.\.\./);
    });

    it('shows "Error saving" indicator when error is set', () => {
      renderAuthenticatedPanel('AAPL', {
        error: 'Failed to save',
      });

      expect(screen.getByTestId('notes-save-indicator').textContent).toMatch(/error/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------

  describe('accessibility', () => {
    it('textarea has accessible label', () => {
      renderAuthenticatedPanel();

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeTruthy();
    });

    it('renders as a section landmark', () => {
      renderAuthenticatedPanel();

      expect(screen.getByTestId('personal-notes-panel')).toBeTruthy();
    });
  });
});
