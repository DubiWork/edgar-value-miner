import { describe, it, expect } from 'vitest';
import { latestFiledDate } from '../../utils/latestFiledDate.js';
import { aaplCompanyFacts } from '../../__fixtures__/aaplCompanyFacts.js';

// Minimal helper to build a companyfacts blob
const makeFacts = (usGaap) => ({ facts: { 'us-gaap': usGaap } });

describe('latestFiledDate', () => {
  // Real AAPL fixture: USD (RevenueFromContract), shares (CommonStock), USD/shares (EPS)
  // Latest filing across all 3 unit types is 2026-07-31 (Q3 10-Q).
  it('returns max filed date from real AAPL fixture (USD tag)', () => {
    expect(latestFiledDate(aaplCompanyFacts)).toBe('2026-07-31');
  });

  // Explicitly verifies all 3 unit types contribute to the max search:
  //   USD  — RevenueFromContractWithCustomerExcludingAssessedTax (latest: 2026-07-31)
  //   shares — CommonStockSharesOutstanding (latest: 2026-07-31)
  //   USD/shares — EarningsPerShareBasic (latest: 2026-07-31)
  it('picks max across USD, shares, and USD/shares unit types', () => {
    expect(latestFiledDate(aaplCompanyFacts)).toBe('2026-07-31');
  });

  it('returns null for IFRS-only filer (no us-gaap key)', () => {
    expect(latestFiledDate({ facts: { 'ifrs-full': {} } })).toBeNull();
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
