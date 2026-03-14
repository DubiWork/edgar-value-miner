import { useFeatureFlag } from '../hooks/useFeatureFlag';

/**
 * FeatureGate renders its children only when the specified feature flag is enabled.
 *
 * When the flag is disabled and no fallback is provided, renders nothing (null).
 * This ensures no errors or placeholder content appears for disabled features.
 *
 * @example
 * // Basic usage — renders children only when AI_DEBATE flag is on
 * <FeatureGate flag="AI_DEBATE">
 *   <AIDebatePanel />
 * </FeatureGate>
 *
 * @example
 * // With fallback — renders upgrade CTA when flag is off
 * <FeatureGate flag="UPGRADE_CTA" fallback={<UpgradeBanner />}>
 *   <FullFeature />
 * </FeatureGate>
 *
 * @param {object} props
 * @param {import('../hooks/useFeatureFlag').FeatureFlag} props.flag - Feature flag name
 * @param {import('react').ReactNode} props.children - Content to show when flag is on
 * @param {import('react').ReactNode} [props.fallback] - Content to show when flag is off
 * @returns {import('react').ReactNode}
 */
export function FeatureGate({ flag, children, fallback = null }) {
  const isEnabled = useFeatureFlag(flag);

  if (!isEnabled) {
    return fallback;
  }

  return children;
}

export default FeatureGate;
