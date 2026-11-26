import { describe, it, expect } from 'vitest';
import { FINANCIAL_GLOSSARY, tokenizeGlossaryText } from '../financialGlossary.js';

describe('financialGlossary', () => {
  it('starts empty by design (no invented definitions) and passes text through unchanged', () => {
    expect(Object.keys(FINANCIAL_GLOSSARY)).toHaveLength(0);
    const tokens = tokenizeGlossaryText('מוניטין מנופח מרכישות עבר', 'he');
    expect(tokens).toEqual([{ type: 'text', text: 'מוניטין מנופח מרכישות עבר' }]);
  });

  it('matches Hebrew and English terms longest-match-first and escapes regex characters like P/E', () => {
    const sampleGlossary = {
      goodwill: {
        termHe: 'מוניטין',
        termEn: 'Goodwill',
        definitionHe: 'הגדרה מאומתת',
        definitionEn: 'Grounded definition',
      },
      peRatio: {
        termHe: 'מכפיל',
        termEn: 'P/E ratio',
        aliasesEn: ['P/E ratios'],
        definitionHe: 'הגדרה למכפיל',
        definitionEn: 'Grounded P/E definition',
      },
    };

    const heTokens = tokenizeGlossaryText('מוניטין מנופח במאזן', 'he', sampleGlossary);
    expect(heTokens).toEqual([
      { type: 'term', text: 'מוניטין', termKey: 'goodwill', entry: sampleGlossary.goodwill },
      { type: 'text', text: ' מנופח במאזן' },
    ]);

    const enTokens = tokenizeGlossaryText(
      'Deceptive low P/E ratios inflate Goodwill.',
      'en',
      sampleGlossary
    );
    expect(enTokens.filter((t) => t.type === 'term').map((t) => t.text)).toEqual([
      'P/E ratios',
      'Goodwill',
    ]);
  });
});
