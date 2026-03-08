/**
 * useChartTheme - Hook providing Recharts-compatible theme configuration.
 *
 * Reads CSS custom properties and returns a flat configuration object
 * with chart colors, text colors, grid colors, and tooltip styling.
 * Falls back to hardcoded defaults when CSS variables are not resolved
 * (e.g., in jsdom test environments).
 *
 * This hook is the single source of truth for all chart theming.
 * It builds on top of useTheme() to react to theme changes.
 *
 * @module useChartTheme
 */

import { useMemo } from 'react';
import { useTheme } from './useTheme';

// =============================================================================
// Fallback Defaults
// =============================================================================

/**
 * Fallback chart theme values used when getComputedStyle returns empty values.
 * Light values use deeper tones for white backgrounds.
 * Dark values use brighter tones for dark backgrounds.
 */
const FALLBACK_THEMES = {
  light: {
    chartColor1: '#0284c7',
    chartColor2: '#7c3aed',
    chartColor3: '#059669',
    chartColor4: '#ea580c',
    chartColor5: '#db2777',
    chartColor6: '#ca8a04',
    successColor: '#16a34a',
    dangerColor: '#dc2626',
    textColor: '#0f172a',
    textMutedColor: '#94a3b8',
    gridColor: '#e2e8f0',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
  },
  dark: {
    chartColor1: '#38bdf8',
    chartColor2: '#a78bfa',
    chartColor3: '#34d399',
    chartColor4: '#fb923c',
    chartColor5: '#f472b6',
    chartColor6: '#facc15',
    successColor: '#22c55e',
    dangerColor: '#ef4444',
    textColor: '#e2e8f0',
    textMutedColor: '#64748b',
    gridColor: '#334155',
    tooltipBg: '#243044',
    tooltipBorder: '#334155',
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Reads a CSS custom property value from the document root element.
 * @param {string} property - CSS property name (e.g. '--chart-1')
 * @returns {string} The trimmed value or empty string
 */
function getCSSProperty(property) {
  try {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(property)
      .trim();
  } catch {
    return '';
  }
}

// =============================================================================
// Hook
// =============================================================================

/**
 * useChartTheme provides a Recharts-compatible theme configuration object.
 *
 * Must be used within a ThemeProvider.
 *
 * @returns {{
 *   chartColor1: string,
 *   chartColor2: string,
 *   chartColor3: string,
 *   chartColor4: string,
 *   chartColor5: string,
 *   chartColor6: string,
 *   successColor: string,
 *   dangerColor: string,
 *   textColor: string,
 *   textMutedColor: string,
 *   gridColor: string,
 *   tooltipBg: string,
 *   tooltipBorder: string
 * }}
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();

  const chartTheme = useMemo(() => {
    const fallback = FALLBACK_THEMES[resolvedTheme] || FALLBACK_THEMES.light;

    return {
      chartColor1: getCSSProperty('--chart-1') || fallback.chartColor1,
      chartColor2: getCSSProperty('--chart-2') || fallback.chartColor2,
      chartColor3: getCSSProperty('--chart-3') || fallback.chartColor3,
      chartColor4: getCSSProperty('--chart-4') || fallback.chartColor4,
      chartColor5: getCSSProperty('--chart-5') || fallback.chartColor5,
      chartColor6: getCSSProperty('--chart-6') || fallback.chartColor6,
      successColor: getCSSProperty('--color-success') || fallback.successColor,
      dangerColor: getCSSProperty('--color-danger') || fallback.dangerColor,
      textColor: getCSSProperty('--color-text-primary') || fallback.textColor,
      textMutedColor: getCSSProperty('--color-text-muted') || fallback.textMutedColor,
      gridColor: getCSSProperty('--color-border') || fallback.gridColor,
      tooltipBg: getCSSProperty('--color-bg-tertiary') || fallback.tooltipBg,
      tooltipBorder: getCSSProperty('--color-border') || fallback.tooltipBorder,
    };
  }, [resolvedTheme]);

  return chartTheme;
}

export default useChartTheme;
