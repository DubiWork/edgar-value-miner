/**
 * Tests for useAuth hook
 *
 * UT-AUTH-HOOK-01 through UT-AUTH-HOOK-12
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthProvider } from '../../contexts/AuthProvider';

// =============================================================================
// Firebase Auth mock — using vi.hoisted so variables are available at mock-hoist time
// =============================================================================

const {
  mockAuth,
  mockUnsubscribe,
  mockOnAuthStateChanged,
  mockSignInWithEmailAndPassword,
  mockCreateUserWithEmailAndPassword,
  mockSignOut,
  getCapturedAuth,
  setCapturedAuth,
} = vi.hoisted(() => {
  let _capturedCallback = null;
  let _capturedErrorCallback = null;
  const _mockUnsubscribe = vi.fn();
  const _mockAuth = {};

  function _captureAuthState(auth, onNext, onError) {
    _capturedCallback = onNext;
    _capturedErrorCallback = onError;
    return _mockUnsubscribe;
  }
  const _mockOnAuthStateChanged = vi.fn(_captureAuthState);

  return {
    mockAuth: _mockAuth,
    mockUnsubscribe: _mockUnsubscribe,
    mockOnAuthStateChanged: _mockOnAuthStateChanged,
    mockSignInWithEmailAndPassword: vi.fn(),
    mockCreateUserWithEmailAndPassword: vi.fn(),
    mockSignOut: vi.fn(),
    getCapturedAuth: () => ({ callback: _capturedCallback, errorCallback: _capturedErrorCallback }),
    setCapturedAuth: (cb, errCb) => {
      _capturedCallback = cb;
      _capturedErrorCallback = errCb;
    },
  };
});

vi.mock('../../lib/firebase', () => ({
  auth: mockAuth,
  firebaseAvailable: true,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args) => mockSignOut(...args),
}));

// =============================================================================
// Helpers
// =============================================================================

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const MOCK_FIREBASE_USER = {
  uid: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
};

// =============================================================================
// Tests
// =============================================================================

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore implementation after clearAllMocks so callback capture still works
    mockOnAuthStateChanged.mockImplementation((auth, onNext, onError) => {
      setCapturedAuth(onNext, onError);
      return mockUnsubscribe;
    });
  });

  // UT-AUTH-HOOK-01: Throws error when used outside AuthProvider
  it('throws error when used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  // UT-AUTH-HOOK-02: Returns loading=true initially (before onAuthStateChanged fires)
  it('returns loading=true initially', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // onAuthStateChanged is called synchronously in useEffect.
    // Callback is captured but not yet fired, so loading remains true.
    await waitFor(() => {
      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  // UT-AUTH-HOOK-03: Returns signed-out state after onAuthStateChanged fires with null
  it('returns signed-out state when Firebase emits null user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(null);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(null);
  });

  // UT-AUTH-HOOK-04: Returns authenticated state when Firebase emits a user
  it('returns authenticated state when Firebase emits a user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(MOCK_FIREBASE_USER);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual({
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBe(null);
  });

  // UT-AUTH-HOOK-05: Returns complete interface shape
  it('returns the complete interface (user, loading, error, isAuthenticated, signIn, signUp, signOut)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(null);
    });

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('signIn');
    expect(result.current).toHaveProperty('signUp');
    expect(result.current).toHaveProperty('signOut');

    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
    expect(typeof result.current.isAuthenticated).toBe('boolean');
  });

  // UT-AUTH-HOOK-06: signIn delegates to Firebase
  it('signIn calls Firebase signInWithEmailAndPassword', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: MOCK_FIREBASE_USER });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(null);
    });

    await act(async () => {
      await result.current.signIn('test@example.com', 'password123');
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      'test@example.com',
      'password123'
    );
  });

  // UT-AUTH-HOOK-07: signUp delegates to Firebase
  it('signUp calls Firebase createUserWithEmailAndPassword', async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: MOCK_FIREBASE_USER });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(null);
    });

    await act(async () => {
      await result.current.signUp('new@example.com', 'securepass');
    });

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      'new@example.com',
      'securepass'
    );
  });

  // UT-AUTH-HOOK-08: signOut delegates to Firebase
  it('signOut calls Firebase signOut', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(MOCK_FIREBASE_USER);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
  });

  // UT-AUTH-HOOK-09: signIn sets error state on failure
  it('signIn sets error state and rethrows when Firebase throws', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce(
      new Error('auth/wrong-password')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(null);
    });

    let caughtError;
    await act(async () => {
      try {
        await result.current.signIn('test@example.com', 'wrong');
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toBe('auth/wrong-password');
    await waitFor(() => expect(result.current.error).toBe('auth/wrong-password'));
  });

  // UT-AUTH-HOOK-10: error state from onAuthStateChanged error callback
  it('sets error state when onAuthStateChanged emits an error', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().errorCallback).not.toBe(null));

    act(() => {
      getCapturedAuth().errorCallback(new Error('auth/network-request-failed'));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('auth/network-request-failed');
  });

  // UT-AUTH-HOOK-11: isAuthenticated is false when user is null
  it('isAuthenticated is false when user is null', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(null);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  // UT-AUTH-HOOK-12: isAuthenticated is true when user is set
  it('isAuthenticated is true when user object is present', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(getCapturedAuth().callback).not.toBe(null));

    act(() => {
      getCapturedAuth().callback(MOCK_FIREBASE_USER);
    });

    expect(result.current.isAuthenticated).toBe(true);
  });
});
