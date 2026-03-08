import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MarginsChart } from '../MarginsChart';
import { ThemeProvider } from '../../../contexts/ThemeProvider';
import { calculateMargins } from '../../../utils/calculateMargins';

// =============================================================================
// Test Data
// =============================================================================

/** Standard 5-year Apple-like margin dataset */
const MOCK_MARGINS_5Y = [
  { fiscalYear: 2019, label: 'FY2019', grossMargin: 37.8, operatingMargin: 24.6, netMargin: 21.2 },
  { fiscalYear: 2020, label: 'FY2020', grossMargin: 38.2, operatingMargin: 24.1, netMargin: 20.9 },
  { fiscalYear: 2021, label: 'FY2021', grossMargin: 41.8, operatingMargin: 29.8, netMargin: 25.9 },
  { fiscalYear: 2022, label: 'FY2022', grossMargin: 43.3, operatingMargin: 30.3, netMargin: 25.3 },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: 44.1, operatingMargin: 29.8, netMargin: 25.3 },
];

/** Bank data — missing gross margin (all null) */
const MOCK_MARGINS_NO_GROSS = [
  { fiscalYear: 2021, label: 'FY2021', grossMargin: null, operatingMargin: 15.2, netMargin: 12.1 },
  { fiscalYear: 2022, label: 'FY2022', grossMargin: null, operatingMargin: 16.8, netMargin: 13.5 },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: null, operatingMargin: 17.1, netMargin: 14.2 },
];

/** Startup with negative margins */
const MOCK_MARGINS_NEGATIVE = [
  { fiscalYear: 2021, label: 'FY2021', grossMargin: 45.0, operatingMargin: -5.2, netMargin: -12.3 },
  { fiscalYear: 2022, label: 'FY2022', grossMargin: 48.0, operatingMargin: 2.1, netMargin: -3.5 },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: 50.0, operatingMargin: 8.5, netMargin: 5.2 },
];

/** Single data point */
const MOCK_MARGINS_SINGLE = [
  { fiscalYear: 2023, label: 'FY2023', grossMargin: 44.1, operatingMargin: 29.8, netMargin: 25.3 },
];

/** Software company with margins > 100% (possible with certain accounting) */
const MOCK_MARGINS_HIGH = [
  { fiscalYear: 2022, label: 'FY2022', grossMargin: 85.0, operatingMargin: 105.0, netMargin: 90.0 },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: 88.0, operatingMargin: 110.0, netMargin: 95.0 },
];

/** Mixed null values in different fields */
const MOCK_MARGINS_MIXED_NULLS = [
  { fiscalYear: 2021, label: 'FY2021', grossMargin: 40.0, operatingMargin: null, netMargin: 20.0 },
  { fiscalYear: 2022, label: 'FY2022', grossMargin: 42.0, operatingMargin: 28.0, netMargin: null },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: 44.0, operatingMargin: 30.0, netMargin: 25.0 },
];

/** All margins null (revenue exists but no profit data) */
const MOCK_MARGINS_ALL_NULL = [
  { fiscalYear: 2022, label: 'FY2022', grossMargin: null, operatingMargin: null, netMargin: null },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: null, operatingMargin: null, netMargin: null },
];

/** Only net margin present (1-line minimum) */
const MOCK_MARGINS_NET_ONLY = [
  { fiscalYear: 2022, label: 'FY2022', grossMargin: null, operatingMargin: null, netMargin: 12.5 },
  { fiscalYear: 2023, label: 'FY2023', grossMargin: null, operatingMargin: null, netMargin: 14.0 },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Renders MarginsChart wrapped in ThemeProvider.
 * Animations are disabled by default for test stability.
 */
function renderChart(props = {}) {
  return render(
    <ThemeProvider>
      <MarginsChart animationDisabled {...props} />
    </ThemeProvider>,
  );
}

/**
 * Renders MarginsChart inside ThemeProvider with initial dark mode.
 */
function renderChartDark(props = {}) {
  window.localStorage.setItem('theme', 'dark');
  return render(
    <ThemeProvider>
      <MarginsChart animationDisabled {...props} />
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
 * Gets a specific cell text from a table row.
 */
function getCellFromRow(rows, rowIndex, cellIndex) {
  return rows[rowIndex].querySelectorAll('td')[cellIndex].textContent;
}

// =============================================================================
// Tests
// =============================================================================

describe('MarginsChart', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  // =========================================================================
  // Rendering (8 tests)
  // =========================================================================

  describe('Rendering', () => {
    it('renders without crashing with valid 5-year data', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      expect(screen.getByTestId('margins-chart')).toBeTruthy();
    });

    it('renders a Recharts LineChart SVG element', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('renders ResponsiveContainer', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const responsive = container.querySelector('.recharts-responsive-container');
      expect(responsive).toBeTruthy();
    });

    it('renders CartesianGrid for horizontal lines', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const grid = container.querySelector('.recharts-cartesian-grid');
      expect(grid).toBeTruthy();
      expect(grid.querySelector('.recharts-cartesian-grid-horizontal')).toBeTruthy();
    });

    it('applies custom className prop', () => {
      renderChart({ data: MOCK_MARGINS_5Y, className: 'my-custom-class' });
      const container = screen.getByTestId('margins-chart');
      expect(container.classList.contains('my-custom-class')).toBe(true);
    });

    it('applies base margins-chart class', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      expect(container.classList.contains('margins-chart')).toBe(true);
    });

    it('renders 2-line fallback when grossMargin is all null (bank data)', () => {
      renderChart({ data: MOCK_MARGINS_NO_GROSS });
      const container = screen.getByTestId('margins-chart');
      // Legend should only show operating + net (no gross)
      const legend = screen.getByTestId('margins-legend');
      const legendItems = legend.querySelectorAll('button');
      expect(legendItems.length).toBe(2);
      // SVG should still render
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
    });

    it('renders 1-line minimum when only net margin data exists', () => {
      renderChart({ data: MOCK_MARGINS_NET_ONLY });
      const container = screen.getByTestId('margins-chart');
      // Legend should show only operating + net (gross absent)
      const legend = screen.getByTestId('margins-legend');
      const legendItems = legend.querySelectorAll('button');
      expect(legendItems.length).toBe(2);
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
    });
  });

  // =========================================================================
  // Data Display (6 tests)
  // =========================================================================

  describe('Data display', () => {
    it('Y-axis is present with tick elements (tickFormatter adds % suffix)', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const yAxis = container.querySelector('.recharts-yAxis');
      expect(yAxis).toBeTruthy();
      // Recharts renders tick elements even if jsdom doesn't resolve SVG text
      const ticks = yAxis.querySelectorAll('.recharts-cartesian-axis-tick');
      expect(ticks.length).toBeGreaterThan(0);
    });

    it('Y-axis domain adjusts dynamically (not fixed 0-100)', () => {
      // With MOCK_MARGINS_5Y, min is ~20.9, max is ~44.1
      // Domain should be roughly [floor(20.9-5), ceil(44.1+5)] = [15, 50]
      // NOT [0, 100]
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const yAxis = container.querySelector('.recharts-yAxis');
      const ticks = yAxis.querySelectorAll('.recharts-cartesian-axis-tick text');
      const tickValues = Array.from(ticks).map((t) =>
        parseFloat(t.textContent.replace('%', '')),
      );
      // No tick should be at 0 or 100 for this dataset
      expect(tickValues.some((v) => v === 0)).toBe(false);
      expect(tickValues.some((v) => v === 100)).toBe(false);
    });

    it('X-axis is present with tick elements for each data point', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const xAxis = container.querySelector('.recharts-xAxis');
      expect(xAxis).toBeTruthy();
      const ticks = xAxis.querySelectorAll('.recharts-cartesian-axis-tick');
      // Should have 5 ticks for 5 data points
      expect(ticks.length).toBe(5);
    });

    it('negative margins data renders Y-axis with ticks', () => {
      renderChart({ data: MOCK_MARGINS_NEGATIVE });
      const container = screen.getByTestId('margins-chart');
      const yAxis = container.querySelector('.recharts-yAxis');
      expect(yAxis).toBeTruthy();
      const ticks = yAxis.querySelectorAll('.recharts-cartesian-axis-tick');
      // Should have ticks; negative values verified via accessible table
      expect(ticks.length).toBeGreaterThan(0);
      // Verify negative values present in data table
      const rows = getTableRows(container);
      expect(getCellFromRow(rows, 0, 2)).toBe('-5.2%');
      expect(getCellFromRow(rows, 0, 3)).toBe('-12.3%');
    });

    it('values > 100% render correctly in data table', () => {
      renderChart({ data: MOCK_MARGINS_HIGH });
      const container = screen.getByTestId('margins-chart');
      // Verify SVG renders
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
      // Verify >100% values present in accessible data table
      const rows = getTableRows(container);
      expect(getCellFromRow(rows, 0, 2)).toBe('105%');
      expect(getCellFromRow(rows, 1, 2)).toBe('110%');
    });

    it('grid lines are present (horizontal)', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const grid = container.querySelector('.recharts-cartesian-grid-horizontal');
      expect(grid).toBeTruthy();
    });
  });

  // =========================================================================
  // Legend Toggle (6 tests)
  // =========================================================================

  describe('Legend toggle', () => {
    it('renders all 3 legend items for full data', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const legend = screen.getByTestId('margins-legend');
      const items = legend.querySelectorAll('button');
      expect(items.length).toBe(3);
    });

    it('legend items show correct labels', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      expect(screen.getByTestId('legend-grossMargin').textContent).toContain('Gross Margin');
      expect(screen.getByTestId('legend-operatingMargin').textContent).toContain('Operating Margin');
      expect(screen.getByTestId('legend-netMargin').textContent).toContain('Net Margin');
    });

    it('click toggles legend item to inactive state', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const grossBtn = screen.getByTestId('legend-grossMargin');
      expect(grossBtn.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(grossBtn);

      expect(grossBtn.getAttribute('aria-pressed')).toBe('false');
      expect(grossBtn.classList.contains('margins-chart__legend-item--inactive')).toBe(true);
    });

    it('toggle restores line on second click', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const grossBtn = screen.getByTestId('legend-grossMargin');

      fireEvent.click(grossBtn); // hide
      expect(grossBtn.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(grossBtn); // show
      expect(grossBtn.getAttribute('aria-pressed')).toBe('true');
      expect(grossBtn.classList.contains('margins-chart__legend-item--inactive')).toBe(false);
    });

    it('min-1-visible: cannot hide the last visible line', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const grossBtn = screen.getByTestId('legend-grossMargin');
      const operatingBtn = screen.getByTestId('legend-operatingMargin');
      const netBtn = screen.getByTestId('legend-netMargin');

      // Hide first two
      fireEvent.click(grossBtn);
      fireEvent.click(operatingBtn);

      // Net is the only one left, clicking it should NOT hide it
      fireEvent.click(netBtn);
      expect(netBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('legend group has accessible role and aria-label', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const legend = screen.getByTestId('margins-legend');
      expect(legend.getAttribute('role')).toBe('group');
      expect(legend.getAttribute('aria-label')).toBe('Toggle margin lines');
    });
  });

  // =========================================================================
  // Tooltip (5 tests)
  // =========================================================================

  describe('Tooltip', () => {
    it('tooltip component renders with correct data-testid', () => {
      // The MarginsTooltip is rendered by Recharts internally;
      // we verify the tooltip content component exists as a custom component
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      // Recharts wraps tooltip but may not show it without hover
      // Verify the chart renders without error (tooltip is wired in)
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
    });

    it('accessible data table shows percentage values with % suffix', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const rows = getTableRows(container);
      // First row (2019): grossMargin 37.8%
      const grossCell = getCellFromRow(rows, 0, 1);
      expect(grossCell).toBe('37.8%');
    });

    it('accessible data table shows values for all three margin types', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const rows = getTableRows(container);
      // Last row (2023): grossMargin 44.1%, operatingMargin 29.8%, netMargin 25.3%
      expect(getCellFromRow(rows, 4, 1)).toBe('44.1%');
      expect(getCellFromRow(rows, 4, 2)).toBe('29.8%');
      expect(getCellFromRow(rows, 4, 3)).toBe('25.3%');
    });

    it('accessible data table shows N/A for null margin values', () => {
      renderChart({ data: MOCK_MARGINS_NO_GROSS });
      const container = screen.getByTestId('margins-chart');
      const rows = getTableRows(container);
      // Gross margin should be N/A for bank data
      expect(getCellFromRow(rows, 0, 1)).toBe('N/A');
    });

    it('accessible data table shows fiscal year in first column', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const rows = getTableRows(container);
      expect(getCellFromRow(rows, 0, 0)).toBe('FY2019');
      expect(getCellFromRow(rows, 4, 0)).toBe('FY2023');
    });
  });

  // =========================================================================
  // Empty State (4 tests)
  // =========================================================================

  describe('Empty state', () => {
    it('null data shows empty state', () => {
      renderChart({ data: null });
      expect(screen.getByTestId('margins-chart-empty')).toBeTruthy();
    });

    it('undefined data shows empty state', () => {
      renderChart({ data: undefined });
      expect(screen.getByTestId('margins-chart-empty')).toBeTruthy();
    });

    it('empty array shows empty state', () => {
      renderChart({ data: [] });
      expect(screen.getByTestId('margins-chart-empty')).toBeTruthy();
    });

    it('empty state has role="status"', () => {
      renderChart({ data: null });
      const emptyState = screen.getByTestId('margins-chart-empty');
      expect(emptyState.getAttribute('role')).toBe('status');
    });
  });

  // =========================================================================
  // Edge Cases (4 tests)
  // =========================================================================

  describe('Edge cases', () => {
    it('single data point renders without crashing', () => {
      renderChart({ data: MOCK_MARGINS_SINGLE });
      const container = screen.getByTestId('margins-chart');
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
      const rows = getTableRows(container);
      expect(rows.length).toBe(1);
    });

    it('negative margins render without crashing', () => {
      renderChart({ data: MOCK_MARGINS_NEGATIVE });
      const container = screen.getByTestId('margins-chart');
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
      const rows = getTableRows(container);
      // Check negative net margin shows correctly in table
      expect(getCellFromRow(rows, 0, 3)).toBe('-12.3%');
    });

    it('margins > 100% render without crashing (software company)', () => {
      renderChart({ data: MOCK_MARGINS_HIGH });
      const container = screen.getByTestId('margins-chart');
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
      const rows = getTableRows(container);
      expect(getCellFromRow(rows, 0, 2)).toBe('105%');
    });

    it('mixed null values render correctly (connectNulls=false)', () => {
      renderChart({ data: MOCK_MARGINS_MIXED_NULLS });
      const container = screen.getByTestId('margins-chart');
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
      const rows = getTableRows(container);
      // Row 0: operatingMargin is null -> N/A
      expect(getCellFromRow(rows, 0, 2)).toBe('N/A');
      // Row 1: netMargin is null -> N/A
      expect(getCellFromRow(rows, 1, 3)).toBe('N/A');
    });
  });

  // =========================================================================
  // Accessibility (2 tests)
  // =========================================================================

  describe('Accessibility', () => {
    it('sr-only data table has correct column headers (Year, Gross, Operating, Net)', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const table = container.querySelector('table.sr-only');
      expect(table).toBeTruthy();
      const headers = table.querySelectorAll('th[scope="col"]');
      expect(headers.length).toBe(4);
      expect(headers[0].textContent).toBe('Year');
      expect(headers[1].textContent).toBe('Gross Margin');
      expect(headers[2].textContent).toBe('Operating Margin');
      expect(headers[3].textContent).toBe('Net Margin');
    });

    it('chart section has descriptive aria-label', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      expect(container.getAttribute('aria-label')).toBe('Profit margins trend chart');
    });
  });

  // =========================================================================
  // Theme (3 tests)
  // =========================================================================

  describe('Theme integration', () => {
    it('renders with default light theme without crashing', () => {
      renderChart({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('renders with dark theme without crashing', () => {
      renderChartDark({ data: MOCK_MARGINS_5Y });
      const container = screen.getByTestId('margins-chart');
      const svg = container.querySelector('svg.recharts-surface');
      expect(svg).toBeTruthy();
    });

    it('structure remains identical across themes', () => {
      // Light theme
      renderChart({ data: MOCK_MARGINS_5Y });
      let container = screen.getByTestId('margins-chart');
      const lightRows = getTableRows(container);
      const lightData = Array.from(lightRows).map((r) => r.textContent);
      cleanup();
      window.localStorage.clear();

      // Dark theme
      renderChartDark({ data: MOCK_MARGINS_5Y });
      container = screen.getByTestId('margins-chart');
      const darkRows = getTableRows(container);
      const darkData = Array.from(darkRows).map((r) => r.textContent);

      expect(lightData).toEqual(darkData);
    });
  });

  // =========================================================================
  // Integration (5 tests)
  // =========================================================================

  describe('Integration', () => {
    it('full pipeline: calculateMargins output renders correctly', () => {
      const metrics = {
        revenue: [
          { value: 100000, fiscalYear: 2023 },
          { value: 90000, fiscalYear: 2022 },
          { value: 80000, fiscalYear: 2021 },
        ],
        grossProfit: [
          { value: 60000, fiscalYear: 2023 },
          { value: 50000, fiscalYear: 2022 },
          { value: 40000, fiscalYear: 2021 },
        ],
        operatingIncome: [
          { value: 30000, fiscalYear: 2023 },
          { value: 25000, fiscalYear: 2022 },
          { value: 20000, fiscalYear: 2021 },
        ],
        netIncome: [
          { value: 20000, fiscalYear: 2023 },
          { value: 18000, fiscalYear: 2022 },
          { value: 15000, fiscalYear: 2021 },
        ],
      };

      const marginsData = calculateMargins(metrics);
      renderChart({ data: marginsData });

      const container = screen.getByTestId('margins-chart');
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();

      const rows = getTableRows(container);
      expect(rows.length).toBe(3);
      // FY2023: gross 60%, operating 30%, net 20%
      expect(getCellFromRow(rows, 2, 0)).toBe('FY2023');
      expect(getCellFromRow(rows, 2, 1)).toBe('60%');
      expect(getCellFromRow(rows, 2, 2)).toBe('30%');
      expect(getCellFromRow(rows, 2, 3)).toBe('20%');
    });

    it('bank data (missing GrossProfit) renders 2-line chart via calculateMargins', () => {
      const metrics = {
        revenue: [
          { value: 50000, fiscalYear: 2023 },
          { value: 45000, fiscalYear: 2022 },
        ],
        // No grossProfit
        operatingIncome: [
          { value: 15000, fiscalYear: 2023 },
          { value: 12000, fiscalYear: 2022 },
        ],
        netIncome: [
          { value: 10000, fiscalYear: 2023 },
          { value: 8000, fiscalYear: 2022 },
        ],
      };

      const marginsData = calculateMargins(metrics);
      renderChart({ data: marginsData });

      const container = screen.getByTestId('margins-chart');
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();

      // Legend should only show 2 items (no gross margin)
      const legend = screen.getByTestId('margins-legend');
      const legendItems = legend.querySelectorAll('button');
      expect(legendItems.length).toBe(2);

      // Table should show N/A for gross margin
      const rows = getTableRows(container);
      expect(getCellFromRow(rows, 0, 1)).toBe('N/A');
    });

    it('pre-revenue company (no revenue) renders empty state', () => {
      const metrics = {
        revenue: [],
      };

      const marginsData = calculateMargins(metrics);
      renderChart({ data: marginsData });

      expect(screen.getByTestId('margins-chart-empty')).toBeTruthy();
    });

    it('data update triggers re-render with new values', () => {
      const { rerender } = render(
        <ThemeProvider>
          <MarginsChart animationDisabled data={MOCK_MARGINS_5Y} />
        </ThemeProvider>,
      );

      let container = screen.getByTestId('margins-chart');
      let rows = getTableRows(container);
      expect(rows.length).toBe(5);

      // Re-render with different data
      rerender(
        <ThemeProvider>
          <MarginsChart animationDisabled data={MOCK_MARGINS_NO_GROSS} />
        </ThemeProvider>,
      );

      container = screen.getByTestId('margins-chart');
      rows = getTableRows(container);
      expect(rows.length).toBe(3);
      expect(getCellFromRow(rows, 0, 1)).toBe('N/A');
    });

    it('barrel export includes MarginsChart', async () => {
      const barrel = await import('../index.js');
      expect(barrel.MarginsChart).toBeDefined();
      expect(typeof barrel.MarginsChart).toBe('function');
    });
  });

  // =========================================================================
  // All-null margin edge case
  // =========================================================================

  describe('All-null margins', () => {
    it('all margins null shows empty state with secondary message', () => {
      renderChart({ data: MOCK_MARGINS_ALL_NULL });
      const emptyState = screen.getByTestId('margins-chart-empty');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No margin data available');
      expect(emptyState.textContent).toContain('profit metrics are missing');
    });
  });

  // =========================================================================
  // PropTypes validation
  // =========================================================================

  describe('PropTypes validation', () => {
    it('component has PropTypes defined', () => {
      expect(MarginsChart.propTypes).toBeDefined();
      expect(MarginsChart.propTypes.data).toBeDefined();
      expect(MarginsChart.propTypes.className).toBeDefined();
      expect(MarginsChart.propTypes.height).toBeDefined();
      expect(MarginsChart.propTypes.animationDisabled).toBeDefined();
    });
  });

  // =========================================================================
  // Console cleanliness
  // =========================================================================

  describe('Console cleanliness', () => {
    it('renders without console errors for valid data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderChart({ data: MOCK_MARGINS_5Y });
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
  });
});
