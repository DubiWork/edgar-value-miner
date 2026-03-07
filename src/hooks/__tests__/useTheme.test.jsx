import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { ThemeProvider } from '../../contexts/ThemeProvider';
import { setSystemTheme } from '../../test-setup';

/**
 * Wrapper component that provides ThemeProvider context.
 */
function wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('useTheme', () => {
  // UT-CTX-10: Throws error when used outside ThemeProvider
  it('throws error when used outside ThemeProvider', () => {
    // Suppress console.error from React for this expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  // UT-HOOK-01: Returns theme, resolvedTheme, setTheme, and chartColors
  it('returns the complete interface (theme, resolvedTheme, setTheme, chartColors)', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current).toHaveProperty('theme');
    expect(result.current).toHaveProperty('resolvedTheme');
    expect(result.current).toHaveProperty('setTheme');
    expect(result.current).toHaveProperty('chartColors');

    expect(typeof result.current.theme).toBe('string');
    expect(typeof result.current.resolvedTheme).toBe('string');
    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.chartColors).toBe('object');
  });

  // UT-HOOK-02: chartColors returns all 6 chart color keys
  it('chartColors returns all 6 chart color keys', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useTheme(), { wrapper });

    const { chartColors } = result.current;
    expect(chartColors).toHaveProperty('chart1');
    expect(chartColors).toHaveProperty('chart2');
    expect(chartColors).toHaveProperty('chart3');
    expect(chartColors).toHaveProperty('chart4');
    expect(chartColors).toHaveProperty('chart5');
    expect(chartColors).toHaveProperty('chart6');

    // All values should be non-empty strings
    Object.values(chartColors).forEach((color) => {
      expect(color).toBeTruthy();
      expect(typeof color).toBe('string');
    });
  });

  // UT-HOOK-03: chartColors returns correct fallback values for light theme
  it('chartColors returns light theme fallback values when getComputedStyle returns empty', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useTheme(), { wrapper });

    // jsdom getComputedStyle returns empty for CSS custom properties
    // so fallbacks should be used
    const { chartColors } = result.current;

    // These should be the light fallback values
    expect(chartColors.chart1).toBe('#0284c7');
    expect(chartColors.chart2).toBe('#7c3aed');
    expect(chartColors.chart3).toBe('#059669');
    expect(chartColors.chart4).toBe('#ea580c');
    expect(chartColors.chart5).toBe('#db2777');
    expect(chartColors.chart6).toBe('#ca8a04');
  });

  // UT-HOOK-04: chartColors updates when theme changes
  it('chartColors updates when theme changes from light to dark', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useTheme(), { wrapper });

    const lightColors = { ...result.current.chartColors };

    act(() => {
      result.current.setTheme('dark');
    });

    const darkColors = result.current.chartColors;

    // Dark fallback colors should differ from light fallback colors
    expect(darkColors.chart1).toBe('#38bdf8');
    expect(darkColors.chart1).not.toBe(lightColors.chart1);
  });

  // UT-HOOK-05: chartColors returns fallback values when getComputedStyle fails
  it('chartColors returns fallback values when getComputedStyle returns empty', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useTheme(), { wrapper });

    // In jsdom, getComputedStyle won't have our CSS variables,
    // so all values should be the fallback colors
    const { chartColors } = result.current;

    // None should be empty
    Object.values(chartColors).forEach((color) => {
      expect(color).not.toBe('');
      expect(color.startsWith('#')).toBe(true);
    });
  });

  it('setTheme updates the resolved theme', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.resolvedTheme).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('setTheme to system follows OS preference', () => {
    setSystemTheme(true); // OS prefers dark

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });
});
