/**
 * usePersonalNotes — Hook for managing personal research notes per ticker.
 *
 * Features:
 * - Loads existing note from Firestore on mount / ticker change
 * - Auto-save with 1500ms debounce after last keystroke
 * - Optimistic UI: content updates instantly, save happens in background
 * - saving / error indicators for auto-save feedback
 * - Works only for authenticated users (no-op for unauthenticated)
 * - Cancels pending debounce on ticker change or unmount
 *
 * @module usePersonalNotes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getNote, saveNote, deleteNote as deleteNoteService } from '../services/notesService';
import { useAuth } from './useAuth';

// =============================================================================
// Constants
// =============================================================================

/** Debounce delay for auto-save in milliseconds */
const AUTOSAVE_DELAY_MS = 1500;

// =============================================================================
// Hook
// =============================================================================

/**
 * Manages personal research notes for a given ticker.
 *
 * @param {string|null|undefined} ticker - Stock ticker symbol (e.g. "AAPL")
 * @returns {{
 *   note: Object|null,
 *   saving: boolean,
 *   error: string|null,
 *   updateNote: (content: string) => void,
 *   deleteNote: () => Promise<void>
 * }}
 *
 * @example
 * function NotesWidget({ ticker }) {
 *   const { note, saving, error, updateNote, deleteNote } = usePersonalNotes(ticker);
 *
 *   return (
 *     <textarea
 *       value={note?.content ?? ''}
 *       onChange={(e) => updateNote(e.target.value)}
 *     />
 *   );
 * }
 */
export function usePersonalNotes(ticker) {
  const { isAuthenticated } = useAuth();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  /** Timer ID for the debounced save */
  const debounceTimerRef = useRef(null);

  /** Tracks mounted status to avoid state updates after unmount */
  const isMountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load note on ticker / auth change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Cancel any pending debounced save for previous ticker
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    let cancelled = false;

    async function loadNote() {
      if (!ticker || !isAuthenticated) {
        if (!cancelled && isMountedRef.current) {
          setNote(null);
          setError(null);
        }
        return;
      }

      try {
        const loaded = await getNote(ticker);
        if (!cancelled && isMountedRef.current) {
          setNote(loaded);
          setError(null);
        }
      } catch {
        if (!cancelled && isMountedRef.current) {
          setError('Failed to load note');
        }
      }
    }

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [ticker, isAuthenticated]);

  // ---------------------------------------------------------------------------
  // updateNote — updates local content immediately, debounces save
  // ---------------------------------------------------------------------------

  /**
   * Updates the note content locally and schedules an auto-save.
   * The save fires 1500ms after the last call (debounce).
   *
   * @param {string} content - New note content
   */
  const updateNote = useCallback(
    (content) => {
      if (!isAuthenticated) return;

      // Optimistic update — show new content immediately
      setNote((prev) =>
        prev
          ? { ...prev, content }
          : { content, ticker: ticker ? String(ticker).trim().toUpperCase() : '' }
      );
      setError(null);

      // Cancel previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Schedule save
      debounceTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        setSaving(true);
        setError(null);

        const success = await saveNote(ticker, content);

        if (!isMountedRef.current) return;

        setSaving(false);
        if (!success) {
          setError('Failed to save note');
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [ticker, isAuthenticated]
  );

  // ---------------------------------------------------------------------------
  // deleteNote
  // ---------------------------------------------------------------------------

  /**
   * Deletes the current note from Firestore.
   * Clears local note state on success.
   *
   * @returns {Promise<void>}
   */
  const deleteNote = useCallback(async () => {
    if (!ticker || !isAuthenticated) return;

    setError(null);
    const success = await deleteNoteService(ticker);

    if (!isMountedRef.current) return;

    if (success) {
      setNote(null);
    } else {
      setError('Failed to delete note');
    }
  }, [ticker, isAuthenticated]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    note,
    saving,
    error,
    updateNote,
    deleteNote,
  };
}

export default usePersonalNotes;
