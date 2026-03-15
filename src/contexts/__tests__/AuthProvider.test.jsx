/**
 * Tests for AuthProvider context component
 *
 * UT-AUTH-CTX-01 through UT-AUTH-CTX-10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { AuthProvider } from '../AuthProvider';
import { AuthContext } from '../AuthContext';

// =============================================================================
// Firebase Auth mock — using vi.hoisted so variables are available at mock-hoist time
// =============================================================================

const {
  mockAuth,
  mockUnsubscribe,
  mockOnAuthStateChangedSpy,
  mockSignInWithEmailAndPassword,
  mockCreateUserWithEmailAndPassword,
  mockSignOut,
  getCaptured,
  setCaptured,
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
  const _mockOnAuthStateChangedSpy = vi.fn(_captureAuthState);

  return {
    mockAuth: _mockAuth,
    mockUnsubscribe: _mockUnsubscribe,
    mockOnAuthStateChangedSpy: _mockOnAuthStateChangedSpy,
    mockSignInWithEmailAndPassword: vi.fn(),
    mockCreateUserWithEmailAndPassword: vi.fn(),
    mockSignOut: vi.fn(),
    getCaptured: () => ({ callback: _capturedCallback, errorCallback: _capturedErrorCallback }),
    setCaptured: (cb, errCb) => {
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
  onAuthStateChanged: (...args) => mockOnAuthStateChangedSpy(...args),
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args) => mockSignOut(...args),
}));

// =============================================================================
// Helper Consumer
// =============================================================================

function AuthConsumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div data-testid="no-context">No context</div>;
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user">{ctx.user ? ctx.user.uid : 'null'}</span>
      <span data-testid="error">{ctx.error ?? 'null'}</span>
      <span data-testid="is-authenticated">{String(ctx.user !== null)}</span>
    </div>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore implementation after clearAllMocks so callback capture still works
    mockOnAuthStateChangedSpy.mockImplementation((auth, onNext, onError) => {
      setCaptured(onNext, onError);
      return mockUnsubscribe;
    });
  });

  // UT-AUTH-CTX-01: Renders children
  it('renders children without crashing', () => {
    const { getByText } = render(
      <AuthProvider>
        <span>child content</span>
      </AuthProvider>
    );
    expect(getByText('child content')).toBeDefined();
  });

  // UT-AUTH-CTX-02: Initial loading state
  it('provides loading=true initially before auth state resolves', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    // onAuthStateChanged is called synchronously in useEffect.
    // The callback is captured but not yet fired, so loading remains true.
    await waitFor(() => expect(mockOnAuthStateChangedSpy).toHaveBeenCalled());
    expect(getByTestId('loading').textContent).toBe('true');
    expect(getByTestId('user').textContent).toBe('null');
  });

  // UT-AUTH-CTX-03: Signed-out state after null user
  it('provides user=null and loading=false after onAuthStateChanged emits null', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(getCaptured().callback).not.toBe(null));

    act(() => {
      getCaptured().callback(null);
    });

    expect(getByTestId('loading').textContent).toBe('false');
    expect(getByTestId('user').textContent).toBe('null');
    expect(getByTestId('error').textContent).toBe('null');
  });

  // UT-AUTH-CTX-04: Signed-in state after Firebase user
  it('provides user object and loading=false after onAuthStateChanged emits a user', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(getCaptured().callback).not.toBe(null));

    act(() => {
      getCaptured().callback({ uid: 'abc', email: 'a@b.com', displayName: 'Alice' });
    });

    expect(getByTestId('loading').textContent).toBe('false');
    expect(getByTestId('user').textContent).toBe('abc');
    expect(getByTestId('error').textContent).toBe('null');
  });

  // UT-AUTH-CTX-05: Error state from auth state error callback
  it('sets error and loading=false when onAuthStateChanged fires the error callback', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(getCaptured().errorCallback).not.toBe(null));

    act(() => {
      getCaptured().errorCallback(new Error('auth/internal-error'));
    });

    expect(getByTestId('loading').textContent).toBe('false');
    expect(getByTestId('error').textContent).toBe('auth/internal-error');
  });

  // UT-AUTH-CTX-06: Unsubscribes on unmount
  it('calls the unsubscribe function returned by onAuthStateChanged on unmount', async () => {
    const { unmount } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(mockOnAuthStateChangedSpy).toHaveBeenCalled());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  // UT-AUTH-CTX-07: Exposes signIn function
  it('exposes signIn function via context', async () => {
    const { result } = renderHook(() => useContext(AuthContext), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => expect(result.current).not.toBe(null));
    expect(typeof result.current.signIn).toBe('function');
  });

  // UT-AUTH-CTX-08: Exposes signUp function
  it('exposes signUp function via context', async () => {
    const { result } = renderHook(() => useContext(AuthContext), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => expect(result.current).not.toBe(null));
    expect(typeof result.current.signUp).toBe('function');
  });

  // UT-AUTH-CTX-09: Exposes signOut function
  it('exposes signOut function via context', async () => {
    const { result } = renderHook(() => useContext(AuthContext), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => expect(result.current).not.toBe(null));
    expect(typeof result.current.signOut).toBe('function');
  });

  // UT-AUTH-CTX-10: User maps only expected fields from Firebase user
  it('maps Firebase user to { uid, email, displayName } only', async () => {
    const { result } = renderHook(() => useContext(AuthContext), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => expect(getCaptured().callback).not.toBe(null));

    act(() => {
      getCaptured().callback({
        uid: 'uid-999',
        email: 'x@y.com',
        displayName: 'X User',
        // Extra Firebase fields that should NOT be forwarded
        refreshToken: 'super-secret',
        stsTokenManager: {},
        providerData: [],
      });
    });

    expect(result.current.user).toEqual({
      uid: 'uid-999',
      email: 'x@y.com',
      displayName: 'X User',
    });
    expect(result.current.user).not.toHaveProperty('refreshToken');
    expect(result.current.user).not.toHaveProperty('stsTokenManager');
  });
});
