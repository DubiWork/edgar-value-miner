import { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { calculateFairValue, getValuationColor, getValuationIcon } from '../../utils/calculateFairValue';
import './ValuationPanel.css';

// =============================================================================
// Constants
// =============================================================================

/** Default target P/E (Graham baseline). */
const DEFAULT_PE = 15;

/** Slider range boundaries. */
const PE_MIN = 5;
const PE_MAX = 50;
const PE_STEP = 0.5;

/** Debounce delay for calculation updates (ms). */
const CALC_DEBOUNCE_MS = 50;

/** Debounce delay for aria-live announcements (ms). */
const ANNOUNCE_DEBOUNCE_MS = 500;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Checks whether EPS is valid for P/E calculation (positive finite number).
 * @param {*} eps
 * @returns {boolean}
 */
function isValidEps(eps) {
  return typeof eps === 'number' && isFinite(eps) && eps > 0;
}

/**
 * Checks whether a price value is available for display.
 * @param {*} price
 * @returns {boolean}
 */
function hasPrice(price) {
  return typeof price === 'number' && isFinite(price) && price > 0;
}

/**
 * Formats a number as a dollar amount.
 * @param {number} value
 * @returns {string}
 */
function formatDollar(value) {
  return `$${value.toFixed(2)}`;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ValuationPanel - P/E Fair Value calculator with adjustable slider.
 *
 * Features:
 * - Real-time fair value calculation via adjustable Target P/E slider
 * - Margin of safety with triple-redundancy status indicator (color + text + icon)
 * - Debounced calculation (50ms) and aria-live announcements (500ms)
 * - Shimmer loading state, graceful edge-case handling (negative EPS, missing price)
 * - Cross-browser slider styling, 44px touch targets, prefers-reduced-motion support
 *
 * @param {Object} props
 * @param {number} props.eps - Earnings per share
 * @param {number} props.currentPrice - Current stock price
 * @param {string} props.companyName - Company display name
 * @param {boolean} [props.loading=false] - Show loading shimmer
 */
export function ValuationPanel({ eps, currentPrice, companyName, loading = false }) {
  const [targetPE, setTargetPE] = useState(DEFAULT_PE);
  const [announcement, setAnnouncement] = useState('');
  const calcTimerRef = useRef(null);
  const announceTimerRef = useRef(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (calcTimerRef.current) clearTimeout(calcTimerRef.current);
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  const validEps = isValidEps(eps);
  const priceAvailable = hasPrice(currentPrice);

  // Calculate fair value
  const result = calculateFairValue({
    eps: validEps ? eps : 1, // pass dummy to get targetPE back
    currentPrice: priceAvailable ? currentPrice : undefined,
    targetPE,
  });

  // Handle slider change with debounced calculation
  const handleSliderChange = useCallback((e) => {
    const newPE = parseFloat(e.target.value);

    if (calcTimerRef.current) clearTimeout(calcTimerRef.current);

    calcTimerRef.current = setTimeout(() => {
      setTargetPE(newPE);
    }, CALC_DEBOUNCE_MS);

    // Update slider value immediately for responsiveness
    setTargetPE(newPE);

    // Debounced aria-live announcement
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    announceTimerRef.current = setTimeout(() => {
      if (validEps && priceAvailable) {
        const newResult = calculateFairValue({ eps, currentPrice, targetPE: newPE });
        setAnnouncement(
          `Fair value ${newResult.display.fairValue} at ${newPE.toFixed(1)} P/E. ` +
          `Margin of safety ${newResult.display.marginOfSafety}. ${newResult.display.valuationStatus}.`
        );
      }
    }, ANNOUNCE_DEBOUNCE_MS);
  }, [eps, currentPrice, validEps, priceAvailable]);

  // =========================================================================
  // Loading state
  // =========================================================================
  if (loading) {
    return (
      <section
        className="card valuation-panel valuation-panel--loading"
        role="status"
        aria-label="Loading valuation data"
        data-testid="valuation-panel"
      >
        <div className="valuation-panel__shimmer valuation-panel__shimmer--title" />
        <div className="valuation-panel__shimmer valuation-panel__shimmer--grid">
          <div className="valuation-panel__shimmer valuation-panel__shimmer--value" />
          <div className="valuation-panel__shimmer valuation-panel__shimmer--value" />
        </div>
        <div className="valuation-panel__shimmer valuation-panel__shimmer--slider" />
        <span className="sr-only">Loading valuation data...</span>
      </section>
    );
  }

  // =========================================================================
  // Negative/zero EPS
  // =========================================================================
  if (!validEps) {
    return (
      <section
        className="card valuation-panel"
        aria-label={`P/E Fair Value analysis for ${companyName || 'company'}`}
        data-testid="valuation-panel"
      >
        <h3 className="valuation-panel__title">P/E Fair Value</h3>
        <div className="valuation-panel__grid">
          <div className="valuation-panel__price">
            <span className="valuation-panel__label">Current Price</span>
            <span className="valuation-panel__value">
              {priceAvailable ? formatDollar(currentPrice) : '--'}
            </span>
          </div>
          <div className="valuation-panel__fair-value">
            <span className="valuation-panel__label">Fair Value</span>
            <span className="valuation-panel__value valuation-panel__value--na">N/A</span>
          </div>
        </div>
        <p className="valuation-panel__message">
          N/A — P/E requires positive earnings
        </p>
        <div className="valuation-panel__slider-section">
          <input
            type="range"
            className="valuation-panel__slider"
            min={PE_MIN}
            max={PE_MAX}
            step={PE_STEP}
            value={targetPE}
            disabled
            aria-label="Target P/E ratio"
            aria-valuemin={PE_MIN}
            aria-valuemax={PE_MAX}
            aria-valuenow={targetPE}
          />
        </div>
      </section>
    );
  }

  // =========================================================================
  // No price data
  // =========================================================================
  if (!priceAvailable) {
    return (
      <section
        className="card valuation-panel"
        aria-label={`P/E Fair Value analysis for ${companyName || 'company'}`}
        data-testid="valuation-panel"
      >
        <h3 className="valuation-panel__title">P/E Fair Value</h3>
        <div className="valuation-panel__grid">
          <div className="valuation-panel__price">
            <span className="valuation-panel__label">Current Price</span>
            <span className="valuation-panel__value valuation-panel__value--na">
              Price data unavailable
            </span>
          </div>
          <div className="valuation-panel__fair-value">
            <span className="valuation-panel__label">Fair Value</span>
            <span className="valuation-panel__value">{result.display.fairValue}</span>
            <span className="valuation-panel__pe-label">at {targetPE.toFixed(1)} P/E</span>
          </div>
        </div>
        <div className="valuation-panel__slider-section">
          <div className="valuation-panel__slider-header">
            <span className="valuation-panel__slider-label">Target P/E</span>
            <output className="valuation-panel__slider-output">{targetPE.toFixed(1)}</output>
          </div>
          <input
            type="range"
            className="valuation-panel__slider"
            min={PE_MIN}
            max={PE_MAX}
            step={PE_STEP}
            value={targetPE}
            onChange={handleSliderChange}
            aria-label="Target P/E ratio"
            aria-valuemin={PE_MIN}
            aria-valuemax={PE_MAX}
            aria-valuenow={targetPE}
          />
          <div className="valuation-panel__slider-range">
            <span>{PE_MIN}</span>
            <span>{PE_MAX}</span>
          </div>
        </div>
        <div aria-live="polite" className="sr-only">{announcement}</div>
      </section>
    );
  }

  // =========================================================================
  // Normal state — all data available
  // =========================================================================
  const { valuationStatus } = result;
  const statusColor = getValuationColor(valuationStatus);
  const statusIcon = getValuationIcon(valuationStatus);

  return (
    <section
      className="card valuation-panel"
      aria-label={`P/E Fair Value analysis for ${companyName || 'company'}`}
      data-testid="valuation-panel"
    >
      <h3 className="valuation-panel__title">P/E Fair Value</h3>

      <div className="valuation-panel__grid">
        {/* Left column: prices */}
        <div className="valuation-panel__prices">
          <div className="valuation-panel__price">
            <span className="valuation-panel__label">Current Price</span>
            <span className="valuation-panel__value">{formatDollar(currentPrice)}</span>
          </div>
          <div className="valuation-panel__fair-value">
            <span className="valuation-panel__label">Fair Value</span>
            <span className="valuation-panel__value">{result.display.fairValue}</span>
            <span className="valuation-panel__pe-label">at {targetPE.toFixed(1)} P/E</span>
          </div>
        </div>

        {/* Right column: margin of safety */}
        <div className="valuation-panel__margin">
          <span className="valuation-panel__label">Margin of Safety</span>
          <span className="valuation-panel__margin-value" style={{ color: `var(${statusColor})` }}>
            {result.display.marginOfSafety}
          </span>
          <span
            className={`valuation-panel__status valuation-panel__status--${valuationStatus}`}
            role="img"
            aria-label={`Valuation status: ${result.display.valuationStatus}`}
          >
            <span className="valuation-panel__status-icon" aria-hidden="true">{statusIcon}</span>
            {result.display.valuationStatus}
          </span>
        </div>
      </div>

      {/* Full width: slider */}
      <div className="valuation-panel__slider-section">
        <div className="valuation-panel__slider-header">
          <span className="valuation-panel__slider-label">Target P/E</span>
          <output className="valuation-panel__slider-output">{targetPE.toFixed(1)}</output>
        </div>
        <input
          type="range"
          className="valuation-panel__slider"
          min={PE_MIN}
          max={PE_MAX}
          step={PE_STEP}
          value={targetPE}
          onChange={handleSliderChange}
          aria-label="Target P/E ratio"
          aria-valuemin={PE_MIN}
          aria-valuemax={PE_MAX}
          aria-valuenow={targetPE}
        />
        <div className="valuation-panel__slider-range">
          <span>{PE_MIN}</span>
          <span>{PE_MAX}</span>
        </div>
      </div>

      {/* Aria-live region for debounced announcements */}
      <div aria-live="polite" className="sr-only">{announcement}</div>
    </section>
  );
}

ValuationPanel.propTypes = {
  eps: PropTypes.number,
  currentPrice: PropTypes.number,
  companyName: PropTypes.string,
  loading: PropTypes.bool,
};

export default ValuationPanel;
