/**
 * notesService — Personal research notes CRUD operations.
 *
 * Stores notes in `users/{uid}/notes/{ticker}` Firestore subcollection.
 * All operations require an authenticated user — unauthenticated calls
 * return safe defaults (null / false / []).
 *
 * @module notesService
 */

import { db, getCurrentUserId } from '../lib/firebase';
import {
  doc,
  collection,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

// =============================================================================
// Constants
// =============================================================================

/** Maximum note length in characters */
const MAX_NOTE_LENGTH = 10000;

/** Firestore collection name for user data */
const USERS_COLLECTION = 'users';

/** Subcollection name for notes */
const NOTES_SUBCOLLECTION = 'notes';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalizes a ticker symbol to uppercase and validates format.
 * @param {string} ticker
 * @returns {string}
 * @throws {Error} if ticker format is invalid
 */
function normalizeTicker(ticker) {
  const normalized = String(ticker).trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,10}$/.test(normalized)) {
    throw new Error(`Invalid ticker format: "${normalized}"`);
  }
  return normalized;
}

/**
 * Returns the Firestore document reference for a user's note.
 * @param {string} uid - Firebase user ID
 * @param {string} ticker - Normalized ticker symbol
 * @returns {import('firebase/firestore').DocumentReference}
 */
function noteDocRef(uid, ticker) {
  return doc(db, USERS_COLLECTION, uid, NOTES_SUBCOLLECTION, ticker);
}

/**
 * Returns the Firestore collection reference for a user's notes.
 * @param {string} uid - Firebase user ID
 * @returns {import('firebase/firestore').CollectionReference}
 */
function notesCollectionRef(uid) {
  return collection(db, USERS_COLLECTION, uid, NOTES_SUBCOLLECTION);
}

/**
 * Checks whether the caller has a valid db instance and auth uid.
 * @returns {{ uid: string|null, valid: boolean }}
 */
function getAuth() {
  if (!db) return { uid: null, valid: false };
  const uid = getCurrentUserId();
  if (!uid) return { uid: null, valid: false };
  return { uid, valid: true };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Reads a user's personal note for a specific ticker.
 *
 * @param {string} ticker - Stock ticker symbol (e.g. "AAPL")
 * @returns {Promise<Object|null>} Note document data, or null if not found / unauthenticated
 *
 * @example
 * const note = await getNote('AAPL');
 * if (note) console.log(note.content);
 */
export async function getNote(ticker) {
  const { uid, valid } = getAuth();
  if (!valid) return null;

  try {
    const normalizedTicker = normalizeTicker(ticker);
    const ref = noteDocRef(uid, normalizedTicker);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return snap.data();
  } catch {
    return null;
  }
}

/**
 * Creates or updates a user's personal note for a specific ticker.
 *
 * Uses setDoc (upsert) so this works for both create and update.
 * Content is truncated at MAX_NOTE_LENGTH characters.
 *
 * @param {string} ticker - Stock ticker symbol (e.g. "AAPL")
 * @param {string} content - Note text content
 * @returns {Promise<boolean>} true on success, false on failure or if unauthenticated
 *
 * @example
 * const saved = await saveNote('AAPL', 'Strong ecosystem, monopoly-like margins.');
 */
export async function saveNote(ticker, content) {
  const { uid, valid } = getAuth();
  if (!valid) return false;

  try {
    const normalizedTicker = normalizeTicker(ticker);
    const truncatedContent = String(content).slice(0, MAX_NOTE_LENGTH);
    const ref = noteDocRef(uid, normalizedTicker);
    const existing = await getDoc(ref);
    const data = {
      content: truncatedContent,
      ticker: normalizedTicker,
      uid,
      updatedAt: serverTimestamp(),
    };
    if (!existing.exists()) {
      data.createdAt = serverTimestamp();
    }
    await setDoc(ref, data, { merge: true });

    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a user's personal note for a specific ticker.
 *
 * @param {string} ticker - Stock ticker symbol (e.g. "AAPL")
 * @returns {Promise<boolean>} true on success, false on failure or if unauthenticated
 *
 * @example
 * await deleteNote('AAPL');
 */
export async function deleteNote(ticker) {
  const { uid, valid } = getAuth();
  if (!valid) return false;

  try {
    const normalizedTicker = normalizeTicker(ticker);
    const ref = noteDocRef(uid, normalizedTicker);
    await deleteDoc(ref);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists all personal notes for the current user.
 *
 * Ordered by updatedAt descending (most recent first).
 * Useful for a future watchlist/notes overview page.
 *
 * @returns {Promise<Array<Object>>} Array of note objects, or empty array if unauthenticated / error
 *
 * @example
 * const notes = await listNotes();
 * notes.forEach(note => console.log(note.ticker, note.content));
 */
export async function listNotes() {
  const { uid, valid } = getAuth();
  if (!valid) return [];

  try {
    const colRef = notesCollectionRef(uid);
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch {
    return [];
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  getNote,
  saveNote,
  deleteNote,
  listNotes,
};
