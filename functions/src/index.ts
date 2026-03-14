import * as functions from 'firebase-functions';
import { helloWorldHandler } from './helloWorld';

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
