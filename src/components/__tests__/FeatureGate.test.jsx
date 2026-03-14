import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate } from '../FeatureGate';

describe('FeatureGate', () => {
  beforeEach(() => {
    // Reset all feature flags
    delete import.meta.env.VITE_FEATURE_AI_DEBATE;
    delete import.meta.env.VITE_FEATURE_PERSONAL_NOTES;
    delete import.meta.env.VITE_FEATURE_SOCIAL_SHARING;
    delete import.meta.env.VITE_FEATURE_UPGRADE_CTA;
  });

  // AC: Renders children when flag is enabled
  it('renders children when flag is enabled', () => {
    import.meta.env.VITE_FEATURE_AI_DEBATE = 'true';

    render(
      <FeatureGate flag="AI_DEBATE">
        <span>AI Debate content</span>
      </FeatureGate>
    );

    expect(screen.getByText('AI Debate content')).toBeTruthy();
  });

  it('renders children when PERSONAL_NOTES flag is enabled', () => {
    import.meta.env.VITE_FEATURE_PERSONAL_NOTES = 'true';

    render(
      <FeatureGate flag="PERSONAL_NOTES">
        <span>Personal notes content</span>
      </FeatureGate>
    );

    expect(screen.getByText('Personal notes content')).toBeTruthy();
  });

  // AC: Renders nothing (not error) when flag is off
  it('renders nothing when flag is disabled (not set)', () => {
    const { container } = render(
      <FeatureGate flag="AI_DEBATE">
        <span>Hidden content</span>
      </FeatureGate>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('renders nothing when flag is explicitly "false"', () => {
    import.meta.env.VITE_FEATURE_AI_DEBATE = 'false';

    const { container } = render(
      <FeatureGate flag="AI_DEBATE">
        <span>Hidden content</span>
      </FeatureGate>
    );

    expect(container.firstChild).toBeNull();
  });

  // AC: Optional fallback prop for disabled state
  it('renders fallback when flag is off and fallback is provided', () => {
    render(
      <FeatureGate flag="AI_DEBATE" fallback={<span>Upgrade required</span>}>
        <span>AI Debate content</span>
      </FeatureGate>
    );

    expect(screen.getByText('Upgrade required')).toBeTruthy();
    expect(screen.queryByText('AI Debate content')).toBeNull();
  });

  it('does not render fallback when flag is enabled', () => {
    import.meta.env.VITE_FEATURE_AI_DEBATE = 'true';

    render(
      <FeatureGate flag="AI_DEBATE" fallback={<span>Upgrade required</span>}>
        <span>AI Debate content</span>
      </FeatureGate>
    );

    expect(screen.getByText('AI Debate content')).toBeTruthy();
    expect(screen.queryByText('Upgrade required')).toBeNull();
  });

  // AC: No fallback provided, flag off — renders nothing (not error)
  it('renders null (no error) when flag is off and no fallback provided', () => {
    const { container } = render(
      <FeatureGate flag="SOCIAL_SHARING">
        <span>Share buttons</span>
      </FeatureGate>
    );

    expect(container.innerHTML).toBe('');
  });

  // AC: Renders multiple children correctly
  it('renders multiple children when flag is enabled', () => {
    import.meta.env.VITE_FEATURE_UPGRADE_CTA = 'true';

    render(
      <FeatureGate flag="UPGRADE_CTA">
        <span>First child</span>
        <span>Second child</span>
      </FeatureGate>
    );

    expect(screen.getByText('First child')).toBeTruthy();
    expect(screen.getByText('Second child')).toBeTruthy();
  });
});
