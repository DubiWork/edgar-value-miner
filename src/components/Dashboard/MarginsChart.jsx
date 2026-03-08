import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown } from 'lucide-react';
import { useChartTheme } from '../../hooks/useChartTheme';
import './MarginsChart.css';

// =============================================================================
// Constants
// =============================================================================

/** Default chart height in pixels */
const DEFAULT_HEIGHT = 300;

/** Line animation duration in milliseconds */
const ANIMATION_DURATION = 600;

/** Stagger offset per line in milliseconds */
const ANIMATION_STAGGER = 150;

/** Padding (in percentage points) added above/below the data range */
const Y_AXIS_PADDING = 5;

/** Line definitions keyed by data field */
const LINE_DEFS = [
  {
    key: 'grossMargin',
    label: 'Gross Margin',
    themeColor: 'chartColor3',
    strokeDasharray: undefined,
    legendStyle: 'solid',
    staggerIndex: 0,
  },
  {
    key: 'operatingMargin',
    label: 'Operating Margin',
    themeColor: 'chartColor1',
    strokeDasharray: '8 4',
    legendStyle: 'dashed',
    staggerIndex: 1,
  },
  {
    key: 'netMargin',
    label: 'Net Margin',
    themeColor: 'chartColor2',
    strokeDasharray: '2 4',
    legendStyle: 'dotted',
    staggerIndex: 2,
  },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Checks if ALL margin values are null for every data point.
 * @param {Array} data - Margin data array
 * @returns {boolean}
 */
function isAllNull(data) {
  if (!Array.isArray(data) || data.length === 0) return true;
  return data.every(
    (d) =>
      d.grossMargin === null &&
      d.operatingMargin === null &&
      d.netMargin === null
  );
}

/**
 * Checks whether gross margin data is entirely absent (all null).
 * @param {Array} data - Margin data array
 * @returns {boolean}
 */
function isGrossMarginAbsent(data) {
  if (!Array.isArray(data) || data.length === 0) return true;
  return data.every((d) => d.grossMargin === null);
}

/**
 * Calculates dynamic Y-axis domain from the data, considering visible lines.
 * @param {Array} data - Margin data array
 * @param {Object} visibleLines - Which lines are visible
 * @returns {[number, number]} [min, max] domain
 */
function calculateDomain(data, visibleLines) {
  const values = [];

  for (const entry of data) {
    if (visibleLines.grossMargin && entry.grossMargin !== null) {
      values.push(entry.grossMargin);
    }
    if (visibleLines.operatingMargin && entry.operatingMargin !== null) {
      values.push(entry.operatingMargin);
    }
    if (visibleLines.netMargin && entry.netMargin !== null) {
      values.push(entry.netMargin);
    }
  }

  if (values.length === 0) return [0, 100];

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Add padding, clamp reasonable bounds
  const paddedMin = Math.floor(min - Y_AXIS_PADDING);
  const paddedMax = Math.ceil(max + Y_AXIS_PADDING);

  return [paddedMin, paddedMax];
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Custom tooltip that shows only visible lines.
 */
function MarginsTooltip({ active, payload, theme, visibleLines }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const visibleDefs = LINE_DEFS.filter((def) => visibleLines[def.key]);

  return (
    <div
      className="margins-chart__tooltip"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.textColor,
      }}
      data-testid="margins-tooltip"
    >
      <p className="margins-chart__tooltip-header">{data.label}</p>
      {visibleDefs.map((def) => {
        const value = data[def.key];
        const color = theme[def.themeColor];

        return (
          <div className="margins-chart__tooltip-row" key={def.key}>
            <span className="margins-chart__tooltip-row-label">
              <span
                className="margins-chart__tooltip-row-swatch"
                style={{ backgroundColor: color }}
              />
              {def.label}
            </span>
            <span className="margins-chart__tooltip-row-value">
              {value !== null && value !== undefined ? `${value}%` : 'N/A'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

MarginsTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  theme: PropTypes.object,
  visibleLines: PropTypes.object,
};

/**
 * Custom interactive legend with toggle.
 */
function MarginsLegend({ visibleLines, onToggle, theme, lineDefs }) {
  return (
    <div
      className="margins-chart__legend"
      data-testid="margins-legend"
      role="group"
      aria-label="Toggle margin lines"
    >
      {lineDefs.map((def) => {
        const isActive = visibleLines[def.key];
        const color = theme[def.themeColor];

        return (
          <button
            key={def.key}
            type="button"
            className={`margins-chart__legend-item${
              isActive ? '' : ' margins-chart__legend-item--inactive'
            }`}
            onClick={() => onToggle(def.key)}
            aria-pressed={isActive}
            data-testid={`legend-${def.key}`}
          >
            <span
              className={`margins-chart__legend-swatch${
                def.legendStyle !== 'solid'
                  ? ` margins-chart__legend-swatch--${def.legendStyle}`
                  : ''
              }`}
              style={
                def.legendStyle === 'solid'
                  ? { backgroundColor: color }
                  : { color }
              }
            />
            {def.label}
          </button>
        );
      })}
    </div>
  );
}

MarginsLegend.propTypes = {
  visibleLines: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
  theme: PropTypes.object.isRequired,
  lineDefs: PropTypes.array.isRequired,
};

/**
 * Empty state with icon and messages.
 */
function EmptyState({ message, secondaryMessage }) {
  return (
    <div
      className="margins-chart__empty"
      role="status"
      data-testid="margins-chart-empty"
    >
      <TrendingDown
        className="margins-chart__empty-icon"
        size={48}
        aria-hidden="true"
      />
      <p className="margins-chart__empty-text">{message}</p>
      {secondaryMessage && (
        <p className="margins-chart__empty-text margins-chart__empty-text--secondary">
          {secondaryMessage}
        </p>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  message: PropTypes.string.isRequired,
  secondaryMessage: PropTypes.string,
};

/**
 * Accessible data table for screen readers.
 */
function AccessibleDataTable({ data }) {
  return (
    <table className="sr-only">
      <caption>Profit margins data by fiscal year</caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Gross Margin</th>
          <th scope="col">Operating Margin</th>
          <th scope="col">Net Margin</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr key={entry.fiscalYear}>
            <td>{entry.label}</td>
            <td>
              {entry.grossMargin !== null && entry.grossMargin !== undefined
                ? `${entry.grossMargin}%`
                : 'N/A'}
            </td>
            <td>
              {entry.operatingMargin !== null &&
              entry.operatingMargin !== undefined
                ? `${entry.operatingMargin}%`
                : 'N/A'}
            </td>
            <td>
              {entry.netMargin !== null && entry.netMargin !== undefined
                ? `${entry.netMargin}%`
                : 'N/A'}
            </td>
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
      label: PropTypes.string,
      grossMargin: PropTypes.number,
      operatingMargin: PropTypes.number,
      netMargin: PropTypes.number,
    })
  ).isRequired,
};

// =============================================================================
// MarginsChart Component
// =============================================================================

/**
 * MarginsChart - Renders Gross, Operating, and Net Margins as a Recharts
 * LineChart with three distinct line styles.
 *
 * Designed to slot into ChartContainer (which provides <section> and <h3>).
 * Uses useChartTheme() for all colors and provides an interactive legend
 * for toggling individual margin lines.
 *
 * Features:
 * - Three distinct line styles (solid, dashed, dotted) with unique colors
 * - Dynamic Y-axis domain calculated from visible data
 * - Interactive legend with toggle (minimum 1 line must remain visible)
 * - Custom tooltip showing only visible lines
 * - Staggered line animation (600ms base, 150ms offsets)
 * - Handles missing gross profit data (renders 2 lines)
 * - Accessible hidden data table for screen readers
 * - Responsive via ResponsiveContainer (300px desktop, 250px mobile via CSS)
 * - prefers-reduced-motion support via animationDisabled prop
 *
 * @param {Object} props
 * @param {Array} props.data - Margin data from calculateMargins()
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.height=300] - Chart height in pixels
 * @param {boolean} [props.animationDisabled] - Disable line animations
 */
export function MarginsChart({
  data,
  className = '',
  height = DEFAULT_HEIGHT,
  animationDisabled = false,
}) {
  const theme = useChartTheme();

  // Determine if gross margin data exists
  const grossMarginAbsent = useMemo(
    () => isGrossMarginAbsent(data),
    [data]
  );

  // Filter line definitions based on data availability
  const activeDefs = useMemo(
    () =>
      grossMarginAbsent
        ? LINE_DEFS.filter((def) => def.key !== 'grossMargin')
        : LINE_DEFS,
    [grossMarginAbsent]
  );

  // Track which lines are visible (for legend toggle)
  const [visibleLines, setVisibleLines] = useState({
    grossMargin: true,
    operatingMargin: true,
    netMargin: true,
  });

  // Effective visible lines (exclude absent gross margin)
  const effectiveVisible = useMemo(() => {
    if (grossMarginAbsent) {
      return { ...visibleLines, grossMargin: false };
    }
    return visibleLines;
  }, [visibleLines, grossMarginAbsent]);

  // Toggle handler with min-1-visible rule
  const handleToggle = useCallback(
    (key) => {
      setVisibleLines((prev) => {
        const next = { ...prev, [key]: !prev[key] };

        // Count how many active lines would remain visible
        const activeVisibleCount = activeDefs.filter(
          (def) => next[def.key]
        ).length;

        // Prevent toggling off the last visible line
        if (activeVisibleCount === 0) {
          return prev;
        }

        return next;
      });
    },
    [activeDefs]
  );

  // Calculate dynamic Y-axis domain
  const domain = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [0, 100];
    return calculateDomain(data, effectiveVisible);
  }, [data, effectiveVisible]);

  // --- Empty states ---

  // No data at all
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div
        className={`margins-chart ${className}`.trim()}
        data-testid="margins-chart"
        aria-label="Profit margins trend chart"
      >
        <EmptyState message="No margin data available" />
      </div>
    );
  }

  // All margins null
  if (isAllNull(data)) {
    return (
      <div
        className={`margins-chart ${className}`.trim()}
        data-testid="margins-chart"
        aria-label="Profit margins trend chart"
      >
        <EmptyState
          message="No margin data available"
          secondaryMessage="Revenue data exists but profit metrics are missing"
        />
      </div>
    );
  }

  return (
    <div
      className={`margins-chart ${className}`.trim()}
      data-testid="margins-chart"
      aria-label="Profit margins trend chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.textMutedColor, fontSize: 12 }}
            axisLine={{ stroke: theme.gridColor }}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: theme.textMutedColor, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            content={
              <MarginsTooltip
                theme={theme}
                visibleLines={effectiveVisible}
              />
            }
            cursor={{ stroke: theme.gridColor, strokeDasharray: '3 3' }}
          />
          {activeDefs.map((def) =>
            effectiveVisible[def.key] ? (
              <Line
                key={def.key}
                type="monotone"
                dataKey={def.key}
                stroke={theme[def.themeColor]}
                strokeWidth={2}
                strokeDasharray={def.strokeDasharray}
                dot={{ r: 4, fill: theme[def.themeColor], strokeWidth: 0 }}
                activeDot={{ r: 6, fill: theme[def.themeColor], strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={!animationDisabled}
                animationDuration={ANIMATION_DURATION}
                animationBegin={def.staggerIndex * ANIMATION_STAGGER}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>

      <MarginsLegend
        visibleLines={effectiveVisible}
        onToggle={handleToggle}
        theme={theme}
        lineDefs={activeDefs}
      />

      <AccessibleDataTable data={data} />
    </div>
  );
}

MarginsChart.propTypes = {
  /** Margin data from calculateMargins() */
  data: PropTypes.arrayOf(
    PropTypes.shape({
      fiscalYear: PropTypes.number.isRequired,
      label: PropTypes.string.isRequired,
      grossMargin: PropTypes.number,
      operatingMargin: PropTypes.number,
      netMargin: PropTypes.number,
    })
  ),
  /** Chart height in pixels (default 300, mobile 250 via CSS) */
  height: PropTypes.number,
  /** Disable line entrance animations (useful for tests and reduced motion) */
  animationDisabled: PropTypes.bool,
  /** Additional CSS classes for the container */
  className: PropTypes.string,
};

export default MarginsChart;
