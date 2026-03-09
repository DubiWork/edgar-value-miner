/**
 * formatTimeAgo - Relative time formatting utility
 *
 * Converts a Unix timestamp (milliseconds) into a human-readable relative
 * time string such as "Just now", "5 min ago", "2 hr ago", or a date string.
 *
 * @module formatTimeAgo
 */

// =============================================================================
// Constants
// =============================================================================

/** One minute in milliseconds */
const MS_MINUTE = 60_000;

/** One hour in milliseconds */
const MS_HOUR = 3_600_000;

/** One day in milliseconds (24 hours) */
const MS_DAY = 86_400_000;

// =============================================================================
// Main Function
// =============================================================================

/**
 * Formats a timestamp into a relative time string.
 *
 * - < 1 min      -> "Just now"
 * - 1-59 min     -> "X min ago"
 * - 1-23 hr      -> "X hr ago"
 * - 24-47 hr     -> "Yesterday"
 * - 48+ hr       -> date string (e.g., "Mar 5, 2026")
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {number} [now=Date.now()] - Current time (for testing)
 * @returns {string} Human-readable relative time string
 *
 * @example
 * formatTimeAgo(Date.now() - 30000);    // "Just now"
 * formatTimeAgo(Date.now() - 300000);   // "5 min ago"
 * formatTimeAgo(Date.now() - 7200000);  // "2 hr ago"
 */
export function formatTimeAgo(timestamp, now = Date.now()) {
  // Handle invalid input
  if (
    timestamp === null ||
    timestamp === undefined ||
    typeof timestamp !== 'number' ||
    !isFinite(timestamp)
  ) {
    return 'Unknown';
  }

  const diffMs = now - timestamp;

  // Future timestamps or zero diff
  if (diffMs < MS_MINUTE) {
    return 'Just now';
  }

  // Minutes
  if (diffMs < MS_HOUR) {
    const minutes = Math.floor(diffMs / MS_MINUTE);
    return `${minutes} min ago`;
  }

  // Hours
  if (diffMs < MS_DAY) {
    const hours = Math.floor(diffMs / MS_HOUR);
    return `${hours} hr ago`;
  }

  // Yesterday (24-47 hours)
  if (diffMs < 2 * MS_DAY) {
    return 'Yesterday';
  }

  // Older than 2 days: show date string
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default formatTimeAgo;
