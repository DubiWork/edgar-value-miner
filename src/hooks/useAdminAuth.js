/**
 * useAdminAuth - Custom React Hook for Firebase Google Auth & Admin Role Detection
 *
 * Provides Google Sign-In/Sign-Out and checks whether the currently signed-in
 * user's email belongs to the configured admin email list (`VITE_ADMIN_EMAILS`).
 *
 * @module useAdminAuth
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import * as firebaseLib from '../lib/firebase';

const DEFAULT_ADMIN_EMAILS = ['dubigreenfeld@gmail.com'];

/**
 * Parses the allowed admin emails from `VITE_ADMIN_EMAILS` (comma-separated)
 * merged with `DEFAULT_ADMIN_EMAILS`.
 *
 * @returns {string[]} Lowercased list of admin emails
 */
export function getAdminEmails() {
  const envRaw = import.meta.env?.VITE_ADMIN_EMAILS || '';
  const envEmails = String(envRaw)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...envEmails]));
}

/**
 * Checks whether a given email address belongs to an admin user.
 *
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}

/**
 * React hook for managing authentication state and admin permissions.
 */
export function useAdminAuth() {
  const auth = firebaseLib.auth || null;
  const firebaseAvailable = Boolean(firebaseLib.firebaseAvailable);

  const [user, setUser] = useState(() => auth?.currentUser || null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(firebaseAvailable && auth));
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!firebaseAvailable || !auth) {
      setAuthLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser || null);
        setAuthLoading(false);
      },
      (err) => {
        console.error('[useAdminAuth] Auth state error:', err);
        setAuthError(err?.message || 'Authentication error');
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth, firebaseAvailable]);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseAvailable || !auth) {
      setAuthError('Firebase Auth is not configured');
      return null;
    }

    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      return result.user;
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Failed to sign in with Google');
      }
      return null;
    }
  }, [auth, firebaseAvailable]);

  const signOutUser = useCallback(async () => {
    if (!firebaseAvailable || !auth) return;
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      setAuthError(err?.message || 'Failed to sign out');
    }
  }, [auth, firebaseAvailable]);

  const isAdmin = Boolean(user?.email && isAdminEmail(user.email));

  return {
    user,
    isAdmin,
    authLoading,
    authError,
    signInWithGoogle,
    signOutUser,
    isFirebaseAvailable: firebaseAvailable,
  };
}

export default useAdminAuth;
