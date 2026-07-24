/**
 * Error types and utility functions for ErrorBoundary
 * @module errorTypes
 */

/**
 * Error types for categorizing different errors
 * @constant {Object}
 */
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  DATA: 'DATA',
  CACHE: 'CACHE',
  RATE_LIMIT: 'RATE_LIMIT',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Categorizes an error based on its properties
 * @param {Error} error - The error to categorize
 * @returns {string} The error type from ERROR_TYPES
 */
export function categorizeError(error) {
  if (!error) {
    return ERROR_TYPES.UNKNOWN;
  }

  const errorCode = error.code || '';
  const errorMessage = (error.message || '').toLowerCase();
  const statusCode = error.statusCode || null;

  // Rate limit errors (SEC 429)
  if (errorCode === 'RATE_LIMITED' || statusCode === 429) {
    return ERROR_TYPES.RATE_LIMIT;
  }

  // Network errors (offline, timeout, fetch failures)
  if (
    errorCode === 'NETWORK_ERROR' ||
    error.name === 'TypeError' ||
    errorMessage.includes('network') ||
    errorMessage.includes('offline') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('failed to fetch')
  ) {
    return ERROR_TYPES.NETWORK;
  }

  // Data errors (invalid ticker, not found, parse errors)
  if (
    errorCode === 'INVALID_TICKER' ||
    errorCode === 'TICKER_NOT_FOUND' ||
    errorCode === 'INVALID_CIK' ||
    errorCode === 'PARSE_ERROR' ||
    errorCode === 'NOT_FOUND' ||
    statusCode === 404
  ) {
    return ERROR_TYPES.DATA;
  }

  // Cache errors (IndexedDB/Firestore failures)
  if (
    errorCode === 'NOT_SUPPORTED' ||
    errorCode === 'QUOTA_EXCEEDED' ||
    errorCode === 'TRANSACTION_ERROR' ||
    errorCode === 'DATABASE_ERROR' ||
    error.name === 'EdgarCacheError' ||
    errorMessage.includes('indexeddb') ||
    errorMessage.includes('firestore') ||
    errorMessage.includes('cache')
  ) {
    return ERROR_TYPES.CACHE;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Configuration for each error type's UI
 * @constant {Object}
 */
export const ERROR_UI_CONFIG = {
  [ERROR_TYPES.NETWORK]: {
    iconName: 'WifiOff',
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    title: 'Connection Problem',
    description: 'Unable to connect to the SEC EDGAR service. Please check your internet connection and try again.',
    showRetry: true,
    retryLabel: 'Try Again',
  },
  [ERROR_TYPES.DATA]: {
    iconName: 'Search',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    title: 'Data Not Found',
    description: 'The requested data could not be found. Please verify the ticker symbol is correct and the company has SEC filings.',
    showRetry: true,
    retryLabel: 'Search Again',
  },
  [ERROR_TYPES.CACHE]: {
    iconName: 'Database',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    title: 'Storage Issue',
    description: 'There was a problem accessing cached data. This may happen in private browsing mode or when storage is full.',
    showRetry: true,
    retryLabel: 'Try Again',
  },
  [ERROR_TYPES.RATE_LIMIT]: {
    iconName: 'Clock',
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    title: 'Too Many Requests',
    description: 'The SEC EDGAR API rate limit has been reached. Please wait a moment before making more requests.',
    showRetry: true,
    retryLabel: 'Retry Now',
  },
  [ERROR_TYPES.UNKNOWN]: {
    iconName: 'AlertTriangle',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    showRetry: true,
    retryLabel: 'Try Again',
  },
};
