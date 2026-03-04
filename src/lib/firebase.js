/**
 * Firebase Configuration and Initialization
 *
 * This module initializes Firebase services (Auth, Firestore) and provides
 * helper functions for interacting with Firebase across the application.
 *
 * Environment Variables Required:
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 *
 * Optional:
 * - VITE_USE_FIREBASE_EMULATOR (set to 'true' for local development)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Validate required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingVars.length > 0) {
  // In development, provide detailed error messages for debugging
  if (import.meta.env.DEV) {
    console.error('Missing required Firebase environment variables:', missingVars);
    throw new Error(
      `Firebase configuration error: Missing environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  } else {
    // In production, use generic error message to avoid information disclosure
    throw new Error('Application configuration error. Please contact support.');
  }
}

// Firebase configuration object
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  if (import.meta.env.DEV) {
    console.log('Firebase initialized successfully');
  }
} catch (error) {
  if (import.meta.env.DEV) {
    console.error('Error initializing Firebase:', error);
  }
  throw error;
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators if in development mode
// This is double-protected: both conditions must be true to connect to emulators
// DEV is set at build time by Vite, so production builds will never have DEV=true
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
if (useEmulator && import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Firebase: Connected to emulators');
  } catch (error) {
    console.warn('Failed to connect to Firebase Emulators:', error.message);
  }
}

/**
 * Helper function to check if Firebase is properly initialized
 * @returns {boolean} True if Firebase is initialized
 */
export const isFirebaseInitialized = () => {
  return !!app;
};

/**
 * Helper function to get the current user ID
 * @returns {string|null} Current user ID or null if not authenticated
 */
export const getCurrentUserId = () => {
  return auth.currentUser?.uid || null;
};

/**
 * Helper function to check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export const isAuthenticated = () => {
  return !!auth.currentUser;
};

/**
 * Helper function to get Firebase project ID
 * @returns {string} Firebase project ID
 */
export const getProjectId = () => {
  return firebaseConfig.projectId;
};

// Export the app instance for advanced use cases
export default app;
