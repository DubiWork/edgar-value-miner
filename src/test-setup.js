/**
 * Vitest Test Setup
 *
 * Global test configuration, mocks, and setup for all test files.
 */

import { afterEach, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// =============================================================================
// IndexedDB Mock Setup
// =============================================================================

// Reset IndexedDB before each test
beforeEach(() => {
  // Create a fresh IndexedDB instance
  global.indexedDB = new IDBFactory();
});

// =============================================================================
// Firebase Mock Setup
// =============================================================================

// Mock Firebase completely to avoid initialization errors
vi.mock('./lib/firebase', () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      })),
    })),
  },
  getCurrentUserId: vi.fn(() => 'test-user-id'),
}));

// =============================================================================
// Environment Variables Mock
// =============================================================================

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: false, // Suppress dev logs during tests
    VITE_SEC_USER_AGENT: 'test-user-agent (test@example.com)',
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
    VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    VITE_FIREBASE_APP_ID: '1:123456789:web:abc123',
  },
  writable: true,
  configurable: true,
});

// =============================================================================
// Global Cleanup
// =============================================================================

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

// =============================================================================
// Fetch Mock Utilities
// =============================================================================

/**
 * Creates a mock fetch response
 * @param {Object} data - Response data
 * @param {Object} options - Response options (status, ok, etc.)
 * @returns {Promise<Response>}
 */
export function createMockFetchResponse(data, options = {}) {
  return Promise.resolve({
    ok: options.ok !== undefined ? options.ok : true,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(options.headers || {}),
  });
}

/**
 * Creates a mock fetch error
 * @param {string} message - Error message
 * @returns {Promise<never>}
 */
export function createMockFetchError(message = 'Network error') {
  return Promise.reject(new Error(message));
}

// =============================================================================
// Wait Utilities
// =============================================================================

/**
 * Waits for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Maximum wait time in milliseconds
 * @param {number} interval - Check interval in milliseconds
 * @returns {Promise<void>}
 */
export async function waitFor(condition, timeout = 5000, interval = 50) {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await wait(interval);
  }
}
