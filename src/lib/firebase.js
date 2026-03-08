/**
 * Firebase Configuration and Initialization
 *
 * This module initializes Firebase services (Auth, Firestore) and provides
 * helper functions for interacting with Firebase across the application.
 *
 * When Firebase environment variables are not set, the module exports
 * null values for auth/db and sets firebaseAvailable to false, allowing
 * the app to run without Firebase (with Firebase-dependent features disabled).
 *
 * Environment Variables Required (for Firebase features):
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

// Check required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);

let app = null;
let auth = null;
let db = null;

/**
 * Whether Firebase is available and properly initialized.
 * When false, all Firebase-dependent features are disabled.
 * @type {boolean}
 */
export let firebaseAvailable = false;

if (missingVars.length > 0) {
  if (import.meta.env.DEV) {
    console.warn(
      'Firebase environment variables not set — Firebase features disabled.',
      'Missing:',
      missingVars
    );
  } else {
    console.warn('Firebase is not configured — Firebase features disabled.');
  }
} else {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth, connectAuthEmulator } = await import('firebase/auth');
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseAvailable = true;

    if (import.meta.env.DEV) {
      console.log('Firebase initialized successfully');
    }

    // Connect to emulators if in development mode
    const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
    if (useEmulator && import.meta.env.DEV && auth && db) {
      try {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, 'localhost', 8080);
        console.log('Firebase: Connected to emulators');
      } catch (emulatorError) {
        console.warn('Failed to connect to Firebase Emulators:', emulatorError.message);
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error initializing Firebase:', error);
    }
    console.warn('Firebase initialization failed — Firebase features disabled.');
    app = null;
    auth = null;
    db = null;
    firebaseAvailable = false;
  }
}

export { auth, db };

/**
 * Helper function to check if Firebase is properly initialized
 * @returns {boolean} True if Firebase is initialized
 */
export const isFirebaseInitialized = () => {
  return firebaseAvailable;
};

/**
 * Helper function to get the current user ID
 * @returns {string|null} Current user ID or null if not authenticated or Firebase unavailable
 */
export const getCurrentUserId = () => {
  return auth?.currentUser?.uid || null;
};

/**
 * Helper function to check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export const isAuthenticated = () => {
  return !!auth?.currentUser;
};

/**
 * Helper function to get Firebase project ID
 * @returns {string|null} Firebase project ID or null if Firebase unavailable
 */
export const getProjectId = () => {
  if (!firebaseAvailable) return null;
  return import.meta.env.VITE_FIREBASE_PROJECT_ID || null;
};

// Export the app instance for advanced use cases
export default app;
