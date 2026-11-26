/**
 * Financial Glossary Lookup & Inline Tokenizer (Step 1 Educational Tooltips)
 *
 * Intentionally starts empty so definitions are strictly grounded in user-provided
 * notebooks (Warren Buffett Shareholder Letters / The Intelligent Investor) rather
 * than invented copy. Each entry uses the schema:
 * {
 *   termHe: string,
 *   aliasesHe?: string[],
 *   termEn: string,
 *   aliasesEn?: string[],
 *   definitionHe: string,
 *   definitionEn: string,
 *   source?: string,
 * }
 *
 * @module financialGlossary
 */

export const FINANCIAL_GLOSSARY = {};

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
