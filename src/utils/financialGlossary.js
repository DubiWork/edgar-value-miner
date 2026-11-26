/**
 * Financial Glossary Lookup & Inline Tokenizer (Step 1 Educational Tooltips)
 *
 * Grounded definitions synthesized from Warren Buffett's Shareholder Letters and
 * Benjamin Graham's *The Intelligent Investor*. Used by `GlossaryText` to render
 * subtle inline hover/tap tooltips without interrupting reading flow.
 *
 * @module financialGlossary
 */

export const FINANCIAL_GLOSSARY = {
  pricingPower: {
    termHe: 'כוח תמחור',
    termEn: 'Pricing power',
    definitionHe:
      'היכולת של עסק להעלות מחירים בקלות ובאופן אגרסיבי מול ביקוש חזק או אינפלציה בלי לאבד לקוחות או נתח שוק משמעותי, וכך לשמור על רווחיות יציבה לאורך זמן.',
    definitionEn:
      'The demonstrated ability of an economic franchise to regularly and aggressively increase prices without fear of significant loss of market share or unit volume.',
    source: 'Berkshire Hathaway Shareholder Letter, 1991',
  },
  excessCapacity: {
    termHe: 'עודף כושר ייצור',
    termEn: 'Excess industry capacity',
    definitionHe:
      'מצב שבו היצע הייצור בענף עולה על הביקוש, מה שמאלץ חברות לקבוע מחירים לפי עלויות תפעול ישירות ופוגע קשות ברווחיות.',
    definitionEn:
      'A supply condition where productive capacity exceeds demand, forcing market prices down to direct operating costs rather than capital employed and producing poor profitability.',
    source: 'Berkshire Hathaway Shareholder Letter, 1982',
  },
  operatingLoss: {
    termHe: 'הפסד תפעולי / שנת גירעון',
    aliasesHe: ['הפסד תפעולי', 'שנת גירעון'],
    termEn: 'Operating loss / Deficit year',
    aliasesEn: ['Operating loss', 'deficit year'],
    definitionHe:
      'מצב שבו הוצאות הפעילות והעלויות של העסק עולות על הכנסותיו, כך שפעילות הליבה מייצרת גירעון עוד לפני הוצאות מימון או מס; גראהם רואה בשנות גירעון סכנה ליציבות הרווח.',
    definitionEn:
      'A condition where operating expenses and charges exceed revenues, resulting in a deficit for the year. Graham requires defensive investors to avoid companies with a deficit year over the past decade.',
    source: 'The Intelligent Investor, Ch. 7 & Ch. 14; Berkshire Hathaway Shareholder Letter, 1985',
  },
  cyclicalCompany: {
    termHe: 'חברות מחזוריות',
    aliasesHe: ['ענף מחזורי', 'חברה מחזורית'],
    termEn: 'Cyclical companies',
    aliasesEn: ['Cyclical peaks', 'Cyclical', 'commodity industries'],
    definitionHe:
      'חברות שהכנסותיהן, שולי הרווח שלהן ומחירי המניות שלהן נעים בגלים של עליות וירידות לפי מחזורי הביקוש וההיצע בענף, ונוטות לתעתע במכפיל נמוך בשיא המחזור ובמכפיל גבוה בשפל.',
    definitionEn:
      'Enterprises whose earnings fluctuate widely between boom-period windfalls and recessionary deficits. They tend to sell at lower multiples in good years and higher multiples in bad years.',
    source: 'The Intelligent Investor, Ch. 7; Berkshire Hathaway Shareholder Letter, 1991',
  },
  peRatio: {
    termHe: 'מכפיל רווח',
    aliasesHe: ['המכפיל', 'מכפיל'],
    termEn: 'Price/earnings (P/E) ratio',
    aliasesEn: ['P/E ratios', 'P/E ratio'],
    definitionHe:
      'יחס המשווה בין מחיר המניה או שווי השוק לרווח הנקי (או הרווח למניה), ומראה כמה דולרים משלמים היום עבור כל דולר של רווח שנתי.',
    definitionEn:
      "A valuation multiple comparing a stock's market price to its per-share earnings, showing how much investors pay today for each dollar of annual earnings.",
    source: 'The Intelligent Investor, Ch. 3 & Ch. 14; Berkshire Hathaway Shareholder Letter, 1991',
  },
  capex: {
    termHe: 'השקעות הון',
    aliasesHe: ['CapEx'],
    termEn: 'Capital expenditures (CapEx)',
    aliasesEn: ['capital investments', 'CapEx'],
    definitionHe:
      'כספים המושקעים ברכישה ותחזוקה של נכסים פיזיים ותשתיות ארוכות טווח (כגון מבנים, ציוד, שרתים ונדל"ן) כדי לשמר את כושר התחרות ולתמוך בפעילות העסק.',
    definitionEn:
      "Capitalized expenditures for plant, equipment, and long-lived physical assets required to maintain a business's competitive position and support operations.",
    source: 'The Intelligent Investor, Commentary on Ch. 11 & Ch. 12; Berkshire Hathaway Shareholder Letter, 1986',
  },
  equity: {
    termHe: 'הון עצמי',
    aliasesHe: ['ההון העצמי'],
    termEn: 'Equity capital / Net worth',
    aliasesEn: ['equity capital', 'total equity', 'equity'],
    definitionHe:
      'ההון ששייך לבעלי המניות — סך הנכסים בניכוי ההתחייבויות — המורכב מההון שהושקע ומהרווחים שנצברו בעסק.',
    definitionEn:
      'The ownership interest of stockholders in a corporation, equal to total assets minus total liabilities and composed of contributed capital plus retained earnings.',
    source: 'The Intelligent Investor, Ch. 2 & Ch. 14; Berkshire Hathaway Shareholder Letter, 1983',
  },
  capitalStructure: {
    termHe: 'מבנה הון',
    aliasesHe: ['מבנה חוב'],
    termEn: 'Capital structure',
    aliasesEn: ['capital structures', 'debt structures', 'debt structure'],
    definitionHe:
      'החלוקה בין הון עצמי לחוב ולאמצעי מימון אחרים של החברה; מבנה שמרני נשען ברובו על הון עצמי ומאפשר לכסות את הריבית בנוחות מתזרים המזומנים השוטף.',
    definitionEn:
      'The composition of equity capital, preferred stock, and debt financing a company. A conservative structure requires substantial equity backing and allows interest to be comfortably met from current cash flow net of CapEx.',
    source: 'The Intelligent Investor, Ch. 5 & Ch. 11; Berkshire Hathaway Shareholder Letter, 1989',
  },
  marginOfSafety: {
    termHe: 'מרווח ביטחון',
    aliasesHe: ['מרווח הביטחון'],
    termEn: 'Margin of safety',
    definitionHe:
      'הפער החיובי שבין הערך הפנימי האמיתי של החברה למחיר הנמוך יותר שמשלמים בפועל, שנועד להגן על המשקיע מפני טעויות בהערכה, הפתעות ותנודות בשוק.',
    definitionEn:
      "A favorable gap between a company's appraised intrinsic value and the lower market price paid for it, providing protection against valuation errors, bad luck, and adverse developments.",
    source: 'The Intelligent Investor, Ch. 20; Berkshire Hathaway Shareholder Letter, 1992',
  },
  leverage: {
    termHe: 'מינוף',
    aliasesHe: ['במינוף', 'המינוף'],
    termEn: 'Leverage',
    aliasesEn: ['bank leverage'],
    definitionHe:
      'שימוש בחוב כדי להגדיל את היקף הנכסים ביחס להון העצמי; מגדיל את פוטנציאל התשואה, אך מעצים משמעותית את הסיכון להפסד כבד או לפגיעה בהון בעת משבר.',
    definitionEn:
      'The use of borrowed debt and senior claims relative to equity to expand assets, magnifying both potential returns and vulnerability to severe losses during downturns.',
    source: 'The Intelligent Investor, Ch. 11; Berkshire Hathaway Shareholder Letter, 1990',
  },
  currentRatio: {
    termHe: 'יחס שוטף',
    aliasesHe: ['היחס השוטף'],
    termEn: 'Current ratio',
    aliasesEn: ['current assets', 'current liabilities'],
    definitionHe:
      'היחס בין הנכסים השוטפים (כמו מזומן, חייבים ומלאי) להתחייבויות השוטפות, הבודק אם לחברה יש כרית נזילות מספקת לעמוד בהתחייבויות הקרובות; גראהם קבע רף שמרני של לפחות 2.0 לחברות תעשייתיות.',
    definitionEn:
      'A liquidity ratio of current assets to current liabilities measuring short-term coverage of upcoming obligations. Graham set a two-to-one standard (at least 2.0x) for industrial companies.',
    source: 'The Intelligent Investor, Ch. 14',
  },
  liquidity: {
    termHe: 'נזילות',
    aliasesHe: ['נזילות החברה'],
    termEn: 'Liquidity',
    definitionHe:
      'היכולת לעמוד בהתחייבויות קצרות טווח ולהחזיק יתרות מזומנים ונכסים זמינים המעניקים חוסן פיננסי ויכולת לפעול גם בתקופות של לחץ אשראי.',
    definitionEn:
      'Having cash equivalents and liquid assets to meet short-term obligations promptly and maintain financial strength during economic or credit stress.',
    source: 'The Intelligent Investor, Ch. 8 & Ch. 12; Berkshire Hathaway Shareholder Letter, 1980',
  },
  operatingCashFlow: {
    termHe: 'תזרים תפעולי',
    aliasesHe: ['תזרים מפעולות', 'תזרים המזומנים'],
    termEn: 'Operating cash flow',
    aliasesEn: ['operating cash', 'Owner cash flow'],
    definitionHe:
      'המזומן בפועל שנוצר מהפעילות העסקית השוטפת של החברה ללא התאמות חשבונאיות לא-מזומניות; מדד מרכזי לבדיקה אם העסק מייצר מזומן בעצמו או זקוק למימון חיצוני.',
    definitionEn:
      'The cash generated by ongoing core business operations (reported on the cash-flow statement), excluding non-cash accounting items and evaluated alongside capital spending requirements.',
    source: 'The Intelligent Investor, Commentary on Ch. 11; Berkshire Hathaway Shareholder Letter, 1986',
  },
  freeCashFlow: {
    termHe: 'תזרים מזומנים חופשי',
    aliasesHe: ['מזומן חופשי', 'תזרים חופשי'],
    termEn: 'Free cash flow (Owner earnings)',
    aliasesEn: ['no-strings-attached cash', 'cash flow net of CapEx', 'free cash flow', 'owner earnings'],
    definitionHe:
      'המזומן שנותר מהפעילות השוטפת לאחר ניכוי השקעות ההון (CapEx) הדרושות לקיום העסק — כסף זמין שיכול לשמש לפירעון חוב, דיבידנד או רכישה עצמית של מניות.',
    definitionEn:
      'Cash generated from operations minus capital expenditures required to maintain the business (akin to owner earnings), representing cash available for debt reduction, buybacks, or dividends.',
    source: 'The Intelligent Investor, Commentary on Ch. 11 & Ch. 15; Berkshire Hathaway Shareholder Letter, 1989',
  },
  accountingNetIncome: {
    termHe: 'רווח חשבונאי',
    aliasesHe: ['מרווח חשבונאי'],
    termEn: 'Accounting net income',
    aliasesEn: ['reported accounting net income', 'reported earnings'],
    definitionHe:
      'השורה התחתונה בדוח רווח והפסד לפי כללי החשבונאות (GAAP), הכוללת רישומים חשבונאיים והוצאות/הכנסות על הנייר שלא תמיד משקפים תזרים מזומנים אמיתי.',
    definitionEn:
      'Bottom-line profit reported under GAAP accounting rules, which includes non-cash items and accounting conventions that may diverge from actual economic cash generation.',
    source: 'The Intelligent Investor, Ch. 12; Berkshire Hathaway Shareholder Letter, 1986',
  },
  stockOptions: {
    termHe: 'תגמול באופציות',
    aliasesHe: ['אופציות', 'תגמול במניות'],
    termEn: 'Stock options',
    aliasesEn: ['Stock option expenses', 'stock-based compensation'],
    definitionHe:
      'הטבה שמעניקה לעובדים או למנהלים זכות לרכוש מניות במחיר שנקבע מראש; זוהי הוצאת שכר אמיתית של החברה שמימושה מדלל את חלקם של בעלי המניות הקיימים.',
    definitionEn:
      'Executive or employee rights to purchase shares at a set price, representing a real corporate compensation expense that dilutes existing shareholders when exercised.',
    source: 'The Intelligent Investor, Commentary on Ch. 11 & Ch. 19; Berkshire Hathaway Shareholder Letter, 1992',
  },
  warrants: {
    termHe: 'כתבי אופציה',
    termEn: 'Warrants',
    aliasesEn: ['subscription rights and warrants'],
    definitionHe:
      'זכויות או תעודות שמנפיקה החברה לרכישת מניות רגילות במחיר קבוע מראש; גראהם מזהיר מפני דילול וניפוח ערך דמיוני, בעוד באפט מציין שבשונה מאופציות הנהלה הן מכניסות תמורה כספית לחברה.',
    definitionEn:
      'Certificates or rights to buy common shares at a set price. Graham warns against dilution and imaginary value, while Buffett notes warrants bring proceeds to the issuer unlike employee options.',
    source: 'The Intelligent Investor, Ch. 16; Berkshire Hathaway Shareholder Letter, 1985',
  },
  dilution: {
    termHe: 'דילול מניות',
    aliasesHe: ['דילול', 'מדלל', 'מדללת', 'הדפסת מניות', 'הנפקת מניות חדשות'],
    termEn: 'Dilution',
    aliasesEn: ['dilutes', 'share issuance', 'issuing new shares'],
    definitionHe:
      'הקטנת חלקו היחסי של כל בעל מניה קיים ברווחים ובבעלות על החברה כתוצאה מהנפקת מניות חדשות או המרת ניירות ערך למניות.',
    definitionEn:
      "The reduction in existing shareholders' proportional ownership and per-share earnings resulting from issuing new shares or converting equity-linked securities.",
    source: 'The Intelligent Investor, Ch. 12 & Ch. 16; Berkshire Hathaway Shareholder Letter, 1982',
  },
  goodwill: {
    termHe: 'מוניטין',
    aliasesHe: ['המוניטין'],
    termEn: 'Goodwill',
    definitionHe:
      'סעיף מאזני בלתי מוחשי הנוצר ברכישת חברה מעל שווי הנכסים המוחשיים; רכישות ביוקר מופרז מנפחות מוניטין שעלול להימחק בהמשך כהפסד חשבונאי.',
    definitionEn:
      'An intangible balance-sheet asset arising from acquisitions above tangible asset value; overpaying for acquisitions inflates goodwill and risks future write-downs.',
    source: 'The Intelligent Investor, Ch. 15 & Commentary on Ch. 17; Berkshire Hathaway Shareholder Letter, 1983',
  },
  intrinsicValue: {
    termHe: 'ערך פנימי',
    aliasesHe: ['הערך הפנימי'],
    termEn: 'Intrinsic value',
    definitionHe:
      'השווי הכלכלי האמיתי של העסק המבוסס על היסודות שלו — כוח הרווח, הנכסים והתזרימים העתידיים שייצר בהיוון להיום — בניגוד למחיר השוק היומי שעשוי להשתנות בחדות.',
    definitionEn:
      'The true economic worth of a business grounded in its earning power, assets, and discounted future cash flows, distinct from its fluctuating daily market price.',
    source: 'The Intelligent Investor, Ch. 1, Ch. 8 & Ch. 20; Berkshire Hathaway Shareholder Letter, 1989',
  },
};

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a string into plain text and matched glossary term tokens (longest-match first).
 * Returns a single plain text token with zero regex overhead when the glossary is empty.
 *
 * @param {string} text
 * @param {'he'|'en'} [lang='he']
 * @param {Record<string, Object>} [glossary=FINANCIAL_GLOSSARY]
 * @returns {Array<{ type: 'text', text: string } | { type: 'term', text: string, termKey: string, entry: Object }>}
 */
export function tokenizeGlossaryText(text, lang = 'he', glossary = FINANCIAL_GLOSSARY) {
  if (!text || typeof text !== 'string') return [];
  if (!glossary || typeof glossary !== 'object') return [{ type: 'text', text }];

  const keys = Object.keys(glossary);
  if (keys.length === 0) return [{ type: 'text', text }];

  const isHe = lang === 'he';
  const phraseToEntry = new Map();
  const phrases = [];

  for (const termKey of keys) {
    const entry = glossary[termKey];
    if (!entry) continue;
    const primary = isHe ? entry.termHe : entry.termEn;
    const aliases = isHe ? entry.aliasesHe : entry.aliasesEn;
    const candidates = [primary, ...(Array.isArray(aliases) ? aliases : [])].filter(
      (p) => typeof p === 'string' && p.trim().length > 0
    );
    for (const phrase of candidates) {
      const norm = phrase.toLowerCase();
      if (!phraseToEntry.has(norm)) {
        phraseToEntry.set(norm, { termKey, entry });
        phrases.push(phrase);
      }
    }
  }

  if (phrases.length === 0) return [{ type: 'text', text }];

  phrases.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(${phrases.map(escapeRegExp).join('|')})`,
    isHe ? 'g' : 'gi'
  );

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    const matchedText = match[0];
    const hit = phraseToEntry.get(matchedText.toLowerCase());
    if (hit) {
      tokens.push({
        type: 'term',
        text: matchedText,
        termKey: hit.termKey,
        entry: hit.entry,
      });
    } else {
      tokens.push({ type: 'text', text: matchedText });
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return tokens;
}
