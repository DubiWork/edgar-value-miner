import { describe, it, expect } from 'vitest';

/**
 * Unit tests for helloWorld Cloud Function.
 * These tests validate the function logic without requiring the Firebase emulator.
 * Integration tests (requiring the emulator) live in tests/e2e/.
 */
describe('helloWorld function', () => {
  it('returns a status of ok', async () => {
    // Import the handler directly to test business logic in isolation
    const { helloWorldHandler } = await import('../helloWorld.js');
    const result = helloWorldHandler();
    expect(result.status).toBe('ok');
  });

  it('returns a message string', async () => {
    const { helloWorldHandler } = await import('../helloWorld.js');
    const result = helloWorldHandler();
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('includes a timestamp in the response', async () => {
    const { helloWorldHandler } = await import('../helloWorld.js');
    const result = helloWorldHandler();
    expect(result.timestamp).toBeDefined();
    // Must be a valid ISO date string
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
