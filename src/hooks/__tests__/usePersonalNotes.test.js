/**
 * Tests for usePersonalNotes hook
 *
 * Covers hook states, auto-save debounce, auth gating, CRUD operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersonalNotes } from '../usePersonalNotes';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../services/notesService', () => ({
  getNote: vi.fn(),
  saveNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-user-123' },
    isAuthenticated: true,
  })),
  default: vi.fn(() => ({
    user: { uid: 'test-user-123' },
    isAuthenticated: true,
  })),
}));

import { getNote, saveNote, deleteNote } from '../../services/notesService';
import { useAuth } from '../useAuth';

// =============================================================================
// Fixtures
// =============================================================================

const mockNote = {
  content: 'Apple is a strong company with excellent ecosystem lock-in.',
  ticker: 'AAPL',
  updatedAt: new Date('2026-03-17'),
  createdAt: new Date('2026-03-17'),
};

// =============================================================================
// Tests
// =============================================================================

describe('usePersonalNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults
    useAuth.mockReturnValue({
      user: { uid: 'test-user-123' },
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('returns null note and false saving when authenticated and note not found', async () => {
      getNote.mockResolvedValue(null);

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      await waitFor(() => {
        expect(getNote).toHaveBeenCalled();
      });

      expect(result.current.note).toBeNull();
      expect(result.current.saving).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.updateNote).toBe('function');
      expect(typeof result.current.deleteNote).toBe('function');
    });

    it('loads existing note on mount', async () => {
      getNote.mockResolvedValue(mockNote);

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      await waitFor(() => {
        expect(result.current.note).toEqual(mockNote);
      });

      expect(getNote).toHaveBeenCalledWith('AAPL');
    });

    it('does not fetch when ticker is null', () => {
      const { result } = renderHook(() => usePersonalNotes(null));

      expect(result.current.note).toBeNull();
      expect(getNote).not.toHaveBeenCalled();
    });

    it('does not fetch when user is not authenticated', () => {
      useAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      renderHook(() => usePersonalNotes('AAPL'));

      expect(getNote).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateNote — auto-save with debounce
  // ---------------------------------------------------------------------------

  describe('updateNote — auto-save with 1.5s debounce', () => {
    it('does not call saveNote immediately after updateNote', async () => {
      getNote.mockResolvedValue(null);
      saveNote.mockResolvedValue(true);

      vi.useFakeTimers({ shouldAdvanceTime: false });

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      // Flush the initial getNote promise before switching to timer control
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.updateNote('new content');
      });

      // Should NOT have saved yet (before timer fires)
      expect(saveNote).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('calls saveNote after 1500ms debounce', async () => {
      getNote.mockResolvedValue(null);
      saveNote.mockResolvedValue(true);

      vi.useFakeTimers();

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      act(() => {
        result.current.updateNote('my research notes');
      });

      // Advance timer by 1500ms and flush promises
      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(saveNote).toHaveBeenCalledWith('AAPL', 'my research notes');

      vi.useRealTimers();
    });

    it('debounces multiple keystrokes — only saves once after final keystroke', async () => {
      getNote.mockResolvedValue(null);
      saveNote.mockResolvedValue(true);

      vi.useFakeTimers();

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      act(() => {
        result.current.updateNote('first');
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        result.current.updateNote('second');
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        result.current.updateNote('third');
      });

      // Should not have saved yet
      expect(saveNote).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(saveNote).toHaveBeenCalledTimes(1);
      expect(saveNote).toHaveBeenCalledWith('AAPL', 'third');

      vi.useRealTimers();
    });

    it('sets saving=true while save is in progress', async () => {
      getNote.mockResolvedValue(null);

      let resolveSave;
      saveNote.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));

      vi.useFakeTimers();

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      act(() => {
        result.current.updateNote('my content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      // saving should be true while promise is pending
      expect(result.current.saving).toBe(true);

      await act(async () => {
        resolveSave(true);
        await Promise.resolve();
      });

      expect(result.current.saving).toBe(false);

      vi.useRealTimers();
    });

    it('sets saving=false and error after failed save', async () => {
      getNote.mockResolvedValue(null);
      saveNote.mockResolvedValue(false); // service returns false on failure

      vi.useFakeTimers();

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      act(() => {
        result.current.updateNote('my content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });

      expect(result.current.saving).toBe(false);
      expect(result.current.error).toBeTruthy();

      vi.useRealTimers();
    });

    it('does not auto-save when user is not authenticated', async () => {
      useAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });
      getNote.mockResolvedValue(null);

      vi.useFakeTimers();

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      act(() => {
        result.current.updateNote('my content');
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(saveNote).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteNote
  // ---------------------------------------------------------------------------

  describe('deleteNote', () => {
    it('calls service deleteNote and clears note on success', async () => {
      getNote.mockResolvedValue(mockNote);
      deleteNote.mockResolvedValue(true);

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      await waitFor(() => {
        expect(result.current.note).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.deleteNote();
      });

      expect(deleteNote).toHaveBeenCalledWith('AAPL');
      expect(result.current.note).toBeNull();
    });

    it('does not clear note when delete fails', async () => {
      getNote.mockResolvedValue(mockNote);
      deleteNote.mockResolvedValue(false);

      const { result } = renderHook(() => usePersonalNotes('AAPL'));

      await waitFor(() => {
        expect(result.current.note).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.deleteNote();
      });

      expect(result.current.note).toEqual(mockNote);
      expect(result.current.error).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Ticker change
  // ---------------------------------------------------------------------------

  describe('ticker change', () => {
    it('fetches new note when ticker changes', async () => {
      const msftNote = { content: 'MSFT notes', ticker: 'MSFT' };

      getNote
        .mockResolvedValueOnce(mockNote)
        .mockResolvedValueOnce(msftNote);

      const { result, rerender } = renderHook(
        ({ ticker }) => usePersonalNotes(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      await waitFor(() => {
        expect(result.current.note).toEqual(mockNote);
      });

      rerender({ ticker: 'MSFT' });

      await waitFor(() => {
        expect(result.current.note).toEqual(msftNote);
      });

      expect(getNote).toHaveBeenCalledTimes(2);
      expect(getNote).toHaveBeenNthCalledWith(1, 'AAPL');
      expect(getNote).toHaveBeenNthCalledWith(2, 'MSFT');
    });

    it('cancels pending debounced save when ticker changes', async () => {
      getNote.mockResolvedValue(null);
      saveNote.mockResolvedValue(true);

      vi.useFakeTimers();

      const { result, rerender } = renderHook(
        ({ ticker }) => usePersonalNotes(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      act(() => {
        result.current.updateNote('content for AAPL');
      });

      // Change ticker before debounce fires — this should cancel the AAPL save
      rerender({ ticker: 'MSFT' });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      // saveNote should NOT have been called for the stale AAPL content
      expect(saveNote).not.toHaveBeenCalledWith('AAPL', 'content for AAPL');

      vi.useRealTimers();
    });
  });
});
