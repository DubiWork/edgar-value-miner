import * as functions from 'firebase-functions';
import { helloWorldHandler } from './helloWorld';
import { getOrGenerateDebateHandler } from './functions/getOrGenerateDebate';

/**
 * helloWorld — smoke-test onCall function.
 * Verifies the Firebase Functions emulator is running and callable.
 *
 * Usage (emulator):
 *   POST http://localhost:5001/<project-id>/<region>/helloWorld
 */
export const helloWorld = functions.https.onCall((_data, _context) => {
  return helloWorldHandler();
});

/**
 * getOrGenerateDebate — AI Bull vs Bear debate with Firestore caching.
 * Cache hit: <1s  |  Fresh generation: <15s
 *
 * Usage (emulator):
 *   POST http://localhost:5001/<project-id>/<region>/getOrGenerateDebate
 *   Body: { "data": { "ticker": "AAPL" } }
 *
 * Unauthenticated callers receive cached debates only.
 * Authenticated callers can trigger fresh generation (subject to rate limits).
 *
 * minInstances: Set FUNCTIONS_MIN_INSTANCES=1 in production to eliminate cold starts (~$5/month).
 */
export const getOrGenerateDebate = functions.https.onCall(
  {
    minInstances: parseInt(process.env.FUNCTIONS_MIN_INSTANCES ?? '0', 10) || 0,
  },
  getOrGenerateDebateHandler
);
