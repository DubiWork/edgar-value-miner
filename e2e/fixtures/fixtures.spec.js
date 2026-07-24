// @ts-check
import { test, expect } from '@playwright/test';
import {
  COMPANY_TICKERS,
  AAPL_COMPANY_FACTS,
  MSFT_COMPANY_FACTS,
  EMPTY_REVENUE_COMPANY_FACTS,
} from '../fixtures/mock-sec-data.js';
import {
  SEC_ERROR_RESPONSES,
} from '../fixtures/mock-error-data.js';

// ---------------------------------------------------------------------------
// COMPANY_TICKERS
// ---------------------------------------------------------------------------
test.describe('COMPANY_TICKERS fixture', () => {
  test('includes AAPL with CIK 320193', () => {
    const aapl = Object.values(COMPANY_TICKERS).find((t) => t.ticker === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl.cik_str).toBe('320193');
    expect(aapl.title).toBe('Apple Inc.');
  });

  test('includes MSFT with CIK 789019', () => {
    const msft = Object.values(COMPANY_TICKERS).find((t) => t.ticker === 'MSFT');
    expect(msft).toBeDefined();
    expect(msft.cik_str).toBe('789019');
    expect(msft.title).toBe('Microsoft Corp');
  });
});

// ---------------------------------------------------------------------------
// AAPL_COMPANY_FACTS — 5 years of data
// ---------------------------------------------------------------------------
test.describe('AAPL_COMPANY_FACTS fixture', () => {
  test('has correct CIK and entity name', () => {
    expect(AAPL_COMPANY_FACTS.cik).toBe(320193);
    expect(AAPL_COMPANY_FACTS.entityName).toBe('Apple Inc.');
  });

  test('has at least 5 years of revenue data (10-K filings)', () => {
    const revenueEntries =
      AAPL_COMPANY_FACTS.facts['us-gaap'].Revenues.units.USD;
    const annualEntries = revenueEntries.filter((e) => e.form === '10-K');
    expect(annualEntries.length).toBeGreaterThanOrEqual(5);
  });

  test('revenue data spans at least 5 calendar years', () => {
    const revenueEntries =
      AAPL_COMPANY_FACTS.facts['us-gaap'].Revenues.units.USD;
    const annualEntries = revenueEntries.filter((e) => e.form === '10-K');
    const years = annualEntries.map((e) => e.frame).filter(Boolean);
    const uniqueYears = [...new Set(years)];
    expect(uniqueYears.length).toBeGreaterThanOrEqual(5);
  });

  test('includes NetIncomeLoss data', () => {
    expect(
      AAPL_COMPANY_FACTS.facts['us-gaap'].NetIncomeLoss
    ).toBeDefined();
    const entries =
      AAPL_COMPANY_FACTS.facts['us-gaap'].NetIncomeLoss.units.USD;
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  test('includes GrossProfit data', () => {
    expect(
      AAPL_COMPANY_FACTS.facts['us-gaap'].GrossProfit
    ).toBeDefined();
  });

  test('includes EarningsPerShareBasic data', () => {
    expect(
      AAPL_COMPANY_FACTS.facts['us-gaap'].EarningsPerShareBasic
    ).toBeDefined();
  });

  test('includes operating cash flow data', () => {
    expect(
      AAPL_COMPANY_FACTS.facts['us-gaap']
        .NetCashProvidedByUsedInOperatingActivities
    ).toBeDefined();
  });

  test('includes capital expenditure data', () => {
    expect(
      AAPL_COMPANY_FACTS.facts['us-gaap']
        .PaymentsToAcquirePropertyPlantAndEquipment
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// MSFT_COMPANY_FACTS
// ---------------------------------------------------------------------------
test.describe('MSFT_COMPANY_FACTS fixture', () => {
  test('has correct CIK and entity name', () => {
    expect(MSFT_COMPANY_FACTS.cik).toBe(789019);
    expect(MSFT_COMPANY_FACTS.entityName).toBe('Microsoft Corp');
  });

  test('has us-gaap facts with Revenues', () => {
    expect(MSFT_COMPANY_FACTS.facts['us-gaap'].Revenues).toBeDefined();
    const entries =
      MSFT_COMPANY_FACTS.facts['us-gaap'].Revenues.units.USD;
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  test('has NetIncomeLoss data', () => {
    expect(
      MSFT_COMPANY_FACTS.facts['us-gaap'].NetIncomeLoss
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// EMPTY_REVENUE_COMPANY_FACTS — company with no revenue data
// ---------------------------------------------------------------------------
test.describe('EMPTY_REVENUE_COMPANY_FACTS fixture', () => {
  test('has an entityName', () => {
    expect(EMPTY_REVENUE_COMPANY_FACTS.entityName).toBeTruthy();
  });

  test('has empty or missing revenue entries', () => {
    const revenues = EMPTY_REVENUE_COMPANY_FACTS.facts['us-gaap']?.Revenues;
    if (revenues) {
      const entries = revenues.units?.USD || [];
      expect(entries.length).toBe(0);
    } else {
      // No Revenues key at all — that's valid for an empty-revenue company
      expect(revenues).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// SEC_ERROR_RESPONSES
// ---------------------------------------------------------------------------
test.describe('SEC_ERROR_RESPONSES fixture', () => {
  test('has a notFound response with status 404', () => {
    expect(SEC_ERROR_RESPONSES.notFound).toBeDefined();
    expect(SEC_ERROR_RESPONSES.notFound.status).toBe(404);
    expect(typeof SEC_ERROR_RESPONSES.notFound.body).toBe('string');
  });

  test('has a serverError response with status 500', () => {
    expect(SEC_ERROR_RESPONSES.serverError).toBeDefined();
    expect(SEC_ERROR_RESPONSES.serverError.status).toBe(500);
    expect(typeof SEC_ERROR_RESPONSES.serverError.body).toBe('string');
  });

  test('has a rateLimited response with status 429', () => {
    expect(SEC_ERROR_RESPONSES.rateLimited).toBeDefined();
    expect(SEC_ERROR_RESPONSES.rateLimited.status).toBe(429);
    expect(typeof SEC_ERROR_RESPONSES.rateLimited.body).toBe('string');
  });
});
