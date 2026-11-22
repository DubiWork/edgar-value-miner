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

  const isNoMoatRating =
    String(rawMoat?.rating || '').trim().toLowerCase() === 'no moat';

  const sources = CANONICAL_MOAT_SOURCES.map((canon) => {
    const match = byKey.get(canon.key);
    const active = isNoMoatRating ? false : match ? Boolean(match.active) : false;
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

const INFOGRAPHIC_STAGES_META = [
  {
    stage: 1,
    iconKey: 'customers',
    defaultTitleHe: 'מי הלקוח ומה הצורך',
    defaultTitleEn: 'Who Needs It',
  },
  {
    stage: 2,
    iconKey: 'engine',
    defaultTitleHe: 'איך העסק פועל',
    defaultTitleEn: 'How It Works',
  },
  {
    stage: 3,
    iconKey: 'revenue',
    defaultTitleHe: 'איך הכסף נכנס',
    defaultTitleEn: 'How Money Flows In',
  },
  {
    stage: 4,
    iconKey: 'profit',
    defaultTitleHe: 'רווח וצמיחה חוזרת',
    defaultTitleEn: 'Profit & Reinvestment',
  },
];

const COMPETITOR_SIZE_MAP = {
  larger: {
    sizeLabelHe: 'גדולה יותר',
    sizeLabelEn: 'Larger Peer',
    sizeShortHe: 'גדולה ↑',
    sizeShortEn: 'Larger ↑',
  },
  similar: {
    sizeLabelHe: 'סדר גודל דומה',
    sizeLabelEn: 'Similar Scale',
    sizeShortHe: 'דומה ≈',
    sizeShortEn: 'Similar ≈',
  },
  smaller: {
    sizeLabelHe: 'קטנה יותר',
    sizeLabelEn: 'Smaller Peer',
    sizeShortHe: 'קטנה ↓',
    sizeShortEn: 'Smaller ↓',
  },
};

function parseLegacyMermaidLabels(mermaidCode) {
  if (!mermaidCode || typeof mermaidCode !== 'string') return [];
  const matches = Array.from(mermaidCode.matchAll(/\["([^"]+)"\]|\[([^\]]+)\]/g));
  const seen = new Set();
  const labels = [];
  for (const m of matches) {
    const label = (m[1] || m[2] || '').trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels.slice(0, 4);
}

/**
 * Normalizes a 4-stage plain-language visual Business Value Infographic.
 */
export function normalizeBusinessInfographic(
  rawInfographic,
  engines = [],
  companyName = '',
  normTicker = '',
  lang = 'he',
  legacyMermaid = ''
) {
  const isHe = lang === 'he';
  if (Array.isArray(rawInfographic) && rawInfographic.length >= 2) {
    return INFOGRAPHIC_STAGES_META.map((meta, idx) => {
      const item = rawInfographic[idx] || rawInfographic[rawInfographic.length - 1] || {};
      const title = isHe
        ? item.titleHe || item.title || meta.defaultTitleHe
        : item.titleEn || item.title || meta.defaultTitleEn;
      const subtitle = isHe
        ? item.subtitleHe || item.subtitle || item.descriptionHe || item.description || ''
        : item.subtitleEn || item.subtitle || item.descriptionEn || item.description || '';
      return {
        stage: meta.stage,
        iconKey: item.iconKey || meta.iconKey,
        title: String(title).trim(),
        subtitle: String(subtitle || (isHe ? meta.defaultTitleHe : meta.defaultTitleEn)).trim(),
      };
    });
  }

  const mermaidLabels = parseLegacyMermaidLabels(legacyMermaid);
  const label = companyName || normTicker || 'החברה';
  const mainEngine = engines[0] || (isHe ? 'מוצרי ושירותי הליבה' : 'Core Products & Services');
  const secondaryEngine = engines[1] || (isHe ? 'שירותים משלימים' : 'Recurring & Aftermarket');

  const defaultSubsHe = [
    mermaidLabels[0] || `לקוחות קצה וארגונים הזקוקים ל-${mainEngine}`,
    mermaidLabels[1] || `${label} מספקת ${mainEngine} ו-${secondaryEngine}`,
    mermaidLabels[2] || 'תשלום במנויים, חוזים רב-שנתיים או מכירה ישירה',
    mermaidLabels[3] || 'עודף המזומנים מופנה לצמיחה, פיתוח ורכישה עצמית',
  ];
  const defaultSubsEn = [
    mermaidLabels[0] || `Enterprise & retail customers needing ${mainEngine}`,
    mermaidLabels[1] || `${label} delivers ${mainEngine} & ${secondaryEngine}`,
    mermaidLabels[2] || 'Revenue collected via subscriptions, contracts & direct sales',
    mermaidLabels[3] || 'Operating cash flow funds reinvestment and shareholder returns',
  ];

  return INFOGRAPHIC_STAGES_META.map((meta, idx) => ({
    stage: meta.stage,
    iconKey: meta.iconKey,
    title: isHe ? meta.defaultTitleHe : meta.defaultTitleEn,
    subtitle: isHe ? defaultSubsHe[idx] : defaultSubsEn[idx],
  }));
}

/**
 * Normalizes competitor entries (either legacy string names or structured peers with scale & overlap).
 */
export function normalizeCompetitors(rawCompetitors = [], lang = 'he') {
  if (!Array.isArray(rawCompetitors)) return [];
  const isHe = lang === 'he';

  return rawCompetitors
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        if (!name) return null;
        return {
          name,
          relativeSize: 'similar',
          sizeLabel: isHe ? COMPETITOR_SIZE_MAP.similar.sizeLabelHe : COMPETITOR_SIZE_MAP.similar.sizeLabelEn,
          sizeShort: isHe ? COMPETITOR_SIZE_MAP.similar.sizeShortHe : COMPETITOR_SIZE_MAP.similar.sizeShortEn,
          competeOn: isHe
            ? 'מתחרה ישירה בפלחי השוק המרכזיים ובשימור לקוחות.'
            : 'Direct peer competing across overlapping core product and customer segments.',
        };
      }
      if (!item || !item.name) return null;
      const sizeKey = ['larger', 'similar', 'smaller'].includes(String(item.relativeSize || '').toLowerCase())
        ? String(item.relativeSize).toLowerCase()
        : 'similar';
      const sizeMeta = COMPETITOR_SIZE_MAP[sizeKey];
      const competeOnText = isHe
        ? item.competeOnHe || item.competeOn || item.competeOnEn || 'מתחרה בפלחי פעילות חופפים.'
        : item.competeOnEn || item.competeOn || item.competeOnHe || 'Competes across overlapping core segments.';

      return {
        name: String(item.name).trim(),
        relativeSize: sizeKey,
        sizeLabel: isHe ? sizeMeta.sizeLabelHe : sizeMeta.sizeLabelEn,
        sizeShort: isHe ? sizeMeta.sizeShortHe : sizeMeta.sizeShortEn,
        competeOn: String(competeOnText).trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Normalizes a compact 3-5 term domain/business jargon glossary for non-expert readers.
 */
export function normalizeGlossary(rawGlossary = [], lang = 'he') {
  const isHe = lang === 'he';
  if (Array.isArray(rawGlossary) && rawGlossary.length > 0) {
    const cleaned = rawGlossary
      .map((item) => {
        if (!item || !item.term) return null;
        const definition = isHe
          ? item.definitionHe || item.definition || item.definitionEn || ''
          : item.definitionEn || item.definition || item.definitionHe || '';
        if (!definition) return null;
        return {
          term: String(item.term).trim(),
          definition: String(definition).trim(),
        };
      })
      .filter(Boolean)
      .slice(0, 5);
    if (cleaned.length > 0) return cleaned;
  }

  return isHe
    ? [
        {
          term: '10-K / 8-K',
          definition: 'הדוח השנתי המלא (10-K) ועדכוני תוצאות רבעוניים (8-K) המוגשים לרשות ני״ע האמריקאית.',
        },
        {
          term: 'B2B / B2G',
          definition: 'מכירה לעסקים וארגונים (B2B) או לממשלות וגופי ביטחון בחוזים רב-שנתיים (B2G).',
        },
        {
          term: 'חפיר כלכלי (Moat)',
          definition: 'יתרון תחרותי מתמשך המקשה על מתחרים לנגוס בנתח השוק או ברווחיות החברה.',
        },
      ]
    : [
        {
          term: '10-K / 8-K',
          definition: 'Audited annual SEC filing (10-K) and timely quarterly/earnings updates (8-K).',
        },
        {
          term: 'B2B / B2G',
          definition: 'Sales to commercial businesses (B2B) or government and defense agencies (B2G).',
        },
        {
          term: 'Economic Moat',
          definition: 'Durable competitive advantage protecting market share and pricing power from rivals.',
        },
      ];
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
    businessInfographic: [
      {
        stage: 1,
        iconKey: 'customers',
        titleHe: 'מי הלקוח ומה הצורך',
        subtitleHe: 'ארגונים וחברות שזקוקים לענן מאובטח וכלי עבודה משרדיים',
        titleEn: 'Who Needs It',
        subtitleEn: 'Enterprises & workers needing secure cloud and daily productivity tools',
      },
      {
        stage: 2,
        iconKey: 'engine',
        titleHe: 'איך העסק פועל',
        subtitleHe: 'מפעילה את ענן Azure, חבילת Office 365 וכלי AI (Copilot)',
        titleEn: 'How It Works',
        subtitleEn: 'Operates Azure hyperscale cloud, M365 software & Copilot AI',
      },
      {
        stage: 3,
        iconKey: 'revenue',
        titleHe: 'איך הכסף נכנס',
        subtitleHe: 'מנויים חודשיים צפויים מראש (SaaS) וחיוב לפי שימוש בענן',
        titleEn: 'How Money Flows In',
        subtitleEn: 'Predictable monthly SaaS seats + usage-based cloud billing',
      },
      {
        stage: 4,
        iconKey: 'profit',
        titleHe: 'רווח וצמיחה חוזרת',
        subtitleHe: '~44% רווח תפעולי שמושקע בשרתי AI והחזר מניות לבעלים',
        titleEn: 'Profit & Reinvestment',
        subtitleEn: '~44% operating margin reinvested in AI capacity & buybacks',
      },
    ],
    growthEngines: [
      'התרחבות Azure AI ואימוץ Copilot בקרב לקוחות ארגוניים (Fortune 500)',
      'מעבר לקוחות לחבילות פרימיום E5 ב-Microsoft 365 והעלאות מחיר תקופתיות',
      'צמיחת פרסום ב-LinkedIn ורכישת Activision Blizzard ב-Game Pass',
    ],
    competitors: [
      {
        name: 'Amazon AWS',
        relativeSize: 'similar',
        competeOnHe: 'תשתיות ענן ומחשוב ארגוני (Cloud Infrastructure)',
        competeOnEn: 'Enterprise cloud compute and AI infrastructure',
      },
      {
        name: 'Google Cloud & Workspace',
        relativeSize: 'similar',
        competeOnHe: 'שירותי ענן, AI וכלי עבודה ושיתוף למשרדים',
        competeOnEn: 'Cloud AI workloads and workplace productivity suites',
      },
      {
        name: 'Salesforce',
        relativeSize: 'smaller',
        competeOnHe: 'תוכנות ארגוניות לניהול לקוחות (Dynamics vs CRM)',
        competeOnEn: 'Enterprise CRM and workflow SaaS applications',
      },
      {
        name: 'Apple',
        relativeSize: 'similar',
        competeOnHe: 'מערכות הפעלה וחומרת קצה למשתמשים וארגונים',
        competeOnEn: 'Desktop/enterprise OS ecosystem and endpoint devices',
      },
      {
        name: 'Sony',
        relativeSize: 'smaller',
        competeOnHe: 'קונסולות גיימינג ומנויי תוכן דיגיטליים (PlayStation vs Xbox)',
        competeOnEn: 'Gaming consoles, studios, and subscription ecosystems',
      },
    ],
    glossary: [
      {
        term: 'SaaS',
        definitionHe: 'תוכנה כשירות — מודל מנויים חודשי/שנתי במקום קנייה חד-פעמית, שמבטיח הכנסות צפויות.',
        definitionEn: 'Software-as-a-Service — recurring subscription software delivering predictable revenue.',
      },
      {
        term: 'OEM',
        definitionHe: 'יצרניות מחשבים מקוריות (כמו Dell ו-HP) המשלמות על רישיונות Windows בכל מחשב חדש.',
        definitionEn: 'Original Equipment Manufacturers (Dell, HP) bundling Windows pre-installed on PCs.',
      },
      {
        term: 'Hyperscale Cloud',
        definitionHe: 'תשתיות ענן ענקיות ויקרות להקמה שבהן העלות ללקוח יורדת משמעותית ככל שהגודל עולה.',
        definitionEn: 'Massive global data-center networks whose unit cost drops sharply with scale.',
      },
      {
        term: 'Switching Costs',
        definitionHe: 'עלויות מעבר — הקושי הטכני והכספי להחליף מערכת ארגונית שכבר מוטמעת בכל החברה.',
        definitionEn: 'Technical and operational friction making customers reluctant to switch vendors.',
      },
    ],
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
    businessInfographic: [
      {
        stage: 1,
        iconKey: 'customers',
        titleHe: 'מי הלקוח ומה הצורך',
        subtitleHe: 'מעל 2.2 מיליארד מכשירי קצה של צרכנים נאמנים ברחבי העולם',
        titleEn: 'Who Needs It',
        subtitleEn: 'Over 2.2B active consumer devices anchored to iOS',
      },
      {
        stage: 2,
        iconKey: 'engine',
        titleHe: 'איך העסק פועל',
        subtitleHe: 'מוכרת חומרת פרימיום (iPhone/Mac) שמכניסה משתמשים לאקוסיסטם',
        titleEn: 'How It Works',
        subtitleEn: 'Sells flagship hardware pulling users into a sticky ecosystem',
      },
      {
        stage: 3,
        iconKey: 'revenue',
        titleHe: 'איך הכסף נכנס',
        subtitleHe: 'מכירות מכשירים + עמלות קבועות מ-App Store, iCloud ו-Apple Pay',
        titleEn: 'How Money Flows In',
        subtitleEn: 'Hardware sales + high-margin recurring App Store & iCloud fees',
      },
      {
        stage: 4,
        iconKey: 'profit',
        titleHe: 'רווח וצמיחה חוזרת',
        subtitleHe: 'מעל $100B תזרים חופשי בשנה המופנה לפיתוח שבבים ובייבאקס',
        titleEn: 'Profit & Reinvestment',
        subtitleEn: '$100B+ annual FCF funding Apple Silicon R&D and buybacks',
      },
    ],
    growthEngines: [
      'צמיחה דו-ספרתית בחטיבת ה-Services עם שולי רווח גולמי של מעל 70%',
      'מחזורי שדרוג מכשירים מבוססי Apple Intelligence על גבי בסיס של 2.2 מיליארד מכשירים',
      'חדירה לשווקים מתעוררים (הודו ודרום-מזרח אסיה) והרחבת שירותי פינטק (Apple Pay)',
    ],
    competitors: [
      {
        name: 'Samsung',
        relativeSize: 'smaller',
        competeOnHe: 'סמארטפונים וטאבלטים במגזר הפרימיום והשוק העולמי',
        competeOnEn: 'Flagship smartphones, tablets, and wearables worldwide',
      },
      {
        name: 'Google Android',
        relativeSize: 'similar',
        competeOnHe: 'מערכת הפעלה לניידים, חנות אפליקציות ושירותי ענן/תשלום',
        competeOnEn: 'Mobile OS ecosystem, app store fees, and Pixel hardware',
      },
      {
        name: 'Xiaomi & Huawei',
        relativeSize: 'smaller',
        competeOnHe: 'מכשירי סמארטפון ותחרות מחירים בשווקים מתעוררים ובסין',
        competeOnEn: 'Handset market share across China and emerging markets',
      },
      {
        name: 'Microsoft',
        relativeSize: 'similar',
        competeOnHe: 'מחשבים אישיים, מערכות הפעלה (macOS vs Windows) ושירותי AI',
        competeOnEn: 'Desktop computing ecosystems (macOS vs Windows)',
      },
      {
        name: 'Spotify',
        relativeSize: 'smaller',
        competeOnHe: 'מנויי מוזיקה וסטרימינג דיגיטלי על גבי iOS (Apple Music)',
        competeOnEn: 'Digital audio streaming subscriptions (Apple Music vs Spotify)',
      },
    ],
    glossary: [
      {
        term: 'Installed Base',
        definitionHe: 'בסיס המכשירים הפעיל — כל האייפונים והמק-ים שנמצאים בשימוש כיום ומזמינים שירותים חוזרים.',
        definitionEn: 'Active devices in consumers’ hands generating ongoing Services revenue.',
      },
      {
        term: 'Services Margin',
        definitionHe: 'רווחיות משירותים דיגיטליים (~74% גולמי), הגבוהה כמעט פי שניים ממכירת החומרה.',
        definitionEn: 'Gross margin (~74%) on App Store, iCloud & licensing — nearly double hardware.',
      },
      {
        term: 'Apple Silicon',
        definitionHe: 'שבבים שאפל מתכננת בעצמה (סדרת M ו-A) כדי להוזיל עלויות ולהאריך חיי סוללה.',
        definitionEn: 'In-house custom chips cutting component costs and boosting battery efficiency.',
      },
    ],
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

  const heInfographic = normalizeBusinessInfographic(
    baseObj.businessInfographic,
    engines,
    companyName,
    normTicker,
    'he',
    baseObj.mermaidDiagram
  );
  const enInfographic = normalizeBusinessInfographic(
    rawEn?.businessInfographic || baseObj.businessInfographic,
    engines,
    companyName,
    normTicker,
    'en',
    baseObj.mermaidDiagram
  );
  const heCompetitors = normalizeCompetitors(
    baseObj.competitors || [
      `${normTicker} Sector Peers`,
      'Global Industry Leaders',
      'Specialized Disruptors',
    ],
    'he'
  );
  const enCompetitors = normalizeCompetitors(
    rawEn?.competitors ||
      baseObj.competitors || [
        `${normTicker} Sector Peers`,
        'Global Industry Leaders',
        'Specialized Disruptors',
      ],
    'en'
  );
  const heGlossary = normalizeGlossary(baseObj.glossary, 'he');
  const enGlossary = normalizeGlossary(rawEn?.glossary || baseObj.glossary, 'en');

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
      businessInfographic: enInfographic,
      competitors: enCompetitors,
      glossary: enGlossary,
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
    growthEngines: [
      `הרחבת אימוץ ${engines[0] || 'מוצרי הליבה'} בקרב לקוחות קיימים וחדשים`,
      `שיפור שולי הרווח התפעולי באמצעות יתרון לגודל ומינוף תפעולי`,
      `חדירה לשווקים בינלאומיים והשקת שירותים משלימים`,
    ],
    ...baseObj,
    keyEngines: engines,
    businessInfographic: heInfographic,
    competitors: heCompetitors,
    glossary: heGlossary,
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
  "businessInfographic": [
    {
      "stage": 1,
      "titleHe": "מי הלקוח ומה הצורך",
      "subtitleHe": "משפט קצר מאוד בעברית פשוטה ללא ז׳רגון על הלקוח והבעיה שהחברה פותרת",
      "titleEn": "Who Needs It",
      "subtitleEn": "Plain-language 1-line summary of customer & need"
    },
    {
      "stage": 2,
      "titleHe": "איך העסק פועל",
      "subtitleHe": "משפט קצר ופשוט על המוצר/השירות המרכזי (בגובה העיניים)",
      "titleEn": "How It Works",
      "subtitleEn": "Plain-language 1-line summary of core product or service"
    },
    {
      "stage": 3,
      "titleHe": "איך הכסף נכנס",
      "subtitleHe": "איך הלקוחות משלמים (חוזים ארוכי טווח / מנויים / מכירת חלפים וכו׳)",
      "titleEn": "How Money Flows In",
      "subtitleEn": "How customers pay (recurring contracts, usage, units)"
    },
    {
      "stage": 4,
      "titleHe": "רווח וצמיחה חוזרת",
      "subtitleHe": "מה הרווח שנשאר ולאן הוא מופנה בעסק",
      "titleEn": "Profit & Reinvestment",
      "subtitleEn": "How cash flow compounds growth and returns"
    }
  ],
  "growthEngines": [
    "מנוע צמיחה 1 קצר וממוקד בעברית מתוך ה-10-K/שיחת הוועידה",
    "מנוע צמיחה 2 קצר וממוקד בעברית",
    "מנוע צמיחה 3 קצר וממוקד בעברית"
  ],
  "competitors": [
    {
      "name": "Competitor 1",
      "relativeSize": "larger | similar | smaller (ביחס לגודל החברה הנסקרת)",
      "competeOnHe": "משפט קצר: באיזה תחום או פלח מתחרות",
      "competeOnEn": "Short phrase on exact competitive overlap"
    }
  ],
  "glossary": [
    {
      "term": "Short Jargon Term / Acronym (e.g. MRO, OEM, USM — 3 to 5 unfamiliar industry terms used above)",
      "definitionHe": "הסבר של שורה אחת בעברית פשוטה למי שאינו מהתחום",
      "definitionEn": "1-line plain English definition for non-specialists"
    }
  ],
  "moat": {
    "rating": "Wide Moat | Narrow Moat | No Moat (הערכה איכותנית לפי מתודולוגיית Morningstar/באפט — בהתחשב בעוצמת התחרות בענף וביריבים כמו דואופול, לא ספירה מכנית בלבד. דרג Narrow Moat אם מתחרים חזקים יכולים לנגוס בנתח שוק או בתמחור, ו-No Moat רק אם אין אף מקור חפיר פעיל)",
    "score": "X/5 (חייב להתאים למספר ה-active: true למטה; ב-No Moat חובה 0 active)",
    "summary": "משפט מאוזן בעברית הסוקר את החפיר (כולל מגבלות מול מתחרים מרכזיים אם קיימות)",
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
      ...(Array.isArray(parsed.businessInfographic)
        ? { businessInfographic: parsed.businessInfographic.slice(0, 4) }
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
      ...(Array.isArray(parsed.glossary)
        ? { glossary: parsed.glossary.slice(0, 5) }
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
    const normalizedPeers = normalizeCompetitors(summaryObj.competitors || [], 'he');
    const normalizedFlow = normalizeBusinessInfographic(
      summaryObj.businessInfographic,
      summaryObj.keyEngines || [],
      normTicker,
      normTicker,
      'he',
      summaryObj.mermaidDiagram
    );
    const normalizedTerms = normalizeGlossary(summaryObj.glossary || [], 'he');

    const compactPayload = {
      summary: summaryObj.summary,
      growthEngines: summaryObj.growthEngines || [],
      businessInfographic: normalizedFlow.map((s) => ({ stage: s.stage, subtitle: s.subtitle })),
      competitors: normalizedPeers.map((c) => ({ name: c.name, competeOn: c.competeOn })),
      glossary: normalizedTerms.map((g) => ({ term: g.term, definition: g.definition })),
      moat: summaryObj.moat || null,
    };

    const translatePrompt = `Translate the following structured investment Tear Sheet JSON fields into clear, professional English for value investors. Return ONLY valid JSON with the keys ("summary", "growthEngines", "businessInfographic", "competitors", "glossary", "moat") preserving all 5 moat sources, competitor names, and glossary terms:
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

      const mergedInfographic = Array.isArray(translated.businessInfographic)
        ? INFOGRAPHIC_STAGES_META.map((meta, idx) => ({
            stage: meta.stage,
            iconKey: meta.iconKey,
            titleEn: meta.defaultTitleEn,
            subtitleEn:
              translated.businessInfographic[idx]?.subtitle ||
              translated.businessInfographic[idx]?.subtitleEn ||
              normalizedFlow[idx]?.subtitle,
          }))
        : undefined;

      const trPeersByName = new Map(
        (Array.isArray(translated.competitors) ? translated.competitors : []).map((c) => [
          String(c?.name || '').toLowerCase(),
          c,
        ])
      );
      const mergedCompetitors = normalizedPeers.map((orig) => ({
        name: orig.name,
        relativeSize: orig.relativeSize,
        competeOnEn:
          trPeersByName.get(orig.name.toLowerCase())?.competeOn ||
          trPeersByName.get(orig.name.toLowerCase())?.competeOnEn ||
          orig.competeOn,
      }));

      const trGlossaryByTerm = new Map(
        (Array.isArray(translated.glossary) ? translated.glossary : []).map((g) => [
          String(g?.term || '').toLowerCase(),
          g,
        ])
      );
      const mergedGlossary = normalizedTerms.map((orig) => ({
        term: orig.term,
        definitionEn:
          trGlossaryByTerm.get(orig.term.toLowerCase())?.definition ||
          trGlossaryByTerm.get(orig.term.toLowerCase())?.definitionEn ||
          orig.definition,
      }));

      const normalizedTranslated = {
        ...translated,
        ...(mergedInfographic ? { businessInfographic: mergedInfographic } : {}),
        ...(mergedCompetitors.length > 0 ? { competitors: mergedCompetitors } : {}),
        ...(mergedGlossary.length > 0 ? { glossary: mergedGlossary } : {}),
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
 * Fetches the 10-K / Transcript / 8-K ingestion status for a ticker from Firestore via Cloud Function,
 * optionally validating cached filing dates cleanly without redundant SEC/LLM calls.
 * @param {string} ticker
 * @param {{ tenKDate?: string|null, eightKDate?: string|null }|null} [clientFilingDates]
 * @returns {Promise<Object|null>}
 */
export async function getCompanyContextStatus(ticker, clientFilingDates = null) {
  try {
    const functions = firebaseLib.functions;
    if (!functions || !ticker) return null;
    const callable = httpsCallable(functions, 'generateAiSummary');
    const response = await callable({
      action: 'getCompanyContextStatus',
      ticker: ticker.toUpperCase().trim(),
      ...(clientFilingDates ? { clientFilingDates } : {}),
    });
    const payload = response?.data ?? response;
    if (!payload?.ingestionStatus) return null;
    return {
      ...payload.ingestionStatus,
      ...(typeof payload.hasNewerFilings === 'boolean'
        ? { hasNewerFilings: payload.hasNewerFilings }
        : {}),
      ...(payload.latestFilingDates ? { latestFilingDates: payload.latestFilingDates } : {}),
    };
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
  normalizeBusinessInfographic,
  normalizeCompetitors,
  normalizeGlossary,
  resolveTraitDisplay,
  translateMoatRating,
};
