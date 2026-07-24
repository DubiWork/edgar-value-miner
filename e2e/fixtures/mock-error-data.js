/**
 * Mock error and edge-case responses for SEC EDGAR API.
 *
 * Used by mockAPIs() to simulate failure scenarios such as
 * 404 not found, 500 server error, and 429 rate limiting.
 */

export const SEC_ERROR_RESPONSES = {
  notFound: {
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Not Found', message: 'Company not found' }),
  },

  serverError: {
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Internal Server Error', message: 'Service unavailable' }),
  },

  rateLimited: {
    status: 429,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded' }),
  },
};
