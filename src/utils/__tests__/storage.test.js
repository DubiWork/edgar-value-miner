/**
 * Tests for Safe localStorage Wrapper
 *
 * Tests cover:
 * - getItem: returns value, handles missing key, unavailable localStorage, SecurityError
 * - setItem: writes value, handles unavailable localStorage
 * - removeItem: removes value, handles unavailable localStorage, handles errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getItem, setItem, removeItem } from '../../utils/storage.js';

// =============================================================================
// Test Setup
// =============================================================================

let originalWindow;

beforeEach(() => {
  localStorage.clear();
  originalWindow = globalThis.window;
});

afterEach(() => {
  globalThis.window = originalWindow;
  vi.restoreAllMocks();
});

// =============================================================================
// getItem
// =============================================================================

describe('getItem', () => {
  it('should return value from localStorage', () => {
    localStorage.setItem('theme', 'dark');

    expect(getItem('theme')).toBe('dark');
  });

  it('should return null when key not found', () => {
    expect(getItem('nonexistent')).toBeNull();
  });

  it('should return null when localStorage is unavailable (window undefined)', () => {
    const savedWindow = globalThis.window;
    delete globalThis.window;

    expect(getItem('theme')).toBeNull();

    globalThis.window = savedWindow;
  });

  it('should return null when localStorage throws SecurityError', () => {
    const savedDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Access denied', 'SecurityError');
      },
      configurable: true,
    });

    expect(getItem('theme')).toBeNull();

    if (savedDescriptor) {
      Object.defineProperty(window, 'localStorage', savedDescriptor);
    }
  });
});

// =============================================================================
// setItem
// =============================================================================

describe('setItem', () => {
  it('should write to localStorage', () => {
    setItem('theme', 'dark');

    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should do nothing when localStorage is unavailable', () => {
    const savedWindow = globalThis.window;
    delete globalThis.window;

    expect(() => setItem('theme', 'dark')).not.toThrow();

    globalThis.window = savedWindow;
  });
});

// =============================================================================
// removeItem
// =============================================================================

describe('removeItem', () => {
  it('should remove from localStorage', () => {
    localStorage.setItem('theme', 'dark');

    removeItem('theme');

    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('should do nothing when localStorage is unavailable', () => {
    const savedWindow = globalThis.window;
    delete globalThis.window;

    expect(() => removeItem('theme')).not.toThrow();

    globalThis.window = savedWindow;
  });

  it('should handle errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage failure');
    });

    expect(() => removeItem('theme')).not.toThrow();
  });
});
