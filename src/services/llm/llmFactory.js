/**
 * LLM Provider Factory
 *
 * Selects and returns the active LLM adapter based on `VITE_ACTIVE_LLM`
 * environment variable (defaults to 'gemini').
 *
 * Every adapter implements the uniform interface:
 * `generateJSON(prompt, apiKey?): Promise<Object>`
 * Note: The default `gemini` adapter invokes the `generateAiSummary`
 * Firebase Cloud Function (Vertex AI IAM) and does not require a client API key.
 *
 * @module llmFactory
 */

import geminiAdapter from './geminiAdapter.js';
import openAiAdapter from './openAiAdapter.js';
import claudeAdapter from './claudeAdapter.js';

const ADAPTERS = {
  gemini: geminiAdapter,
  openai: openAiAdapter,
  claude: claudeAdapter,
};

/**
 * Resolves the active LLM adapter based on environment configuration or explicit override.
 *
 * @param {string} [providerOverride] - Optional provider name ('gemini' | 'openai' | 'claude')
 * @returns {{ generateJSON: (prompt: string, apiKey?: string) => Promise<Object>, requiresApiKey?: boolean }}
 */
export function getProvider(providerOverride) {
  const envProvider = import.meta.env?.VITE_ACTIVE_LLM || 'gemini';

  const activeKey = String(providerOverride || envProvider)
    .toLowerCase()
    .trim();

  const adapter = ADAPTERS[activeKey];
  if (!adapter) {
    throw new Error(
      `Unsupported LLM provider "${activeKey}". Supported providers: ${Object.keys(ADAPTERS).join(', ')}`
    );
  }

  return adapter;
}

export default {
  getProvider,
};
