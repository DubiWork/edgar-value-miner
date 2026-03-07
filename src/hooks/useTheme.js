import { useContext, useMemo } from 'react';
import { ThemeContext } from '../contexts/ThemeContext.js';

/**
 * Fallback chart colors used when getComputedStyle returns empty values.
 */
const FALLBACK_CHART_COLORS = {
  light: {
    chart1: '#0284c7',
    chart2: '#7c3aed',
    chart3: '#059669',
    chart4: '#ea580c',
    chart5: '#db2777',
    chart6: '#ca8a04',
  },
  dark: {
    chart1: '#38bdf8',
    chart2: '#a78bfa',
    chart3: '#34d399',
    chart4: '#fb923c',
    chart5: '#f472b6',
    chart6: '#facc15',
  },
};

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

/**
 * useTheme hook provides access to the current theme and chart colors.
 *
 * Must be used within a ThemeProvider.
 *
 * @returns {{
 *   theme: 'light' | 'dark' | 'system',
 *   resolvedTheme: 'light' | 'dark',
 *   setTheme: (theme: 'light' | 'dark' | 'system') => void,
 *   chartColors: { chart1: string, chart2: string, chart3: string, chart4: string, chart5: string, chart6: string }
 * }}
 */
export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  const { theme, resolvedTheme, setTheme } = context;

  const chartColors = useMemo(() => {
    const fallback = FALLBACK_CHART_COLORS[resolvedTheme] || FALLBACK_CHART_COLORS.light;

    return {
      chart1: getCSSProperty('--chart-1') || fallback.chart1,
      chart2: getCSSProperty('--chart-2') || fallback.chart2,
      chart3: getCSSProperty('--chart-3') || fallback.chart3,
      chart4: getCSSProperty('--chart-4') || fallback.chart4,
      chart5: getCSSProperty('--chart-5') || fallback.chart5,
      chart6: getCSSProperty('--chart-6') || fallback.chart6,
    };
  }, [resolvedTheme]);

  return { theme, resolvedTheme, setTheme, chartColors };
}

export default useTheme;
