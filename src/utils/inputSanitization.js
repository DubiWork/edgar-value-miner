/**
 * Input Sanitization Utilities
 *
 * Sanitizes user input to prevent XSS attacks and ensure safe data handling.
 * Used as the first line of defense before any input reaches the API layer.
 *
 * @module inputSanitization
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Allowed characters for ticker input: A-Z, a-z, 0-9, hyphen, period
 * @constant {RegExp}
 */
const TICKER_ALLOWED_CHARS = /^[A-Za-z0-9.\-]+$/;

/**
 * Pattern to detect HTML tags (including script tags)
 * @constant {RegExp}
 */
const HTML_TAG_PATTERN = /<[^>]*>/g;

/**
 * Pattern to detect common XSS vectors
 * @constant {RegExp}
 */
const XSS_PATTERN = /javascript:|on\w+\s*=|<script|<\/script|<img|<svg|<iframe|data:/i;

/**
 * Maximum allowed length for ticker input
 * @constant {number}
 */
const MAX_TICKER_LENGTH = 10;

// =============================================================================
// Sanitization Functions
// =============================================================================

/**
 * Sanitizes a ticker symbol input string
 *
 * Removes any potentially dangerous characters and validates the input
 * against an allowlist of safe characters. This is the primary defense
 * against XSS attacks via the ticker input field.
 *
 * @param {*} input - The raw ticker input from the user
 * @returns {{ sanitized: string, isValid: boolean, original: string, warnings: string[] }}
 *
 * @example
 * sanitizeTickerInput('AAPL');
 * // { sanitized: 'AAPL', isValid: true, original: 'AAPL', warnings: [] }
 *
 * sanitizeTickerInput('<script>alert("xss")</script>');
 * // { sanitized: '', isValid: false, original: '<script>...', warnings: ['Input contained HTML tags'] }
 */
export function sanitizeTickerInput(input) {
  const warnings = [];

  // Handle non-string or empty input
  if (input === null || input === undefined) {
    return { sanitized: '', isValid: false, original: String(input), warnings: ['Input is empty'] };
  }

  const original = String(input);

  // Check for empty string after conversion
  if (original.trim().length === 0) {
    return { sanitized: '', isValid: false, original, warnings: ['Input is empty'] };
  }

  let working = original;

  // Check for XSS patterns before stripping
  if (XSS_PATTERN.test(original)) {
    warnings.push('Input contained potential XSS pattern');
  }

  // Strip HTML tags FIRST (before truncation to avoid breaking tag boundaries)
  if (HTML_TAG_PATTERN.test(working)) {
    warnings.push('Input contained HTML tags');
    working = working.replace(HTML_TAG_PATTERN, '');
  }

  // Remove any characters not in the allowlist
  const sanitized = working
    .split('')
    .filter(char => TICKER_ALLOWED_CHARS.test(char))
    .join('')
    .trim();

  // Truncate after sanitization
  const truncated = sanitized.length > MAX_TICKER_LENGTH
    ? sanitized.slice(0, MAX_TICKER_LENGTH)
    : sanitized;

  if (sanitized.length > MAX_TICKER_LENGTH) {
    warnings.push(`Input truncated from ${sanitized.length} to ${MAX_TICKER_LENGTH} characters`);
  }

  // Validate the sanitized result
  const isValid = truncated.length > 0 && truncated.length <= MAX_TICKER_LENGTH;

  return { sanitized: truncated, isValid, original, warnings };
}

/**
 * Sanitizes a general text input string
 *
 * Strips HTML tags and dangerous patterns from arbitrary text input.
 * Used for search queries, notes, and other free-text fields.
 *
 * @param {*} input - The raw text input
 * @param {Object} [options={}] - Options
 * @param {number} [options.maxLength=500] - Maximum allowed length
 * @returns {{ sanitized: string, original: string, warnings: string[] }}
 *
 * @example
 * sanitizeTextInput('Hello <b>World</b>');
 * // { sanitized: 'Hello World', original: 'Hello <b>World</b>', warnings: ['Input contained HTML tags'] }
 */
export function sanitizeTextInput(input, options = {}) {
  const { maxLength = 500 } = options;
  const warnings = [];

  if (input === null || input === undefined) {
    return { sanitized: '', original: String(input), warnings: ['Input is empty'] };
  }

  const original = String(input);
  let working = original;

  // Truncate to max length
  if (working.length > maxLength) {
    warnings.push(`Input truncated from ${working.length} to ${maxLength} characters`);
    working = working.slice(0, maxLength);
  }

  // Check for XSS patterns
  if (XSS_PATTERN.test(working)) {
    warnings.push('Input contained potential XSS pattern');
  }

  // Strip HTML tags
  if (HTML_TAG_PATTERN.test(working)) {
    warnings.push('Input contained HTML tags');
    working = working.replace(HTML_TAG_PATTERN, '');
  }

  return { sanitized: working.trim(), original, warnings };
}

/**
 * Checks if a string contains potential XSS vectors
 *
 * Does NOT sanitize - only detects. Use sanitizeTickerInput or
 * sanitizeTextInput for actual sanitization.
 *
 * @param {string} input - The string to check
 * @returns {boolean} True if the input contains potential XSS patterns
 *
 * @example
 * containsXss('<script>alert(1)</script>'); // true
 * containsXss('AAPL'); // false
 */
export function containsXss(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  return XSS_PATTERN.test(input) || HTML_TAG_PATTERN.test(input);
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  sanitizeTickerInput,
  sanitizeTextInput,
  containsXss,
};
