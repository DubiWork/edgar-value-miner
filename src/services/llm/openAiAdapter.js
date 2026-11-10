/**
 * OpenAI LLM Adapter (Skeleton)
 *
 * Implements the uniform LLM adapter interface `generateJSON(prompt, apiKey)`
 * as a placeholder for future OpenAI (GPT) integration.
 *
 * @module openAiAdapter
 */

/**
 * Generates a structured JSON response from OpenAI.
 *
 * @param {string} _prompt - The prompt text requesting a JSON response.
 * @param {string} _apiKey - The OpenAI API key.
 * @returns {Promise<Object>} Parsed JSON response from the LLM.
 */
export async function generateJSON(_prompt, _apiKey) {
  throw new Error('Not Implemented: OpenAI adapter is not implemented yet');
}

export default {
  generateJSON,
};
