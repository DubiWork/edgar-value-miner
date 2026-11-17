/**
 * Gemini LLM Adapter (Vertex AI via Firebase Cloud Functions)
 *
 * Implements the uniform LLM adapter interface `generateJSON(prompt)`
 * by invoking the `generateAiSummary` Firebase Cloud Function backed by Vertex AI.
 *
 * @module geminiAdapter
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase.js';

/**
 * Generates a structured JSON response from Vertex AI Gemini via the
 * `generateAiSummary` callable Firebase Cloud Function.
 *
 * @param {string} prompt - The prompt text requesting a JSON response.
 * @returns {Promise<Object>} Parsed JSON response from the LLM.
 */
export async function generateJSON(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt is required');
  }

  if (!functions) {
    throw new Error('Firebase Functions is not initialized');
  }

  const generateAiSummary = httpsCallable(functions, 'generateAiSummary');
  const response = await generateAiSummary({ prompt: prompt.trim() });

  const payload = response?.data ?? response;
  const rawText = typeof payload === 'string' ? payload : payload?.text;

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from generateAiSummary Cloud Function');
  }

  // Strip optional markdown code fences if present before parsing
  const cleanedText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleanedText);
}

export default {
  generateJSON,
  requiresApiKey: false,
};
