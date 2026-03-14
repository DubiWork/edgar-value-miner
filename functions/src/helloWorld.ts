/**
 * Pure handler logic for the helloWorld function.
 * Separated from the Firebase wiring to allow unit testing without the emulator.
 */

export interface HelloWorldResponse {
  status: 'ok';
  message: string;
  timestamp: string;
}

export function helloWorldHandler(): HelloWorldResponse {
  return {
    status: 'ok',
    message: 'EDGAR Value Miner Functions are running.',
    timestamp: new Date().toISOString(),
  };
}
