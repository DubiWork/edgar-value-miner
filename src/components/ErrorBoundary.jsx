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
    if (resetError) {
      resetError();
    }
    window.location.href = '/';
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="card max-w-md w-full text-center">
        {/* Icon */}
        <div
          className="inline-flex p-4 rounded-full mb-6"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
        >
          <Icon className={`h-10 w-10 ${config.iconColor}`} />
        </div>

        {/* Title */}
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {config.title}
        </h2>

        {/* Description */}
        <p
          className="mb-6 leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
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
            <summary
              className="text-sm cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Technical Details (Dev Mode)
            </summary>
            <div
              className="mt-2 p-3 rounded-lg text-xs font-mono overflow-auto max-h-48"
              style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            >
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <strong>Name:</strong> {error.name || 'Unknown'}
              </div>
              <div className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                <strong>Message:</strong> {error.message || 'No message'}
              </div>
              {error.code && (
                <div className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong>Code:</strong> {error.code}
                </div>
              )}
              {error.statusCode && (
                <div className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong>Status:</strong> {error.statusCode}
                </div>
              )}
              {error.stack && (
                <div
                  className="mt-2 whitespace-pre-wrap break-all"
                  style={{ color: 'var(--color-text-muted)' }}
                >
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

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    if (import.meta.env.DEV) {
      console.group('ErrorBoundary caught an error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo?.componentStack);
      console.groupEnd();
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback({ error, resetError: this.resetError });
        }
        return fallback;
      }

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
