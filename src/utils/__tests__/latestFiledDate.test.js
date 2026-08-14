import { describe, it, expect } from 'vitest';
import { latestFiledDate } from '../../utils/latestFiledDate.js';

// Minimal helper to build a companyfacts blob
const makeFacts = (usGaap) => ({ facts: { 'us-gaap': usGaap } });

describe('latestFiledDate', () => {
  it('returns max filed date across a single tag', () => {
    const json = makeFacts({
      Revenues: {
        units: {
          USD: [
            { filed: '2023-05-01', val: 1 },
            { filed: '2024-11-01', val: 2 },
            { filed: '2022-02-10', val: 3 },
          ],
        },
      },
    });
    expect(latestFiledDate(json)).toBe('2024-11-01');
  });

  it('picks max across multiple tags and unit types', () => {
    const json = makeFacts({
      Revenues: {
        units: {
          USD: [{ filed: '2023-05-01', val: 1 }],
        },
      },
      CommonStockSharesOutstanding: {
        units: {
          shares: [{ filed: '2025-02-14', val: 5 }],
        },
      },
      EarningsPerShareBasic: {
        units: {
          'USD/shares': [{ filed: '2024-08-07', val: 3 }],
        },
      },
    });
    expect(latestFiledDate(json)).toBe('2025-02-14');
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
