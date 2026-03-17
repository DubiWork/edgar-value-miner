/**
 * Tests for notesService
 *
 * Covers CRUD operations on users/{uid}/notes/{ticker} Firestore subcollection.
 * Tests: getNote, saveNote, deleteNote, listNotes
 * Auth gating: unauthenticated users get no-op / null results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =============================================================================
// Mock Firebase BEFORE imports
// =============================================================================

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

// Mutable state object — tests set mockFirebaseState.db to control the `db` value
// without touching the import binding (avoids no-import-assign lint errors).
const mockFirebaseState = {
  db: {},
  getCurrentUserId: vi.fn(() => null),
};

vi.mock('../../lib/firebase', () => ({
  get db() {
    return mockFirebaseState.db;
  },
  get getCurrentUserId() {
    return mockFirebaseState.getCurrentUserId;
  },
}));

import {
  getNote,
  saveNote,
  deleteNote,
  listNotes,
} from '../notesService.js';

import * as firestore from 'firebase/firestore';

// =============================================================================
// Helpers
// =============================================================================

function mockDocRef() {
  return { id: 'mock-doc-ref' };
}

function mockDocSnap(exists, data = {}) {
  return {
    exists: () => exists,
    data: () => data,
    id: 'AAPL',
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('notesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirebaseState.db = {};
    mockFirebaseState.getCurrentUserId = vi.fn(() => null);
    firestore.doc.mockReturnValue(mockDocRef());
    firestore.collection.mockReturnValue({ id: 'notes-collection' });
    firestore.query.mockReturnValue({ id: 'mock-query' });
    firestore.orderBy.mockReturnValue({ id: 'order-by' });
  });

  // ---------------------------------------------------------------------------
  // getNote
  // ---------------------------------------------------------------------------

  describe('getNote', () => {
    it('returns null when user is not authenticated', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue(null);

      const result = await getNote('AAPL');

      expect(result).toBeNull();
      expect(firestore.getDoc).not.toHaveBeenCalled();
    });

    it('returns null when document does not exist', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));

      const result = await getNote('AAPL');

      expect(result).toBeNull();
    });

    it('returns note data when document exists', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      const noteData = {
        content: 'My research notes',
        ticker: 'AAPL',
        updatedAt: { _serverTimestamp: true },
        createdAt: { _serverTimestamp: true },
      };
      firestore.getDoc.mockResolvedValue(mockDocSnap(true, noteData));

      const result = await getNote('AAPL');

      expect(result).toEqual(noteData);
    });

    it('normalizes ticker to uppercase', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));

      await getNote('aapl');

      // doc() should have been called with uppercase ticker
      expect(firestore.doc).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'user-123',
        'notes',
        'AAPL'
      );
    });

    it('returns null on Firestore error', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockRejectedValue(new Error('Network error'));

      const result = await getNote('AAPL');

      expect(result).toBeNull();
    });

    it('returns null when db is not available', async () => {
      mockFirebaseState.db = null;
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');

      const result = await getNote('AAPL');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // saveNote
  // ---------------------------------------------------------------------------

  describe('saveNote', () => {
    it('returns false when user is not authenticated', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue(null);

      const result = await saveNote('AAPL', 'My analysis');

      expect(result).toBe(false);
      expect(firestore.setDoc).not.toHaveBeenCalled();
    });

    it('saves note to Firestore and returns true on success', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockResolvedValue(undefined);

      const result = await saveNote('AAPL', 'My research notes');

      expect(result).toBe(true);
      expect(firestore.setDoc).toHaveBeenCalledOnce();
    });

    it('saves with correct document structure', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockResolvedValue(undefined);

      await saveNote('AAPL', 'My analysis');

      const savedData = firestore.setDoc.mock.calls[0][1];
      expect(savedData).toMatchObject({
        content: 'My analysis',
        ticker: 'AAPL',
        updatedAt: { _serverTimestamp: true },
      });
    });

    it('saves to correct path: users/{uid}/notes/{ticker}', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockResolvedValue(undefined);

      await saveNote('AAPL', 'My analysis');

      expect(firestore.doc).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'user-123',
        'notes',
        'AAPL'
      );
    });

    it('normalizes ticker to uppercase', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockResolvedValue(undefined);

      await saveNote('aapl', 'My analysis');

      const savedData = firestore.setDoc.mock.calls[0][1];
      expect(savedData.ticker).toBe('AAPL');
    });

    it('truncates content at 10000 characters', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockResolvedValue(undefined);

      const longContent = 'x'.repeat(15000);
      await saveNote('AAPL', longContent);

      const savedData = firestore.setDoc.mock.calls[0][1];
      expect(savedData.content.length).toBe(10000);
    });

    it('returns false on Firestore error', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockRejectedValue(new Error('Permission denied'));

      const result = await saveNote('AAPL', 'My analysis');

      expect(result).toBe(false);
    });

    it('returns false when db is not available', async () => {
      mockFirebaseState.db = null;
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');

      const result = await saveNote('AAPL', 'My analysis');

      expect(result).toBe(false);
    });

    it('does not overwrite createdAt on update', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(true, { createdAt: 'original-ts' }));
      firestore.setDoc.mockResolvedValue(undefined);

      await saveNote('AAPL', 'Updated notes');

      const savedData = firestore.setDoc.mock.calls[0][1];
      expect(savedData).not.toHaveProperty('createdAt');
    });

    it('sets createdAt on initial creation', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDoc.mockResolvedValue(mockDocSnap(false));
      firestore.setDoc.mockResolvedValue(undefined);

      await saveNote('AAPL', 'New note');

      const savedData = firestore.setDoc.mock.calls[0][1];
      expect(savedData).toHaveProperty('createdAt');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteNote
  // ---------------------------------------------------------------------------

  describe('deleteNote', () => {
    it('returns false when user is not authenticated', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue(null);

      const result = await deleteNote('AAPL');

      expect(result).toBe(false);
      expect(firestore.deleteDoc).not.toHaveBeenCalled();
    });

    it('deletes note from Firestore and returns true', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.deleteDoc.mockResolvedValue(undefined);

      const result = await deleteNote('AAPL');

      expect(result).toBe(true);
      expect(firestore.deleteDoc).toHaveBeenCalledOnce();
    });

    it('deletes from correct path: users/{uid}/notes/{ticker}', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.deleteDoc.mockResolvedValue(undefined);

      await deleteNote('AAPL');

      expect(firestore.doc).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'user-123',
        'notes',
        'AAPL'
      );
    });

    it('normalizes ticker to uppercase', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.deleteDoc.mockResolvedValue(undefined);

      await deleteNote('aapl');

      expect(firestore.doc).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'user-123',
        'notes',
        'AAPL'
      );
    });

    it('returns false on Firestore error', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.deleteDoc.mockRejectedValue(new Error('Network error'));

      const result = await deleteNote('AAPL');

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // listNotes
  // ---------------------------------------------------------------------------

  describe('listNotes', () => {
    it('returns empty array when user is not authenticated', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue(null);

      const result = await listNotes();

      expect(result).toEqual([]);
      expect(firestore.getDocs).not.toHaveBeenCalled();
    });

    it('returns array of notes on success', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      const mockNotes = [
        { id: 'AAPL', data: () => ({ content: 'Apple notes', ticker: 'AAPL' }) },
        { id: 'MSFT', data: () => ({ content: 'Microsoft notes', ticker: 'MSFT' }) },
      ];
      firestore.getDocs.mockResolvedValue({ docs: mockNotes });

      const result = await listNotes();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ ticker: 'AAPL', content: 'Apple notes' });
      expect(result[1]).toMatchObject({ ticker: 'MSFT', content: 'Microsoft notes' });
    });

    it('returns empty array on Firestore error', async () => {
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');
      firestore.getDocs.mockRejectedValue(new Error('Network error'));

      const result = await listNotes();

      expect(result).toEqual([]);
    });

    it('returns empty array when db is not available', async () => {
      mockFirebaseState.db = null;
      mockFirebaseState.getCurrentUserId.mockReturnValue('user-123');

      const result = await listNotes();

      expect(result).toEqual([]);
    });
  });
});
