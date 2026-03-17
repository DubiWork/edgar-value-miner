/**
 * Feature flag registry for EDGAR Value Miner MVP.
 *
 * All flags are read from Vite environment variables at build time.
 * Default: all flags false (nothing breaks if env vars are missing).
 *
 * To enable a flag, set the corresponding env var to 'true' in your
 * .env.development or .env.staging file.
 *
 * @typedef {'AI_DEBATE' | 'PERSONAL_NOTES' | 'SOCIAL_SHARING' | 'UPGRADE_CTA'} FeatureFlag
 */

/**
 * Valid feature flag names.
 * Add new flags here to include them in the registry.
 *
 * @type {readonly FeatureFlag[]}
 */
export const FEATURE_FLAGS = /** @type {const} */ ([
  'AI_DEBATE',
  'PERSONAL_NOTES',
  'SOCIAL_SHARING',
  'UPGRADE_CTA',
]);

/**
 * Returns whether a feature flag is enabled.
 *
 * Reads from `import.meta.env.VITE_FEATURE_<FLAG_NAME>`.
 * Only the string value `'true'` enables the flag — anything else
 * (undefined, empty string, 'false', '0') returns false.
 *
 * @param {FeatureFlag} flagName - The feature flag name (e.g. 'AI_DEBATE')
 * @returns {boolean} Whether the flag is enabled
 */
export function useFeatureFlag(flagName) {
  const envKey = `VITE_FEATURE_${flagName}`;
  const value = import.meta.env[envKey];
  return value === 'true';
}

export default useFeatureFlag;
