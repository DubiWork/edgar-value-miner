import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureFlag } from '../useFeatureFlag';

// Helper to set a feature flag in the env mock
function setFlag(flagName, value) {
  import.meta.env[`VITE_FEATURE_${flagName}`] = value === true ? 'true' : value === false ? '' : value;
}

describe('useFeatureFlag', () => {
  beforeEach(() => {
    // Reset all feature flags to undefined (not set)
    delete import.meta.env.VITE_FEATURE_AI_DEBATE;
    delete import.meta.env.VITE_FEATURE_PERSONAL_NOTES;
    delete import.meta.env.VITE_FEATURE_SOCIAL_SHARING;
    delete import.meta.env.VITE_FEATURE_UPGRADE_CTA;
  });

  // AC: Default — all flags false when env vars are missing
  it('returns false when env var is not set (default false)', () => {
    const { result } = renderHook(() => useFeatureFlag('AI_DEBATE'));
    expect(result.current).toBe(false);
  });

  it('returns false for PERSONAL_NOTES when env var is not set', () => {
    const { result } = renderHook(() => useFeatureFlag('PERSONAL_NOTES'));
    expect(result.current).toBe(false);
  });

  it('returns false for SOCIAL_SHARING when env var is not set', () => {
    const { result } = renderHook(() => useFeatureFlag('SOCIAL_SHARING'));
    expect(result.current).toBe(false);
  });

  it('returns false for UPGRADE_CTA when env var is not set', () => {
    const { result } = renderHook(() => useFeatureFlag('UPGRADE_CTA'));
    expect(result.current).toBe(false);
  });

  // AC: Flag on — returns true when env var is 'true'
  it('returns true when VITE_FEATURE_AI_DEBATE is "true"', () => {
    setFlag('AI_DEBATE', true);
    const { result } = renderHook(() => useFeatureFlag('AI_DEBATE'));
    expect(result.current).toBe(true);
  });

  it('returns true when VITE_FEATURE_PERSONAL_NOTES is "true"', () => {
    setFlag('PERSONAL_NOTES', true);
    const { result } = renderHook(() => useFeatureFlag('PERSONAL_NOTES'));
    expect(result.current).toBe(true);
  });

  it('returns true when VITE_FEATURE_SOCIAL_SHARING is "true"', () => {
    setFlag('SOCIAL_SHARING', true);
    const { result } = renderHook(() => useFeatureFlag('SOCIAL_SHARING'));
    expect(result.current).toBe(true);
  });

  it('returns true when VITE_FEATURE_UPGRADE_CTA is "true"', () => {
    setFlag('UPGRADE_CTA', true);
    const { result } = renderHook(() => useFeatureFlag('UPGRADE_CTA'));
    expect(result.current).toBe(true);
  });

  // AC: Flag off — empty string, 'false', or '0' are all falsy
  it('returns false when env var is empty string', () => {
    import.meta.env.VITE_FEATURE_AI_DEBATE = '';
    const { result } = renderHook(() => useFeatureFlag('AI_DEBATE'));
    expect(result.current).toBe(false);
  });

  it('returns false when env var is "false"', () => {
    import.meta.env.VITE_FEATURE_AI_DEBATE = 'false';
    const { result } = renderHook(() => useFeatureFlag('AI_DEBATE'));
    expect(result.current).toBe(false);
  });

  it('returns false when env var is "0"', () => {
    import.meta.env.VITE_FEATURE_AI_DEBATE = '0';
    const { result } = renderHook(() => useFeatureFlag('AI_DEBATE'));
    expect(result.current).toBe(false);
  });
});
