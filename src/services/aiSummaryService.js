/**
 * AI Company Summary Service
 *
 * Provides concise "Circle of Competence" business model explanations
 * and key revenue engines for Step 1 Triage.
 *
 * Flow:
 * 1. Check local IndexedDB cache for existing summary.
 * 2. If not cached, resolve the active LLM provider via `llmFactory.getProvider()`
 *    and invoke `generateJSON(prompt)` (which calls the `generateAiSummary`
 *    Firebase Cloud Function backed by Vertex AI).
 * 3. If the call fails, gracefully generate a dynamic mock
 *    after a simulated delay (1.5s) to allow UX / skeleton testing.
 * 4. Cache results and return.
 *
 * @module aiSummaryService
 */

import { httpsCallable } from 'firebase/functions';
import * as firebaseLib from '../lib/firebase.js';
import llmFactory from './llm/llmFactory.js';

// =============================================================================
// Constants & Configuration
// =============================================================================

const DB_NAME = 'edgar-ai-cache';
const DB_VERSION = 1;
const STORE_NAME = 'summaries';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Curated high-fidelity summaries for marquee tickers
const PRESET_MOCKS = {
  MSFT: {
    summary:
      'מייקרוסופט היא ענקית טכנולוגיה שמרוויחה כסף ממכירת רישיונות תוכנה (Windows, Office), שירותי ענן לארגונים (Azure), ומוצרי חומרה וגיימינג. המודל נשען על הכנסות חוזרות ממנויים (SaaS).',
    keyEngines: [
      'Azure Cloud & Server',
      'Office 365 SaaS',
      'Windows & Enterprise OEM',
      'Xbox & Gaming Subscriptions',
    ],
  },
  AAPL: {
    summary:
      'אפל היא חברת טכנולוגיה מובילה שמפתחת ומוכרת מכשירי פרימיום כמו iPhone, מחשבי Mac ושעוני Apple Watch. עיקר רווחיה מגיע ממכירת חומרה יוקרתית ומאקוסיסטם עשיר של שירותים דיגיטליים (App Store, iCloud, Apple Pay).',
    keyEngines: [
      'iPhone Hardware Sales',
      'Services (App Store & iCloud)',
      'Wearables & Accessories',
      'Mac & iPad Computing',
    ],
  },
  GOOGL: {
    summary:
      'אלפבית (גוגל) היא ענקית אינטרנט המרוויחה את עיקר הונה מהצגת מודעות פרסום מותאמות אישית במנוע החיפוש שלה, ב-YouTube ובאתרי שותפים. בנוסף, החברה מרחיבה בעקביות את פעילות שירותי הענן (Google Cloud) ומערכת ההפעלה Android.',
    keyEngines: [
      'Google Search & Performance Ads',
      'YouTube Advertising & Subscriptions',
      'Google Cloud Platform (GCP)',
      'Android & Google Play Ecosystem',
    ],
  },
  GOOG: {
    summary:
      'אלפבית (גוגל) היא ענקית אינטרנט המרוויחה את עיקר הונה מהצגת מודעות פרסום מותאמות אישית במנוע החיפוש שלה, ב-YouTube ובאתרי שותפים. בנוסף, החברה מרחיבה בעקביות את פעילות שירותי הענן (Google Cloud) ומערכת ההפעלה Android.',
    keyEngines: [
      'Google Search & Performance Ads',
      'YouTube Advertising & Subscriptions',
      'Google Cloud Platform (GCP)',
      'Android & Google Play Ecosystem',
    ],
  },
  NVDA: {
    summary:
      'אנבידיה היא מובילה עולמית בפיתוח מעבדים גרפיים (GPU) ושבבי בינה מלאכותית למרכזי נתונים ענקיים. החברה מרוויחה סכומי עתק ממכירת חומרת מחשוב-על ופלטפורמת התוכנה CUDA לחברות המאמנות ומריצות מודלי AI.',
    keyEngines: [
      'AI & Data Center Compute (Hopper/Blackwell)',
      'Gaming Graphics (GeForce)',
      'Enterprise Software (CUDA Platform)',
      'Automotive & Autonomous Drive Systems',
    ],
  },
  AMZN: {
    summary:
      'אמזון היא קונגלומרט טכנולוגיה ומסחר אלקטרוני שמרוויח כסף מעמלות על מכירות באתרי הסחר שלו, מנויי Prime, שירותי פרסום דיגיטלי, ושירותי הענן המובילים בעולם (AWS) המהווים את מנוע הרווח העיקרי.',
    keyEngines: [
      'Amazon Web Services (AWS)',
      'Online Retail & 3P Seller Services',
      'Digital Advertising Services',
      'Subscription Services (Amazon Prime)',
    ],
  },
  TSLA: {
    summary:
      'טסלה היא יצרנית רכב חשמלי וטכנולוגיית אנרגיה נקייה. הכנסותיה נובעות ממכירת מכוניות חשמליות מתקדמות, מערכות אגירת אנרגיה וסוללות (Megapack), שירותי תוכנה לנהיגה אוטונומית (FSD) ורשת טעינה מהירה עולמית.',
    keyEngines: [
      'Automotive Sales (Model Y & Model 3)',
      'Energy Generation & Storage (Megapack)',
      'Full Self-Driving (FSD) & Software',
      'Supercharger Network & Services',
    ],
  },
};

// =============================================================================
// Environment Variable Helper
// =============================================================================

/**
 * Resolves the optional LLM API key for non-Vertex providers using Vite's `import.meta.env`.
 * Note: The default Gemini adapter uses the `generateAiSummary` Firebase Cloud Function
 * (Vertex AI IAM) and does not require a client API key.
 *
 * @returns {string}
 */
function getConfiguredApiKey() {
  const rawKey = import.meta.env?.VITE_LLM_API_KEY || '';
  return String(rawKey).trim();
}

// =============================================================================
// IndexedDB Local Storage Helpers
// =============================================================================

function isIndexedDBAvailable() {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB not supported'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'ticker' });
        }
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Gets cached summary from IndexedDB (with localStorage fallback).
 * @param {string} ticker
 * @returns {Promise<Object|null>}
 */
export async function getCachedSummary(ticker) {
  const normTicker = ticker.toUpperCase().trim();

  // Try IndexedDB first
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(normTicker);

        req.onsuccess = () => {
          const record = req.result;
          if (record && record.data) {
            const isFresh = Date.now() - (record.timestamp || 0) < CACHE_TTL_MS;
            if (isFresh) {
              resolve({
                ...record.data,
                originalSource: record.data.originalSource || record.data.source || 'unknown',
                cachedAt: record.timestamp,
              });
              return;
            }
          }
          resolve(null);
        };

        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    // Fallback to localStorage
    try {
      const item = localStorage.getItem(`ai_summary_${normTicker}`);
      if (item) {
        const parsed = JSON.parse(item);
        if (Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS) {
          return {
            ...parsed.data,
            originalSource: parsed.data?.originalSource || parsed.data?.source || 'unknown',
            cachedAt: parsed.timestamp,
          };
        }
      }
    } catch {
      // Ignore
    }
    return null;
  }
}

/**
 * Saves summary to IndexedDB (with localStorage fallback).
 * @param {string} ticker
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function setCachedSummary(ticker, data) {
  const normTicker = ticker.toUpperCase().trim();
  const record = {
    ticker: normTicker,
    data: {
      ...data,
      originalSource: data.originalSource || data.source || 'unknown',
    },
    timestamp: Date.now(),
  };

  // Save to IndexedDB
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(`ai_summary_${normTicker}`, JSON.stringify(record));
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Deletes a cached AI summary for a specific ticker from IndexedDB and localStorage.
 * @param {string} ticker
 * @returns {Promise<boolean>}
 */
export async function invalidateCachedSummary(ticker) {
  if (!ticker || typeof ticker !== 'string') return false;
  const normTicker = ticker.toUpperCase().trim();
  let removed = false;

  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(normTicker);
        req.onsuccess = () => {
          removed = true;
          resolve();
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch {
    // Ignore IDB errors and ensure localStorage is also cleared
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`ai_summary_${normTicker}`);
      removed = true;
    }
  } catch {
    // Ignore
  }

  return removed;
}

/**
 * Clears all cached AI summaries from IndexedDB and localStorage.
 * @returns {Promise<boolean>}
 */
export async function clearAllCachedSummaries() {
  let cleared = false;

  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => {
          cleared = true;
          resolve();
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch {
    // Ignore IDB errors
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ai_summary_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      cleared = true;
    }
  } catch {
    // Ignore
  }

  return cleared;
}

// =============================================================================
// Mock Generator
// =============================================================================

function generateDynamicMock(ticker, companyProfile) {
  const normTicker = ticker.toUpperCase().trim();
  const companyName = companyProfile?.name || companyProfile?.companyName || normTicker;

  if (PRESET_MOCKS[normTicker]) {
    return {
      ticker: normTicker,
      ...PRESET_MOCKS[normTicker],
      source: 'mock-preset',
    };
  }

  return {
    ticker: normTicker,
    summary: `${companyName} (${normTicker}) היא חברה מובילה הפועלת ומספקת פתרונות ומוצרים מתקדמים בענף הפעילות שלה. החברה מרוויחה כסף ממכירה ישירה של שירותים, רישיונות ומוצרים ללקוחות פרטיים וארגוניים. המודל העסקי נשען על הרחבת קהל הלקוחות וחיזוק מנועי ההכנסה הקיימים.`,
    keyEngines: [
      `${normTicker} Core Products`,
      'Subscription & Service Revenues',
      'Enterprise Solutions',
      'Global Distribution Network',
    ],
    source: 'mock-dynamic',
  };
}

// =============================================================================
// LLM API Caller (via Factory/Adapter Pattern)
// =============================================================================

async function callLlmApi(ticker, companyProfile, apiKey) {
  const normTicker = ticker.toUpperCase().trim();
  const companyName = companyProfile?.name || companyProfile?.companyName || normTicker;
  const sector = companyProfile?.sector || '';

  const promptText = `אתה אנליסט המייעץ למשקיע מתחיל. קרא את תיאור העסק של חברת ${companyName} (${normTicker}${sector ? `, בתחום: ${sector}` : ''}) וכתוב פסקה אחת בעברית (עד 3 משפטים) שעונה בפשטות על: מה החברה עושה ואיך היא מרוויחה כסף. השתמש בשפה פשוטה (רמת כיתה ה'). בנוסף, ספק רשימה של 3-4 מנועי הכנסה/מוצרים מרכזיים באנגלית.

החזר את התשובה במבנה JSON בלבד ללא שום טקסט נוסף:
{
  "summary": "הפסקה בעברית",
  "keyEngines": ["Engine 1 in English", "Engine 2 in English", "Engine 3 in English", "Engine 4 in English"]
}`;

  const provider = llmFactory.getProvider();
  const parsed = await provider.generateJSON(promptText, apiKey);

  if (!parsed || !parsed.summary || !Array.isArray(parsed.keyEngines)) {
    throw new Error('Malformed JSON structure from LLM');
  }

  return {
    ticker: normTicker,
    summary: parsed.summary,
    keyEngines: parsed.keyEngines.slice(0, 4),
    source: 'ai-live',
  };
}

// =============================================================================
// Main Service Method
// =============================================================================

/**
 * Retrieves an existing AI summary from IndexedDB cache or generates a new one.
 * If the live call fails, simulates AI thinking delay (1.5s) and returns
 * a dynamic mock.
 *
 * @param {string} ticker - The stock ticker symbol
 * @param {Object} [companyProfile] - Optional company info (name, sector)
 * @param {Object} [options] - Optional settings
 * @param {boolean} [options.forceRefresh=false] - Bypass and clear cache before fetching
 * @returns {Promise<{
 *   ticker: string,
 *   summary: string,
 *   keyEngines: string[],
 *   source: string,
 *   originalSource?: string,
 *   cachedAt?: number,
 *   fallbackError?: string
 * }>}
 */
/**
 * Fetches the current AI budget status and renewal date from the
 * `generateAiSummary` Cloud Function (`{ action: 'getBudgetStatus' }`).
 *
 * @returns {Promise<{
 *   periodKey: string,
 *   status: 'active' | 'exhausted',
 *   spentUsd: number,
 *   monthlyLimitUsd: number,
 *   totalCalls: number,
 *   totalTokens: number,
 *   resetsAt: string,
 *   daysUntilReset: number,
 *   exhaustedReason: string|null
 * }|null>}
 */
export async function getAiBudgetStatus() {
  try {
    const functions = firebaseLib.functions;
    if (!functions) return null;
    const callable = httpsCallable(functions, 'generateAiSummary');
    const response = await callable({ action: 'getBudgetStatus' });
    const payload = response?.data ?? response;
    return payload?.budget || null;
  } catch {
    return null;
  }
}

export async function getOrFetchCompanySummary(ticker, companyProfile = {}, options = {}) {
  if (!ticker || typeof ticker !== 'string') {
    return generateDynamicMock('MSFT', companyProfile);
  }

  const normTicker = ticker.toUpperCase().trim();
  const apiKey = getConfiguredApiKey();
  const forceRefresh = options?.forceRefresh === true;

  let existingCached = null;
  try {
    existingCached = await getCachedSummary(normTicker);
  } catch {
    // Ignore cache lookup error
  }

  if (forceRefresh) {
    await invalidateCachedSummary(normTicker);
  } else if (existingCached) {
    return {
      ...existingCached,
      originalSource: existingCached.originalSource || existingCached.source || 'unknown',
      source: 'cache',
    };
  }

  // 2. Attempt live call via Factory/Adapter (Cloud Function for Gemini, API key for others)
  let fallbackError = null;
  let budgetExhausted = false;
  const provider = llmFactory.getProvider();
  const canCallLive = provider.requiresApiKey === false || Boolean(apiKey);
  if (canCallLive) {
    try {
      const liveResult = await callLlmApi(normTicker, companyProfile, apiKey);
      await setCachedSummary(normTicker, liveResult);
      return liveResult;
    } catch (err) {
      fallbackError = err?.message || String(err);
      budgetExhausted = /AI_BUDGET_EXHAUSTED|resource-exhausted/i.test(fallbackError);
      if (typeof console !== 'undefined') {
        console.warn(
          `[aiSummaryService] Live LLM call failed for ${normTicker}, falling back to dynamic mock:`,
          err
        );
      }
    }
  }

  // If budget is exhausted and we had a previously cached summary, restore & serve what we already had
  if (budgetExhausted && existingCached) {
    try {
      await setCachedSummary(normTicker, existingCached);
    } catch {
      // Ignore
    }
    return {
      ...existingCached,
      originalSource: existingCached.originalSource || existingCached.source || 'unknown',
      source: 'cache',
      budgetExhausted: true,
      fallbackError,
    };
  }

  // 3. Fallback: Simulate 1.5s delay to allow Skeleton Loader testing, then return mock
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const mockResult = {
    ...generateDynamicMock(normTicker, companyProfile),
    ...(fallbackError ? { fallbackError } : {}),
    ...(budgetExhausted ? { budgetExhausted: true } : {}),
  };

  try {
    await setCachedSummary(normTicker, mockResult);
  } catch {
    // Ignore cache write errors
  }

  return mockResult;
}

export default {
  getOrFetchCompanySummary,
  getCachedSummary,
  setCachedSummary,
  invalidateCachedSummary,
  clearAllCachedSummaries,
  getAiBudgetStatus,
};
