import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';

describe('useReducedMotion', () => {
  // =========================================================================
  // Initial state
  // =========================================================================

  it('returns false when prefers-reduced-motion does not match', () => {
    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion matches on init', () => {
    window.matchMedia = vi.fn((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  // =========================================================================
  // Runtime changes
  // =========================================================================

  it('updates when media query fires a change event', () => {
    let changeHandler = null;

    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);

    act(() => {
      changeHandler({ matches: true });
    });

    expect(result.current).toBe(true);
  });

  it('reverts to false when user turns off reduced motion', () => {
    let changeHandler = null;

    window.matchMedia = vi.fn((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);

    act(() => {
      changeHandler({ matches: false });
    });

    expect(result.current).toBe(false);
  });

  // =========================================================================
  // Cleanup
  // =========================================================================

  it('removes the event listener on unmount', () => {
    const removeEventListener = vi.fn();

    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener,
    }));

    const { unmount } = renderHook(() => useReducedMotion());

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  // =========================================================================
  // Graceful degradation
  // =========================================================================

  it('returns false when window.matchMedia is not available', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = undefined;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);

    window.matchMedia = originalMatchMedia;
  });
});
