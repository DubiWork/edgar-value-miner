/**
 * Feature flags — env-var based for MVP.
 *
 * All flags are read at call-time (not module-load-time) so they can be
 * overridden in tests without requiring module resets.
 */

/** Returns true when the AI debate feature is enabled. Default: true. */
export function isAiDebateEnabled(): boolean {
  const val = process.env.AI_DEBATE_ENABLED;
  if (val === undefined || val === '') return true;
  return val.toLowerCase() !== 'false' && val !== '0';
}
