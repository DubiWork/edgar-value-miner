import { Component } from 'react';
import { AlertTriangle, WifiOff, Clock, Database, Search, RefreshCw, Home } from 'lucide-react';
import { ERROR_TYPES, ERROR_UI_CONFIG, categorizeError } from './errorTypes';

/**
 * Map of icon names to icon components
 */
const ICONS = {
  AlertTriangle,
  WifiOff,
  Clock,
  Database,
  Search,
};

/**
 * ErrorFallback Component
 * Renders user-friendly error UI based on error type
 *
 * @param {Object} props
 * @param {Error} props.error - The error that occurred
 * @param {Function} props.resetError - Function to reset the error state
 * @param {string} [props.errorType] - Pre-categorized error type
 */
export function ErrorFallback({ error, resetError, errorType }) {
  const type = errorType || categorizeError(error);
  const config = ERROR_UI_CONFIG[type] || ERROR_UI_CONFIG[ERROR_TYPES.UNKNOWN];
  const Icon = ICONS[config.iconName] || AlertTriangle;

  const handleRetry = () => {
    if (resetError) {
      resetError();
    }
  };

  const handleGoHome = () => {
    // Reset error state and navigate to root
    if (resetError) {
      resetError();
    }
    // Use window.location for a clean navigation
    window.location.href = '/';
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="card max-w-md w-full text-center">
        {/* Icon */}
        <div className={`inline-flex p-4 rounded-full ${config.iconBg} mb-6`}>
          <Icon className={`h-10 w-10 ${config.iconColor}`} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {config.title}
        </h2>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          {config.description}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {config.showRetry && (
            <button
              onClick={handleRetry}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {config.retryLabel}
            </button>
          )}
          <button
            onClick={handleGoHome}
            className="btn-secondary inline-flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </div>

        {/* Dev mode: Show error details */}
        {import.meta.env.DEV && error && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Technical Details (Dev Mode)
            </summary>
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono overflow-auto max-h-48">
              <div className="text-gray-700 dark:text-gray-300">
                <strong>Name:</strong> {error.name || 'Unknown'}
              </div>
              <div className="text-gray-700 dark:text-gray-300 mt-1">
                <strong>Message:</strong> {error.message || 'No message'}
              </div>
              {error.code && (
                <div className="text-gray-700 dark:text-gray-300 mt-1">
                  <strong>Code:</strong> {error.code}
                </div>
              )}
              {error.statusCode && (
                <div className="text-gray-700 dark:text-gray-300 mt-1">
                  <strong>Status:</strong> {error.statusCode}
                </div>
              )}
              {error.stack && (
                <div className="text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap break-all">
                  {error.stack}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * ErrorBoundary Component
 *
 * React Error Boundary that catches JavaScript errors in child components
 * and displays a user-friendly fallback UI.
 *
 * Features:
 * - Catches errors without crashing the entire app
 * - Shows different UIs for different error types
 * - Provides "Try Again" button to recover
 * - Logs errors to console in dev mode
 * - Supports custom fallback components
 *
 * @example
 * // Basic usage
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * @example
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorPage />}>
 *   <App />
 * </ErrorBoundary>
 *
 * @example
 * // With onError callback
 * <ErrorBoundary onError={(error, info) => logToService(error, info)}>
 *   <App />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught
   * This lifecycle method is called during "render" phase
   */
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error information
   * This lifecycle method is called during "commit" phase
   */
  componentDidCatch(error, errorInfo) {
    // Store error info for potential debugging
    this.setState({ errorInfo });

    // Log to console in dev mode only
    if (import.meta.env.DEV) {
      console.group('ErrorBoundary caught an error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo?.componentStack);
      console.groupEnd();
    }

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset the error state to allow retry
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional onReset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, render it
      if (fallback) {
        // If fallback is a function, call it with error and reset function
        if (typeof fallback === 'function') {
          return fallback({ error, resetError: this.resetError });
        }
        // If fallback is a React element, clone it with error props
        return fallback;
      }

      // Render default error UI
      return (
        <ErrorFallback
          error={error}
          resetError={this.resetError}
        />
      );
    }

    return children;
  }
}

export default ErrorBoundary;
