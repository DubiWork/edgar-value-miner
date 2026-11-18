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

// Curated high-fidelity structured Tear Sheet summaries for marquee tickers
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
    businessModelTraits: [
      'B2B Enterprise',
      'Recurring SaaS (75%+)',
      'High Operating Margin (44%)',
      'Cloud & AI Infrastructure',
    ],
    revenueSegments: [
      { name: 'Intelligent Cloud (Azure & Server)', pct: 43 },
      { name: 'Productivity & Business (M365, LinkedIn)', pct: 32 },
      { name: 'More Personal Computing (Windows, Xbox)', pct: 25 },
    ],
    geoBreakdown: [
      { region: 'United States', pct: 51 },
      { region: 'International (EMEA, APAC, Americas)', pct: 49 },
    ],
    mermaidDiagram:
      'flowchart LR\n  A["Enterprise & Consumers"] --> B["M365 SaaS & Azure Cloud"]\n  B --> C["$245B Recurring Revenue"]\n  C --> D["44% Operating Margin"]',
    growthEngines: [
      'התרחבות Azure AI ואימוץ Copilot בקרב לקוחות ארגוניים (Fortune 500)',
      'מעבר לקוחות לחבילות פרימיום E5 ב-Microsoft 365 והעלאות מחיר תקופתיות',
      'צמיחת פרסום ב-LinkedIn ורכישת Activision Blizzard ב-Game Pass',
    ],
    competitors: ['Amazon AWS', 'Google Cloud & Workspace', 'Salesforce', 'Apple', 'Sony'],
    moat: {
      rating: 'Wide Moat',
      score: '4/5',
      summary:
        'חפיר כלכלי רחב במיוחד הנשען על עלויות מעבר אדירות בארגונים (Active Directory, Office, Azure) ויתרון לגודל בתשתיות הענן.',
      sources: [
        {
          name: 'Switching Costs',
          active: true,
          rationale: 'ארגונים תלויים ב-Office, Teams ו-Azure לתפעול יומיומי — החלפת ספק כרוכה בסיכון תפעולי כבד.',
        },
        {
          name: 'Network Effects',
          active: true,
          rationale: 'LinkedIn (מיליארד משתמשים), GitHub ופורמט הקבצים של Office נהנים מאפקט רשת גלובלי.',
        },
        {
          name: 'Cost Advantage',
          active: true,
          rationale: 'יתרון לגודל המאפשר השקעת עתק ($50B+ בשנה) בחוות שרתים ושבבי AI בעלות יחידה נמוכה.',
        },
        {
          name: 'Intangible Assets',
          active: true,
          rationale: 'אמון מותג ארגוני של 40 שנה ואישורי אבטחה וממשל (FedRAMP).',
        },
      ],
    },
    translations: {
      en: {
        summary:
          'Microsoft is a global technology leader generating revenue from enterprise software subscriptions (Office 365, Windows), cloud infrastructure (Azure), and gaming. Its model is built on high-margin recurring SaaS revenue.',
        growthEngines: [
          'Azure AI compute expansion and Copilot monetization across Fortune 500 enterprises',
          'Seat upgrades to Microsoft 365 E5 tiers with strong pricing power',
          'LinkedIn B2B ad growth and Xbox Game Pass ecosystem expansion',
        ],
        moat: {
          rating: 'Wide Moat',
          score: '4/5',
          summary:
            'Exceptional Wide Moat driven by mission-critical enterprise switching costs and hyperscale cloud cost advantages.',
          sources: [
            {
              name: 'Switching Costs',
              active: true,
              rationale: 'Deep enterprise lock-in across Active Directory, Office 365, Teams, and Azure workloads.',
            },
            {
              name: 'Network Effects',
              active: true,
              rationale: 'Two-sided network effects in LinkedIn, GitHub, and standard Office document formats.',
            },
            {
              name: 'Cost Advantage',
              active: true,
              rationale: 'Hyperscale data center footprint lowers per-unit cloud and AI inference costs.',
            },
            {
              name: 'Intangible Assets',
              active: true,
              rationale: 'Decades of enterprise trust, global distribution channel, and government compliance certifications.',
            },
          ],
        },
      },
    },
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
    businessModelTraits: [
      'B2C Premium Ecosystem',
      'Hardware + Services Flywheel',
      'High Gross Margin Services (74%)',
      '2.2B+ Active Devices',
    ],
    revenueSegments: [
      { name: 'iPhone', pct: 51 },
      { name: 'Services (App Store, iCloud, Apple Pay)', pct: 25 },
      { name: 'Mac & iPad', pct: 15 },
      { name: 'Wearables, Home & Accessories', pct: 9 },
    ],
    geoBreakdown: [
      { region: 'Americas', pct: 43 },
      { region: 'Europe', pct: 26 },
      { region: 'Greater China', pct: 17 },
      { region: 'Japan & Rest of Asia Pacific', pct: 14 },
    ],
    mermaidDiagram:
      'flowchart LR\n  A["Premium Hardware (iPhone/Mac)"] --> B["2.2B+ Installed Base"]\n  B --> C["Recurring Services (App Store/iCloud)"]\n  C --> D["$100B+ Annual Free Cash Flow"]',
    growthEngines: [
      'צמיחה דו-ספרתית בחטיבת ה-Services עם שולי רווח גולמי של מעל 70%',
      'מחזורי שדרוג מכשירים מבוססי Apple Intelligence על גבי בסיס של 2.2 מיליארד מכשירים',
      'חדירה לשווקים מתעוררים (הודו ודרום-מזרח אסיה) והרחבת שירותי פינטק (Apple Pay)',
    ],
    competitors: ['Samsung', 'Google Android', 'Xiaomi & Huawei', 'Microsoft', 'Spotify'],
    moat: {
      rating: 'Wide Moat',
      score: '4/5',
      summary:
        'חפיר רחב המבוסס על אקוסיסטם סגור (iOS + חומרה + שירותים) היוצר עלויות מעבר גבוהות וכוח תמחור נדיר בשוק הצרכני.',
      sources: [
        {
          name: 'Switching Costs',
          active: true,
          rationale: 'שילוב הדוק בין iPhone, Watch, iCloud ו-iMessage גורם לשיעור שימור לקוחות של מעל 90%.',
        },
        {
          name: 'Intangible Assets',
          active: true,
          rationale: 'מותג הצרכנות החזק בעולם ותכנון שבבים פנימי (Apple Silicon).',
        },
        {
          name: 'Network Effects',
          active: true,
          rationale: 'App Store מושך מפתחים בזכות בסיס המשתמשים הרווחי ביותר בעולם.',
        },
      ],
    },
    translations: {
      en: {
        summary:
          'Apple designs and sells premium consumer hardware (iPhone, Mac, iPad, Watch) integrated with a high-margin digital Services ecosystem (App Store, iCloud, Apple Pay) across 2.2B+ active devices.',
        growthEngines: [
          'Double-digit Services growth carrying 70%+ gross margins',
          'Apple Intelligence hardware upgrade cycles across its 2.2B+ installed base',
          'Emerging market expansion in India and financial services adoption (Apple Pay)',
        ],
        moat: {
          rating: 'Wide Moat',
          score: '4/5',
          summary:
            'Wide Moat powered by a walled-garden hardware-plus-software ecosystem with 90%+ customer retention and unmatched brand pricing power.',
          sources: [
            {
              name: 'Switching Costs',
              active: true,
              rationale: 'Seamless integration across iOS, iCloud, Apple Watch, and Mac locks in consumers.',
            },
            {
              name: 'Intangible Assets',
              active: true,
              rationale: 'Premier global consumer brand and proprietary Apple Silicon chip architecture.',
            },
            {
              name: 'Network Effects',
              active: true,
              rationale: 'iOS App Store ecosystem connects millions of developers with high-spending users.',
            },
          ],
        },
      },
    },
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

function enrichWithTearSheetDefaults(baseObj, normTicker, companyName) {
  const engines = Array.isArray(baseObj.keyEngines) && baseObj.keyEngines.length > 0
    ? baseObj.keyEngines
    : [
        `${normTicker} Core Products`,
        'Subscription & Service Revenues',
        'Enterprise Solutions',
        'Global Distribution Network',
      ];

  return {
    businessModelTraits: baseObj.businessModelTraits || [
      'B2B & B2C Operations',
      'Recurring & Transactional Mix',
      'Scalable Platform',
    ],
    revenueSegments: baseObj.revenueSegments || [
      { name: engines[0] || 'Core Products & Services', pct: 55 },
      { name: engines[1] || 'Subscriptions & Recurring', pct: 30 },
      { name: engines[2] || 'Other Operating Segments', pct: 15 },
    ],
    geoBreakdown: baseObj.geoBreakdown || [
      { region: 'United States / Domestic', pct: 60 },
      { region: 'International Markets', pct: 40 },
    ],
    mermaidDiagram:
      baseObj.mermaidDiagram ||
      `flowchart LR\n  A["Customers & Enterprises"] --> B["${engines[0] || normTicker}"]\n  B --> C["Recurring & Product Revenue"]\n  C --> D["Operating Cash Flow"]`,
    growthEngines: baseObj.growthEngines || [
      `הרחבת אימוץ ${engines[0] || 'מוצרי הליבה'} בקרב לקוחות קיימים וחדשים`,
      `שיפור שולי הרווח התפעולי באמצעות יתרון לגודל ומינוף תפעולי`,
      `חדירה לשווקים בינלאומיים והשקת שירותים משלימים`,
    ],
    competitors: baseObj.competitors || [
      `${normTicker} Sector Peers`,
      'Global Industry Leaders',
      'Specialized Disruptors',
    ],
    moat: baseObj.moat || {
      rating: 'Narrow Moat',
      score: '2/5',
      summary: `${companyName} נשענת על עלויות מעבר של לקוחות קיימים ומותג מבוסס בענף הפעילות שלה.`,
      sources: [
        {
          name: 'Switching Costs',
          active: true,
          rationale: 'הטמעת המוצרים בתהליכי העבודה של הלקוחות מייצרת עלויות מעבר.',
        },
        {
          name: 'Intangible Assets',
          active: true,
          rationale: 'מוניטין, קניין רוחני וקשרי לקוחות ארוכי טווח.',
        },
      ],
    },
    translations: baseObj.translations || {
      en: {
        summary: `${companyName} (${normTicker}) operates as a leading provider of products and services in its industry, generating revenue through direct sales, enterprise contracts, and recurring service offerings.`,
        growthEngines: [
          `Expanding adoption of ${engines[0] || 'core products'} across enterprise and consumer segments`,
          'Operating margin expansion driven by scale and recurring revenue mix',
          'International market penetration and new product innovation',
        ],
        moat: {
          rating: baseObj.moat?.rating || 'Narrow Moat',
          score: baseObj.moat?.score || '2/5',
          summary: `${companyName} benefits from customer switching costs and established brand recognition in its core market.`,
          sources: [
            {
              name: 'Switching Costs',
              active: true,
              rationale: 'Customer workflow integration creates retention and switching friction.',
            },
            {
              name: 'Intangible Assets',
              active: true,
              rationale: 'Brand recognition, proprietary know-how, and enterprise relationships.',
            },
          ],
        },
      },
    },
    ...baseObj,
    keyEngines: engines,
  };
}

function generateDynamicMock(ticker, companyProfile) {
  const normTicker = ticker.toUpperCase().trim();
  const companyName = companyProfile?.name || companyProfile?.companyName || normTicker;

  if (PRESET_MOCKS[normTicker]) {
    return enrichWithTearSheetDefaults(
      {
        ticker: normTicker,
        ...PRESET_MOCKS[normTicker],
        source: 'mock-preset',
      },
      normTicker,
      companyName
    );
  }

  return enrichWithTearSheetDefaults(
    {
      ticker: normTicker,
      summary: `${companyName} (${normTicker}) היא חברה מובילה הפועלת ומספקת פתרונות ומוצרים מתקדמים בענף הפעילות שלה. החברה מרוויחה כסף ממכירה ישירה של שירותים, רישיונות ומוצרים ללקוחות פרטיים וארגוניים. המודל העסקי נשען על הרחבת קהל הלקוחות וחיזוק מנועי ההכנסה הקיימים.`,
      keyEngines: [
        `${normTicker} Core Products`,
        'Subscription & Service Revenues',
        'Enterprise Solutions',
        'Global Distribution Network',
      ],
      source: 'mock-dynamic',
    },
    normTicker,
    companyName
  );
}

// =============================================================================
// LLM API Caller (via Factory/Adapter Pattern)
// =============================================================================

async function callLlmApi(ticker, companyProfile, apiKey, options = {}) {
  const normTicker = ticker.toUpperCase().trim();
  const companyName = companyProfile?.name || companyProfile?.companyName || normTicker;
  const sector = companyProfile?.sector || '';

  const promptText = `אתה אנליסט השקעות ערך בכיר. קרא בעיון את נתוני דוח ה-10-K (Item 1, Item 1A, Item 7) ושיחת הוועידה המצורפים עבור ${companyName} (${normTicker}${sector ? `, סקטור: ${sector}` : ''}).
בנה JSON מובנה עבור כרטיס סיכום ויזואלי ("Tear Sheet" / Blade) שמאפשר למשקיע להבין את העסק ב-30 שניות ללא "קיר של טקסט".
שמור על עברית טבעית ורהוטה, והשאר מונחים מקצועיים ושמות חטיבות/מוצרים/מתחרים באנגלית.

החזר אך ורק JSON תקין במבנה הבא:
{
  "summary": "Elevator Pitch חד (1-2 משפטים בעברית פשוטה) שמסביר מה החברה עושה ואיך היא מרוויחה כסף",
  "keyEngines": ["Engine 1 in English", "Engine 2 in English", "Engine 3 in English", "Engine 4 in English"],
  "businessModelTraits": ["B2B / B2C", "Recurring SaaS / Transactional", "High Margin / Scale"],
  "revenueSegments": [
    { "name": "Segment Name in English", "pct": 50 },
    { "name": "Segment 2 in English", "pct": 30 },
    { "name": "Segment 3 in English", "pct": 20 }
  ],
  "geoBreakdown": [
    { "region": "United States", "pct": 55 },
    { "region": "International", "pct": 45 }
  ],
  "mermaidDiagram": "flowchart LR\\n  A[\\"Customers\\"] --> B[\\"Core Platform\\"] --> C[\\"Revenue Streams\\"] --> D[\\"Operating Profit\\"]",
  "growthEngines": [
    "מנוע צמיחה 1 קצר וממוקד בעברית מתוך ה-10-K/שיחת הוועידה",
    "מנוע צמיחה 2 קצר וממוקד בעברית",
    "מנוע צמיחה 3 קצר וממוקד בעברית"
  ],
  "competitors": ["Competitor 1", "Competitor 2", "Competitor 3", "Competitor 4"],
  "moat": {
    "rating": "Wide Moat | Narrow Moat | No Moat",
    "score": "4/5",
    "summary": "משפט אחד בעברית שמסכם את החפיר הכלכלי של החברה",
    "sources": [
      { "name": "Switching Costs", "active": true, "rationale": "נימוק קצר בעברית" },
      { "name": "Network Effects", "active": true, "rationale": "נימוק קצר בעברית" },
      { "name": "Cost Advantage", "active": false, "rationale": "נימוק קצר בעברית" },
      { "name": "Intangible Assets", "active": true, "rationale": "נימוק קצר בעברית" }
    ]
  }
}`;

  const provider = llmFactory.getProvider();
  const parsed = await provider.generateJSON(promptText, apiKey, {
    ticker: normTicker,
    forceRefreshContext: Boolean(options?.forceRefresh),
  });

  if (!parsed || !parsed.summary || !Array.isArray(parsed.keyEngines)) {
    throw new Error('Malformed JSON structure from LLM');
  }

  return enrichWithTearSheetDefaults(
    {
      ticker: normTicker,
      summary: parsed.summary,
      keyEngines: parsed.keyEngines.slice(0, 4),
      ...(Array.isArray(parsed.businessModelTraits)
        ? { businessModelTraits: parsed.businessModelTraits.slice(0, 5) }
        : {}),
      ...(Array.isArray(parsed.revenueSegments)
        ? { revenueSegments: parsed.revenueSegments.slice(0, 6) }
        : {}),
      ...(Array.isArray(parsed.geoBreakdown)
        ? { geoBreakdown: parsed.geoBreakdown.slice(0, 5) }
        : {}),
      ...(typeof parsed.mermaidDiagram === 'string' && parsed.mermaidDiagram.trim()
        ? { mermaidDiagram: parsed.mermaidDiagram.trim() }
        : {}),
      ...(Array.isArray(parsed.growthEngines)
        ? { growthEngines: parsed.growthEngines.slice(0, 4) }
        : {}),
      ...(Array.isArray(parsed.competitors)
        ? { competitors: parsed.competitors.slice(0, 6) }
        : {}),
      ...(parsed.moat && typeof parsed.moat === 'object' ? { moat: parsed.moat } : {}),
      ...(parsed._ingestionStatus ? { ingestionStatus: parsed._ingestionStatus } : {}),
      source: 'ai-live',
    },
    normTicker,
    companyName
  );
}

/**
 * Translates an existing structured summary JSON on-demand to the requested target language ('en' or 'he')
 * without re-sending the heavy 10-K context, and caches the translation inside the summary record.
 */
export async function translateSummaryOnDemand(ticker, summaryObj, targetLang = 'en') {
  if (!summaryObj || targetLang === 'he') {
    return summaryObj;
  }

  if (summaryObj.translations?.[targetLang]?.summary) {
    return summaryObj;
  }

  const normTicker = (ticker || summaryObj.ticker || 'MSFT').toUpperCase().trim();
  const apiKey = getConfiguredApiKey();
  const provider = llmFactory.getProvider();

  try {
    const compactPayload = {
      summary: summaryObj.summary,
      growthEngines: summaryObj.growthEngines || [],
      moat: summaryObj.moat || null,
    };

    const translatePrompt = `Translate the following structured investment Tear Sheet JSON fields into clear, professional English for value investors. Return ONLY valid JSON with the exact same keys ("summary", "growthEngines", "moat"):
${JSON.stringify(compactPayload)}`;

    const translated = await provider.generateJSON(translatePrompt, apiKey);
    if (translated && translated.summary) {
      const updated = {
        ...summaryObj,
        translations: {
          ...(summaryObj.translations || {}),
          [targetLang]: translated,
        },
      };
      await setCachedSummary(normTicker, updated);
      return updated;
    }
  } catch {
    // Fall back to existing translation defaults if live call fails
  }

  return enrichWithTearSheetDefaults(summaryObj, normTicker, normTicker);
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

/**
 * Fetches the 10-K / Transcript / 8-K ingestion status for a ticker from Firestore via Cloud Function.
 * @param {string} ticker
 * @returns {Promise<Object|null>}
 */
export async function getCompanyContextStatus(ticker) {
  try {
    const functions = firebaseLib.functions;
    if (!functions || !ticker) return null;
    const callable = httpsCallable(functions, 'generateAiSummary');
    const response = await callable({
      action: 'getCompanyContextStatus',
      ticker: ticker.toUpperCase().trim(),
    });
    const payload = response?.data ?? response;
    return payload?.ingestionStatus || null;
  } catch {
    return null;
  }
}

/**
 * Forces a fresh server-side download & extraction of the 10-K + Transcript / 8-K for a ticker.
 * @param {string} ticker
 * @returns {Promise<Object|null>}
 */
export async function refreshCompanyContext(ticker) {
  try {
    const functions = firebaseLib.functions;
    if (!functions || !ticker) return null;
    const callable = httpsCallable(functions, 'generateAiSummary');
    const response = await callable({
      action: 'refreshCompanyContext',
      ticker: ticker.toUpperCase().trim(),
    });
    const payload = response?.data ?? response;
    return payload?.ingestionStatus || null;
  } catch {
    return null;
  }
}

/**
 * Saves an Admin-supplied manual transcript for a ticker into Firestore (`companyContext/{ticker}`).
 * @param {string} ticker
 * @param {string} manualTranscriptText
 * @param {string} [manualTranscriptDate]
 * @returns {Promise<Object|null>}
 */
export async function saveManualTranscript(ticker, manualTranscriptText, manualTranscriptDate) {
  const functions = firebaseLib.functions;
  if (!functions || !ticker || !manualTranscriptText) return null;
  const callable = httpsCallable(functions, 'generateAiSummary');
  const response = await callable({
    action: 'saveManualTranscript',
    ticker: ticker.toUpperCase().trim(),
    manualTranscriptText,
    ...(manualTranscriptDate ? { manualTranscriptDate } : {}),
  });
  const payload = response?.data ?? response;
  return payload?.ingestionStatus || null;
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
    return enrichWithTearSheetDefaults(
      {
        ...existingCached,
        originalSource: existingCached.originalSource || existingCached.source || 'unknown',
        source: 'cache',
      },
      normTicker,
      companyProfile?.name || companyProfile?.companyName || normTicker
    );
  }

  // 2. Attempt live call via Factory/Adapter (Cloud Function for Gemini, API key for others)
  let fallbackError = null;
  let budgetExhausted = false;
  const provider = llmFactory.getProvider();
  const canCallLive = provider.requiresApiKey === false || Boolean(apiKey);
  if (canCallLive) {
    try {
      const liveResult = await callLlmApi(normTicker, companyProfile, apiKey, {
        forceRefresh,
      });
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
  getCompanyContextStatus,
  refreshCompanyContext,
  saveManualTranscript,
  translateSummaryOnDemand,
};
