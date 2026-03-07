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
      <h1
        className="text-2xl font-bold"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Loading States Demo
      </h1>

      {/* Spinners */}
      <section>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Loading Spinners
        </h2>
        <div className="flex items-center gap-8">
          <div className="text-center">
            <LoadingSpinner size="sm" />
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Small</p>
          </div>
          <div className="text-center">
            <LoadingSpinner size="md" />
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Medium</p>
          </div>
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Large</p>
          </div>
        </div>
      </section>

      {/* Loading Dots */}
      <section>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Loading Dots
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Processing<LoadingDots />
        </p>
      </section>

      {/* Progress Bar */}
      <section>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
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
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Skeleton Loaders
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Company Card</h3>
            <LoadingSkeleton type="company-card" />
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Text</h3>
              <LoadingSkeleton type="text" />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Stat</h3>
              <LoadingSkeleton type="stat" />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Avatar</h3>
              <LoadingSkeleton type="avatar" />
            </div>
          </div>
        </div>
      </section>

      {/* Shimmer Charts */}
      <section>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Shimmer Charts
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Line Chart</h3>
            <ShimmerChart type="line" height={200} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Bar Chart</h3>
            <ShimmerChart type="bar" height={200} />
          </div>
        </div>
      </section>

      {/* Overlay Demo Note */}
      <section>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Loading Overlay
        </h2>
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          LoadingOverlay component available for full-screen or container overlays.
          Usage: &lt;LoadingOverlay message="Loading..." fullScreen /&gt;
        </p>
        <div
          className="relative h-32 mt-4 border rounded-lg"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <LoadingOverlay message="Loading content..." />
        </div>
      </section>
    </div>
  );
}

export default LoadingStatesDemo;
