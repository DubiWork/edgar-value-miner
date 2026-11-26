import { describe, it, expect } from 'vitest';
import { FINANCIAL_GLOSSARY, tokenizeGlossaryText } from '../financialGlossary.js';

describe('financialGlossary', () => {
  it('contains all 20 grounded Buffett/Graham glossary entries with complete bilingual definitions', () => {
    const entries = Object.entries(FINANCIAL_GLOSSARY);
    expect(entries).toHaveLength(20);

    for (const [, entry] of entries) {
      expect(entry.termHe.length).toBeGreaterThan(2);
      expect(entry.termEn.length).toBeGreaterThan(2);
      expect(entry.definitionHe.length).toBeGreaterThan(20);
      expect(entry.definitionEn.length).toBeGreaterThan(20);
      expect(entry.source).toMatch(/Intelligent Investor|Berkshire Hathaway/);
    }
  });

  it('matches Hebrew surface forms appearing across WISDOM_QUOTES insightHe strings', () => {
    const samples = [
      ['ללא כוח תמחור ובידול, עודף כושר ייצור מבטיח רווחיות ירודה.', ['pricingPower', 'excessCapacity']],
      ['חברות מחזוריות מטעות כשהרווחים בשיא והמכפיל נראה זול באופן מלאכותי.', ['cyclicalCompany', 'peRatio']],
      ['השקעות הון כבדות בענף מחזורי מנטרלות זו את זו ומשאירות תשואה אפסית.', ['capex', 'cyclicalCompany']],
      ['במינוף של 20 ל-1, טעות קטנה בנכסי הבנק מוחקת את כל ההון.', ['leverage']],
      ['תזרים מפעולות אמין בהרבה מרווח חשבונאי שניתן לעיוות וטשטוש.', ['operatingCashFlow', 'accountingNetIncome']],
      ['היזהרו מעסקים שמציגים רווחים יפים אך אינם ממירים אותם למזומן חופשי.', ['freeCashFlow']],
      ['תגמול באופציות מדלל בעלי מניות ומקטין את הרווח האמיתי.', ['stockOptions', 'dilution']],
      ['הנפקת כתבי אופציה גוזלת ערך ומדללת את המשקיעים הקיימים.', ['warrants', 'dilution']],
      ['הדפסת מניות בלתי פוסקת לרכישות מדללת את בעלי המניות ומהווה מכתב שרשרת.', ['dilution']],
      ['מבנה חוב שבו תוצאות מעולות אינן מספיקות לתשלום ריבית מבטיח כישלון.', ['capitalStructure']],
      ['יחס שוטף מתחת ל-2 מסכן את נזילות החברה בהאטה.', ['currentRatio', 'liquidity']],
      ['רכישות במחיר מופרז מנפחות את המוניטין במאזן ומשקפות היעדר משמעת ניהולית.', ['goodwill']],
    ];

    for (const [text, expectedKeys] of samples) {
      const matchedKeys = tokenizeGlossaryText(text, 'he')
        .filter((t) => t.type === 'term')
        .map((t) => t.termKey);
      for (const key of expectedKeys) {
        expect(matchedKeys).toContain(key);
      }
    }
  });

  it('matches English surface forms and safely handles empty or null custom glossary', () => {
    const enTokens = tokenizeGlossaryText(
      'Cyclical peaks create deceptive low P/E ratios, cash flow net of CapEx, and intrinsic value via Goodwill.',
      'en'
    );
    const keys = enTokens.filter((t) => t.type === 'term').map((t) => t.termKey);
    expect(keys).toContain('cyclicalCompany');
    expect(keys).toContain('peRatio');
    expect(keys).toContain('freeCashFlow');
    expect(keys).toContain('intrinsicValue');
    expect(keys).toContain('goodwill');

    expect(tokenizeGlossaryText('No terms here', 'en', {})).toEqual([
      { type: 'text', text: 'No terms here' },
    ]);
    expect(tokenizeGlossaryText('No terms here', 'en', null)).toEqual([
      { type: 'text', text: 'No terms here' },
    ]);
  });
});
