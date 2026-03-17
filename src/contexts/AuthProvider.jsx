import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { AuthContext } from './AuthContext';

// Static imports — these will be mocked in tests via vi.mock.
// The firebase.js module guards against missing env vars and exports null for auth
// if Firebase is not configured.
import { auth as firebaseAuth } from '../lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

/**
 * AuthProvider manages the application authentication state.
 *
 * Responsibilities:
 * - Subscribes to Firebase `onAuthStateChanged` and exposes auth state via AuthContext
 * - Provides `signIn`, `signUp`, and `signOut` action functions
 * - Sets `loading: true` during Firebase initialization, then `false` once state is known
 * - Cleans up the auth listener on unmount
 * - Gracefully handles the case where Firebase is not configured (auth === null)
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  // If Firebase auth is not available, we're not in a loading state — start false.
  // Otherwise start true until onAuthStateChanged fires.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!firebaseAuth);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseAuth) {
      // Firebase not configured — already initialized with loading=false
      return;
    }

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (firebaseUser) => {
        setUser(
          firebaseUser
            ? {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
              }
            : null
        );
        setLoading(false);
      },
      (authError) => {
        setError(authError.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Signs in with email and password.
   * Sets error state on failure.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const signIn = useCallback(async (email, password) => {
    if (!firebaseAuth) {
      const msg = 'Firebase Auth is not available';
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Creates a new account with email and password.
   * Sets error state on failure.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const signUp = useCallback(async (email, password) => {
    if (!firebaseAuth) {
      const msg = 'Firebase Auth is not available';
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Signs out the current user.
   * Sets error state on failure.
   *
   * @returns {Promise<void>}
   */
  const signOut = useCallback(async () => {
    if (!firebaseAuth) {
      const msg = 'Firebase Auth is not available';
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, signIn, signUp, signOut }),
    [user, loading, error, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
