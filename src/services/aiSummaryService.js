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
// Canonical Moat & Business Model Dictionaries
// =============================================================================

export const CANONICAL_MOAT_SOURCES = [
  {
    key: 'Switching Costs',
    labelHe: 'עלויות מעבר',
    labelEn: 'Switching Costs',
    descriptionHe: 'קושי, זמן ועלות גבוהה ללקוחות לנטוש את המוצר ולעבור למתחרה.',
    descriptionEn: 'High cost, time, or operational risk for customers to switch to a competitor.',
    defaultInactiveHe: 'לא זוהה כמנוע חפיר מרכזי בדוח ה-10-K.',
    defaultInactiveEn: 'Not identified as a primary moat source in the 10-K.',
  },
  {
    key: 'Network Effects',
    labelHe: 'אפקט רשת',
    labelEn: 'Network Effects',
    descriptionHe: 'ערך המוצר או הפלטפורמה עולה עבור כל משתמש ככל שמצטרפים יותר משתמשים.',
    descriptionEn: 'The product becomes more valuable to each user as more users join the ecosystem.',
    defaultInactiveHe: 'לא זוהה אפקט רשת משמעותי כמקור חפיר מרכזי בדוח.',
    defaultInactiveEn: 'No strong network effect identified as a primary moat source.',
  },
  {
    key: 'Cost Advantage',
    labelHe: 'יתרון עלות וגודל',
    labelEn: 'Cost Advantage',
    descriptionHe: 'יכולת מבנית לייצר או לספק שירות בעלות נמוכה מהמתחרים בזכות יתרון לגודל ותשתיות.',
    descriptionEn: 'Structural ability to deliver products or services at lower unit cost than peers.',
    defaultInactiveHe: 'לא זוהה יתרון עלות מבני מובהק בדוח.',
    defaultInactiveEn: 'No structural cost advantage identified as a primary moat source.',
  },
  {
    key: 'Intangible Assets',
    labelHe: 'נכסים בלתי מוחשיים',
    labelEn: 'Intangible Assets',
    descriptionHe: 'כוח מותג חזק, פטנטים, קניין רוחני (IP), רישיונות רגולטוריים ואמון רב-שנים.',
    descriptionEn: 'Strong brand equity, patents, proprietary IP, or regulatory licenses providing pricing power.',
    defaultInactiveHe: 'לא זוהו נכסים בלתי מוחשיים כמקור חפיר מרכזי בדוח.',
    defaultInactiveEn: 'Intangible assets not cited as a primary moat driver.',
  },
  {
    key: 'Efficient Scale',
    labelHe: 'יעילות קנה מידה',
    labelEn: 'Efficient Scale',
    descriptionHe: 'שוק המשרת מספר מצומצם של שחקנים, כך שלמתחרים חדשים לא משתלם כלכלית להיכנס.',
    descriptionEn: 'Concentrated market where new entrants cannot economically justify entry.',
    defaultInactiveHe: 'השוק תחרותי בקנה מידה עולמי ואינו מוגן כמונופול טבעי אזורי.',
    defaultInactiveEn: 'Market remains competitive for scaled global peers rather than a natural oligopoly.',
  },
];

const MOAT_KEY_ALIASES = {
  'switching costs': 'Switching Costs',
  'switching cost': 'Switching Costs',
  'network effects': 'Network Effects',
  'network effect': 'Network Effects',
  'cost advantage': 'Cost Advantage',
  'cost advantages': 'Cost Advantage',
  'economies of scale': 'Cost Advantage',
  'intangible assets': 'Intangible Assets',
  'brand': 'Intangible Assets',
  'patents': 'Intangible Assets',
  'efficient scale': 'Efficient Scale',
};

const MOAT_RATING_HE_MAP = {
  'wide moat': 'חפיר רחב',
  'narrow moat': 'חפיר צר',
  'no moat': 'ללא חפיר',
};

export function translateMoatRating(rating, lang = 'he') {
  if (!rating) return lang === 'he' ? 'חפיר צר' : 'Narrow Moat';
  const normalized = String(rating).trim();
  if (lang !== 'he') return normalized;
  return MOAT_RATING_HE_MAP[normalized.toLowerCase()] || normalized;
}

/**
 * Ensures any moat object always lists all 5 canonical economic moat sources in fixed order
 * and computes its X/5 score deterministically from active sources.
 */
export function normalizeMoat(rawMoat, companyName = '', lang = 'he') {
  const incomingSources = Array.isArray(rawMoat?.sources) ? rawMoat.sources : [];
  const byKey = new Map();

  for (const item of incomingSources) {
    if (!item || !item.name) continue;
    const rawKey = String(item.name).trim().toLowerCase();
    const mappedKey = MOAT_KEY_ALIASES[rawKey] || item.name;
    const canon = CANONICAL_MOAT_SOURCES.find(
      (c) =>
        c.key.toLowerCase() === String(mappedKey).toLowerCase() ||
        c.labelHe === item.name
    );
    if (canon && !byKey.has(canon.key)) {
      byKey.set(canon.key, item);
    }
  }

  const sources = CANONICAL_MOAT_SOURCES.map((canon) => {
    const match = byKey.get(canon.key);
    const active = match ? Boolean(match.active) : false;
    const rationale = match?.rationale
      ? String(match.rationale).trim()
      : active
      ? lang === 'he'
        ? canon.descriptionHe
        : canon.descriptionEn
      : lang === 'he'
      ? canon.defaultInactiveHe
      : canon.defaultInactiveEn;

    return {
      name: canon.key,
      labelHe: canon.labelHe,
      labelEn: canon.labelEn,
      descriptionHe: canon.descriptionHe,
      descriptionEn: canon.descriptionEn,
      active,
      rationale,
    };
  });

  const activeCount = sources.filter((s) => s.active).length;
  const rating =
    rawMoat?.rating ||
    (activeCount >= 3 ? 'Wide Moat' : activeCount >= 1 ? 'Narrow Moat' : 'No Moat');

  const activeNames = sources
    .filter((s) => s.active)
    .map((s) => (lang === 'he' ? s.labelHe : s.labelEn));

  const fallbackSummary =
    lang === 'he'
      ? `${companyName ? `${companyName}: ` : ''}${translateMoatRating(rating, 'he')} (${activeCount} מתוך 5 מקורות${activeNames.length ? `: ${activeNames.join(', ')}` : ''}).`
      : `${companyName ? `${companyName}: ` : ''}${rating} (${activeCount} of 5 sources${activeNames.length ? `: ${activeNames.join(', ')}` : ''}).`;

  return {
    rating,
    score: `${activeCount}/5`,
    summary: rawMoat?.summary || fallbackSummary,
    sources,
  };
}

const EXACT_TRAIT_META = {
  'b2b enterprise': {
    labelHe: 'מכירה לארגונים (B2B Enterprise)',
    explanationHe: 'החברה מוכרת רישיונות ותוכנה בעיקר לעסקים ולארגונים בחוזים רב-שנתיים עם נטישת לקוחות נמוכה.',
    explanationEn: 'Sells software and services primarily to enterprises under multi-year contracts.',
  },
  'recurring saas (75%+)': {
    labelHe: 'הכנסות חוזרות ממנויים (Recurring SaaS)',
    explanationHe: 'מעל 75% מההכנסות הן מדמי מנוי חוזרים לתוכנה וענן, מה שמייצר יציבות ותזרים צפוי.',
    explanationEn: 'Over 75% of revenue comes from recurring cloud and software subscriptions.',
  },
  'high operating margin (44%)': {
    labelHe: 'רווחיות תפעולית גבוהה (44% Operating Margin)',
    explanationHe: 'החברה שומרת על כ-44% רווח תפעולי מתוך ההכנסות — סימן מובהק לכוח תמחור ויעילות לגודל.',
    explanationEn: 'Generates ~44% operating margins, reflecting pricing power and operating leverage.',
  },
  'cloud & ai infrastructure': {
    labelHe: 'תשתיות ענן ובינה מלאכותית (Cloud & AI)',
    explanationHe: 'מפעילה מרכזי נתונים עולמיים שעליהם ארגונים מריצים מערכות ליבה ומודלי AI.',
    explanationEn: 'Operates hyperscale data centers powering enterprise cloud workloads and AI.',
  },
  'b2c premium ecosystem': {
    labelHe: 'אקוסיסטם צרכני פרימיום (B2C Ecosystem)',
    explanationHe: 'מערכת סגורה של חומרה ותוכנה לצרכנים פרטיים היוצרת נאמנות וכוח תמחור גבוה.',
    explanationEn: 'Tightly integrated consumer hardware and software ecosystem with strong brand loyalty.',
  },
  'hardware + services flywheel': {
    labelHe: 'חומרה המזינה שירותים (Flywheel)',
    explanationHe: 'כל מכשיר שנמכר מגדיל את מאגר המשתמשים הרוכשים שירותים דיגיטליים רווחיים לאורך שנים.',
    explanationEn: 'Each device sold expands the installed base monetized via recurring digital services.',
  },
  'high gross margin services (74%)': {
    labelHe: 'שירותים ברווח גולמי גבוה (74% Gross Margin)',
    explanationHe: 'חטיבת השירותים הדיגיטליים נהנית משולי רווח גולמי של מעל 70%, גבוהים ממכירת החומרה.',
    explanationEn: 'Digital services carry 70%+ gross margins, lifting overall profitability.',
  },
  '2.2b+ active devices': {
    labelHe: 'בסיס של 2.2B+ מכשירים פעילים',
    explanationHe: 'פריסה עולמית של מעל 2.2 מיליארד מכשירים המשמשת ערוץ הפצה ישיר לשירותים חדשים.',
    explanationEn: 'Massive installed base of 2.2B+ active devices serving as a direct services distribution channel.',
  },
  'b2b & b2c operations': {
    labelHe: 'פעילות לעסקים ולצרכנים (B2B & B2C)',
    explanationHe: 'שילוב מכירות הן ללקוחות עסקיים (B2B) והן לצרכנים פרטיים (B2C) להרחבת בסיס ההכנסות.',
    explanationEn: 'Diversified revenue across both enterprise customers (B2B) and consumers (B2C).',
  },
  'recurring & transactional mix': {
    labelHe: 'תמהיל הכנסות חוזרות ועסקאות (Recurring Mix)',
    explanationHe: 'שילוב בין הכנסות מנוי קבועות לבין מכירות חד-פעמיות של מוצרים או שירותים.',
    explanationEn: 'Blends predictable subscription streams with transactional product or service sales.',
  },
  'scalable platform': {
    labelHe: 'פלטפורמה בעלת יכולת התרחבות (Scalable Platform)',
    explanationHe: 'תשתית המאפשרת לצרף לקוחות חדשים בעלות שולית נמוכה ולשפר רווחיות עם הגדילה.',
    explanationEn: 'Platform economics where revenue scales faster than incremental operating costs.',
  },
};

const TRAIT_KEYWORD_RULES = [
  {
    test: (s) => /\bb2b\b/i.test(s) && /\bb2c\b/i.test(s),
    heLabel: 'מכירה לעסקים ולצרכנים',
    heExplain: 'פונה הן לארגונים (B2B) בחוזים גדולים והן לצרכנים פרטיים (B2C).',
    enExplain: 'Serves both enterprise clients (B2B) and retail consumers (B2C).',
  },
  {
    test: (s) => /\bb2b\b/i.test(s) && !/\bb2c\b/i.test(s),
    heLabel: 'מכירה לארגונים (B2B)',
    heExplain: 'מתמקדת במכירה לעסקים ולארגונים — חוזים ארוכי טווח ושימור לקוחות גבוה.',
    enExplain: 'Enterprise-focused business model with structured B2B contracts.',
  },
  {
    test: (s) => /\bb2c\b/i.test(s) && !/\bb2b\b/i.test(s),
    heLabel: 'מכירה לצרכנים (B2C)',
    heExplain: 'מוכרת ישירות לצרכן הפרטי ונשענת על מותג וביקוש רחב.',
    enExplain: 'Direct-to-consumer business model anchored by brand reach.',
  },
  {
    test: (s) => /(recurring|saas|subscription)/i.test(s),
    heLabel: 'הכנסות חוזרות / מנויי SaaS',
    heExplain: 'מודל מנויים חוזר (SaaS) שמבטיח זרם הכנסות קבוע ויציב מדי רבעון.',
    enExplain: 'Subscription-driven revenue providing predictable recurring cash flows.',
  },
  {
    test: (s) => /(consumption|usage-based)/i.test(s),
    heLabel: 'תמחור ענן לפי שימוש',
    heExplain: 'ההכנסות צומחות אוטומטית ככל שהלקוח צורך יותר משאבי מחשוב או שירותים.',
    enExplain: 'Revenue scales organically with customer compute or service consumption.',
  },
  {
    test: (s) => /(high operating margin|high margin|high gross margin)/i.test(s),
    heLabel: 'שולי רווח גבוהים',
    heExplain: 'שיעור רווחיות גבוה המצביע על כוח תמחור, יתרון איכותי ויעילות תפעולית.',
    enExplain: 'Elevated profit margins signaling pricing power and cost discipline.',
  },
  {
    test: (s) => /(global scale|economies of scale|scale)/i.test(s),
    heLabel: 'פריסה ויתרון לגודל',
    heExplain: 'גודל גלובלי המפזר עלויות פיתוח ותשתית ומקשה על מתחרים קטנים להדביק פער.',
    enExplain: 'Global operating scale amortizing fixed infrastructure and R&D costs.',
  },
  {
    test: (s) => /(cloud|ai|infrastructure)/i.test(s),
    heLabel: 'תשתיות ענן ו-AI',
    heExplain: 'הפעלת תשתיות מחשוב, שרתים ושירותי בינה מלאכותית לארגונים.',
    enExplain: 'Core cloud compute and artificial intelligence infrastructure.',
  },
  {
    test: (s) => /transactional/i.test(s),
    heLabel: 'הכנסות מעסקאות',
    heExplain: 'מבוססת על נפח עסקאות או מכירה חד-פעמית של מוצרים ושירותים.',
    enExplain: 'Generates revenue per transaction or product sale.',
  },
];

/**
 * Resolves a Business Model Trait (either a legacy string or structured bilingual object)
 * into clean display pill text and an investor-friendly explanation for tooltips.
 */
export function resolveTraitDisplay(rawTrait, lang = 'he') {
  if (rawTrait && typeof rawTrait === 'object') {
    const labelEn = String(rawTrait.label || rawTrait.labelEn || '').trim();
    const labelHe = String(rawTrait.labelHe || labelEn).trim();
    return {
      key: labelEn || labelHe,
      displayLabel: lang === 'he' ? labelHe : labelEn || labelHe,
      englishTerm: labelEn,
      explanation:
        lang === 'he'
          ? rawTrait.explanationHe || rawTrait.explanationEn || ''
          : rawTrait.explanationEn || rawTrait.explanationHe || '',
    };
  }

  const text = String(rawTrait || '').trim();
  const exact = EXACT_TRAIT_META[text.toLowerCase()];
  if (exact) {
    return {
      key: text,
      displayLabel: lang === 'he' ? exact.labelHe : text,
      englishTerm: text,
      explanation: lang === 'he' ? exact.explanationHe : exact.explanationEn,
    };
  }

  const matchedRules = TRAIT_KEYWORD_RULES.filter((r) => r.test(text));
  if (matchedRules.length > 0) {
    const heParts = [...new Set(matchedRules.map((r) => r.heLabel))].slice(0, 2);
    const heDesc = matchedRules.map((r) => r.heExplain).join(' ');
    const enDesc = matchedRules.map((r) => r.enExplain).join(' ');
    return {
      key: text,
      displayLabel: lang === 'he' ? `${heParts.join(' · ')} (${text})` : text,
      englishTerm: text,
      explanation: lang === 'he' ? heDesc : enDesc,
    };
  }

  return {
    key: text,
    displayLabel: text,
    englishTerm: text,
    explanation:
      lang === 'he'
        ? `מאפיין מודל עסקי (${text}) כפי שזוהה מתוך דוח החברה.`
        : `Core business model characteristic identified in company filings (${text}).`,
  };
}

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
        'חפיר כלכלי רחב (4 מתוך 5 מקורות): מבוסס על עלויות מעבר ארגוניות, אפקט רשת (LinkedIn ו-GitHub), יתרון עלות וגודל בתשתיות הענן ונכסי מותג ו-IP.',
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
        {
          name: 'Efficient Scale',
          active: false,
          rationale: 'שוק הענן והתוכנה תחרותי בקנה מידה גלובלי מול AWS ו-Google ואינו מונופול אזורי סגור.',
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
            'Wide Moat (4 of 5 sources): Built on mission-critical enterprise switching costs, network effects (LinkedIn/GitHub), hyperscale cloud cost advantage, and trusted brand/IP assets.',
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
            {
              name: 'Efficient Scale',
              active: false,
              rationale: 'Global cloud and enterprise software faces scaled competition (AWS, Google Cloud) rather than a natural local monopoly.',
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
        'חפיר רחב (4 מתוך 5 מקורות): מבוסס על עלויות מעבר גבוהות באקוסיסטם iOS, אפקט רשת ב-App Store, יתרון עלות בייצור ושבבים ונכסי מותג צרכניים.',
      sources: [
        {
          name: 'Switching Costs',
          active: true,
          rationale: 'שילוב הדוק בין iPhone, Watch, iCloud ו-iMessage גורם לשיעור שימור לקוחות של מעל 90%.',
        },
        {
          name: 'Network Effects',
          active: true,
          rationale: 'App Store מושך מפתחים בזכות בסיס המשתמשים הרווחי ביותר בעולם.',
        },
        {
          name: 'Cost Advantage',
          active: true,
          rationale: 'כוח מיקוח חסר תקדים מול ספקיות ייצור ותכנון שבבים עצמאי (Apple Silicon).',
        },
        {
          name: 'Intangible Assets',
          active: true,
          rationale: 'מותג הצרכנות החזק בעולם ותכנון שבבים ופטנטים פנימיים.',
        },
        {
          name: 'Efficient Scale',
          active: false,
          rationale: 'שוק הסמארטפונים והחומרה העולמי פתוח למתחרים (Samsung, Google, Xiaomi).',
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
            'Wide Moat (4 of 5 sources): Powered by iOS switching costs, App Store network effects, supply-chain and silicon cost advantage, and premier consumer brand equity.',
          sources: [
            {
              name: 'Switching Costs',
              active: true,
              rationale: 'Seamless integration across iOS, iCloud, Apple Watch, and Mac locks in consumers.',
            },
            {
              name: 'Network Effects',
              active: true,
              rationale: 'iOS App Store ecosystem connects millions of developers with high-spending users.',
            },
            {
              name: 'Cost Advantage',
              active: true,
              rationale: 'Unmatched component purchasing scale and custom Apple Silicon chip design.',
            },
            {
              name: 'Intangible Assets',
              active: true,
              rationale: 'Premier global consumer brand and proprietary hardware-software IP.',
            },
            {
              name: 'Efficient Scale',
              active: false,
              rationale: 'Global consumer electronics remains open to large international rivals.',
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

  const defaultMoatInput = baseObj.moat || {
    rating: 'Narrow Moat',
    score: '2/5',
    summary: `${companyName} נשענת על עלויות מעבר של לקוחות קיימים ונכסי מותג ומוניטין בענף הפעילות שלה.`,
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
  };

  const normalizedMoat = normalizeMoat(defaultMoatInput, companyName, 'he');

  const rawEn = baseObj.translations?.en;
  const fallbackEnMoatInput = rawEn?.moat || {
    rating: normalizedMoat.rating,
    sources: normalizedMoat.sources.map((s) => ({
      name: s.name,
      active: s.active,
      rationale: s.active ? s.descriptionEn : s.defaultInactiveEn || s.descriptionEn,
    })),
  };
  const normalizedEnMoat = normalizeMoat(fallbackEnMoatInput, companyName, 'en');

  const LEGACY_EN_FALLBACK_MARKER =
    'operates as a leading provider of products and services in its industry';
  const hasCuratedOrLiveEn =
    Boolean(rawEn?.summary) &&
    !rawEn?._isFallbackTranslation &&
    !String(rawEn.summary).includes(LEGACY_EN_FALLBACK_MARKER);
  const isFallbackEn = !hasCuratedOrLiveEn;
  const enrichedTranslations = {
    ...(baseObj.translations || {}),
    en: {
      ...(isFallbackEn ? { _isFallbackTranslation: true } : {}),
      summary:
        rawEn?.summary ||
        `${companyName} (${normTicker}) operates as a leading provider of products and services in its industry, generating revenue through direct sales, enterprise contracts, and recurring service offerings.`,
      growthEngines: rawEn?.growthEngines || [
        `Expanding adoption of ${engines[0] || 'core products'} across enterprise and consumer segments`,
        'Operating margin expansion driven by scale and recurring revenue mix',
        'International market penetration and new product innovation',
      ],
      moat: normalizedEnMoat,
    },
  };

  return {
    businessModelTraits: [
      'B2B & B2C Operations',
      'Recurring & Transactional Mix',
      'Scalable Platform',
    ],
    revenueSegments: [
      { name: engines[0] || 'Core Products & Services', pct: 55 },
      { name: engines[1] || 'Subscriptions & Recurring', pct: 30 },
      { name: engines[2] || 'Other Operating Segments', pct: 15 },
    ],
    geoBreakdown: [
      { region: 'United States / Domestic', pct: 60 },
      { region: 'International Markets', pct: 40 },
    ],
    mermaidDiagram: `flowchart LR\n  A["Customers & Enterprises"] --> B["${engines[0] || normTicker}"]\n  B --> C["Recurring & Product Revenue"]\n  C --> D["Operating Cash Flow"]`,
    growthEngines: [
      `הרחבת אימוץ ${engines[0] || 'מוצרי הליבה'} בקרב לקוחות קיימים וחדשים`,
      `שיפור שולי הרווח התפעולי באמצעות יתרון לגודל ומינוף תפעולי`,
      `חדירה לשווקים בינלאומיים והשקת שירותים משלימים`,
    ],
    competitors: [
      `${normTicker} Sector Peers`,
      'Global Industry Leaders',
      'Specialized Disruptors',
    ],
    ...baseObj,
    keyEngines: engines,
    moat: normalizedMoat,
    translations: enrichedTranslations,
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
  "businessModelTraits": [
    {
      "label": "Short English Tag (e.g. B2B & B2C)",
      "labelHe": "תווית קצרה בעברית (למשל: מכירה לארגונים וצרכנים · B2B & B2C)",
      "explanationHe": "משפט קצר בעברית שמסביר מה התווית אומרת עבור החברה",
      "explanationEn": "One concise sentence explaining this business model trait"
    }
  ],
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
    "summary": "משפט מאוזן בעברית הסוקר את כלל מקורות החפיר הפעילים של החברה (ולא רק מקור אחד)",
    "sources": [
      { "name": "Switching Costs", "active": true, "rationale": "נימוק קצר בעברית" },
      { "name": "Network Effects", "active": true, "rationale": "נימוק קצר בעברית" },
      { "name": "Cost Advantage", "active": true, "rationale": "נימוק קצר בעברית" },
      { "name": "Intangible Assets", "active": true, "rationale": "נימוק קצר בעברית" },
      { "name": "Efficient Scale", "active": false, "rationale": "נימוק קצר בעברית מדוע קיים או לא קיים" }
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

  if (
    summaryObj.translations?.[targetLang]?.summary &&
    !summaryObj.translations?.[targetLang]?._isFallbackTranslation
  ) {
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

    const translatePrompt = `Translate the following structured investment Tear Sheet JSON fields into clear, professional English for value investors. Return ONLY valid JSON with the exact same keys ("summary", "growthEngines", "moat") preserving all 5 moat sources:
${JSON.stringify(compactPayload)}`;

    const translated = await provider.generateJSON(translatePrompt, apiKey);
    if (translated && translated.summary) {
      const sourceMoat = summaryObj.moat
        ? normalizeMoat(summaryObj.moat, normTicker, 'he')
        : null;
      let mergedMoat = translated.moat;
      if (sourceMoat) {
        const translatedNormalized = normalizeMoat(translated.moat || {}, normTicker, 'en');
        const translatedByName = new Map(
          translatedNormalized.sources.map((s) => [s.name, s])
        );
        mergedMoat = normalizeMoat(
          {
            rating: sourceMoat.rating,
            summary: translated.moat?.summary || translatedNormalized.summary,
            sources: sourceMoat.sources.map((origSrc) => {
              const trSrc = translatedByName.get(origSrc.name);
              return {
                name: origSrc.name,
                active: origSrc.active,
                rationale:
                  trSrc?.rationale ||
                  (origSrc.active ? origSrc.descriptionEn : origSrc.defaultInactiveEn),
              };
            }),
          },
          normTicker,
          'en'
        );
      } else if (mergedMoat) {
        mergedMoat = normalizeMoat(mergedMoat, normTicker, 'en');
      }

      const normalizedTranslated = {
        ...translated,
        ...(mergedMoat ? { moat: mergedMoat } : {}),
      };
      const updated = {
        ...summaryObj,
        translations: {
          ...(summaryObj.translations || {}),
          [targetLang]: normalizedTranslated,
        },
      };
      await setCachedSummary(normTicker, updated);
      return enrichWithTearSheetDefaults(updated, normTicker, normTicker);
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
  CANONICAL_MOAT_SOURCES,
  normalizeMoat,
  resolveTraitDisplay,
  translateMoatRating,
};
