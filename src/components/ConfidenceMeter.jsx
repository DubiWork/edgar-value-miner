/**
 * ConfidenceMeter — Simple progress bar showing confidence as a percentage.
 *
 * @param {Object} props
 * @param {number} props.confidence - Value between 0 and 1
 * @param {string} props.color - Tailwind/CSS color string for the bar fill
 * @param {string} props.testId - data-testid value for the wrapper
 */
export function ConfidenceMeter({ confidence, color, testId }) {
  const pct = Math.round(confidence * 100);

  return (
    <div data-testid={testId} className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence: ${pct}%`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export default ConfidenceMeter;
