import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RevenueChart } from '../RevenueChart';
import { ThemeProvider } from '../../../contexts/ThemeProvider';
import { formatCurrency } from '../../../utils/formatCurrency';
import { calculateYoY } from '../../../utils/calculateYoY';

// =============================================================================
// Test Data (from ISSUE_5_TEST_PLAN.md section 10)
// =============================================================================

/** Standard 5-year Apple-like dataset (most-recent-first from normalizer) */
const MOCK_REVENUE_5Y = [
  { value: 383285000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 394328000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 365817000000, fiscalYear: 2021, period: 'CY2021' },
  { value: 274515000000, fiscalYear: 2020, period: 'CY2020' },
  { value: 260174000000, fiscalYear: 2019, period: 'CY2019' },
];

/** 3-year partial dataset */
const MOCK_REVENUE_3Y = [
  { value: 150000000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 120000000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 100000000000, fiscalYear: 2021, period: 'CY2021' },
];

/** 2-year dataset */
const MOCK_REVENUE_2Y = [
  { value: 120000000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 100000000000, fiscalYear: 2022, period: 'CY2022' },
];

/** Single year */
const MOCK_REVENUE_1Y = [
  { value: 50000000000, fiscalYear: 2023, period: 'CY2023' },
];

/** Small revenue (millions range) */
const MOCK_REVENUE_SMALL = [
  { value: 12500000, fiscalYear: 2023, period: 'CY2023' },
  { value: 8700000, fiscalYear: 2022, period: 'CY2022' },
  { value: 5200000, fiscalYear: 2021, period: 'CY2021' },
  { value: 3100000, fiscalYear: 2020, period: 'CY2020' },
  { value: 1500000, fiscalYear: 2019, period: 'CY2019' },
];

/** Pre-revenue (all zeros) */
const MOCK_REVENUE_ZERO = [
  { value: 0, fiscalYear: 2023, period: 'CY2023' },
  { value: 0, fiscalYear: 2022, period: 'CY2022' },
  { value: 0, fiscalYear: 2021, period: 'CY2021' },
];

/** 7-year dataset (tests slicing to 5) */
const MOCK_REVENUE_7Y = [
  { value: 400000000000, fiscalYear: 2025, period: 'CY2025' },
  { value: 390000000000, fiscalYear: 2024, period: 'CY2024' },
  { value: 383285000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 394328000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 365817000000, fiscalYear: 2021, period: 'CY2021' },
  { value: 274515000000, fiscalYear: 2020, period: 'CY2020' },
  { value: 260174000000, fiscalYear: 2019, period: 'CY2019' },
];

/** Dataset with invalid entries */
const MOCK_REVENUE_WITH_INVALID = [
  { value: 100000000000, fiscalYear: 2023, period: 'CY2023' },
  { value: NaN, fiscalYear: 2022, period: 'CY2022' },
  { value: 80000000000, fiscalYear: 2021, period: 'CY2021' },
  null,
  { value: Infinity, fiscalYear: 2019, period: 'CY2019' },
];

/** Declining revenue dataset (all YoY negative) */
const MOCK_REVENUE_DECLINING = [
  { value: 50000000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 65000000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 80000000000, fiscalYear: 2021, period: 'CY2021' },
  { value: 95000000000, fiscalYear: 2020, period: 'CY2020' },
  { value: 110000000000, fiscalYear: 2019, period: 'CY2019' },
];

/** Extreme outlier dataset */
const MOCK_REVENUE_OUTLIER = [
  { value: 500000000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 100000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 80000000, fiscalYear: 2021, period: 'CY2021' },
  { value: 60000000, fiscalYear: 2020, period: 'CY2020' },
  { value: 40000000, fiscalYear: 2019, period: 'CY2019' },
];

/** Negative revenue dataset */
const MOCK_REVENUE_NEGATIVE = [
  { value: 100000000, fiscalYear: 2023, period: 'CY2023' },
  { value: -5000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 80000000, fiscalYear: 2021, period: 'CY2021' },
  { value: 60000000, fiscalYear: 2020, period: 'CY2020' },
  { value: 40000000, fiscalYear: 2019, period: 'CY2019' },
];

/** All identical values */
const MOCK_REVENUE_IDENTICAL = [
  { value: 100000000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 100000000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 100000000000, fiscalYear: 2021, period: 'CY2021' },
  { value: 100000000000, fiscalYear: 2020, period: 'CY2020' },
  { value: 100000000000, fiscalYear: 2019, period: 'CY2019' },
];

/** Very large (Walmart-scale) dataset */
const MOCK_REVENUE_WALMART = [
  { value: 611289000000, fiscalYear: 2023, period: 'CY2023' },
  { value: 572754000000, fiscalYear: 2022, period: 'CY2022' },
  { value: 559151000000, fiscalYear: 2021, period: 'CY2021' },
];

/** Thousands-range dataset (nano-cap) */
const MOCK_REVENUE_THOUSANDS = [
  { value: 50000, fiscalYear: 2023, period: 'CY2023' },
  { value: 30000, fiscalYear: 2022, period: 'CY2022' },
  { value: 10000, fiscalYear: 2021, period: 'CY2021' },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Renders RevenueChart wrapped in ThemeProvider.
 * Animations are disabled by default for test stability.
 */
function renderChart(props = {}) {
  return render(
    <ThemeProvider>
      <RevenueChart animationDisabled {...props} />
    </ThemeProvider>,
  );
}

/**
 * Renders RevenueChart inside ThemeProvider with initial dark mode.
 */
function renderChartDark(props = {}) {
  // Set localStorage to dark before rendering
  window.localStorage.setItem('theme', 'dark');
  return render(
    <ThemeProvider>
      <RevenueChart animationDisabled {...props} />
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
 * Gets the YoY text from a specific table row index.
 */
function getYoYFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[2].textContent;
}

/**
 * Gets the revenue text from a specific table row index.
 */
function getRevenueFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[1].textContent;
}

/**
 * Gets the year label text from a specific table row index.
 */
function getYearFromRow(rows, index) {
  return rows[index].querySelectorAll('td')[0].textContent;
}

// =============================================================================
// Tests
// =============================================================================

describe('RevenueChart', () => {
  beforeEach(() => {
    cleanup();
  });

  // =========================================================================
  // UT-01 through UT-06: Basic Rendering
  // =========================================================================

  describe('Basic rendering', () => {
    it('UT-01: renders without crashing with valid 5-year data', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('UT-04: renders with data-testid="revenue-chart" on container', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      expect(container).toBeTruthy();
    });

    it('A11Y-01: has descriptive aria-label on container', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      expect(container.getAttribute('aria-label')).toBe(
        'Revenue trend chart showing annual revenue',
      );
    });

    it('UT-51: applies custom className prop', () => {
      renderChart({ data: MOCK_REVENUE_5Y, className: 'my-custom-class' });
      const container = screen.getByTestId('revenue-chart');
      expect(container.classList.contains('my-custom-class')).toBe(true);
    });

    it('applies base revenue-chart class', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      expect(container.classList.contains('revenue-chart')).toBe(true);
    });

    it('renders with 3-year partial data', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('EC-02: renders with single year of data', () => {
      renderChart({ data: MOCK_REVENUE_1Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders with small (millions) revenue data', () => {
      renderChart({ data: MOCK_REVENUE_SMALL });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('EC-03: renders with exactly 2 years of data', () => {
      renderChart({ data: MOCK_REVENUE_2Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('className is trimmed when no custom class provided', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      // Should be "revenue-chart" not "revenue-chart "
      expect(container.className).toBe('revenue-chart');
    });
  });

  // =========================================================================
  // EC-04, EC-05: Data Slicing (max 5 years)
  // =========================================================================

  describe('Data slicing', () => {
    it('EC-05: slices data to most recent 5 years when more than 5 provided', () => {
      renderChart({ data: MOCK_REVENUE_7Y });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
    });

    it('EC-05: includes the most recent 5 years, not oldest 5', () => {
      renderChart({ data: MOCK_REVENUE_7Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Most recent 5 from [2025,2024,2023,2022,2021,2020,2019] = [2025,2024,2023,2022,2021]
      // Reversed to chronological: 2021,2022,2023,2024,2025
      expect(getYearFromRow(rows, 0)).toBe('FY2021');
      expect(getYearFromRow(rows, 4)).toBe('FY2025');
    });

    it('EC-04: displays all years when exactly 5 provided', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });

    it('displays all years when fewer than 5 provided', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
    });
  });

  // =========================================================================
  // Invalid Data Filtering (EC-30 through EC-37)
  // =========================================================================

  describe('Invalid data filtering', () => {
    it('EC-33/EC-34: filters out NaN, Infinity, and null entries', () => {
      renderChart({ data: MOCK_REVENUE_WITH_INVALID });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Only value: 100B (2023) and 80B (2021) are valid
      expect(rows.length).toBe(2);
    });

    it('renders empty state when all entries are invalid', () => {
      const allInvalid = [
        { value: NaN, fiscalYear: 2023, period: 'CY2023' },
        { value: Infinity, fiscalYear: 2022, period: 'CY2022' },
        null,
      ];
      renderChart({ data: allInvalid });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
    });

    it('EC-36: handles null entries scattered in array', () => {
      const withNulls = [
        { value: 200000000000, fiscalYear: 2023, period: 'CY2023' },
        null,
        null,
        { value: 150000000000, fiscalYear: 2020, period: 'CY2020' },
      ];
      renderChart({ data: withNulls });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('EC-30: handles entries missing the value field', () => {
      const missingValue = [
        { fiscalYear: 2023, period: 'CY2023' },
        { value: 100000000000, fiscalYear: 2022, period: 'CY2022' },
      ];
      renderChart({ data: missingValue });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Entry without value is not a valid number, should be filtered
      expect(rows.length).toBe(1);
    });
  });

  // =========================================================================
  // UT-40 through UT-44: Empty & Error States
  // =========================================================================

  describe('Empty state', () => {
    it('UT-40: shows empty state when data is null', () => {
      renderChart({ data: null });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
      expect(screen.getByText('No revenue data available')).toBeTruthy();
    });

    it('UT-41: shows empty state when data is undefined', () => {
      renderChart({ data: undefined });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
      expect(screen.getByText('No revenue data available')).toBeTruthy();
    });

    it('UT-42: shows empty state when data is empty array', () => {
      renderChart({ data: [] });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
      expect(screen.getByText('No revenue data available')).toBeTruthy();
    });

    it('UT-44: empty state has role="status" for accessibility', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
    });

    it('UT-43: empty state renders an icon (SVG)', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      const svg = emptyState.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('empty state icon has aria-hidden="true"', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      const svg = emptyState.querySelector('svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    });

    it('empty state still has the main container with aria-label', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('revenue-chart');
      expect(container.getAttribute('aria-label')).toBe(
        'Revenue trend chart showing annual revenue',
      );
    });

    it('empty state does not render sr-only data table', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table');
      expect(table).toBeNull();
    });
  });

  // =========================================================================
  // EC-14: Pre-Revenue State
  // =========================================================================

  describe('Pre-revenue state', () => {
    it('EC-14: shows "Pre-revenue company" when all values are zero', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      expect(screen.getByText('Pre-revenue company')).toBeTruthy();
    });

    it('pre-revenue state has role="status"', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
    });

    it('pre-revenue state still has accessible data table', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
    });

    it('pre-revenue does not render the BarChart SVG', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      const container = screen.getByTestId('revenue-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeNull();
    });

    it('pre-revenue table shows $0 for all revenue values', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      for (let i = 0; i < rows.length; i++) {
        expect(getRevenueFromRow(rows, i)).toBe('$0');
      }
    });
  });

  // =========================================================================
  // A11Y-02, A11Y-10: Accessible Data Table
  // =========================================================================

  describe('Accessible data table', () => {
    it('A11Y-10: renders a visually hidden table with sr-only class', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table.sr-only');
      expect(table).toBeTruthy();
    });

    it('table has descriptive caption', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const caption = container.querySelector('table caption');
      expect(caption).toBeTruthy();
      expect(caption.textContent).toBe('Annual revenue data');
    });

    it('table has Year, Revenue, YoY Growth column headers with scope', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const headers = container.querySelectorAll('table th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Year');
      expect(headers[1].textContent).toBe('Revenue');
      expect(headers[2].textContent).toBe('YoY Growth');
      // Check scope attribute
      headers.forEach((th) => {
        expect(th.getAttribute('scope')).toBe('col');
      });
    });

    it('UT-03: table rows display data in chronological order (oldest first)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
      expect(getYearFromRow(rows, 0)).toBe('FY2019');
      expect(getYearFromRow(rows, 1)).toBe('FY2020');
      expect(getYearFromRow(rows, 2)).toBe('FY2021');
      expect(getYearFromRow(rows, 3)).toBe('FY2022');
      expect(getYearFromRow(rows, 4)).toBe('FY2023');
    });

    it('UT-11: table first row YoY shows N/A (no prior year)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
    });

    it('table includes formatted revenue values (billions)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // 2019 revenue: $260,174,000,000 -> "$260.2B"
      expect(getRevenueFromRow(rows, 0)).toBe('$260.2B');
    });

    it('table includes formatted revenue values (millions)', () => {
      renderChart({ data: MOCK_REVENUE_SMALL });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // 2019 revenue: $1,500,000 -> "$1.5M"
      expect(getRevenueFromRow(rows, 0)).toBe('$1.5M');
    });

    it('table includes formatted revenue values (thousands)', () => {
      renderChart({ data: MOCK_REVENUE_THOUSANDS });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // 2021 revenue: $10,000 -> "$10.0K"
      expect(getRevenueFromRow(rows, 0)).toBe('$10.0K');
    });
  });

  // =========================================================================
  // UT-10 through UT-17: YoY Growth Calculation
  // =========================================================================

  describe('YoY growth calculation', () => {
    it('UT-10: displays YoY growth for all years except first', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // First row = N/A, rows 2-5 should have percentage values
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
      for (let i = 1; i < rows.length; i++) {
        const yoy = getYoYFromRow(rows, i);
        expect(yoy).not.toBe('N/A');
        expect(yoy).toMatch(/[+-]?\d+\.\d%/);
      }
    });

    it('UT-12: positive growth shows "+" prefix', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // 2021: $100B, 2022: $120B -> +20.0%
      expect(getYoYFromRow(rows, 1)).toBe('+20.0%');
    });

    it('UT-13: negative growth shows "-" prefix', () => {
      renderChart({ data: MOCK_REVENUE_DECLINING });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // All subsequent years have declining revenue
      for (let i = 1; i < rows.length; i++) {
        expect(getYoYFromRow(rows, i)).toMatch(/^-/);
      }
    });

    it('UT-15: YoY calculated correctly for known values', () => {
      // 2020: $274.515B, 2021: $365.817B -> ((365817-274515)/274515)*100 = +33.3%
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Row index 2 = FY2021 (third row)
      expect(getYoYFromRow(rows, 2)).toBe('+33.3%');
    });

    it('UT-14/EC-19: identical values produce "0.0%" YoY', () => {
      renderChart({ data: MOCK_REVENUE_IDENTICAL });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      for (let i = 1; i < rows.length; i++) {
        expect(getYoYFromRow(rows, i)).toBe('0.0%');
      }
    });

    it('UT-17: YoY formatted with 1 decimal place', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      const yoy = getYoYFromRow(rows, 1);
      // Should be "+20.0%" - exactly 1 decimal
      expect(yoy).toMatch(/^[+-]?\d+\.\d%$/);
    });

    it('single year data shows only N/A for YoY', () => {
      renderChart({ data: MOCK_REVENUE_1Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(1);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
    });

    it('EC-03: two years of data produces exactly 1 YoY label', () => {
      renderChart({ data: MOCK_REVENUE_2Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
      expect(getYoYFromRow(rows, 1)).toBe('+20.0%');
    });
  });

  // =========================================================================
  // UT-20 through UT-24: Y-Axis Formatting
  // =========================================================================

  describe('Y-axis formatting', () => {
    it('UT-20: formatCurrency returns "$B" for billion-dollar revenues', () => {
      expect(formatCurrency(394328000000)).toBe('$394.3B');
    });

    it('UT-21: formatCurrency returns "$M" for million-dollar revenues', () => {
      expect(formatCurrency(12500000)).toBe('$12.5M');
    });

    it('UT-22: formatCurrency returns "$K" for thousand-dollar revenues', () => {
      expect(formatCurrency(50000)).toBe('$50.0K');
    });

    it('formatCurrency returns "$0" for zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('formatCurrency returns "N/A" for non-numeric input', () => {
      expect(formatCurrency(null)).toBe('N/A');
      expect(formatCurrency(undefined)).toBe('N/A');
      expect(formatCurrency(NaN)).toBe('N/A');
      expect(formatCurrency(Infinity)).toBe('N/A');
    });

    it('formatCurrency handles negative values with accounting parens', () => {
      expect(formatCurrency(-5000000)).toBe('($5.0M)');
      expect(formatCurrency(-500000000000)).toBe('($500.0B)');
    });

    it('EC-10: formatCurrency handles Walmart-scale revenue', () => {
      expect(formatCurrency(611289000000)).toBe('$611.3B');
    });

    it('EC-11: formatCurrency handles micro-cap revenue', () => {
      expect(formatCurrency(1200000)).toBe('$1.2M');
    });

    it('EC-12: formatCurrency handles nano-cap revenue', () => {
      expect(formatCurrency(50000)).toBe('$50.0K');
    });

    it('formatCurrency handles sub-thousand revenue', () => {
      expect(formatCurrency(500)).toBe('$500');
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

    it('UT-14: returns zero for identical values', () => {
      const result = calculateYoY(100000000000, 100000000000);
      expect(result.percentage).toBe(0);
      expect(result.formatted).toBe('0.0%');
    });

    it('UT-16: returns N/A when previous value is zero', () => {
      const result = calculateYoY(50000000, 0);
      expect(result.percentage).toBeNull();
      expect(result.formatted).toBe('N/A');
    });

    it('returns N/A for null inputs', () => {
      expect(calculateYoY(null, 100).formatted).toBe('N/A');
      expect(calculateYoY(100, null).formatted).toBe('N/A');
    });

    it('returns N/A for NaN inputs', () => {
      expect(calculateYoY(NaN, 100).formatted).toBe('N/A');
      expect(calculateYoY(100, NaN).formatted).toBe('N/A');
    });

    it('returns N/A for Infinity inputs', () => {
      expect(calculateYoY(Infinity, 100).formatted).toBe('N/A');
      expect(calculateYoY(100, Infinity).formatted).toBe('N/A');
    });

    it('rounds to 1 decimal place', () => {
      // 107800 / 100000 - 1 = 0.078 -> 7.8%
      const result = calculateYoY(107800, 100000);
      expect(result.formatted).toBe('+7.8%');
    });
  });

  // =========================================================================
  // UT-30 through UT-34: Tooltip Configuration
  // =========================================================================

  describe('Tooltip configuration', () => {
    it('UT-30: Recharts Tooltip component is present in chart', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      // Recharts renders tooltip wrapper
      const tooltipWrapper = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipWrapper).toBeTruthy();
    });

    it('does not render tooltip for empty data', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('revenue-chart');
      const tooltipWrapper = container.querySelector('.recharts-tooltip-wrapper');
      expect(tooltipWrapper).toBeNull();
    });
  });

  // =========================================================================
  // Recharts SVG Rendering
  // =========================================================================

  describe('Chart SVG rendering', () => {
    it('renders a Recharts BarChart SVG element', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('renders X-axis', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const xAxis = container.querySelector('.recharts-xAxis');
      expect(xAxis).toBeTruthy();
    });

    it('renders Y-axis', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const yAxis = container.querySelector('.recharts-yAxis');
      expect(yAxis).toBeTruthy();
    });

    it('renders CartesianGrid', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const grid = container.querySelector('.recharts-cartesian-grid');
      expect(grid).toBeTruthy();
    });

    it('renders horizontal grid lines only (vertical=false)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const grid = container.querySelector('.recharts-cartesian-grid');
      expect(grid).toBeTruthy();
      // Horizontal lines should exist
      const horizontalLines = grid.querySelector('.recharts-cartesian-grid-horizontal');
      expect(horizontalLines).toBeTruthy();
    });

    it('does not render chart SVG for empty data', () => {
      renderChart({ data: null });
      const container = screen.getByTestId('revenue-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeNull();
    });

    it('does not render chart SVG for pre-revenue data', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      const container = screen.getByTestId('revenue-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeNull();
    });

    it('renders a ResponsiveContainer wrapper', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const responsive = container.querySelector('.recharts-responsive-container');
      expect(responsive).toBeTruthy();
    });
  });

  // =========================================================================
  // Animation Control (PERF-13)
  // =========================================================================

  describe('Animation control', () => {
    it('PERF-13: accepts animationDisabled prop and renders correctly', () => {
      renderChart({ data: MOCK_REVENUE_5Y, animationDisabled: true });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders when animationDisabled is false', () => {
      renderChart({ data: MOCK_REVENUE_5Y, animationDisabled: false });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders identically regardless of animation state', () => {
      const { unmount } = renderChart({ data: MOCK_REVENUE_3Y, animationDisabled: true });
      const container1 = screen.getByTestId('revenue-chart');
      const rows1 = getTableRows(container1);
      const data1 = Array.from(rows1).map((r) => r.textContent);
      unmount();

      renderChart({ data: MOCK_REVENUE_3Y, animationDisabled: false });
      const container2 = screen.getByTestId('revenue-chart');
      const rows2 = getTableRows(container2);
      const data2 = Array.from(rows2).map((r) => r.textContent);

      expect(data1).toEqual(data2);
    });
  });

  // =========================================================================
  // UT-52, UT-53: Height Prop
  // =========================================================================

  describe('Height prop', () => {
    it('UT-52: accepts a custom height prop', () => {
      renderChart({ data: MOCK_REVENUE_5Y, height: 400 });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('UT-53: renders without explicit height (uses default)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders with very small height', () => {
      renderChart({ data: MOCK_REVENUE_5Y, height: 100 });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders with large height', () => {
      renderChart({ data: MOCK_REVENUE_5Y, height: 600 });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });
  });

  // =========================================================================
  // EC-10 through EC-20: Revenue Value Edge Cases
  // =========================================================================

  describe('Revenue value edge cases', () => {
    it('EC-10: handles very large revenue (Walmart-scale)', () => {
      renderChart({ data: MOCK_REVENUE_WALMART });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      // $611.289B -> "$611.3B"
      expect(getRevenueFromRow(rows, 2)).toBe('$611.3B');
    });

    it('EC-15/EC-16: handles negative revenue values', () => {
      renderChart({ data: MOCK_REVENUE_NEGATIVE });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
      // Negative: -5000000 -> "($5.0M)"
      expect(getRevenueFromRow(rows, 3)).toBe('($5.0M)');
    });

    it('EC-17: handles floating point revenue values', () => {
      const floatingPoint = [
        { value: 394328000000.50, fiscalYear: 2023, period: 'CY2023' },
        { value: 365817000000.75, fiscalYear: 2022, period: 'CY2022' },
      ];
      renderChart({ data: floatingPoint });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Should round appropriately in billions format
      expect(getRevenueFromRow(rows, 1)).toBe('$394.3B');
    });

    it('EC-18: handles values spanning multiple orders of magnitude', () => {
      const spanning = [
        { value: 500000000, fiscalYear: 2023, period: 'CY2023' },
        { value: 5000000, fiscalYear: 2022, period: 'CY2022' },
        { value: 50000, fiscalYear: 2021, period: 'CY2021' },
      ];
      renderChart({ data: spanning });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      expect(getRevenueFromRow(rows, 0)).toBe('$50.0K');
      expect(getRevenueFromRow(rows, 1)).toBe('$5.0M');
      expect(getRevenueFromRow(rows, 2)).toBe('$500.0M');
    });

    it('EC-19: all identical revenue values render correctly', () => {
      renderChart({ data: MOCK_REVENUE_IDENTICAL });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
      for (let i = 0; i < rows.length; i++) {
        expect(getRevenueFromRow(rows, i)).toBe('$100.0B');
      }
    });

    it('EC-20: extreme outlier data renders without crash', () => {
      renderChart({ data: MOCK_REVENUE_OUTLIER });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
      // Small values should still be present
      expect(getRevenueFromRow(rows, 0)).toBe('$40.0M');
      // Large outlier
      expect(getRevenueFromRow(rows, 4)).toBe('$500.0B');
    });

    it('EC-13: zero value in middle of data shows $0', () => {
      const withZero = [
        { value: 100000000, fiscalYear: 2023, period: 'CY2023' },
        { value: 0, fiscalYear: 2022, period: 'CY2022' },
        { value: 80000000, fiscalYear: 2021, period: 'CY2021' },
      ];
      renderChart({ data: withZero });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      expect(getRevenueFromRow(rows, 1)).toBe('$0');
    });
  });

  // =========================================================================
  // Declining Revenue (all negative YoY)
  // =========================================================================

  describe('Declining revenue', () => {
    it('all YoY values are negative for declining dataset', () => {
      renderChart({ data: MOCK_REVENUE_DECLINING });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // First row is N/A
      expect(getYoYFromRow(rows, 0)).toBe('N/A');
      // All subsequent rows should be negative
      for (let i = 1; i < rows.length; i++) {
        expect(getYoYFromRow(rows, i)).toMatch(/^-\d+\.\d%$/);
      }
    });

    it('declining revenue specific YoY values are correct', () => {
      renderChart({ data: MOCK_REVENUE_DECLINING });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Chronological: 2019($110B), 2020($95B), 2021($80B), 2022($65B), 2023($50B)
      // 2020 YoY: (95-110)/110 = -13.6%
      expect(getYoYFromRow(rows, 1)).toBe('-13.6%');
      // 2021 YoY: (80-95)/95 = -15.8%
      expect(getYoYFromRow(rows, 2)).toBe('-15.8%');
    });
  });

  // =========================================================================
  // EC-30 through EC-37: Data Shape Edge Cases
  // =========================================================================

  describe('Data shape edge cases', () => {
    it('EC-22/IT-22: handles data with extra fields gracefully', () => {
      const dataWithExtras = [
        {
          value: 100000000000,
          fiscalYear: 2023,
          period: 'CY2023',
          filedDate: '2024-01-01',
          form: '10-K',
          confidence: 'high',
        },
        {
          value: 80000000000,
          fiscalYear: 2022,
          period: 'CY2022',
          filedDate: '2023-01-01',
          form: '10-K',
          confidence: 'high',
        },
      ];
      renderChart({ data: dataWithExtras });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(2);
    });

    it('does not crash with non-array data (string)', () => {
      renderChart({ data: 'not-an-array' });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
    });

    it('does not crash with object data', () => {
      renderChart({ data: { value: 100 } });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
    });

    it('does not crash with number data', () => {
      renderChart({ data: 42 });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
    });

    it('does not crash with boolean data', () => {
      renderChart({ data: true });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
    });

    it('handles mixed valid and invalid entries', () => {
      renderChart({ data: MOCK_REVENUE_WITH_INVALID });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Only 2 valid entries: 80B (2021) and 100B (2023)
      expect(rows.length).toBe(2);
    });

    it('EC-37: renders chronological order from most-recent-first input', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(getYearFromRow(rows, 0)).toBe('FY2021');
      expect(getYearFromRow(rows, 1)).toBe('FY2022');
      expect(getYearFromRow(rows, 2)).toBe('FY2023');
    });

    it('EC-31: handles entries with missing fiscalYear field', () => {
      const missingYear = [
        { value: 100000000000, period: 'CY2023' },
        { value: 80000000000, fiscalYear: 2022, period: 'CY2022' },
      ];
      // Even without fiscalYear, isValidEntry only checks value
      // The component should still render the entry
      renderChart({ data: missingYear });
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      // Both entries have valid values, so both should render
      expect(rows.length).toBe(2);
    });
  });

  // =========================================================================
  // IT-10 through IT-14: Theme Integration
  // =========================================================================

  describe('Theme integration', () => {
    it('IT-10/IT-11: renders with default light theme', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('IT-10: renders with dark theme without crashing', () => {
      renderChartDark({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('IT-13: axis labels are present in both themes', () => {
      // Light theme
      renderChart({ data: MOCK_REVENUE_5Y });
      let container = screen.getByTestId('revenue-chart');
      let xAxis = container.querySelector('.recharts-xAxis');
      let yAxis = container.querySelector('.recharts-yAxis');
      expect(xAxis).toBeTruthy();
      expect(yAxis).toBeTruthy();
      cleanup();

      // Dark theme
      renderChartDark({ data: MOCK_REVENUE_5Y });
      container = screen.getByTestId('revenue-chart');
      xAxis = container.querySelector('.recharts-xAxis');
      yAxis = container.querySelector('.recharts-yAxis');
      expect(xAxis).toBeTruthy();
      expect(yAxis).toBeTruthy();
    });

    it('A11Y-09: structure remains identical across themes', () => {
      // Light theme
      renderChart({ data: MOCK_REVENUE_3Y });
      let container = screen.getByTestId('revenue-chart');
      let lightRows = getTableRows(container);
      const lightData = Array.from(lightRows).map((r) => r.textContent);
      cleanup();

      // Dark theme
      renderChartDark({ data: MOCK_REVENUE_3Y });
      container = screen.getByTestId('revenue-chart');
      const darkRows = getTableRows(container);
      const darkData = Array.from(darkRows).map((r) => r.textContent);

      expect(lightData).toEqual(darkData);
    });
  });

  // =========================================================================
  // A11Y: Accessibility
  // =========================================================================

  describe('Accessibility', () => {
    it('A11Y-01: chart container has descriptive aria-label', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      expect(container.getAttribute('aria-label')).toContain('Revenue trend chart');
    });

    it('A11Y-03: empty state message is accessible with role="status"', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
      expect(emptyState.textContent).toContain('No revenue data available');
    });

    it('A11Y-10: hidden data table is present for screen readers', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table.sr-only');
      expect(table).toBeTruthy();
    });

    it('A11Y-21: no tab trap in chart (no tabindex on chart container)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      // The chart should not create a tab trap
      expect(container.getAttribute('tabindex')).toBeNull();
    });

    it('empty state icon is decorative (aria-hidden)', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      const icon = emptyState.querySelector('svg');
      expect(icon).toBeTruthy();
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('table headers use scope="col" for proper association', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const headers = container.querySelectorAll('table th[scope="col"]');
      expect(headers.length).toBe(3);
    });

    it('pre-revenue state is accessible', () => {
      renderChart({ data: MOCK_REVENUE_ZERO });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
      expect(emptyState.textContent).toContain('Pre-revenue company');
    });
  });

  // =========================================================================
  // UT-50/UT-51: Prop Validation
  // =========================================================================

  describe('PropTypes validation', () => {
    it('UT-50: component has PropTypes defined', () => {
      expect(RevenueChart.propTypes).toBeDefined();
      expect(RevenueChart.propTypes.data).toBeDefined();
      expect(RevenueChart.propTypes.className).toBeDefined();
      expect(RevenueChart.propTypes.height).toBeDefined();
      expect(RevenueChart.propTypes.animationDisabled).toBeDefined();
    });
  });

  // =========================================================================
  // Console cleanliness
  // =========================================================================

  describe('Console cleanliness', () => {
    it('renders without console errors for valid data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_REVENUE_5Y });
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

    it('renders without console errors for pre-revenue data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_REVENUE_ZERO });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console warnings for valid data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderChart({ data: MOCK_REVENUE_5Y });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('renders without console errors for edge case data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_REVENUE_WITH_INVALID });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // Component re-render / data update behavior
  // =========================================================================

  describe('Data update behavior', () => {
    it('updates chart when data prop changes', () => {
      const { rerender } = render(
        <ThemeProvider>
          <RevenueChart animationDisabled data={MOCK_REVENUE_3Y} />
        </ThemeProvider>,
      );
      let container = screen.getByTestId('revenue-chart');
      let rows = getTableRows(container);
      expect(rows.length).toBe(3);

      // Update to 5-year data
      rerender(
        <ThemeProvider>
          <RevenueChart animationDisabled data={MOCK_REVENUE_5Y} />
        </ThemeProvider>,
      );
      container = screen.getByTestId('revenue-chart');
      rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });

    it('transitions from data to empty state correctly', () => {
      const { rerender } = render(
        <ThemeProvider>
          <RevenueChart animationDisabled data={MOCK_REVENUE_5Y} />
        </ThemeProvider>,
      );
      expect(screen.queryByTestId('revenue-chart-empty')).toBeNull();

      rerender(
        <ThemeProvider>
          <RevenueChart animationDisabled data={null} />
        </ThemeProvider>,
      );
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
    });

    it('transitions from empty to data state correctly', () => {
      const { rerender } = render(
        <ThemeProvider>
          <RevenueChart animationDisabled data={null} />
        </ThemeProvider>,
      );
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();

      rerender(
        <ThemeProvider>
          <RevenueChart animationDisabled data={MOCK_REVENUE_5Y} />
        </ThemeProvider>,
      );
      expect(screen.queryByTestId('revenue-chart-empty')).toBeNull();
      const container = screen.getByTestId('revenue-chart');
      const rows = getTableRows(container);
      expect(rows.length).toBe(5);
    });
  });

  // =========================================================================
  // Snapshot tests
  // =========================================================================

  describe('Snapshot tests', () => {
    it('matches snapshot for 5-year data', () => {
      const { container } = renderChart({ data: MOCK_REVENUE_5Y });
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for empty state', () => {
      const { container } = renderChart({ data: null });
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for pre-revenue state', () => {
      const { container } = renderChart({ data: MOCK_REVENUE_ZERO });
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
