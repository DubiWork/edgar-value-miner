import {
  LoadingSpinner,
  LoadingProgress,
  LoadingSkeleton,
  ShimmerChart,
  LoadingOverlay,
  LoadingDots,
} from './LoadingStates';

/**
 * LoadingStatesDemo - Demo component showcasing all loading states
 * This component is for development/testing purposes only
 */
export function LoadingStatesDemo() {
  return (
    <div className="p-8 space-y-12 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Loading States Demo
      </h1>

      {/* Spinners */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Loading Spinners
        </h2>
        <div className="flex items-center gap-8">
          <div className="text-center">
            <LoadingSpinner size="sm" />
            <p className="mt-2 text-sm text-gray-500">Small</p>
          </div>
          <div className="text-center">
            <LoadingSpinner size="md" />
            <p className="mt-2 text-sm text-gray-500">Medium</p>
          </div>
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-2 text-sm text-gray-500">Large</p>
          </div>
        </div>
      </section>

      {/* Loading Dots */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Loading Dots
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Processing<LoadingDots />
        </p>
      </section>

      {/* Progress Bar */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Progress Bar
        </h2>
        <div className="space-y-6">
          <LoadingProgress value={25} message="Fetching SEC data..." />
          <LoadingProgress value={75} message="Processing filings..." source="api" />
          <LoadingProgress value={100} message="Complete!" source="cache" />
        </div>
      </section>

      {/* Skeletons */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Skeleton Loaders
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Company Card</h3>
            <LoadingSkeleton type="company-card" />
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Text</h3>
              <LoadingSkeleton type="text" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Stat</h3>
              <LoadingSkeleton type="stat" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Avatar</h3>
              <LoadingSkeleton type="avatar" />
            </div>
          </div>
        </div>
      </section>

      {/* Shimmer Charts */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Shimmer Charts
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Line Chart</h3>
            <ShimmerChart type="line" height={200} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Bar Chart</h3>
            <ShimmerChart type="bar" height={200} />
          </div>
        </div>
      </section>

      {/* Overlay Demo Note */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Loading Overlay
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          LoadingOverlay component available for full-screen or container overlays.
          Usage: &lt;LoadingOverlay message="Loading..." fullScreen /&gt;
        </p>
        <div className="relative h-32 mt-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <LoadingOverlay message="Loading content..." />
        </div>
      </section>
    </div>
  );
}

export default LoadingStatesDemo;
