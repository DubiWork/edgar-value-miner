import PropTypes from 'prop-types';

/**
 * LoadingSpinner - A circular spinner for quick operations
 * @param {Object} props
 * @param {'sm'|'md'|'lg'} props.size - Size of the spinner
 * @param {string} props.className - Additional CSS classes
 */
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block ${className}`}
    >
      <div
        className={`${sizeClasses[size]} rounded-full border-gray-200 dark:border-gray-700 border-t-brand-500 animate-spin`}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

/**
 * LoadingProgress - Progress bar for operations with known completion percentage
 * @param {Object} props
 * @param {number} props.value - Progress percentage (0-100)
 * @param {string} props.message - Optional message to display
 * @param {boolean} props.showPercentage - Whether to show percentage text
 * @param {string} props.source - Data source indicator (e.g., "cache", "api")
 */
export function LoadingProgress({
  value = 0,
  message = '',
  showPercentage = true,
  source = '',
}) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={message || 'Loading progress'}
      className="w-full"
    >
      {(message || source) && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {message}
          </span>
          {source && (
            <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {source === 'cache' ? 'Loading from cache...' : `Source: ${source}`}
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showPercentage && (
        <div className="mt-1 text-right">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {clampedValue}%
          </span>
        </div>
      )}
    </div>
  );
}

LoadingProgress.propTypes = {
  value: PropTypes.number,
  message: PropTypes.string,
  showPercentage: PropTypes.bool,
  source: PropTypes.string,
};

/**
 * LoadingSkeleton - Skeleton loader for various content types
 * @param {Object} props
 * @param {'company-card'|'text'|'avatar'|'stat'} props.type - Type of skeleton
 * @param {string} props.className - Additional CSS classes
 */
export function LoadingSkeleton({ type = 'text', className = '' }) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  const skeletonTypes = {
    'company-card': (
      <div
        role="status"
        aria-label="Loading company card"
        className={`card ${className}`}
      >
        <div className="flex items-center space-x-4 mb-4">
          <div className={`${baseClasses} h-12 w-12 rounded-lg`} />
          <div className="flex-1 space-y-2">
            <div className={`${baseClasses} h-5 w-32`} />
            <div className={`${baseClasses} h-3 w-20`} />
          </div>
        </div>
        <div className="space-y-3">
          <div className={`${baseClasses} h-4 w-full`} />
          <div className={`${baseClasses} h-4 w-3/4`} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className={`${baseClasses} h-16 rounded-lg`} />
          <div className={`${baseClasses} h-16 rounded-lg`} />
          <div className={`${baseClasses} h-16 rounded-lg`} />
        </div>
        <span className="sr-only">Loading company card...</span>
      </div>
    ),
    text: (
      <div
        role="status"
        aria-label="Loading text"
        className={`space-y-2 ${className}`}
      >
        <div className={`${baseClasses} h-4 w-full`} />
        <div className={`${baseClasses} h-4 w-5/6`} />
        <div className={`${baseClasses} h-4 w-4/6`} />
        <span className="sr-only">Loading text...</span>
      </div>
    ),
    avatar: (
      <div
        role="status"
        aria-label="Loading avatar"
        className={className}
      >
        <div className={`${baseClasses} h-10 w-10 rounded-full`} />
        <span className="sr-only">Loading avatar...</span>
      </div>
    ),
    stat: (
      <div
        role="status"
        aria-label="Loading statistic"
        className={`${className}`}
      >
        <div className={`${baseClasses} h-3 w-16 mb-2`} />
        <div className={`${baseClasses} h-8 w-24`} />
        <span className="sr-only">Loading statistic...</span>
      </div>
    ),
  };

  return skeletonTypes[type] || skeletonTypes.text;
}

LoadingSkeleton.propTypes = {
  type: PropTypes.oneOf(['company-card', 'text', 'avatar', 'stat']),
  className: PropTypes.string,
};

/**
 * ShimmerChart - Shimmer effect placeholder for chart loading
 * @param {Object} props
 * @param {'line'|'bar'} props.type - Type of chart being loaded
 * @param {number} props.height - Height of the chart placeholder
 * @param {string} props.className - Additional CSS classes
 */
export function ShimmerChart({ type = 'line', height = 200, className = '' }) {
  const shimmerGradient = `
    bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
    dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
    bg-[length:200%_100%] animate-shimmer
  `;

  return (
    <div
      role="status"
      aria-label={`Loading ${type} chart`}
      className={`card ${className}`}
    >
      {/* Chart header skeleton */}
      <div className="flex justify-between items-center mb-4">
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-32" />
        <div className="flex space-x-2">
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-6 w-16" />
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-6 w-16" />
        </div>
      </div>

      {/* Chart area with shimmer */}
      <div
        className={`relative overflow-hidden rounded-lg ${shimmerGradient}`}
        style={{ height }}
      >
        {type === 'line' && (
          <svg
            className="absolute inset-0 w-full h-full opacity-20"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
          >
            <path
              d="M0,150 Q50,120 100,140 T200,100 T300,130 T400,80"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-400 dark:text-gray-500"
            />
          </svg>
        )}
        {type === 'bar' && (
          <div className="absolute inset-0 flex items-end justify-around px-4 pb-4 opacity-20">
            {[60, 80, 45, 90, 70, 85, 55].map((h, i) => (
              <div
                key={i}
                className="w-8 bg-gray-400 dark:bg-gray-500 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chart legend skeleton */}
      <div className="flex justify-center space-x-6 mt-4">
        <div className="flex items-center space-x-2">
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-3" />
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-16" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-3" />
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-16" />
        </div>
      </div>
      <span className="sr-only">Loading {type} chart...</span>
    </div>
  );
}

ShimmerChart.propTypes = {
  type: PropTypes.oneOf(['line', 'bar']),
  height: PropTypes.number,
  className: PropTypes.string,
};

/**
 * LoadingOverlay - Full screen or container overlay with loading indicator
 * @param {Object} props
 * @param {string} props.message - Message to display
 * @param {boolean} props.fullScreen - Whether to cover the full screen
 */
export function LoadingOverlay({ message = 'Loading...', fullScreen = false }) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0';

  return (
    <div
      role="status"
      aria-label={message}
      className={`${containerClasses} flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm`}
    >
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}

LoadingOverlay.propTypes = {
  message: PropTypes.string,
  fullScreen: PropTypes.bool,
};

/**
 * LoadingDots - Animated dots for inline loading indication
 */
export function LoadingDots() {
  return (
    <span role="status" aria-label="Loading" className="inline-flex space-x-1">
      <span className="h-1.5 w-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      <span className="sr-only">Loading...</span>
    </span>
  );
}

// Default export with all components
export default {
  LoadingSpinner,
  LoadingProgress,
  LoadingSkeleton,
  ShimmerChart,
  LoadingOverlay,
  LoadingDots,
};
