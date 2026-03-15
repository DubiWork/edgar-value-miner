import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * useAuth provides access to the current authentication state and auth actions.
 *
 * Must be used within an AuthProvider. Throws a descriptive error if called outside one.
 *
 * @returns {{
 *   user: import('../contexts/AuthContext').AuthUser|null,
 *   loading: boolean,
 *   error: string|null,
 *   isAuthenticated: boolean,
 *   signIn: (email: string, password: string) => Promise<void>,
 *   signUp: (email: string, password: string) => Promise<void>,
 *   signOut: () => Promise<void>
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, loading, error, signIn, signUp, signOut } = context;

  return {
    user,
    loading,
    error,
    isAuthenticated: user !== null,
    signIn,
    signUp,
    signOut,
  };
}

export default useAuth;
