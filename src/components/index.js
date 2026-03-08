// Barrel export for components

// Error handling
export { default as ErrorBoundary, ErrorFallback } from './ErrorBoundary';
export { ERROR_TYPES, ERROR_UI_CONFIG, categorizeError } from './errorTypes';

// Loading states
export {
  LoadingSpinner,
  LoadingProgress,
  LoadingSkeleton,
  ShimmerChart,
  LoadingOverlay,
  LoadingDots,
} from './LoadingStates';

// Search
export { TickerSearch } from './TickerSearch';

// Theme
export { ThemeToggle } from './ThemeToggle';

// Dashboard
export { DashboardLayout } from './Dashboard';
export { CompanyBanner } from './Dashboard/CompanyBanner';
export { MetricCard } from './Dashboard';
export { ChartContainer } from './Dashboard/ChartContainer';

// Demo components (for development/testing)
export { LoadingStatesDemo } from './LoadingStatesDemo';
