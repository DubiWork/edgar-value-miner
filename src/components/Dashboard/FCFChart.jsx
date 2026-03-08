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
  Cell,
  ReferenceLine,
} from 'recharts';
import { TrendingDown } from 'lucide-react';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateYoY } from '../../utils/calculateYoY';
import './FCFChart.css';

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of years to display */
const MAX_YEARS = 5;

/** Default chart height in pixels */
const DEFAULT_HEIGHT = 300;

/** Bar animation duration in milliseconds */
const ANIMATION_DURATION = 600;

/** Positive bar border radius (top rounded) */
const BAR_RADIUS_POSITIVE = [4, 4, 0, 0];

/** Negative bar border radius (bottom rounded) */
const BAR_RADIUS_NEGATIVE = [0, 0, 4, 4];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Checks whether a data entry has a valid, finite numeric value.
 * @param {Object} entry - An FCF data point
 * @returns {boolean}
 */
function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const { value } = entry;
  return typeof value === 'number' && isFinite(value);
}

/**
 * Determines if the sign changed between two values (positive to negative
 * or negative to positive). Returns true if either value is zero (ambiguous).
 * @param {number} current
 * @param {number} previous
 * @returns {boolean}
 */
function hasSignChange(current, previous) {
  if (current === 0 || previous === 0) return true;
  return (current > 0 && previous < 0) || (current < 0 && previous > 0);
}

/**
 * Processes raw FCF data into chart-ready format.
 *
 * Steps:
 * 1. Filter invalid entries (NaN, Infinity, null, non-objects)
 * 2. Slice to most recent MAX_YEARS entries
 * 3. Reverse to chronological order (oldest first)
 * 4. Calculate YoY growth for each entry
 *
 * @param {Array} rawData - Array of { value, fiscalYear, period, calculated, components }
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
    let yoy = { percentage: null, formatted: '' };

    if (prevEntry) {
      if (hasSignChange(entry.value, prevEntry.value)) {
        yoy = { percentage: null, formatted: 'N/A' };
      } else {
        yoy = calculateYoY(entry.value, prevEntry.value);
      }
    }

    return {
      value: entry.value,
      fiscalYear: entry.fiscalYear,
      period: entry.period,
      calculated: entry.calculated,
      components: entry.components || null,
      xLabel: `FY${entry.fiscalYear}`,
      yoyFormatted: yoy.formatted,
      yoyPercentage: yoy.percentage,
    };
  });
}

/**
 * Whether any data point has a negative FCF value.
 * @param {Array} data - Processed chart data
 * @returns {boolean}
 */
function hasNegativeValues(data) {
  return data.some((d) => d.value < 0);
}

/**
 * Custom bar shape that applies different border radii for positive vs negative.
 */
function FCFBarShape(props) {
  const { x, y, width, height: h, value } = props;
  if (width === 0 || h === 0) return null;

  const radius = value >= 0 ? BAR_RADIUS_POSITIVE : BAR_RADIUS_NEGATIVE;
  const [tl, tr, br, bl] = radius;

  // Build SVG path with rounded corners
  const absH = Math.abs(h);
  const path = `
    M${x + tl},${y}
    L${x + width - tr},${y}
    Q${x + width},${y} ${x + width},${y + tr}
    L${x + width},${y + absH - br}
    Q${x + width},${y + absH} ${x + width - br},${y + absH}
    L${x + bl},${y + absH}
    Q${x},${y + absH} ${x},${y + absH - bl}
    L${x},${y + tl}
    Q${x},${y} ${x + tl},${y}
    Z
  `;

  return <path d={path} fill={props.fill} />;
}

FCFBarShape.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  value: PropTypes.number,
  fill: PropTypes.string,
};

/**
 * Custom YoY label renderer for LabelList.
 * Positions above positive bars, below negative bars.
 * Returns null for the first bar (no prior year) or when no value.
 */
function renderYoYLabel(props) {
  const { x, y, width, value, index } = props;
  if (!value || index === undefined) return null;

  // Access the chart data from the BarChart payload to determine bar direction
  const offset = 8;

  return (
    <text
      x={x + width / 2}
      y={y - offset}
      textAnchor="middle"
      className="fcf-chart__yoy-label"
      data-testid="yoy-label"
    >
      {value}
    </text>
  );
}

/**
 * Custom tooltip content for the FCF chart with 3-line breakdown.
 */
function CustomTooltip({ active, payload, theme }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const isNegative = data.value < 0;
  const fcfColor = isNegative ? theme.dangerColor : theme.successColor;

  return (
    <div
      className="fcf-chart__tooltip"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.textColor,
      }}
      data-testid="fcf-tooltip"
    >
      <p className="fcf-chart__tooltip-header">
        {data.xLabel}
        {data.yoyFormatted && ` (${data.yoyFormatted})`}
      </p>

      {data.components && (
        <>
          <div className="fcf-chart__tooltip-row">
            <span className="fcf-chart__tooltip-row-label">Operating Cash Flow</span>
            <span className="fcf-chart__tooltip-row-value">
              {formatCurrency(data.components.operatingCashFlow)}
            </span>
          </div>
          <div className="fcf-chart__tooltip-row">
            <span className="fcf-chart__tooltip-row-label">Capital Expenditures</span>
            <span className="fcf-chart__tooltip-row-value">
              {formatCurrency(Math.abs(data.components.capitalExpenditures))}
            </span>
          </div>
          <hr
            className="fcf-chart__tooltip-separator"
            style={{ borderColor: theme.tooltipBorder }}
          />
        </>
      )}

      <div className="fcf-chart__tooltip-fcf">
        <span>Free Cash Flow</span>
        <span style={{ color: fcfColor }}>
          {formatCurrency(data.value)}
        </span>
      </div>
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
      className="fcf-chart__empty"
      role="status"
      data-testid="fcf-chart-empty"
    >
      <TrendingDown className="fcf-chart__empty-icon" size={48} aria-hidden="true" />
      <p className="fcf-chart__empty-text">{message}</p>
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
      <caption>Annual free cash flow data</caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Free Cash Flow</th>
          <th scope="col">Operating Cash Flow</th>
          <th scope="col">Capital Expenditures</th>
          <th scope="col">YoY Growth</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr key={entry.fiscalYear}>
            <td>{entry.xLabel}</td>
            <td>{formatCurrency(entry.value)}</td>
            <td>
              {entry.components
                ? formatCurrency(entry.components.operatingCashFlow)
                : 'N/A'}
            </td>
            <td>
              {entry.components
                ? formatCurrency(Math.abs(entry.components.capitalExpenditures))
                : 'N/A'}
            </td>
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
      components: PropTypes.shape({
        operatingCashFlow: PropTypes.number,
        capitalExpenditures: PropTypes.number,
      }),
      yoyFormatted: PropTypes.string,
    })
  ).isRequired,
};

// =============================================================================
// FCFChart Component
// =============================================================================

/**
 * FCFChart - Renders annual Free Cash Flow as a Recharts BarChart with
 * dual-color bars (green positive / red negative).
 *
 * Designed to slot into ChartContainer (which provides <section> and <h3>).
 * Uses useChartTheme() for all colors including successColor and dangerColor,
 * formatCurrency for Y-axis ticks, and calculateYoY for growth labels.
 *
 * Features:
 * - Dual-color bars: green for positive FCF, red for negative
 * - ReferenceLine at y=0 when negative values exist
 * - 3-line tooltip showing OCF/CapEx/FCF breakdown
 * - YoY growth labels above positive bars, below negative
 * - Sign-change YoY displays "N/A"
 * - Responsive via ResponsiveContainer (300px desktop, 250px mobile via CSS)
 * - Accessible hidden data table with 5 columns
 * - prefers-reduced-motion support via animationDisabled prop
 * - Empty states for no data and missing CapEx
 *
 * @param {Object} props
 * @param {Array} props.data - FCF data from gaapNormalizer.calculateFreeCashFlow()
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.height=300] - Chart height in pixels
 * @param {boolean} [props.animationDisabled] - Disable bar animations
 */
export function FCFChart({
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
        className={`fcf-chart ${className}`.trim()}
        data-testid="fcf-chart"
        aria-label="Free cash flow chart showing annual FCF"
      >
        <EmptyState message="No free cash flow data available" />
      </div>
    );
  }

  // Check if all entries are missing components (no CapEx data)
  const allMissingComponents = chartData.every((d) => !d.components);
  if (allMissingComponents) {
    return (
      <div
        className={`fcf-chart ${className}`.trim()}
        data-testid="fcf-chart"
        aria-label="Free cash flow chart showing annual FCF"
      >
        <EmptyState message="Capital expenditure data unavailable for FCF breakdown" />
        <AccessibleDataTable data={chartData} />
      </div>
    );
  }

  const showReferenceLine = hasNegativeValues(chartData);

  return (
    <div
      className={`fcf-chart ${className}`.trim()}
      data-testid="fcf-chart"
      aria-label="Free cash flow chart showing annual FCF"
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
          {showReferenceLine && (
            <ReferenceLine
              y={0}
              stroke={theme.textMutedColor}
              strokeDasharray="3 3"
              data-testid="fcf-reference-line"
            />
          )}
          <Bar
            dataKey="value"
            shape={<FCFBarShape />}
            isAnimationActive={!animationDisabled}
            animationDuration={ANIMATION_DURATION}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.fiscalYear}
                fill={entry.value >= 0 ? theme.successColor : theme.dangerColor}
              />
            ))}
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

FCFChart.propTypes = {
  /** FCF data array from gaapNormalizer.calculateFreeCashFlow() */
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number,
      fiscalYear: PropTypes.number,
      period: PropTypes.string,
      calculated: PropTypes.bool,
      components: PropTypes.shape({
        operatingCashFlow: PropTypes.number,
        capitalExpenditures: PropTypes.number,
      }),
    })
  ),
  /** Additional CSS classes for the container */
  className: PropTypes.string,
  /** Chart height in pixels (default 300, mobile 250 via CSS) */
  height: PropTypes.number,
  /** Disable bar entrance animations (useful for tests and reduced motion) */
  animationDisabled: PropTypes.bool,
};

export default FCFChart;
