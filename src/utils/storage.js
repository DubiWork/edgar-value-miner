/**
 * Safe localStorage wrapper.
 *
 * Node.js 25+ provides a built-in `localStorage` global that lacks standard
 * Web Storage API methods (getItem, setItem, removeItem, clear) when
 * `--localstorage-file` is not provided. In browser environments (and jsdom),
 * `window.localStorage` has the full API.
 *
 * This module provides safe wrappers that prefer `window.localStorage` when
 * available and fall back gracefully.
 */

/**
 * Gets the proper localStorage object with full Web Storage API.
 * @returns {Storage | null}
 */
function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage;
    }
  } catch {
    // Security error in some environments
  }
  return null;
}

/**
 * Safely gets an item from localStorage.
 * @param {string} key
 * @returns {string | null}
 */
export function getItem(key) {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely sets an item in localStorage.
 * @param {string} key
 * @param {string} value
 * @throws {Error} Rethrows if storage is available but write fails (e.g., quota exceeded)
 */
export function setItem(key, value) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, value);
}

/**
 * Safely removes an item from localStorage.
 * @param {string} key
 */
export function removeItem(key) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore
  }
}
