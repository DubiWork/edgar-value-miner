import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartTheme } from '../useChartTheme';
import { useTheme } from '../useTheme';
import { ThemeProvider } from '../../contexts/ThemeProvider';
import { setSystemTheme } from '../../test-setup';

/**
 * Wrapper component that provides ThemeProvider context.
 */
function wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('useChartTheme', () => {
  // =========================================================================
  // Context requirement
  // =========================================================================

  it('throws error when used outside ThemeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useChartTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  // =========================================================================
  // Return shape
  // =========================================================================

  it('returns all expected chart theme properties', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    const expectedKeys = [
      'chartColor1',
      'chartColor2',
      'chartColor3',
      'chartColor4',
      'chartColor5',
      'chartColor6',
      'successColor',
      'dangerColor',
      'textColor',
      'textMutedColor',
      'gridColor',
      'tooltipBg',
      'tooltipBorder',
    ];

    expectedKeys.forEach((key) => {
      expect(result.current).toHaveProperty(key);
      expect(typeof result.current[key]).toBe('string');
      expect(result.current[key]).not.toBe('');
    });
  });

  it('returns exactly 13 properties', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    expect(Object.keys(result.current)).toHaveLength(13);
  });

  // =========================================================================
  // Light theme fallback values
  // =========================================================================

  it('returns light fallback chart colors when CSS variables are not resolved', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    expect(result.current.chartColor1).toBe('#0284c7');
    expect(result.current.chartColor2).toBe('#7c3aed');
    expect(result.current.chartColor3).toBe('#059669');
    expect(result.current.chartColor4).toBe('#ea580c');
    expect(result.current.chartColor5).toBe('#db2777');
    expect(result.current.chartColor6).toBe('#ca8a04');
  });

  it('returns light fallback text and grid colors', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    expect(result.current.textColor).toBe('#0f172a');
    expect(result.current.textMutedColor).toBe('#94a3b8');
    expect(result.current.gridColor).toBe('#e2e8f0');
  });

  it('returns light fallback tooltip colors', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    expect(result.current.tooltipBg).toBe('#ffffff');
    expect(result.current.tooltipBorder).toBe('#e2e8f0');
  });

  // =========================================================================
  // Dark theme fallback values
  // =========================================================================

  it('returns dark fallback chart colors when theme is dark', () => {
    setSystemTheme(false);

    const { result } = renderHook(
      () => {
        const theme = useTheme();
        const chartTheme = useChartTheme();
        return { ...theme, chartTheme };
      },
      { wrapper }
    );

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.chartTheme.chartColor1).toBe('#38bdf8');
    expect(result.current.chartTheme.chartColor2).toBe('#a78bfa');
    expect(result.current.chartTheme.chartColor3).toBe('#34d399');
    expect(result.current.chartTheme.chartColor4).toBe('#fb923c');
    expect(result.current.chartTheme.chartColor5).toBe('#f472b6');
    expect(result.current.chartTheme.chartColor6).toBe('#facc15');
  });

  it('returns dark fallback text and grid colors', () => {
    setSystemTheme(false);

    const { result } = renderHook(
      () => {
        const theme = useTheme();
        const chartTheme = useChartTheme();
        return { ...theme, chartTheme };
      },
      { wrapper }
    );

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.chartTheme.textColor).toBe('#e2e8f0');
    expect(result.current.chartTheme.textMutedColor).toBe('#64748b');
    expect(result.current.chartTheme.gridColor).toBe('#334155');
  });

  it('returns dark fallback tooltip colors', () => {
    setSystemTheme(false);

    const { result } = renderHook(
      () => {
        const theme = useTheme();
        const chartTheme = useChartTheme();
        return { ...theme, chartTheme };
      },
      { wrapper }
    );

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.chartTheme.tooltipBg).toBe('#243044');
    expect(result.current.chartTheme.tooltipBorder).toBe('#334155');
  });

  // =========================================================================
  // Theme switching
  // =========================================================================

  it('updates all colors when theme switches from light to dark', () => {
    setSystemTheme(false);

    const { result } = renderHook(
      () => {
        const theme = useTheme();
        const chartTheme = useChartTheme();
        return { ...theme, chartTheme };
      },
      { wrapper }
    );

    const lightColors = { ...result.current.chartTheme };

    act(() => {
      result.current.setTheme('dark');
    });

    const darkColors = result.current.chartTheme;

    // Chart colors should differ between themes
    expect(darkColors.chartColor1).not.toBe(lightColors.chartColor1);
    expect(darkColors.chartColor2).not.toBe(lightColors.chartColor2);

    // Text and grid colors should differ between themes
    expect(darkColors.textColor).not.toBe(lightColors.textColor);
    expect(darkColors.gridColor).not.toBe(lightColors.gridColor);
    expect(darkColors.tooltipBg).not.toBe(lightColors.tooltipBg);
  });

  it('updates colors when theme switches from dark back to light', () => {
    setSystemTheme(false);

    const { result } = renderHook(
      () => {
        const theme = useTheme();
        const chartTheme = useChartTheme();
        return { ...theme, chartTheme };
      },
      { wrapper }
    );

    act(() => {
      result.current.setTheme('dark');
    });

    act(() => {
      result.current.setTheme('light');
    });

    // Should be back to light theme values
    expect(result.current.chartTheme.chartColor1).toBe('#0284c7');
    expect(result.current.chartTheme.textColor).toBe('#0f172a');
    expect(result.current.chartTheme.tooltipBg).toBe('#ffffff');
  });

  // =========================================================================
  // System theme
  // =========================================================================

  it('uses dark colors when system prefers dark and theme is system', () => {
    setSystemTheme(true);

    const { result } = renderHook(
      () => {
        const theme = useTheme();
        const chartTheme = useChartTheme();
        return { ...theme, chartTheme };
      },
      { wrapper }
    );

    act(() => {
      result.current.setTheme('system');
    });

    // System prefers dark, so dark fallbacks should be used
    expect(result.current.chartTheme.chartColor1).toBe('#38bdf8');
    expect(result.current.chartTheme.textColor).toBe('#e2e8f0');
  });

  // =========================================================================
  // All values are valid hex colors
  // =========================================================================

  it('all returned values are valid hex color strings', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    Object.values(result.current).forEach((value) => {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  // =========================================================================
  // Reusability (no component-specific logic)
  // =========================================================================

  it('does not contain any component-specific properties', () => {
    setSystemTheme(false);

    const { result } = renderHook(() => useChartTheme(), { wrapper });

    const keys = Object.keys(result.current);

    // Should not have any revenue, margin, or component-specific keys
    keys.forEach((key) => {
      expect(key).not.toMatch(/revenue|margin|income|profit/i);
    });
  });

  // =========================================================================
  // Memoization stability
  // =========================================================================

  it('returns the same object reference when theme has not changed', () => {
    setSystemTheme(false);

    const { result, rerender } = renderHook(() => useChartTheme(), { wrapper });

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });
});
