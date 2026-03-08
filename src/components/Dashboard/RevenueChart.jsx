import PropTypes from 'prop-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateYoY } from '../../utils/calculateYoY';
import './RevenueChart.css';

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of years to display */
const MAX_YEARS = 5;

/** Default chart height in pixels */
const DEFAULT_HEIGHT = 300;

/** Bar animation duration in milliseconds */
const ANIMATION_DURATION = 600;

/** Bar top border radius */
const BAR_RADIUS = [4, 4, 0, 0];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Checks whether a data entry has a valid, finite numeric value.
 * @param {Object} entry - A revenue data point
 * @returns {boolean}
 */
function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const { value } = entry;
  return typeof value === 'number' && isFinite(value);
}

/**
 * Checks if every entry in the array has a value of zero.
 * @param {Array} data - Processed chart data
 * @returns {boolean}
 */
function isPreRevenue(data) {
  return data.length > 0 && data.every((d) => d.value === 0);
}

/**
 * Processes raw revenue data into chart-ready format.
 *
 * Steps:
 * 1. Filter invalid entries (NaN, Infinity, null, non-objects)
 * 2. Slice to most recent MAX_YEARS entries
 * 3. Reverse to chronological order (oldest first)
 * 4. Calculate YoY growth for each entry
 *
 * @param {Array} rawData - Array of { value, fiscalYear, period }
 * @returns {Array} Chart-ready data with yoyFormatted and xLabel fields
 */
function processData(rawData) {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  // Filter invalid entries, take most recent MAX_YEARS, then reverse to chronological
  const valid = rawData.filter(isValidEntry);
  const sliced = valid.slice(0, MAX_YEARS);
  const chronological = [...sliced].reverse();

  return chronological.map((entry, index) => {
    const prevEntry = index > 0 ? chronological[index - 1] : null;
    const yoy = prevEntry
      ? calculateYoY(entry.value, prevEntry.value)
      : { percentage: null, formatted: '' };

    return {
      value: entry.value,
      fiscalYear: entry.fiscalYear,
      period: entry.period,
      xLabel: `FY${entry.fiscalYear}`,
      yoyFormatted: yoy.formatted,
      yoyPercentage: yoy.percentage,
    };
  });
}

/**
 * Custom YoY label renderer for LabelList.
 * Returns null for the first bar (no prior year) or on mobile.
 */
function renderYoYLabel(props) {
  const { x, y, width, value } = props;
  if (!value) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      className="revenue-chart__yoy-label"
      data-testid="yoy-label"
    >
      {value}
    </text>
  );
}

/**
 * Custom tooltip content for the revenue chart.
 */
function CustomTooltip({ active, payload, theme }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div
      className="revenue-chart__tooltip"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.textColor,
      }}
    >
      <p className="revenue-chart__tooltip-year">{data.xLabel}</p>
      <p className="revenue-chart__tooltip-value">
        {formatCurrency(data.value)}
      </p>
      {data.yoyFormatted && (
        <p className="revenue-chart__tooltip-yoy">
          YoY: {data.yoyFormatted}
        </p>
      )}
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({
    payload: PropTypes.object,
  })),
  theme: PropTypes.object,
};

// =============================================================================
// Empty State
// =============================================================================

function EmptyState({ message }) {
  return (
    <div
      className="revenue-chart__empty"
      role="status"
      data-testid="revenue-chart-empty"
    >
      <BarChart3 className="revenue-chart__empty-icon" size={48} aria-hidden="true" />
      <p className="revenue-chart__empty-text">{message}</p>
    </div>
  );
}

EmptyState.propTypes = {
  message: PropTypes.string.isRequired,
};

// =============================================================================
// Accessible Data Table (sr-only)
// =============================================================================

function AccessibleDataTable({ data }) {
  return (
    <table className="sr-only">
      <caption>Annual revenue data</caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Revenue</th>
          <th scope="col">YoY Growth</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr key={entry.fiscalYear}>
            <td>{entry.xLabel}</td>
            <td>{formatCurrency(entry.value)}</td>
            <td>{entry.yoyFormatted || 'N/A'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

AccessibleDataTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      fiscalYear: PropTypes.number,
      xLabel: PropTypes.string,
      value: PropTypes.number,
      yoyFormatted: PropTypes.string,
    })
  ).isRequired,
};

// =============================================================================
// RevenueChart Component
// =============================================================================

/**
 * RevenueChart - Renders annual revenue as a Recharts BarChart.
 *
 * Designed to slot into ChartContainer (which provides <section> and <h3>).
 * Uses useChartTheme() for all colors, formatCurrency for Y-axis ticks,
 * and calculateYoY for growth labels above bars.
 *
 * Features:
 * - Responsive via ResponsiveContainer (300px desktop, 250px mobile via CSS)
 * - YoY growth labels above each bar (except first year)
 * - Custom tooltip with fiscal year, formatted value, and YoY growth
 * - Accessible hidden data table for screen readers
 * - Empty state for null/empty data and pre-revenue companies
 * - prefers-reduced-motion support via animationDisabled prop
 *
 * @param {Object} props
 * @param {Array} props.data - Revenue data: [{ value, fiscalYear, period }]
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.height=300] - Chart height in pixels
 * @param {boolean} [props.animationDisabled] - Disable bar animations
 */
export function RevenueChart({
  data,
  className = '',
  height = DEFAULT_HEIGHT,
  animationDisabled = false,
}) {
  const theme = useChartTheme();
  const chartData = processData(data);

  // Empty / no data state
  if (chartData.length === 0) {
    return (
      <div
        className={`revenue-chart ${className}`.trim()}
        data-testid="revenue-chart"
        aria-label="Revenue trend chart showing annual revenue"
      >
        <EmptyState message="No revenue data available" />
      </div>
    );
  }

  // Pre-revenue state (all zeros)
  if (isPreRevenue(chartData)) {
    return (
      <div
        className={`revenue-chart ${className}`.trim()}
        data-testid="revenue-chart"
        aria-label="Revenue trend chart showing annual revenue"
      >
        <EmptyState message="Pre-revenue company" />
        <AccessibleDataTable data={chartData} />
      </div>
    );
  }

  return (
    <div
      className={`revenue-chart ${className}`.trim()}
      data-testid="revenue-chart"
      aria-label="Revenue trend chart showing annual revenue"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 24, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="xLabel"
            tick={{ fill: theme.textMutedColor, fontSize: 12 }}
            axisLine={{ stroke: theme.gridColor }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fill: theme.textMutedColor, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            content={<CustomTooltip theme={theme} />}
            cursor={{ fill: theme.gridColor, opacity: 0.3 }}
          />
          <Bar
            dataKey="value"
            fill={theme.chartColor1}
            radius={BAR_RADIUS}
            isAnimationActive={!animationDisabled}
            animationDuration={ANIMATION_DURATION}
          >
            <LabelList
              dataKey="yoyFormatted"
              content={renderYoYLabel}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <AccessibleDataTable data={chartData} />
    </div>
  );
}

RevenueChart.propTypes = {
  /** Revenue data array: [{ value, fiscalYear, period }] */
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number,
      fiscalYear: PropTypes.number,
      period: PropTypes.string,
    })
  ),
  /** Additional CSS classes for the container */
  className: PropTypes.string,
  /** Chart height in pixels (default 300, mobile 250 via CSS) */
  height: PropTypes.number,
  /** Disable bar entrance animations (useful for tests and reduced motion) */
  animationDisabled: PropTypes.bool,
};

export default RevenueChart;
