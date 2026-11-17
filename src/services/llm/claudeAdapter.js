/**
 * Claude (Anthropic) LLM Adapter (Skeleton)
 *
 * Implements the uniform LLM adapter interface `generateJSON(prompt, apiKey)`
 * as a placeholder for future Anthropic Claude integration.
 *
 * @module claudeAdapter
 */

/**
 * Generates a structured JSON response from Anthropic Claude.
 *
 * @param {string} _prompt - The prompt text requesting a JSON response.
 * @param {string} _apiKey - The Anthropic API key.
 * @returns {Promise<Object>} Parsed JSON response from the LLM.
 */
export async function generateJSON(_prompt, _apiKey) {
  throw new Error('Not Implemented: Claude adapter is not implemented yet');
}

export default {
  generateJSON,
};
