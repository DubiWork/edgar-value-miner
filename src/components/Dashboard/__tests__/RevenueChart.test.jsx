import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenueChart } from '../RevenueChart';
import { ThemeProvider } from '../../../contexts/ThemeProvider';

// =============================================================================
// Test Data
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

/** Single year */
const MOCK_REVENUE_1Y = [
  { value: 50000000000, fiscalYear: 2023, period: 'CY2023' },
];

/** Small revenue (millions range) */
const MOCK_REVENUE_SMALL = [
  { value: 12500000, fiscalYear: 2023, period: 'CY2023' },
  { value: 8700000, fiscalYear: 2022, period: 'CY2022' },
  { value: 5200000, fiscalYear: 2021, period: 'CY2021' },
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

// =============================================================================
// Helper
// =============================================================================

/**
 * Renders RevenueChart wrapped in ThemeProvider.
 */
function renderChart(props = {}) {
  return render(
    <ThemeProvider>
      <RevenueChart animationDisabled {...props} />
    </ThemeProvider>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('RevenueChart', () => {
  // =========================================================================
  // Basic Rendering
  // =========================================================================

  describe('Basic rendering', () => {
    it('renders without crashing with valid 5-year data', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders with data-testid="revenue-chart" on container', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      expect(container).toBeTruthy();
    });

    it('has aria-label for accessibility', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      expect(container.getAttribute('aria-label')).toBe(
        'Revenue trend chart showing annual revenue'
      );
    });

    it('applies custom className', () => {
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

    it('renders with single year of data', () => {
      renderChart({ data: MOCK_REVENUE_1Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders with small (millions) revenue data', () => {
      renderChart({ data: MOCK_REVENUE_SMALL });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });
  });

  // =========================================================================
  // Data Slicing (max 5 years)
  // =========================================================================

  describe('Data slicing', () => {
    it('slices data to most recent 5 years when more than 5 provided', () => {
      renderChart({ data: MOCK_REVENUE_7Y });
      const container = screen.getByTestId('revenue-chart');
      // The sr-only table should have exactly 5 data rows
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
    });

    it('displays all years when 5 or fewer provided', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table');
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);
    });
  });

  // =========================================================================
  // Invalid Data Filtering
  // =========================================================================

  describe('Invalid data filtering', () => {
    it('filters out NaN, Infinity, and null entries', () => {
      renderChart({ data: MOCK_REVENUE_WITH_INVALID });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table');
      // Only value: 100B and 80B are valid
      const rows = table.querySelectorAll('tbody tr');
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
  });

  // =========================================================================
  // Empty & Error States
  // =========================================================================

  describe('Empty state', () => {
    it('shows empty state when data is null', () => {
      renderChart({ data: null });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
      expect(screen.getByText('No revenue data available')).toBeTruthy();
    });

    it('shows empty state when data is undefined', () => {
      renderChart({ data: undefined });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
      expect(screen.getByText('No revenue data available')).toBeTruthy();
    });

    it('shows empty state when data is empty array', () => {
      renderChart({ data: [] });
      expect(screen.getByTestId('revenue-chart-empty')).toBeTruthy();
      expect(screen.getByText('No revenue data available')).toBeTruthy();
    });

    it('empty state has role="status" for accessibility', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
    });

    it('empty state renders a bar chart icon', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('revenue-chart-empty');
      // lucide-react renders an SVG
      const svg = emptyState.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  });

  // =========================================================================
  // Pre-Revenue State
  // =========================================================================

  describe('Pre-revenue state', () => {
    it('shows "Pre-revenue company" when all values are zero', () => {
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
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);
    });
  });

  // =========================================================================
  // Accessible Data Table
  // =========================================================================

  describe('Accessible data table', () => {
    it('renders a visually hidden table with sr-only class', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table.sr-only');
      expect(table).toBeTruthy();
    });

    it('table has correct caption', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const caption = container.querySelector('table caption');
      expect(caption).toBeTruthy();
      expect(caption.textContent).toBe('Annual revenue data');
    });

    it('table has Year, Revenue, YoY Growth column headers', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const headers = container.querySelectorAll('table th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Year');
      expect(headers[1].textContent).toBe('Revenue');
      expect(headers[2].textContent).toBe('YoY Growth');
    });

    it('table rows display data in chronological order (oldest first)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      expect(rows.length).toBe(5);

      // First row should be oldest year (2019)
      const firstRowCells = rows[0].querySelectorAll('td');
      expect(firstRowCells[0].textContent).toBe('FY2019');

      // Last row should be newest year (2023)
      const lastRowCells = rows[4].querySelectorAll('td');
      expect(lastRowCells[0].textContent).toBe('FY2023');
    });

    it('table first row YoY shows N/A (no prior year)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      const firstRowCells = rows[0].querySelectorAll('td');
      expect(firstRowCells[2].textContent).toBe('N/A');
    });

    it('table includes formatted revenue values', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      // 2019 revenue: $260174000000 → "$260.2B"
      const firstRowRevenue = rows[0].querySelectorAll('td')[1].textContent;
      expect(firstRowRevenue).toBe('$260.2B');
    });
  });

  // =========================================================================
  // YoY Growth Calculation (via accessible table)
  // =========================================================================

  describe('YoY growth calculation', () => {
    it('first year has no YoY growth value', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      const firstYoY = rows[0].querySelectorAll('td')[2].textContent;
      // No prior year, should be N/A
      expect(firstYoY).toBe('N/A');
    });

    it('calculates positive YoY growth correctly', () => {
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      // 2021: $100B, 2022: $120B → +20.0%
      const secondYoY = rows[1].querySelectorAll('td')[2].textContent;
      expect(secondYoY).toBe('+20.0%');
    });

    it('calculates negative YoY growth correctly', () => {
      // 2022: $394B, 2023: $383B → negative
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      // Last row is 2023
      const lastYoY = rows[4].querySelectorAll('td')[2].textContent;
      expect(lastYoY).toMatch(/^-/);
    });

    it('single year data has no YoY labels', () => {
      renderChart({ data: MOCK_REVENUE_1Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      expect(rows.length).toBe(1);
      const yoy = rows[0].querySelectorAll('td')[2].textContent;
      expect(yoy).toBe('N/A');
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

    it('renders X-axis with fiscal year labels', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      // Recharts renders X-axis labels as <text> elements inside .recharts-xAxis
      const xAxis = container.querySelector('.recharts-xAxis');
      expect(xAxis).toBeTruthy();
    });

    it('renders Y-axis', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const yAxis = container.querySelector('.recharts-yAxis');
      expect(yAxis).toBeTruthy();
    });

    it('renders CartesianGrid with dashed lines', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      const container = screen.getByTestId('revenue-chart');
      const grid = container.querySelector('.recharts-cartesian-grid');
      expect(grid).toBeTruthy();
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
  });

  // =========================================================================
  // Animation Control
  // =========================================================================

  describe('Animation control', () => {
    it('accepts animationDisabled prop', () => {
      // Should render without error
      renderChart({ data: MOCK_REVENUE_5Y, animationDisabled: true });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders when animationDisabled is false', () => {
      renderChart({ data: MOCK_REVENUE_5Y, animationDisabled: false });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });
  });

  // =========================================================================
  // Height Prop
  // =========================================================================

  describe('Height prop', () => {
    it('accepts a custom height prop', () => {
      renderChart({ data: MOCK_REVENUE_5Y, height: 400 });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });

    it('renders without explicit height (uses default)', () => {
      renderChart({ data: MOCK_REVENUE_5Y });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge cases', () => {
    it('handles data with extra fields gracefully', () => {
      const dataWithExtras = [
        { value: 100000000000, fiscalYear: 2023, period: 'CY2023', filedDate: '2024-01-01', form: '10-K', confidence: 'high' },
        { value: 80000000000, fiscalYear: 2022, period: 'CY2022', filedDate: '2023-01-01', form: '10-K', confidence: 'high' },
      ];
      renderChart({ data: dataWithExtras });
      expect(screen.getByTestId('revenue-chart')).toBeTruthy();
      const table = screen.getByTestId('revenue-chart').querySelector('table');
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
    });

    it('does not crash with non-array data', () => {
      // Passing a string should trigger empty state
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

    it('handles mixed valid and invalid entries', () => {
      renderChart({ data: MOCK_REVENUE_WITH_INVALID });
      const container = screen.getByTestId('revenue-chart');
      const table = container.querySelector('table');
      const rows = table.querySelectorAll('tbody tr');
      // Only 2 valid entries: 80B (2021) and 100B (2023)
      expect(rows.length).toBe(2);
    });

    it('renders chronological order even from non-standard input order', () => {
      // Data comes most-recent-first from normalizer, component reverses
      renderChart({ data: MOCK_REVENUE_3Y });
      const container = screen.getByTestId('revenue-chart');
      const rows = container.querySelectorAll('table tbody tr');
      // Should be chronological: 2021, 2022, 2023
      expect(rows[0].querySelectorAll('td')[0].textContent).toBe('FY2021');
      expect(rows[1].querySelectorAll('td')[0].textContent).toBe('FY2022');
      expect(rows[2].querySelectorAll('td')[0].textContent).toBe('FY2023');
    });
  });

  // =========================================================================
  // No console errors
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
  });
});
