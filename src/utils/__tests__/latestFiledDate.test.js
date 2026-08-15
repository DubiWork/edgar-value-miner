import { describe, it, expect } from 'vitest';
import { latestFiledDate } from '../../utils/latestFiledDate.js';
import { aaplCompanyFacts } from '../../__fixtures__/aaplCompanyFacts.js';

// Minimal helper to build a companyfacts blob
const makeFacts = (usGaap) => ({ facts: { 'us-gaap': usGaap } });

describe('latestFiledDate', () => {
  it('returns latest filed date from real AAPL SEC data', () => {
    expect(latestFiledDate(aaplCompanyFacts)).toBe('2026-07-31');
  });

  it('picks max across USD, shares, and USD/shares unit types', () => {
    const facts = makeFacts({
      Revenue:         { units: { USD:         [{ filed: '2024-03-01', val: 1 }] } },
      Shares:          { units: { shares:      [{ filed: '2025-06-15', val: 2 }] } },
      EarningsPerShare:{ units: { 'USD/shares':[{ filed: '2023-11-20', val: 3 }] } },
    });
    expect(latestFiledDate(facts)).toBe('2025-06-15');
  });

  it('returns null for IFRS-only filer (no us-gaap key)', () => {
    expect(latestFiledDate({ facts: { 'ifrs-full': {} } })).toBeNull();
  });

  it('ignores ifrs-full dates — scans us-gaap only', () => {
    const json = {
      facts: {
        'us-gaap': { Revenues: { units: { USD: [{ filed: '2024-06-01', val: 1 }] } } },
        'ifrs-full': { Revenue: { units: { EUR: [{ filed: '2025-12-31', val: 1 }] } } },
      },
    };
    expect(latestFiledDate(json)).toBe('2024-06-01');
  });

  it('returns null when facts key is missing', () => {
    expect(latestFiledDate({})).toBeNull();
    expect(latestFiledDate({ facts: {} })).toBeNull();
  });

  it('returns null when us-gaap is empty', () => {
    expect(latestFiledDate(makeFacts({}))).toBeNull();
  });

  it('returns null for null / undefined input', () => {
    expect(latestFiledDate(null)).toBeNull();
    expect(latestFiledDate(undefined)).toBeNull();
  });
});
