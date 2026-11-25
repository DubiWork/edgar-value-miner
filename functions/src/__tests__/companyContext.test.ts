import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  cleanFilingHtmlToText,
  extract10KSections,
  findLatestSecFilings,
  getOrFetchCompanyContext,
  checkAndRefreshCompanyContext,
  saveManualTranscriptForTicker,
  buildGroundedContextPromptBlock,
  resolveTickerFromSec,
  parseRetryAfterMs,
  httpsGetRaw,
  resetInMemoryContextForTesting,
  clearTickersCacheForTesting,
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

  it('preserves prose after self-closing skip tags and drops unclosed trailing scripts', () => {
    const htmlWithSelfClosing =
      '<p>Lead summary.</p><script src="bundle.js" /><p>Trailing prose preserved.</p><script>const leaked = true;';
    const cleaned = cleanFilingHtmlToText(htmlWithSelfClosing);

    expect(cleaned).toContain('Lead summary.');
    expect(cleaned).toContain('Trailing prose preserved.');
    expect(cleaned).not.toContain('leaked');
  });

  it('skips SEC company_tickers.json when known CIK is provided (e.g. SHOP) and adopts entity name from submissions (#324)', async () => {
    const padding = 'Merchant commerce platform and subscription solutions. '.repeat(25);
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes('company_tickers.json')) {
        throw new Error('HTTP 429 when fetching company_tickers.json (should not be called!)');
      }
      if (url.includes('submissions/CIK0001594805.json')) {
        return JSON.stringify({
          name: 'SHOPIFY INC.',
          filings: {
            recent: {
              form: ['8-K', '10-K'],
              accessionNumber: ['0001594805-26-000012', '0001594805-26-000004'],
              filingDate: ['2026-11-03', '2026-02-11'],
              primaryDocument: ['shop-20261103.htm', 'shop-20251231.htm'],
              items: ['2.02', ''],
            },
          },
        });
      }
      if (url.includes('shop-20251231.htm')) {
        return `<p>ITEM 1. BUSINESS</p><p>Shopify empowers independent merchants globally. ${padding}</p>`;
      }
      if (url.includes('shop-20261103.htm')) {
        return `<p>Q3 revenue grew 26% YoY. ${padding}</p>`;
      }
      throw new Error(`404 Not Found: ${url}`);
    });

    const ctx = await getOrFetchCompanyContext('SHOP', {
      cik: '0001594805',
      fetcher: mockFetcher,
    });

    expect(ctx.cik).toBe(1594805);
    expect(ctx.companyName).toBe('SHOPIFY INC.');
    expect(ctx.ingestionStatus.tenK.status).toBe('ok');
    expect(ctx.ingestionStatus.eightK.status).toBe('ok');
    expect(
      mockFetcher.mock.calls.some(([calledUrl]) => String(calledUrl).includes('company_tickers.json'))
    ).toBe(false);
  });

  it('caches parsed SEC company_tickers.json in memory for 24h (#324)', async () => {
    clearTickersCacheForTesting();
    const mockFetcher = vi.fn(async () =>
      JSON.stringify({
        '0': { cik_str: 1594805, ticker: 'SHOP', title: 'SHOPIFY INC.' },
        '1': { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' },
      })
    );

    const t0 = 1_700_000_000_000;
    const first = await resolveTickerFromSec('SHOP', mockFetcher, { nowMs: t0 });
    const second = await resolveTickerFromSec('MSFT', mockFetcher, { nowMs: t0 + 60_000 });

    expect(first).toEqual({ cik: 1594805, companyName: 'SHOPIFY INC.' });
    expect(second).toEqual({ cik: 789019, companyName: 'MICROSOFT CORP' });
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // After 25h (> 24h TTL), refreshes directory once
    await resolveTickerFromSec('SHOP', mockFetcher, { nowMs: t0 + 25 * 60 * 60 * 1000 });
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('retries transient HTTP 429/503 with Retry-After or backoff and does not retry 404 (#324)', async () => {
    expect(parseRetryAfterMs('2', 0, 5_000)).toBe(2_000);
    expect(parseRetryAfterMs('30', 0, 5_000)).toBe(5_000);
    expect(parseRetryAfterMs(undefined)).toBeNull();

    const makeMockHttpsGet = (responses: Array<{ statusCode: number; headers?: Record<string, string>; body?: string }>) => {
      let idx = 0;
      return vi.fn((_url: any, _opts: any, cb: any) => {
        const spec = responses[idx++] || responses[responses.length - 1];
        const req = new EventEmitter() as any;
        req.destroy = vi.fn();

        const res = new EventEmitter() as any;
        res.statusCode = spec.statusCode;
        res.headers = spec.headers || {};
        res.resume = vi.fn();

        queueMicrotask(() => {
          cb(res);
          if (spec.statusCode === 200) {
            if (spec.body) {
              res.emit('data', Buffer.from(spec.body, 'utf-8'));
            }
            res.emit('end');
          }
        });

        return req;
      });
    };

    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const get429ThenOk = makeMockHttpsGet([
      { statusCode: 429, headers: { 'retry-after': '2' } },
      { statusCode: 503 },
      { statusCode: 200, body: '{"ok":true}' },
    ]);

    const body = await httpsGetRaw('https://www.sec.gov/files/company_tickers.json', {}, {
      requestFn: get429ThenOk as any,
      sleep: sleepMock,
      baseDelayMs: 200,
    });
    expect(body).toBe('{"ok":true}');
    expect(get429ThenOk).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 2_000);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 400);

    // 404 fails fast with zero retries
    const sleep404 = vi.fn().mockResolvedValue(undefined);
    const get404 = makeMockHttpsGet([{ statusCode: 404 }]);
    await expect(
      httpsGetRaw('https://data.sec.gov/missing.json', {}, {
        requestFn: get404 as any,
        sleep: sleep404,
      })
    ).rejects.toThrow(/HTTP 404/);
    expect(get404).toHaveBeenCalledTimes(1);
    expect(sleep404).not.toHaveBeenCalled();

    // Exhausted 429 retries reject cleanly after maxRetries attempts
    const sleepExhausted = vi.fn().mockResolvedValue(undefined);
    const getAlways429 = makeMockHttpsGet([{ statusCode: 429 }]);
    await expect(
      httpsGetRaw('https://www.sec.gov/files/company_tickers.json', {}, {
        requestFn: getAlways429 as any,
        sleep: sleepExhausted,
        maxRetries: 2,
        baseDelayMs: 50,
      })
    ).rejects.toThrow(/HTTP 429/);
    expect(getAlways429).toHaveBeenCalledTimes(3);
    expect(sleepExhausted).toHaveBeenCalledTimes(2);
  });

  it('reuses explicit CIK when recovering an incomplete cik:0 context in checkAndRefreshCompanyContext (#324)', async () => {
    const padding = 'Payment network processing global card transactions. '.repeat(25);
    // Simulate a failed earlier lookup that saved cik: 0 without overwriting later recovery
    const failingFetcher = vi.fn().mockRejectedValue(new Error('HTTP 429 when fetching company_tickers.json'));
    const failed = await getOrFetchCompanyContext('MA', { fetcher: failingFetcher });
    expect(failed.cik).toBe(0);
    expect(failed.ingestionStatus.tenK.status).toBe('error');

    const recoverFetcher = vi.fn(async (url: string) => {
      if (url.includes('company_tickers.json')) {
        throw new Error('Should reuse passed cik instead of fetching company_tickers.json');
      }
      if (url.includes('submissions/CIK0001141391.json')) {
        return JSON.stringify({
          name: 'MASTERCARD INC',
          filings: {
            recent: {
              form: ['8-K', '10-K'],
              accessionNumber: ['0001141391-26-000010', '0001141391-26-000002'],
              filingDate: ['2026-10-30', '2026-02-12'],
              primaryDocument: ['ma-8k.htm', 'ma-10k.htm'],
              items: ['2.02', ''],
            },
          },
        });
      }
      if (url.includes('ma-10k.htm')) {
        return `<p>ITEM 1. BUSINESS</p><p>Mastercard connects consumers and banks worldwide. ${padding}</p>`;
      }
      if (url.includes('ma-8k.htm')) {
        return `<p>Mastercard Q3 earnings grew 14% YoY. ${padding}</p>`;
      }
      throw new Error(`404: ${url}`);
    });

    const recovered = await checkAndRefreshCompanyContext('MA', {
      cik: '0001141391',
      fetcher: recoverFetcher,
    });
    expect(recovered.refreshed).toBe(true);
    expect(recovered.context?.cik).toBe(1141391);
    expect(recovered.context?.ingestionStatus.tenK.status).toBe('ok');
    expect(recovered.context?.ingestionStatus.eightK.status).toBe('ok');
  });
});
