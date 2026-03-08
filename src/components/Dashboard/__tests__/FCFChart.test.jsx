import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FCFChart } from '../FCFChart';
import { ThemeProvider } from '../../../contexts/ThemeProvider';
import { formatCurrency } from '../../../utils/formatCurrency';
import { calculateYoY } from '../../../utils/calculateYoY';

// =============================================================================
// Test Data
// =============================================================================

/** Standard 5-year positive FCF (Apple-like, most-recent-first from normalizer) */
const MOCK_FCF_5Y_POSITIVE = [
  { value: 110543000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 118254000000, capitalExpenditures: 10671000000 } },
  { value: 111443000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 122151000000, capitalExpenditures: 10708000000 } },
  { value: 92953000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 104038000000, capitalExpenditures: 11085000000 } },
  { value: 73365000000, fiscalYear: 2020, period: 'CY2020', calculated: true, components: { operatingCashFlow: 80674000000, capitalExpenditures: 7309000000 } },
  { value: 92953000000, fiscalYear: 2019, period: 'CY2019', calculated: true, components: { operatingCashFlow: 69391000000, capitalExpenditures: 10495000000 } },
];

/** Mixed positive/negative FCF */
const MOCK_FCF_MIXED = [
  { value: 42000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 52000000000, capitalExpenditures: 10000000000 } },
  { value: 25000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 35000000000, capitalExpenditures: 10000000000 } },
  { value: -3000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 12000000000, capitalExpenditures: 15000000000 } },
  { value: 8000000000, fiscalYear: 2020, period: 'CY2020', calculated: true, components: { operatingCashFlow: 18000000000, capitalExpenditures: 10000000000 } },
  { value: -15000000000, fiscalYear: 2019, period: 'CY2019', calculated: true, components: { operatingCashFlow: 5000000000, capitalExpenditures: 20000000000 } },
];

/** All negative FCF */
const MOCK_FCF_ALL_NEGATIVE = [
  { value: -20000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 25000000000, capitalExpenditures: 45000000000 } },
  { value: -30000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 20000000000, capitalExpenditures: 50000000000 } },
  { value: -50000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 10000000000, capitalExpenditures: 60000000000 } },
];

/** FCF data without components */
const MOCK_FCF_NO_COMPONENTS = [
  { value: 60000000000, fiscalYear: 2023, period: 'CY2023', calculated: true },
  { value: 50000000000, fiscalYear: 2022, period: 'CY2022', calculated: true },
];

/** 3-year FCF dataset */
const MOCK_FCF_3Y = [
  { value: 150000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 170000000000, capitalExpenditures: 20000000000 } },
  { value: 120000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 140000000000, capitalExpenditures: 20000000000 } },
  { value: 100000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
];

/** 2-year FCF dataset */
const MOCK_FCF_2Y = [
  { value: 120000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 140000000000, capitalExpenditures: 20000000000 } },
  { value: 100000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
];

/** Single year */
const MOCK_FCF_1Y = [
  { value: 50000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 60000000000, capitalExpenditures: 10000000000 } },
];

/** 7-year dataset (tests slicing to 5) */
const MOCK_FCF_7Y = [
  { value: 130000000000, fiscalYear: 2025, period: 'CY2025', calculated: true, components: { operatingCashFlow: 150000000000, capitalExpenditures: 20000000000 } },
  { value: 120000000000, fiscalYear: 2024, period: 'CY2024', calculated: true, components: { operatingCashFlow: 140000000000, capitalExpenditures: 20000000000 } },
  { value: 110000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 130000000000, capitalExpenditures: 20000000000 } },
  { value: 100000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
  { value: 90000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 110000000000, capitalExpenditures: 20000000000 } },
  { value: 80000000000, fiscalYear: 2020, period: 'CY2020', calculated: true, components: { operatingCashFlow: 100000000000, capitalExpenditures: 20000000000 } },
  { value: 70000000000, fiscalYear: 2019, period: 'CY2019', calculated: true, components: { operatingCashFlow: 90000000000, capitalExpenditures: 20000000000 } },
];

/** Zero FCF */
const MOCK_FCF_ZERO = [
  { value: 0, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 10000000000, capitalExpenditures: 10000000000 } },
  { value: 0, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 5000000000, capitalExpenditures: 5000000000 } },
];

/** Very large (trillion-scale) FCF */
const MOCK_FCF_TRILLION = [
  { value: 1200000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 1500000000000, capitalExpenditures: 300000000000 } },
  { value: 1000000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 1300000000000, capitalExpenditures: 300000000000 } },
];

/** Very small (thousands-range) FCF */
const MOCK_FCF_SMALL = [
  { value: 5000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 8000, capitalExpenditures: 3000 } },
  { value: 3000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 6000, capitalExpenditures: 3000 } },
];

/** Dataset with invalid entries */
const MOCK_FCF_WITH_INVALID = [
  { value: 100000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
  { value: NaN, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 90000000000, capitalExpenditures: 10000000000 } },
  { value: 80000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 100000000000, capitalExpenditures: 20000000000 } },
  null,
  { value: Infinity, fiscalYear: 2019, period: 'CY2019', calculated: true, components: { operatingCashFlow: 70000000000, capitalExpenditures: 15000000000 } },
];

/** Both-negative improving: -$50B to -$20B (+60.0% improvement) */
const MOCK_FCF_NEGATIVE_IMPROVING = [
  { value: -20000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 25000000000, capitalExpenditures: 45000000000 } },
  { value: -50000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 10000000000, capitalExpenditures: 60000000000 } },
];

/** Both-negative worsening: -$20B to -$50B */
const MOCK_FCF_NEGATIVE_WORSENING = [
  { value: -50000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 10000000000, capitalExpenditures: 60000000000 } },
  { value: -20000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 25000000000, capitalExpenditures: 45000000000 } },
];

/** Partial components data (some have components, some do not) */
const MOCK_FCF_PARTIAL_COMPONENTS = [
  { value: 60000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 80000000000, capitalExpenditures: 20000000000 } },
  { value: 50000000000, fiscalYear: 2022, period: 'CY2022', calculated: true },
  { value: 40000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 55000000000, capitalExpenditures: 15000000000 } },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Renders FCFChart wrapped in ThemeProvider.
 * Animations are disabled by default for test stability.
 */
function renderChart(props = {}) {
  return render(
    <ThemeProvider>
      <FCFChart animationDisabled {...props} />
    </ThemeProvider>,
  );
}

/**
 * Renders FCFChart inside ThemeProvider with initial dark mode.
 */
function renderChartDark(props = {}) {
  window.localStorage.setItem('theme', 'dark');
  return render(
    <ThemeProvider>
      <FCFChart animationDisabled {...props} />
    </ThemeProvider>,
  );
}

/**
 * Gets all accessible data table rows from the rendered chart.
 */
function getTableRows(container) {
  const table = container.querySelector('table');
  return table ? table.querySelectorAll('tbody tr') : [];
}

/**
 * Gets the year label text from a specific table row index.
 */
function getYearFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[0].textContent;
}

/**
 * Gets the FCF value text from a specific table row index.
 */
function getFCFFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[1].textContent;
}

/**
 * Gets the Operating Cash Flow text from a specific table row index.
 */
function getOCFFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[2].textContent;
}

/**
 * Gets the CapEx text from a specific table row index.
 */
function getCapExFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[3].textContent;
}

/**
 * Gets the YoY text from a specific table row index.
 */
function getYoYFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[4].textContent;
}

// =============================================================================
// Tests
// =============================================================================

describe('FCFChart', () => {
  beforeEach(() => {
    cleanup();
  });

  // =========================================================================
  // Basic Rendering
  // =========================================================================

  describe('Basic rendering', () => {
    it('renders without crashing with valid 5-year data', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders with data-testid="fcf-chart" on container', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container).toBeTruthy();
    });

    it('has descriptive aria-label on container', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.getAttribute('aria-label')).toBe(
        'Free cash flow chart showing annual FCF',
      );
    });

    it('applies custom className prop', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE, className: 'my-custom-class' });
      const container = screen.getByTestId('fcf-chart');
      expect(container.classList.contains('my-custom-class')).toBe(true);
    });

    it('applies base fcf-chart class', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.classList.contains('fcf-chart')).toBe(true);
    });

    it('renders with 3-year partial data', () => {
      renderChart({ data: MOCK_FCF_3Y });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders with single year of data', () => {
      renderChart({ data: MOCK_FCF_1Y });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders with exactly 2 years of data', () => {
      renderChart({ data: MOCK_FCF_2Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('className is trimmed when no custom class provided', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.className).toBe('fcf-chart');
    });
  });

  // =========================================================================
  // Dual-Color Bar Tests
  // =========================================================================

  describe('Dual-color bars', () => {
    it('all positive values get success color fill (green)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      // Recharts renders Bar cells as SVG paths with fill attribute
      // With useChartTheme, positive values get light fallback successColor
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      paths.forEach((path) => {
        // In jsdom, useChartTheme returns light fallback successColor '#16a34a'
        expect(path.getAttribute('fill')).toBe('#16a34a');
      });
    });

    it('all negative values get danger color fill (red)', () => {
      renderChart({ data: MOCK_FCF_ALL_NEGATIVE });
      const container = screen.getByTestId('fcf-chart');
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      paths.forEach((path) => {
        expect(path.getAttribute('fill')).toBe('#dc2626');
      });
    });

    it('mixed positive/negative values get correct per-bar colors', () => {
      renderChart({ data: MOCK_FCF_MIXED });
      const container = screen.getByTestId('fcf-chart');
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      // Data reversed to chronological: 2019(-15B), 2020(+8B), 2021(-3B), 2022(+25B), 2023(+42B)
      // Expected fills: danger, success, danger, success, success
      const expectedFills = ['#dc2626', '#16a34a', '#dc2626', '#16a34a', '#16a34a'];
      paths.forEach((path, idx) => {
        expect(path.getAttribute('fill')).toBe(expectedFills[idx]);
      });
    });

    it('zero FCF uses success color (non-negative convention)', () => {
      renderChart({ data: MOCK_FCF_ZERO });
      const container = screen.getByTestId('fcf-chart');
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      paths.forEach((path) => {
        // value >= 0 uses successColor
        expect(path.getAttribute('fill')).toBe('#16a34a');
      });
    });

    it('renders ReferenceLine at y=0 when negative values exist', () => {
      renderChart({ data: MOCK_FCF_MIXED });
      const container = screen.getByTestId('fcf-chart');
      // ReferenceLine renders as an element in recharts-reference-line class
      const referenceLine = container.querySelector('.recharts-reference-line');
      expect(referenceLine).toBeTruthy();
    });

    it('does not render ReferenceLine when all values are positive', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const referenceLine = container.querySelector('.recharts-reference-line');
      expect(referenceLine).toBeNull();
    });

    it('all negative data renders chart without crashing (ReferenceLine expected)', () => {
      renderChart({ data: MOCK_FCF_ALL_NEGATIVE });
      const container = screen.getByTestId('fcf-chart');
      // All negative data should still render the chart with bars
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      expect(paths.length).toBe(3);
      // All bars should use danger color
      paths.forEach((path) => {
        expect(path.getAttribute('fill')).toBe('#dc2626');
      });
    });

    it('renders correct number of bar shapes for 5-year data', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      expect(paths.length).toBe(5);
    });
  });

  // =========================================================================
  // Tooltip Breakdown Tests
  // =========================================================================

  describe('Tooltip configuration', () => {
    it('Recharts Tooltip component is present in chart', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const tooltipWrapper = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipWrapper).toBeTruthy();
    });

    it('does not render tooltip for empty data', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('fcf-chart');
      const tooltipWrapper = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipWrapper).toBeNull();
    });

    it('chart with components data renders tooltip wrapper', () => {
      renderChart({ data: MOCK_FCF_3Y });
      const container = screen.getByTestId('fcf-chart');
      const tooltipWrapper = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipWrapper).toBeTruthy();
    });

    it('chart with mixed data renders tooltip wrapper', () => {
      renderChart({ data: MOCK_FCF_MIXED });
      const container = screen.getByTestId('fcf-chart');
      const tooltipWrapper = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipWrapper).toBeTruthy();
    });

    it('formatCurrency formats positive FCF correctly for tooltip display', () => {
      expect(formatCurrency(110543000000)).toBe('$110.5B');
    });

    it('formatCurrency formats negative FCF with accounting parentheses for tooltip', () => {
      expect(formatCurrency(-15000000000)).toBe('($15.0B)');
    });

    it('formatCurrency formats OCF correctly for tooltip display', () => {
      expect(formatCurrency(118254000000)).toBe('$118.3B');
    });

    it('formatCurrency formats CapEx correctly for tooltip display', () => {
      expect(formatCurrency(10671000000)).toBe('$10.7B');
    });
  });

  // =========================================================================
  // YoY Growth Label Tests
  // =========================================================================

  describe('YoY growth calculation', () => {
    it('displays YoY growth for all years except first', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
      for (let i = 1; i < rows.length; i++) {
        const yoy = getYoYFromRow(rows, i);
        expect(yoy).not.toBe('N/A');
      }
    });

    it('standard positive YoY is calculated correctly', () => {
      // 3Y data: 2021($100B), 2022($120B), 2023($150B) chronological
      // 2022 YoY: (120-100)/100 = +20.0%
      renderChart({ data: MOCK_FCF_3Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(getYoYFromRow(rows, 1)).toBe('+20.0%');
    });

    it('negative-to-positive sign change shows N/A', () => {
      // MOCK_FCF_MIXED chronological: 2019(-15B), 2020(+8B), ...
      // 2020 YoY: sign change -> N/A
      renderChart({ data: MOCK_FCF_MIXED });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // Row 1 = FY2020 (was -15B in 2019, now +8B) -> sign change -> N/A
      expect(getYoYFromRow(rows, 1)).toBe('N/A');
    });

    it('positive-to-negative sign change shows N/A', () => {
      // MOCK_FCF_MIXED chronological: 2019(-15B), 2020(+8B), 2021(-3B), ...
      // 2021 YoY: +8B to -3B sign change -> N/A
      renderChart({ data: MOCK_FCF_MIXED });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // Row 2 = FY2021 (was +8B in 2020, now -3B) -> sign change -> N/A
      expect(getYoYFromRow(rows, 2)).toBe('N/A');
    });

    it('both-negative improving shows positive percentage', () => {
      // -50B to -20B: ((-20)-(-50))/|-50| = 30/50 = +60.0%
      renderChart({ data: MOCK_FCF_NEGATIVE_IMPROVING });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(getYoYFromRow(rows, 1)).toBe('+60.0%');
    });

    it('both-negative worsening shows negative percentage', () => {
      // -20B to -50B: ((-50)-(-20))/|-20| = -30/20 = -150.0%
      renderChart({ data: MOCK_FCF_NEGATIVE_WORSENING });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(getYoYFromRow(rows, 1)).toBe('-150.0%');
    });

    it('zero-to-positive transition shows N/A', () => {
      const data = [
        { value: 50000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 60000000000, capitalExpenditures: 10000000000 } },
        { value: 0, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 10000000000, capitalExpenditures: 10000000000 } },
      ];
      renderChart({ data });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // 0 to 50B: hasSignChange(50B, 0) => true => N/A
      expect(getYoYFromRow(rows, 1)).toBe('N/A');
    });

    it('single year data shows only N/A for YoY', () => {
      renderChart({ data: MOCK_FCF_1Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(1);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
    });

    it('two years of data produces exactly 1 YoY label', () => {
      renderChart({ data: MOCK_FCF_2Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
      expect(getYoYFromRow(rows, 1)).toBe('+20.0%');
    });

    it('YoY formatted with 1 decimal place', () => {
      renderChart({ data: MOCK_FCF_3Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      const yoy = getYoYFromRow(rows, 1);
      expect(yoy).toMatch(/^[+-]?\d+\.\d%$/);
    });
  });

  // =========================================================================
  // Empty State & Error Handling
  // =========================================================================

  describe('Empty state', () => {
    it('shows empty state when data is null', () => {
      renderChart({ data: null });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
      expect(screen.getByText('No free cash flow data available')).toBeTruthy();
    });

    it('shows empty state when data is undefined', () => {
      renderChart({ data: undefined });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
      expect(screen.getByText('No free cash flow data available')).toBeTruthy();
    });

    it('shows empty state when data is empty array', () => {
      renderChart({ data: [] });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
      expect(screen.getByText('No free cash flow data available')).toBeTruthy();
    });

    it('empty state has role="status" for accessibility', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('fcf-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
    });

    it('empty state renders an icon (SVG)', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('fcf-chart-empty');
      const svg = emptyState.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('empty state icon has aria-hidden="true"', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('fcf-chart-empty');
      const svg = emptyState.querySelector('svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    });

    it('empty state still has the main container with aria-label', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('fcf-chart');
      expect(container.getAttribute('aria-label')).toBe(
        'Free cash flow chart showing annual FCF',
      );
    });

    it('empty state does not render sr-only data table', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('fcf-chart');
      const table = container.querySelector('table');
      expect(table).toBeNull();
    });

    it('renders empty state when all entries are invalid', () => {
      const allInvalid = [
        { value: NaN, fiscalYear: 2023, period: 'CY2023' },
        { value: Infinity, fiscalYear: 2022, period: 'CY2022' },
        null,
      ];
      renderChart({ data: allInvalid });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
    });

    it('shows CapEx unavailable message when all entries lack components', () => {
      renderChart({ data: MOCK_FCF_NO_COMPONENTS });
      expect(screen.getByText('Capital expenditure data unavailable for FCF breakdown')).toBeTruthy();
    });

    it('CapEx unavailable state still has accessible data table', () => {
      renderChart({ data: MOCK_FCF_NO_COMPONENTS });
      const container = screen.getByTestId('fcf-chart');
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  // =========================================================================
  // Theme Integration
  // =========================================================================

  describe('Theme integration', () => {
    it('renders with default light theme', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('renders with dark theme without crashing', () => {
      renderChartDark({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('axis labels are present in both themes', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      let container = screen.getByTestId('fcf-chart');
      expect(container.querySelector('.recharts-xAxis')).toBeTruthy();
      expect(container.querySelector('.recharts-yAxis')).toBeTruthy();
      cleanup();

      renderChartDark({ data: MOCK_FCF_5Y_POSITIVE });
      container = screen.getByTestId('fcf-chart');
      expect(container.querySelector('.recharts-xAxis')).toBeTruthy();
      expect(container.querySelector('.recharts-yAxis')).toBeTruthy();
    });

    it('structure remains identical across themes', () => {
      renderChart({ data: MOCK_FCF_3Y });
      let container = screen.getByTestId('fcf-chart');
      const lightRows = getTableRows(container);
      const lightData = Array.from(lightRows).map((r) => r.textContent);
      cleanup();

      renderChartDark({ data: MOCK_FCF_3Y });
      container = screen.getByTestId('fcf-chart');
      const darkRows = getTableRows(container);
      const darkData = Array.from(darkRows).map((r) => r.textContent);

      expect(lightData).toEqual(darkData);
    });

    it('dark theme uses dark fallback colors for bar fills', () => {
      renderChartDark({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const paths = container.querySelectorAll('.recharts-bar-rectangle path');
      // Dark theme fallback successColor is '#22c55e'
      paths.forEach((path) => {
        expect(path.getAttribute('fill')).toBe('#22c55e');
      });
    });
  });

  // =========================================================================
  // Accessibility
  // =========================================================================

  describe('Accessibility', () => {
    it('chart container has descriptive aria-label', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.getAttribute('aria-label')).toContain('Free cash flow chart');
    });

    it('renders a visually hidden table with sr-only class', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const table = container.querySelector('table.sr-only');
      expect(table).toBeTruthy();
    });

    it('table has descriptive caption', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const caption = container.querySelector('table caption');
      expect(caption).toBeTruthy();
      expect(caption.textContent).toBe('Annual free cash flow data');
    });

    it('table has 5 column headers: Year, FCF, OCF, CapEx, YoY', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const headers = container.querySelectorAll('table th');
      expect(headers.length).toBe(5);
      expect(headers[0].textContent).toBe('Year');
      expect(headers[1].textContent).toBe('Free Cash Flow');
      expect(headers[2].textContent).toBe('Operating Cash Flow');
      expect(headers[3].textContent).toBe('Capital Expenditures');
      expect(headers[4].textContent).toBe('YoY Growth');
    });

    it('table headers use scope="col" for proper association', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const headers = container.querySelectorAll('table th[scope="col"]');
      expect(headers.length).toBe(5);
    });

    it('empty state message is accessible with role="status"', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('fcf-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
      expect(emptyState.textContent).toContain('No free cash flow data available');
    });

    it('no tab trap in chart (no tabindex on chart container)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.getAttribute('tabindex')).toBeNull();
    });

    it('empty state icon is decorative (aria-hidden)', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('fcf-chart-empty');
      const icon = emptyState.querySelector('svg');
      expect(icon).toBeTruthy();
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // =========================================================================
  // Accessible Data Table Values
  // =========================================================================

  describe('Accessible data table', () => {
    it('table rows display data in chronological order (oldest first)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
      expect(getYearFromRow(rows, 0)).toBe('FY2019');
      expect(getYearFromRow(rows, 1)).toBe('FY2020');
      expect(getYearFromRow(rows, 2)).toBe('FY2021');
      expect(getYearFromRow(rows, 3)).toBe('FY2022');
      expect(getYearFromRow(rows, 4)).toBe('FY2023');
    });

    it('table first row YoY shows N/A (no prior year)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
    });

    it('table includes formatted FCF values (billions)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // 2019 FCF: $92,953,000,000 -> "$93.0B"
      expect(getFCFFromRow(rows, 0)).toBe('$93.0B');
    });

    it('table includes formatted OCF values', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // 2019 OCF: $69,391,000,000 -> "$69.4B"
      expect(getOCFFromRow(rows, 0)).toBe('$69.4B');
    });

    it('table includes formatted CapEx values (absolute)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // 2019 CapEx: $10,495,000,000 -> "$10.5B"
      expect(getCapExFromRow(rows, 0)).toBe('$10.5B');
    });

    it('table shows N/A for OCF and CapEx when components missing', () => {
      renderChart({ data: MOCK_FCF_PARTIAL_COMPONENTS });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // Row index 1 = FY2022 (no components)
      expect(getOCFFromRow(rows, 1)).toBe('N/A');
      expect(getCapExFromRow(rows, 1)).toBe('N/A');
    });

    it('table includes negative FCF with accounting parens', () => {
      renderChart({ data: MOCK_FCF_ALL_NEGATIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // 2021 FCF: -50B -> "($50.0B)"
      expect(getFCFFromRow(rows, 0)).toBe('($50.0B)');
    });

    it('table row count matches number of valid data points', () => {
      renderChart({ data: MOCK_FCF_WITH_INVALID });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // Only 2 valid: 100B (2023) and 80B (2021)
      expect(rows.length).toBe(2);
    });
  });

  // =========================================================================
  // Data Slicing (max 5 years)
  // =========================================================================

  describe('Data slicing', () => {
    it('slices data to most recent 5 years when more than 5 provided', () => {
      renderChart({ data: MOCK_FCF_7Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });

    it('includes the most recent 5 years, not oldest 5', () => {
      renderChart({ data: MOCK_FCF_7Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      // Most recent 5 from [2025,2024,2023,2022,2021,2020,2019] = [2025,2024,2023,2022,2021]
      // Reversed to chronological: 2021,2022,2023,2024,2025
      expect(getYearFromRow(rows, 0)).toBe('FY2021');
      expect(getYearFromRow(rows, 4)).toBe('FY2025');
    });

    it('displays all years when exactly 5 provided', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });

    it('displays all years when fewer than 5 provided', () => {
      renderChart({ data: MOCK_FCF_3Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
    });
  });

  // =========================================================================
  // Invalid Data Filtering
  // =========================================================================

  describe('Invalid data filtering', () => {
    it('filters out NaN, Infinity, and null entries', () => {
      renderChart({ data: MOCK_FCF_WITH_INVALID });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('handles null entries scattered in array', () => {
      const withNulls = [
        { value: 200000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 220000000000, capitalExpenditures: 20000000000 } },
        null,
        null,
        { value: 150000000000, fiscalYear: 2020, period: 'CY2020', calculated: true, components: { operatingCashFlow: 170000000000, capitalExpenditures: 20000000000 } },
      ];
      renderChart({ data: withNulls });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('handles entries missing the value field', () => {
      const missingValue = [
        { fiscalYear: 2023, period: 'CY2023', calculated: true },
        { value: 100000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
      ];
      renderChart({ data: missingValue });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(1);
    });
  });

  // =========================================================================
  // Chart SVG Rendering
  // =========================================================================

  describe('Chart SVG rendering', () => {
    it('renders a Recharts BarChart SVG element', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('renders X-axis', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.querySelector('.recharts-xAxis')).toBeTruthy();
    });

    it('renders Y-axis', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.querySelector('.recharts-yAxis')).toBeTruthy();
    });

    it('renders CartesianGrid', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.querySelector('.recharts-cartesian-grid')).toBeTruthy();
    });

    it('renders horizontal grid lines only (vertical=false)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      const grid = container.querySelector('.recharts-cartesian-grid');
      expect(grid).toBeTruthy();
      expect(grid.querySelector('.recharts-cartesian-grid-horizontal')).toBeTruthy();
    });

    it('does not render chart SVG for empty data', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('fcf-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeNull();
    });

    it('renders a ResponsiveContainer wrapper', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      const container = screen.getByTestId('fcf-chart');
      expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
    });
  });

  // =========================================================================
  // Animation Control
  // =========================================================================

  describe('Animation control', () => {
    it('accepts animationDisabled prop and renders correctly', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE, animationDisabled: true });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders when animationDisabled is false', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE, animationDisabled: false });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders identically regardless of animation state', () => {
      const { unmount } = renderChart({ data: MOCK_FCF_3Y, animationDisabled: true });
      const container1 = screen.getByTestId('fcf-chart');
      const rows1 = getTableRows(container1);
      const data1 = Array.from(rows1).map((r) => r.textContent);
      unmount();

      renderChart({ data: MOCK_FCF_3Y, animationDisabled: false });
      const container2 = screen.getByTestId('fcf-chart');
      const rows2 = getTableRows(container2);
      const data2 = Array.from(rows2).map((r) => r.textContent);

      expect(data1).toEqual(data2);
    });
  });

  // =========================================================================
  // Height Prop
  // =========================================================================

  describe('Height prop', () => {
    it('accepts a custom height prop', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE, height: 400 });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders without explicit height (uses default)', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders with very small height', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE, height: 100 });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });

    it('renders with large height', () => {
      renderChart({ data: MOCK_FCF_5Y_POSITIVE, height: 600 });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge cases', () => {
    it('handles very large FCF values (trillion-scale)', () => {
      renderChart({ data: MOCK_FCF_TRILLION });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
      // $1,200,000,000,000 -> "$1200.0B"
      expect(getFCFFromRow(rows, 1)).toBe('$1200.0B');
    });

    it('handles very small FCF values (thousands)', () => {
      renderChart({ data: MOCK_FCF_SMALL });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
      expect(getFCFFromRow(rows, 0)).toBe('$3.0K');
      expect(getFCFFromRow(rows, 1)).toBe('$5.0K');
    });

    it('handles data spanning multiple orders of magnitude', () => {
      const spanning = [
        { value: 500000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 600000000, capitalExpenditures: 100000000 } },
        { value: 5000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 8000000, capitalExpenditures: 3000000 } },
        { value: 50000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 80000, capitalExpenditures: 30000 } },
      ];
      renderChart({ data: spanning });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      expect(getFCFFromRow(rows, 0)).toBe('$50.0K');
      expect(getFCFFromRow(rows, 1)).toBe('$5.0M');
      expect(getFCFFromRow(rows, 2)).toBe('$500.0M');
    });

    it('handles zero FCF in middle of data', () => {
      const withZero = [
        { value: 100000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
        { value: 0, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 10000000000, capitalExpenditures: 10000000000 } },
        { value: 80000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 100000000000, capitalExpenditures: 20000000000 } },
      ];
      renderChart({ data: withZero });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      expect(getFCFFromRow(rows, 1)).toBe('$0');
    });

    it('handles data with extra fields gracefully', () => {
      const dataWithExtras = [
        {
          value: 100000000000,
          fiscalYear: 2023,
          period: 'CY2023',
          calculated: true,
          filedDate: '2024-01-01',
          form: '10-K',
          components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 },
        },
        {
          value: 80000000000,
          fiscalYear: 2022,
          period: 'CY2022',
          calculated: true,
          filedDate: '2023-01-01',
          components: { operatingCashFlow: 100000000000, capitalExpenditures: 20000000000 },
        },
      ];
      renderChart({ data: dataWithExtras });
      expect(screen.getByTestId('fcf-chart')).toBeTruthy();
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('does not crash with non-array data (string)', () => {
      renderChart({ data: 'not-an-array' });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
    });

    it('does not crash with object data', () => {
      renderChart({ data: { value: 100 } });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
    });

    it('does not crash with number data', () => {
      renderChart({ data: 42 });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
    });

    it('does not crash with boolean data', () => {
      renderChart({ data: true });
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
    });

    it('handles mixed valid and invalid entries', () => {
      renderChart({ data: MOCK_FCF_WITH_INVALID });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('renders chronological order from most-recent-first input', () => {
      renderChart({ data: MOCK_FCF_3Y });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(getYearFromRow(rows, 0)).toBe('FY2021');
      expect(getYearFromRow(rows, 1)).toBe('FY2022');
      expect(getYearFromRow(rows, 2)).toBe('FY2023');
    });

    it('handles partial components (some entries with, some without)', () => {
      renderChart({ data: MOCK_FCF_PARTIAL_COMPONENTS });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      // Entry with components: real values
      expect(getOCFFromRow(rows, 0)).toBe('$55.0B');
      // Entry without components: N/A
      expect(getOCFFromRow(rows, 1)).toBe('N/A');
      // Entry with components: real values
      expect(getOCFFromRow(rows, 2)).toBe('$80.0B');
    });

    it('handles all-identical positive FCF values', () => {
      const identical = [
        { value: 100000000000, fiscalYear: 2023, period: 'CY2023', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
        { value: 100000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
        { value: 100000000000, fiscalYear: 2021, period: 'CY2021', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
      ];
      renderChart({ data: identical });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      for (let i = 0; i < rows.length; i++) {
        expect(getFCFFromRow(rows, i)).toBe('$100.0B');
      }
      // Identical values: YoY should be 0.0%
      expect(getYoYFromRow(rows, 1)).toBe('0.0%');
      expect(getYoYFromRow(rows, 2)).toBe('0.0%');
    });

    it('handles entries with missing fiscalYear field', () => {
      const missingYear = [
        { value: 100000000000, period: 'CY2023', calculated: true, components: { operatingCashFlow: 120000000000, capitalExpenditures: 20000000000 } },
        { value: 80000000000, fiscalYear: 2022, period: 'CY2022', calculated: true, components: { operatingCashFlow: 100000000000, capitalExpenditures: 20000000000 } },
      ];
      renderChart({ data: missingYear });
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });
  });

  // =========================================================================
  // PropTypes validation
  // =========================================================================

  describe('PropTypes validation', () => {
    it('component has PropTypes defined', () => {
      expect(FCFChart.propTypes).toBeDefined();
      expect(FCFChart.propTypes.data).toBeDefined();
      expect(FCFChart.propTypes.className).toBeDefined();
      expect(FCFChart.propTypes.height).toBeDefined();
      expect(FCFChart.propTypes.animationDisabled).toBeDefined();
    });
  });

  // =========================================================================
  // Console cleanliness
  // =========================================================================

  describe('Console cleanliness', () => {
    it('renders without console errors for valid data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console errors for null data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: null });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console errors for empty array data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: [] });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console warnings for valid data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console errors for mixed data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_FCF_MIXED });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console errors for edge case data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_FCF_WITH_INVALID });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // Data update behavior
  // =========================================================================

  describe('Data update behavior', () => {
    it('updates chart when data prop changes', () => {
      const { rerender } = render(
        <ThemeProvider>
          <FCFChart animationDisabled data={MOCK_FCF_3Y} />
        </ThemeProvider>,
      );
      let container = screen.getByTestId('fcf-chart');
      let rows = getTableRows(container);
      expect(rows.length).toBe(3);

      rerender(
        <ThemeProvider>
          <FCFChart animationDisabled data={MOCK_FCF_5Y_POSITIVE} />
        </ThemeProvider>,
      );
      container = screen.getByTestId('fcf-chart');
      rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });

    it('transitions from data to empty state correctly', () => {
      const { rerender } = render(
        <ThemeProvider>
          <FCFChart animationDisabled data={MOCK_FCF_5Y_POSITIVE} />
        </ThemeProvider>,
      );
      expect(screen.queryByTestId('fcf-chart-empty')).toBeNull();

      rerender(
        <ThemeProvider>
          <FCFChart animationDisabled data={null} />
        </ThemeProvider>,
      );
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();
    });

    it('transitions from empty to data state correctly', () => {
      const { rerender } = render(
        <ThemeProvider>
          <FCFChart animationDisabled data={null} />
        </ThemeProvider>,
      );
      expect(screen.getByTestId('fcf-chart-empty')).toBeTruthy();

      rerender(
        <ThemeProvider>
          <FCFChart animationDisabled data={MOCK_FCF_5Y_POSITIVE} />
        </ThemeProvider>,
      );
      expect(screen.queryByTestId('fcf-chart-empty')).toBeNull();
      const container = screen.getByTestId('fcf-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });
  });

  // =========================================================================
  // calculateYoY utility validation
  // =========================================================================

  describe('calculateYoY utility', () => {
    it('returns positive percentage for growth', () => {
      const result = calculateYoY(120000000000, 100000000000);
      expect(result.percentage).toBe(20);
      expect(result.formatted).toBe('+20.0%');
    });

    it('returns negative percentage for decline', () => {
      const result = calculateYoY(80000000000, 100000000000);
      expect(result.percentage).toBe(-20);
      expect(result.formatted).toBe('-20.0%');
    });

    it('returns zero for identical values', () => {
      const result = calculateYoY(100000000000, 100000000000);
      expect(result.percentage).toBe(0);
      expect(result.formatted).toBe('0.0%');
    });

    it('returns N/A when previous value is zero', () => {
      const result = calculateYoY(50000000, 0);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('handles negative-to-negative improvement correctly', () => {
      // -50B to -20B: ((-20)-(-50))/|-50| = 30/50 = +60%
      const result = calculateYoY(-20000000000, -50000000000);
      expect(result.percentage).toBe(60);
      expect(result.formatted).toBe('+60.0%');
    });

    it('handles negative-to-negative worsening correctly', () => {
      // -20B to -50B: ((-50)-(-20))/|-20| = -30/20 = -150%
      const result = calculateYoY(-50000000000, -20000000000);
      expect(result.percentage).toBe(-150);
      expect(result.formatted).toBe('-150.0%');
    });
  });

  // =========================================================================
  // Snapshot tests
  // =========================================================================

  describe('Snapshot tests', () => {
    it('matches snapshot for 5-year positive data', () => {
      const { container } = renderChart({ data: MOCK_FCF_5Y_POSITIVE });
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for empty state', () => {
      const { container } = renderChart({ data: null });
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for mixed positive/negative data', () => {
      const { container } = renderChart({ data: MOCK_FCF_MIXED });
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
