import { createContext } from 'react';

/**
 * @typedef {Object} AuthUser
 * @property {string} uid - Firebase user ID
 * @property {string|null} email - User email
 * @property {string|null} displayName - User display name
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user - Current authenticated user, or null if signed out
 * @property {boolean} loading - True during Firebase auth state initialization
 * @property {string|null} error - Last auth error message, or null
 * @property {(email: string, password: string) => Promise<void>} signIn - Sign in with email/password
 * @property {(email: string, password: string) => Promise<void>} signUp - Create new account
 * @property {() => Promise<void>} signOut - Sign out current user
 */

/**
 * AuthContext holds the current authentication state.
 * Consumers should use the useAuth hook rather than accessing this directly.
 */
export const AuthContext = createContext(null);
