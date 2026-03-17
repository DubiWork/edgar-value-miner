/**
 * Tests for AuthGuard component
 *
 * UT-AUTH-GUARD-01 through UT-AUTH-GUARD-10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';
import { AuthContext } from '../../contexts/AuthContext';

// =============================================================================
// Helpers: inject AuthContext value directly (bypass AuthProvider internals)
// =============================================================================

/**
 * Wraps children in AuthContext.Provider with a given value.
 * This lets us test AuthGuard in isolation without a real Firebase connection.
 *
 * @param {import('../contexts/AuthContext').AuthContextValue} value
 * @param {React.ReactNode} children
 */
function renderWithAuth(value, children) {
  return render(
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

const AUTHENTICATED_CTX = {
  user: { uid: 'user-1', email: 'a@b.com', displayName: 'A' },
  loading: false,
  error: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

const UNAUTHENTICATED_CTX = {
  user: null,
  loading: false,
  error: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

const LOADING_CTX = {
  user: null,
  loading: true,
  error: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

// =============================================================================
// Tests
// =============================================================================

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-AUTH-GUARD-01: Renders children when authenticated
  it('renders children when user is authenticated', () => {
    const { getByTestId } = renderWithAuth(
      AUTHENTICATED_CTX,
      <AuthGuard>
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    expect(getByTestId('protected')).toBeDefined();
  });

  // UT-AUTH-GUARD-02: Does not render children when unauthenticated
  it('does not render children when user is not authenticated', () => {
    const { queryByTestId } = renderWithAuth(
      UNAUTHENTICATED_CTX,
      <AuthGuard>
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    expect(queryByTestId('protected')).toBeNull();
  });

  // UT-AUTH-GUARD-03: Renders fallback when unauthenticated
  it('renders fallback when user is not authenticated', () => {
    const { getByTestId, queryByTestId } = renderWithAuth(
      UNAUTHENTICATED_CTX,
      <AuthGuard fallback={<div data-testid="login-prompt">Please log in</div>}>
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    expect(getByTestId('login-prompt')).toBeDefined();
    expect(queryByTestId('protected')).toBeNull();
  });

  // UT-AUTH-GUARD-04: Renders null fallback by default when unauthenticated
  it('renders nothing (null) by default when unauthenticated and no fallback provided', () => {
    const { container } = renderWithAuth(
      UNAUTHENTICATED_CTX,
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>
    );

    expect(container.firstChild).toBeNull();
  });

  // UT-AUTH-GUARD-05: Shows loadingFallback during loading
  it('renders loadingFallback during auth initialization', () => {
    const { getByTestId, queryByTestId } = renderWithAuth(
      LOADING_CTX,
      <AuthGuard
        loadingFallback={<div data-testid="spinner">Loading...</div>}
      >
        <div data-testid="protected">Protected Content</div>
      </AuthGuard>
    );

    expect(getByTestId('spinner')).toBeDefined();
    expect(queryByTestId('protected')).toBeNull();
  });

  // UT-AUTH-GUARD-06: Renders nothing during loading when no loadingFallback
  it('renders nothing during loading when no loadingFallback provided', () => {
    const { container } = renderWithAuth(
      LOADING_CTX,
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>
    );

    expect(container.firstChild).toBeNull();
  });

  // UT-AUTH-GUARD-07: Does not render loadingFallback when authenticated
  it('does not show loadingFallback when loading=false and user is authenticated', () => {
    const { queryByTestId, getByTestId } = renderWithAuth(
      AUTHENTICATED_CTX,
      <AuthGuard
        loadingFallback={<div data-testid="spinner">Loading...</div>}
      >
        <div data-testid="protected">Protected</div>
      </AuthGuard>
    );

    expect(queryByTestId('spinner')).toBeNull();
    expect(getByTestId('protected')).toBeDefined();
  });

  // UT-AUTH-GUARD-08: Does not render fallback when authenticated
  it('does not show fallback when user is authenticated', () => {
    const { queryByTestId, getByTestId } = renderWithAuth(
      AUTHENTICATED_CTX,
      <AuthGuard fallback={<div data-testid="login-prompt">Please log in</div>}>
        <div data-testid="protected">Protected</div>
      </AuthGuard>
    );

    expect(queryByTestId('login-prompt')).toBeNull();
    expect(getByTestId('protected')).toBeDefined();
  });

  // UT-AUTH-GUARD-09: Throws when used outside AuthProvider
  it('throws when used outside AuthProvider (no AuthContext)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <AuthGuard>
          <div>Protected</div>
        </AuthGuard>
      );
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  // UT-AUTH-GUARD-10: Transitions from loading to authenticated
  it('transitions from loadingFallback to children when auth state resolves to authenticated', () => {
    // Render a controlled wrapper that accepts ctxValue as prop
    function ControlledWrapper({ ctxValue }) {
      return (
        <AuthContext.Provider value={ctxValue}>
          <AuthGuard
            loadingFallback={<div data-testid="spinner">Loading...</div>}
            fallback={<div data-testid="login">Login</div>}
          >
            <div data-testid="protected">Protected</div>
          </AuthGuard>
        </AuthContext.Provider>
      );
    }

    const { queryByTestId, getByTestId, rerender } = render(
      <ControlledWrapper ctxValue={LOADING_CTX} />
    );

    expect(getByTestId('spinner')).toBeDefined();
    expect(queryByTestId('protected')).toBeNull();

    rerender(<ControlledWrapper ctxValue={AUTHENTICATED_CTX} />);

    expect(queryByTestId('spinner')).toBeNull();
    expect(getByTestId('protected')).toBeDefined();
  });
});
