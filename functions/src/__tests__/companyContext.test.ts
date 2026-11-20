import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cleanFilingHtmlToText,
  extract10KSections,
  findLatestSecFilings,
  getOrFetchCompanyContext,
  checkAndRefreshCompanyContext,
  saveManualTranscriptForTicker,
  buildGroundedContextPromptBlock,
  resetInMemoryContextForTesting,
} from '../functions/companyContext';

describe('companyContext (#318 — 10-K & Earnings Call Data Pipeline)', () => {
  beforeEach(() => {
    resetInMemoryContextForTesting();
  });

  it('strips HTML/XBRL boilerplate and extracts Item 1, Item 1A, and Item 7 sections skipping TOC', () => {
    const padding = 'Detailed prose content about cloud and enterprise software operations. '.repeat(25);
    const sample10KHtml = `
      <html>
        <head><style>.xbrl { display: none; }</style></head>
        <body>
          <div>Table of Contents: ITEM 1. BUSINESS ... 4 | ITEM 1A. RISK FACTORS ... 12 | ITEM 7. MANAGEMENT'S DISCUSSION ... 40</div>
          <p>ITEM 1. BUSINESS</p>
          <p>Microsoft develops and supports software, services, devices and solutions. ${padding}</p>
          <p>ITEM 1A. RISK FACTORS</p>
          <p>Intense competition across all markets may adversely affect our margins. ${padding}</p>
          <p>ITEM 1B. UNRESOLVED STAFF COMMENTS</p>
          <p>None.</p>
          <p>ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION</p>
          <p>Intelligent Cloud revenue increased 21% driven by Azure AI services. ${padding}</p>
          <p>ITEM 7A. QUANTITATIVE AND QUALITATIVE DISCLOSURES ABOUT MARKET RISK</p>
          <p>Foreign exchange risk details.</p>
        </body>
      </html>
    `;

    const clean = cleanFilingHtmlToText(sample10KHtml);
    const sections = extract10KSections(clean);

    expect(sections.item1Business).toContain('Microsoft develops and supports software');
    expect(sections.item1Business).not.toContain('Foreign exchange risk details');
    expect(sections.item1ARiskFactors).toContain('Intense competition across all markets');
    expect(sections.item7Mda).toContain('Intelligent Cloud revenue increased 21%');
  });

  it('locates latest 10-K and 8-K (Item 2.02) from SEC submissions JSON and builds citation URLs', async () => {
    const mockSubmissions = {
      filings: {
        recent: {
          form: ['4', '8-K', '8-K', '10-K'],
          accessionNumber: [
            '0000789019-26-000010',
            '0000789019-26-000009',
            '0000789019-26-000008',
            '0000789019-25-000001',
          ],
          filingDate: ['2026-05-01', '2026-04-28', '2026-04-25', '2025-07-30'],
          primaryDocument: ['form4.xml', 'deck.htm', 'earnings-q3.htm', 'msft-20250630.htm'],
          items: ['', '7.01', '2.02,9.01', ''],
        },
      },
    };

    const mockFetcher = vi.fn().mockResolvedValue(JSON.stringify(mockSubmissions));
    const result = await findLatestSecFilings(789019, mockFetcher);

    expect(result.tenK).toEqual({
      form: '10-K',
      filingDate: '2025-07-30',
      accessionNumber: '0000789019-25-000001',
      primaryDocument: 'msft-20250630.htm',
      reportUrl:
        'https://www.sec.gov/Archives/edgar/data/789019/000078901925000001/msft-20250630.htm',
    });

    expect(result.eightKEarnings).toEqual({
      form: '8-K',
      filingDate: '2026-04-25',
      accessionNumber: '0000789019-26-000008',
      primaryDocument: 'earnings-q3.htm',
      reportUrl:
        'https://www.sec.gov/Archives/edgar/data/789019/000078901926000008/earnings-q3.htm',
    });
  });

  it('fetches, caches, and falls back to 8-K Item 2.02 when public transcript is unavailable', async () => {
    const padding = 'Business segment performance and cloud growth commentary. '.repeat(30);
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('company_tickers.json')) {
        return JSON.stringify({
          '0': { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' },
        });
      }
      if (url.includes('submissions/CIK0000789019.json')) {
        return JSON.stringify({
          filings: {
            recent: {
              form: ['8-K', '10-K'],
              accessionNumber: ['0000789019-26-000008', '0000789019-25-000001'],
              filingDate: ['2026-04-25', '2025-07-30'],
              primaryDocument: ['earnings.htm', 'msft-10k.htm'],
              items: ['2.02,9.01', ''],
            },
          },
        });
      }
      if (url.includes('msft-10k.htm')) {
        return `<p>ITEM 1. BUSINESS</p><p>Azure and Office 365 recurring SaaS model. ${padding}</p>`;
      }
      if (url.includes('earnings.htm')) {
        return `<p>Q3 FY26 Earnings Release: Revenue was $70.1B, up 13% YoY. ${padding}</p>`;
      }
      throw new Error('404 Not Found');
    });

    const ctx = await getOrFetchCompanyContext('MSFT', { fetcher: mockFetcher });

    expect(ctx.ticker).toBe('MSFT');
    expect(ctx.cik).toBe(789019);
    expect(ctx.ingestionStatus.tenK.status).toBe('ok');
    expect(ctx.ingestionStatus.eightK.status).toBe('ok');
    expect(ctx.ingestionStatus.transcript.status).toBe('fallback_8k');
    expect(ctx.earnings?.source).toBe('8-K');

    const promptBlock = buildGroundedContextPromptBlock(ctx);
    expect(promptBlock).toContain('GROUNDED SEC FILINGS & EARNINGS CONTEXT FOR MICROSOFT CORP (MSFT)');
    expect(promptBlock).toContain('Azure and Office 365 recurring SaaS model');
    expect(promptBlock).toContain('Q3 FY26 Earnings Release');

    // Second call hits L2 cache without calling fetcher again
    const callCountAfterFirst = mockFetcher.mock.calls.length;
    const cachedCtx = await getOrFetchCompanyContext('MSFT', { fetcher: mockFetcher });
    expect(cachedCtx.lastFetched).toBe(ctx.lastFetched);
    expect(mockFetcher.mock.calls.length).toBe(callCountAfterFirst);
  });

  it('allows Admin to save a manual transcript and marks transcript status as manual', async () => {
    const updated = await saveManualTranscriptForTicker(
      'MSFT',
      'Satya Nadella: Copilot adoption accelerated across enterprise customers in Q3.',
      '2026-04-25'
    );

    expect(updated.ingestionStatus.transcript.status).toBe('manual');
    expect(updated.earnings?.source).toBe('manual');
    expect(updated.earnings?.text).toContain('Satya Nadella: Copilot adoption');
  });

  it('cheaply detects newer 8-K/10-K filing dates on SEC EDGAR after cooldown without redundant HTML fetches when unchanged', async () => {
    const padding = 'Business segment performance and cloud growth commentary. '.repeat(30);
    let eightKDate = '2026-04-25';
    let htmlFetchCount = 0;

    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('company_tickers.json')) {
        return JSON.stringify({
          '0': { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' },
        });
      }
      if (url.includes('submissions/CIK0000789019.json')) {
        return JSON.stringify({
          filings: {
            recent: {
              form: ['8-K', '10-K'],
              accessionNumber: ['0000789019-26-000008', '0000789019-25-000001'],
              filingDate: [eightKDate, '2025-07-30'],
              primaryDocument: ['earnings.htm', 'msft-10k.htm'],
              items: ['2.02,9.01', ''],
            },
          },
        });
      }
      if (url.includes('msft-10k.htm')) {
        htmlFetchCount += 1;
        return `<p>ITEM 1. BUSINESS</p><p>Azure and Office 365 recurring SaaS model. ${padding}</p>`;
      }
      if (url.includes('earnings.htm')) {
        htmlFetchCount += 1;
        return `<p>Earnings release dated ${eightKDate}. ${padding}</p>`;
      }
      throw new Error('404 Not Found');
    });

    await getOrFetchCompanyContext('MSFT', { fetcher: mockFetcher });
    const countAfterInit = htmlFetchCount;

    // 1. After 13h cooldown, filing dates still match -> checks submissions JSON only, 0 HTML re-fetches
    const thirteenHoursLater = Date.now() + 13 * 60 * 60 * 1000;
    const sameCheck = await checkAndRefreshCompanyContext('MSFT', {
      fetcher: mockFetcher,
      nowMs: thirteenHoursLater,
      clientFilingDates: { tenKDate: '2025-07-30', eightKDate: '2026-04-25' },
    });
    expect(sameCheck.refreshed).toBe(false);
    expect(sameCheck.hasNewerFilings).toBe(false);
    expect(htmlFetchCount).toBe(countAfterInit);

    // 2. Suppose SEC EDGAR now has a newer 8-K AND client summary was grounded on old date -> auto-refreshes!
    eightKDate = '2026-07-29';
    const twentySixHoursLater = Date.now() + 26 * 60 * 60 * 1000;
    const newerCheck = await checkAndRefreshCompanyContext('MSFT', {
      fetcher: mockFetcher,
      nowMs: twentySixHoursLater,
      clientFilingDates: { tenKDate: '2025-07-30', eightKDate: '2026-04-25' },
    });
    expect(newerCheck.refreshed).toBe(true);
    expect(newerCheck.hasNewerFilings).toBe(true);
    expect(newerCheck.latestFilingDates.eightKDate).toBe('2026-07-29');
    expect(htmlFetchCount).toBeGreaterThan(countAfterInit);
  });

  it('safely strips spaced script/style/ix:header end tags and avoids double-unescaping entities', () => {
    const trickyHtml = `
      <div>
        <!-- Hidden comment <p>ignored</p> -->
        <script type="text/javascript">const x = "1 > 0";</script >
        <SCRIPT>alert(1)</script\t\n>
        <style>.hidden { color: red; }</style >
        <ix:header><ix:hidden>XBRL secret</ix:hidden></ix:header >
        <p data-note="a > b">Revenue &lt; $5B and Operating Margin &gt; 20% for R&amp;D &quot;core&quot; &apos;v1&#39;.</p>
        <p>Literal prose: Revenue < $5B and margins > 20%.</p>
        <p>Double-encoded sequence: &amp;lt;script&amp;gt; and &amp;quot;safe&amp;quot; remain escaped.</p>
      </div>
    `;

    const cleaned = cleanFilingHtmlToText(trickyHtml);

    expect(cleaned).not.toContain('alert(1)');
    expect(cleaned).not.toContain('Hidden comment');
    expect(cleaned).not.toContain('.hidden');
    expect(cleaned).not.toContain('XBRL secret');
    expect(cleaned).not.toContain('data-note');
    expect(cleaned).toContain(`Revenue < $5B and Operating Margin > 20% for R&D "core" 'v1'.`);
    expect(cleaned).toContain('Literal prose: Revenue < $5B and margins > 20%.');
    expect(cleaned).toContain('Double-encoded sequence: &lt;script&gt; and &quot;safe&quot; remain escaped.');
  });
});
