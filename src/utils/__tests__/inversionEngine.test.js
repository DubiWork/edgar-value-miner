import { describe, it, expect } from 'vitest';
import { calculateTriageMetrics } from '../triageCalculator.js';
import { evaluateInversionFlags, WISDOM_QUOTES } from '../inversionEngine.js';

function annualSeries(valuesByYear) {
  return valuesByYear.map(([fiscalYear, value]) => ({ fiscalYear, value }));
}

describe('inversionEngine & triageCalculator (#357 Slice 3)', () => {
  it('passes MSFT-style clean compounder with 0 red flags and 0 yellow warnings', () => {
    const msftClean = {
      metrics: {
        revenue: {
          annual: annualSeries([
            [2022, 198270000000],
            [2023, 211915000000],
            [2024, 245122000000],
            [2025, 281724000000],
          ]),
        },
        grossProfit: {
          annual: annualSeries([
            [2024, 171000000000],
            [2025, 194000000000], // ~68.9% GM
          ]),
        },
        operatingIncome: {
          annual: annualSeries([
            [2022, 83472000000],
            [2023, 88580000000],
            [2024, 109324000000],
            [2025, 128466000000], // 45.6% Op Margin
          ]),
        },
        netIncome: {
          annual: annualSeries([
            [2023, 72361000000],
            [2024, 88136000000],
            [2025, 101832000000],
          ]),
        },
        operatingCashFlow: {
          annual: annualSeries([
            [2023, 87582000000],
            [2024, 118548000000],
            [2025, 136162000000], // ~1.30x Net Income
          ]),
        },
        capitalExpenditures: {
          annual: annualSeries([
            [2023, 28107000000],
            [2024, 44477000000],
            [2025, 64551000000], // 3Y CapEx/OCF ~ 40%
          ]),
        },
        stockBasedCompensation: {
          annual: annualSeries([
            [2023, 9611000000],
            [2024, 10734000000],
            [2025, 11980000000], // ~4.2% rev; 3Y FCF ex-SBC heavily positive
          ]),
        },
        interestExpense: { annual: annualSeries([[2025, 2600000000]]) }, // > 49x coverage
        totalAssets: { annual: annualSeries([[2025, 512163000000]]) },
        totalLiabilities: { annual: annualSeries([[2025, 243686000000]]) }, // L/E ~0.91x
        stockholdersEquity: {
          annual: annualSeries([
            [2023, 206223000000],
            [2024, 268477000000],
            [2025, 343479000000],
          ]),
        },
        totalDebt: { annual: annualSeries([[2025, 60000000000]]) },
        cash: { annual: annualSeries([[2025, 78000000000]]) }, // Net cash!
        goodwill: { annual: annualSeries([[2025, 119220000000]]) }, // ~23% assets (< 40%)
        weightedAverageSharesDiluted: {
          annual: annualSeries([
            [2023, 7472000000],
            [2024, 7469000000],
            [2025, 7433000000], // -0.5% YoY buybacks
          ]),
        },
        stockRepurchases: {
          annual: annualSeries([
            [2023, 22245000000],
            [2024, 17254000000],
            [2025, 18000000000],
          ]),
        },
        dividendsPaid: {
          annual: annualSeries([
            [2023, 19800000000],
            [2024, 21771000000],
            [2025, 24082000000],
          ]),
        },
        currentAssets: { annual: annualSeries([[2025, 185000000000]]) },
        currentLiabilities: { annual: annualSeries([[2025, 115000000000]]) }, // 1.61x
      },
    };

    const result = calculateTriageMetrics(msftClean, { archetype: 'TECH_SAAS' });

    expect(result.inversion.summary.isCleanPass).toBe(true);
    expect(result.inversion.summary.redCount).toBe(0);
    expect(result.inversion.summary.yellowCount).toBe(0);
    expect(result.inversion.summary.overallStatus).toBe('pass');
    expect(result.inversion.summary.bannerHe).toContain('0 דגלים אדומים');
    expect(result.capitalStructure.status).toBe('pass');
  });

  describe('Locked A1 Guardrail #1 — Buyback Cannibals (HD / MCD)', () => {
    it('exempts HD-style negative equity from Red insolvency fail when buyback-driven with strong cash & coverage', () => {
      const hdCannibal = {
        metrics: {
          revenue: {
            annual: annualSeries([
              [2023, 152669000000],
              [2024, 159514000000],
              [2025, 172000000000],
            ]),
          },
          grossProfit: { annual: annualSeries([[2025, 57600000000]]) },
          operatingIncome: {
            annual: annualSeries([
              [2023, 21679000000],
              [2024, 22400000000],
              [2025, 24000000000],
            ]),
          },
          netIncome: {
            annual: annualSeries([
              [2023, 15100000000],
              [2024, 15600000000],
              [2025, 16800000000],
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 18000000000],
              [2024, 19500000000],
              [2025, 21000000000],
            ]),
          },
          capitalExpenditures: {
            annual: annualSeries([
              [2023, 3000000000],
              [2024, 3100000000],
              [2025, 3200000000], // FCF = 17.8B
            ]),
          },
          interestExpense: { annual: annualSeries([[2025, 1690000000]]) }, // EBIT/Int = 14.2x
          totalAssets: { annual: annualSeries([[2025, 76000000000]]) },
          stockholdersEquity: { annual: annualSeries([[2025, -1500000000]]) }, // Negative equity!
          retainedEarnings: { annual: annualSeries([[2025, 78000000000]]) }, // Huge retained earnings!
          treasuryStock: { annual: annualSeries([[2025, -82000000000]]) },
          totalDebt: { annual: annualSeries([[2025, 42000000000]]) },
          cash: { annual: annualSeries([[2025, 3500000000]]) }, // Net Debt = 38.5B -> 2.16x FCF <= 3.0x
          currentAssets: { annual: annualSeries([[2025, 31000000000]]) },
          currentLiabilities: { annual: annualSeries([[2025, 19500000000]]) }, // 1.59x
          weightedAverageSharesDiluted: {
            annual: annualSeries([
              [2021, 1100000000],
              [2024, 995000000],
              [2025, 990000000],
            ]),
          },
        },
      };

      const res = calculateTriageMetrics(hdCannibal, { archetype: 'RETAIL_ECOMMERCE' });

      expect(res.inversion.guardrails.buybackCannibal.active).toBe(true);
      expect(res.inversion.guardrails.buybackCannibal.exemptedEquityDeficit).toBe(true);
      expect(res.inversion.summary.redCount).toBe(0);
      expect(res.inversion.summary.isCleanPass).toBe(true);
      expect(res.capitalStructure.status).toBe('pass');
      expect(res.capitalStructure.badgeHe).toBe('מאזן יציב');
      expect(res.capitalStructure.primaryValueHe).toContain('14.2x');
      expect(res.capitalStructure.guardrailTagHe).toBe('ℹ️ הון שלילי מרכישה עצמית — תקין');

      const contextTag = res.inversion.tier3Context.find((c) => c.id === 'a1-buyback-cannibal');
      expect(contextTag).toBeDefined();
      expect(contextTag.badgeHe).toBe('ℹ️ הון שלילי מרכישה עצמית — תקין');
      expect(contextTag.explanationHe).toContain('לקנות בחזרה מניות של עצמה');
    });

    it('also exempts high positive L/E >= 3.0x when buyback-driven criteria hold, while failing distressed negative equity', () => {
      const thinPositiveEquity = {
        metrics: {
          revenue: { annual: annualSeries([[2025, 50000000000]]) },
          operatingIncome: { annual: annualSeries([[2025, 10000000000]]) },
          netIncome: { annual: annualSeries([[2025, 7000000000]]) },
          operatingCashFlow: { annual: annualSeries([[2025, 9000000000]]) },
          capitalExpenditures: { annual: annualSeries([[2025, 1500000000]]) }, // FCF = 7.5B
          interestExpense: { annual: annualSeries([[2025, 1250000000]]) }, // 8.0x
          totalAssets: { annual: annualSeries([[2025, 45000000000]]) },
          totalLiabilities: { annual: annualSeries([[2025, 40000000000]]) }, // L/E = 8.0x >= 3.0x
          stockholdersEquity: { annual: annualSeries([[2025, 5000000000]]) },
          retainedEarnings: { annual: annualSeries([[2025, 35000000000]]) },
          treasuryStock: { annual: annualSeries([[2025, 31000000000]]) },
          totalDebt: { annual: annualSeries([[2025, 22000000000]]) },
          cash: { annual: annualSeries([[2025, 3000000000]]) }, // Net Debt/FCF = 2.53x
        },
      };

      const exempted = evaluateInversionFlags(thinPositiveEquity, {
        archetype: 'RETAIL_ECOMMERCE',
      });
      expect(exempted.guardrails.buybackCannibal.active).toBe(true);
      expect(exempted.guardrails.buybackCannibal.exemptedHighLeverage).toBe(true);
      expect(exempted.tier1Red.find((f) => f.id === 'high-leverage-fail')).toBeUndefined();

      // Negative control: negative retained earnings + weak coverage => RED fail
      const distressed = {
        metrics: {
          ...thinPositiveEquity.metrics,
          stockholdersEquity: { annual: annualSeries([[2025, -2000000000]]) },
          retainedEarnings: { annual: annualSeries([[2025, -5000000000]]) },
          interestExpense: { annual: annualSeries([[2025, 4000000000]]) }, // 2.5x < 4.0x
        },
      };
      const failed = evaluateInversionFlags(distressed, { archetype: 'RETAIL_ECOMMERCE' });
      expect(failed.guardrails.buybackCannibal.active).toBe(false);
      expect(failed.tier1Red.some((f) => f.id === 'negative-equity-fail')).toBe(true);
    });
  });

  describe('Locked A1 Guardrail #2 — SaaS Deferred Revenue (ADBE / CRM)', () => {
    it('gates Current Ratio on adjusted ratio (1.7x (מתואם) vs מדווח: 0.9x) and emits blue context pill', () => {
      const adbeLike = {
        metrics: {
          revenue: {
            annual: annualSeries([
              [2023, 19409000000],
              [2024, 21505000000],
              [2025, 24000000000],
            ]),
          },
          grossProfit: { annual: annualSeries([[2025, 21300000000]]) }, // 88.8%
          operatingIncome: {
            annual: annualSeries([
              [2023, 6650000000],
              [2024, 7500000000],
              [2025, 8640000000], // 36% margin -> Rule of 40 ~ 47.6% >= 40%
            ]),
          },
          netIncome: {
            annual: annualSeries([
              [2023, 5428000000],
              [2024, 5950000000],
              [2025, 6800000000],
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 7300000000],
              [2024, 8000000000],
              [2025, 8900000000],
            ]),
          },
          currentAssets: { annual: annualSeries([[2025, 9000000000]]) },
          currentLiabilities: { annual: annualSeries([[2025, 10000000000]]) }, // Reported = 0.90x
          deferredRevenueCurrent: { annual: annualSeries([[2025, 4705882353]]) }, // Adjusted = 1.70x
        },
      };

      const res = calculateTriageMetrics(adbeLike, { archetype: 'TECH_SAAS' });

      expect(res.currentRatio.status).toBe('pass');
      expect(res.currentRatio.isAdjustedForDeferredRevenue).toBe(true);
      expect(res.currentRatio.valueHe).toBe('1.7x (מתואם)');
      expect(res.currentRatio.reportedSublabelHe).toBe('מדווח: 0.9x');
      expect(res.currentRatio.guardrailTagHe).toBe('ℹ️ תשלומי מנויים מראש — לא חוב');
      expect(res.inversion.summary.redCount).toBe(0);

      const saasContext = res.inversion.tier3Context.find((c) => c.id === 'a1-saas-deferred-revenue');
      expect(saasContext).toBeDefined();
      expect(saasContext.badgeHe).toBe('ℹ️ תשלומי מנויים מראש — לא חוב');
      expect(saasContext.explanationHe).toContain('מנויים לשנה הקרובה');

      // Also works automatically via >= 15% DefRev/CL heuristic without passing explicit archetype
      const autoRes = calculateTriageMetrics(adbeLike);
      expect(autoRes.currentRatio.status).toBe('pass');
      expect(autoRes.currentRatio.valueHe).toBe('1.7x (מתואם)');
    });

    it('still warns (1.0–1.49x) or fails (< 1.0x) when adjusted SaaS liquidity stays weak', () => {
      const badSaas = {
        metrics: {
          revenue: { annual: annualSeries([[2025, 1000000000]]) },
          currentAssets: { annual: annualSeries([[2025, 500000000]]) },
          currentLiabilities: { annual: annualSeries([[2025, 1000000000]]) },
          deferredRevenueCurrent: { annual: annualSeries([[2025, 300000000]]) }, // Adj CL = 700M => 0.71x < 1.0
        },
      };
      const res = calculateTriageMetrics(badSaas, { archetype: 'TECH_SAAS' });
      expect(res.currentRatio.status).toBe('fail');
      expect(res.inversion.tier1Red.some((f) => f.id === 'saas-adjusted-liquidity-fail')).toBe(true);
    });
  });

  describe('A2 Financial Spread Split — Non-Bank Finance (AER) vs Deposit Bank (JPM / KLAR)', () => {
    it('catches AER-style lessor high leverage (L/E >= 4.5x), weak interest coverage (< 1.5x), loss year & negative FCF', () => {
      const aerProfile = {
        metrics: {
          revenue: {
            annual: annualSeries([
              [2020, 4500000000],
              [2021, 5100000000],
              [2022, 4800000000],
              [2023, 4700000000],
              [2024, 4600000000],
              [2025, 4500000000],
            ]),
          },
          operatingIncome: {
            annual: annualSeries([
              [2021, -720000000], // -14.1% loss year!
              [2023, 600000000],
              [2024, 550000000],
              [2025, 500000000],
            ]),
          },
          netIncome: {
            annual: annualSeries([
              [2023, 350000000],
              [2024, 220000000],
              [2025, -150000000], // Negative net income
            ]),
          },
          interestExpense: {
            tag: 'InterestExpenseOperating',
            annual: annualSeries([[2025, 1900000000]]), // (500 + 1900)/1900 = 1.26x < 1.5x
          },
          totalAssets: { annual: annualSeries([[2025, 72000000000]]) },
          totalLiabilities: { annual: annualSeries([[2025, 60000000000]]) }, // L/E = 5.0x >= 4.5x
          stockholdersEquity: { annual: annualSeries([[2025, 12000000000]]) },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 4200000000],
              [2024, 4100000000],
              [2025, 3900000000],
            ]),
          },
          capitalExpenditures: {
            annual: annualSeries([
              [2023, 5200000000],
              [2024, 5300000000],
              [2025, 5100000000],
            ]),
          },
        },
      };

      const res = calculateTriageMetrics(aerProfile, {
        archetype: 'FINANCIAL_SPREAD',
        financialSubType: 'NON_BANK_FINANCE',
      });

      const redIds = res.inversion.tier1Red.map((f) => f.id);
      expect(res.inversion.summary.overallStatus).toBe('fail');
      expect(redIds).toContain('high-leverage-fail');
      expect(redIds).toContain('weak-interest-coverage-fail');
      expect(redIds).toContain('financial-net-loss-fail');
      expect(res.inversion.resilience3Y.ebitInterestCoverage).toBeCloseTo(1.26, 2);
    });

    it('exempts Deposit Bank Current Ratio & checks Equity/Assets < 6% bank leverage rule', () => {
      const thinBank = {
        metrics: {
          revenue: {
            tag: 'InterestAndDividendIncomeOperating',
            annual: annualSeries([
              [2023, 4000000000],
              [2024, 4500000000],
              [2025, 5000000000],
            ]),
          },
          netIncome: {
            annual: annualSeries([
              [2023, 700000000],
              [2024, 800000000],
              [2025, 900000000], // 18% net margin
            ]),
          },
          totalAssets: { annual: annualSeries([[2025, 200000000000]]) },
          stockholdersEquity: { annual: annualSeries([[2025, 9600000000]]) }, // 4.8% < 6%
          currentAssets: { annual: annualSeries([[2025, 40000000000]]) },
          currentLiabilities: { annual: annualSeries([[2025, 120000000000]]) }, // Would normally fail CR!
        },
      };

      const res = calculateTriageMetrics(thinBank, {
        archetype: 'FINANCIAL_SPREAD',
        financialSubType: 'DEPOSIT_BANK',
      });

      expect(res.currentRatio.isBankExempt).toBe(true);
      expect(res.currentRatio.status).toBe('pass');
      expect(res.inversion.tier1Red.some((f) => f.id === 'bank-thin-capital-cushion')).toBe(true);
      expect(res.inversion.tier1Red.find((f) => f.id === 'current-ratio-fail')).toBeUndefined();
      expect(res.inversion.tier3Context.some((c) => c.id === 'a2-bank-liquidity-exempt')).toBe(true);
    });
  });

  describe('Roll-Up / Goodwill Trap vs Quality Serial Compounder', () => {
    const baseAcquirer = {
      revenue: { annual: annualSeries([[2024, 9000000000], [2025, 10000000000]]) },
      operatingIncome: { annual: annualSeries([[2024, 2200000000], [2025, 2500000000]]) }, // 25% margin
      netIncome: { annual: annualSeries([[2025, 1800000000]]) },
      operatingCashFlow: { annual: annualSeries([[2025, 2000000000]]) },
      capitalExpenditures: { annual: annualSeries([[2025, 200000000]]) }, // FCF = 1.8B
      totalAssets: { annual: annualSeries([[2025, 20000000000]]) },
      stockholdersEquity: { annual: annualSeries([[2025, 9000000000]]) },
      totalLiabilities: { annual: annualSeries([[2025, 11000000000]]) }, // L/E = 1.22x
      totalDebt: { annual: annualSeries([[2025, 3500000000]]) },
      cash: { annual: annualSeries([[2025, 1000000000]]) }, // Net Debt = 2.5B (1.39x FCF); IC = 11.5B -> ROIC ~ 17.2%
      goodwill: { annual: annualSeries([[2025, 11000000000]]) }, // 55% of assets!
      weightedAverageSharesDiluted: {
        annual: annualSeries([[2024, 100000000], [2025, 100000000]]), // 0% dilution
      },
    };

    it('keeps quality serial compounder with 55% goodwill, high ROIC, low debt & 0% dilution at Tier 2 Yellow ONLY', () => {
      const res = calculateTriageMetrics({ metrics: baseAcquirer });
      expect(res.inversion.tier1Red).toHaveLength(0);
      expect(res.inversion.tier2Yellow.some((f) => f.id === 'goodwill-elevated-warn')).toBe(true);
    });

    it('triggers Tier 1 Red Fail when >= 50% goodwill pairs with low ROIC (< 10%) OR high NetDebt/FCF (> 4x) OR > 2.5% dilution', () => {
      const weakRoicRollup = {
        metrics: {
          ...baseAcquirer,
          operatingIncome: { annual: annualSeries([[2024, 1100000000], [2025, 1050000000]]) }, // ROIC ~ 7.2% < 10%
        },
      };
      const lowRoicRes = calculateTriageMetrics(weakRoicRollup);
      expect(lowRoicRes.inversion.tier1Red.some((f) => f.id === 'goodwill-rollup-red')).toBe(true);

      const debtRollup = {
        metrics: {
          ...baseAcquirer,
          totalDebt: { annual: annualSeries([[2025, 9500000000]]) }, // Net Debt = 8.5B / 1.8B = 4.72x > 4.0x
        },
      };
      const debtRes = calculateTriageMetrics(debtRollup);
      expect(debtRes.inversion.tier1Red.some((f) => f.id === 'goodwill-rollup-red')).toBe(true);

      const dilutingRollup = {
        metrics: {
          ...baseAcquirer,
          weightedAverageSharesDiluted: {
            annual: annualSeries([[2024, 100000000], [2025, 104000000]]), // +4.0% > 2.5%
          },
        },
      };
      const dilRes = calculateTriageMetrics(dilutingRollup);
      const gwFlag = dilRes.inversion.tier1Red.find((f) => f.id === 'goodwill-rollup-red');
      expect(gwFlag).toBeDefined();
      expect(gwFlag.valueDisplayHe).toContain('דילול 4.0%');
      expect(gwFlag.valueDisplayEn).toContain('Dilution 4.0%');
      expect(gwFlag.valueDisplayEn).not.toContain('דילול');
    });

    it('marks 42% goodwill (< 50%) as Tier 2 Yellow Warn even if ROIC is low', () => {
      const moderateGoodwill = {
        metrics: {
          ...baseAcquirer,
          goodwill: { annual: annualSeries([[2025, 8400000000]]) }, // 42%
          operatingIncome: { annual: annualSeries([[2025, 1050000000]]) },
        },
      };
      const res = calculateTriageMetrics(moderateGoodwill);
      expect(res.inversion.tier1Red.find((f) => f.id === 'goodwill-rollup-red')).toBeUndefined();
      expect(res.inversion.tier2Yellow.some((f) => f.id === 'goodwill-elevated-warn')).toBe(true);
    });
  });

  describe('3Y Multi-Year Resilience Checks', () => {
    it('flags 3Y Cash Conversion < 0.80x as Red and 0.80x–0.85x as Yellow + OCF burn financing trap', () => {
      const redConversion = evaluateInversionFlags({
        metrics: {
          netIncome: {
            annual: annualSeries([
              [2023, 100000000],
              [2024, 100000000],
              [2025, 100000000], // sum = 300M
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 70000000],
              [2024, 72000000],
              [2025, 74000000], // sum = 216M -> 0.72x < 0.80x
            ]),
          },
        },
      });
      expect(redConversion.resilience3Y.cashConversionRatio).toBeCloseTo(0.72, 2);
      expect(
        redConversion.tier1Red.some((f) => f.id === 'resilience-3y-cash-conversion-fail')
      ).toBe(true);

      const warnConversion = evaluateInversionFlags({
        metrics: {
          netIncome: {
            annual: annualSeries([
              [2023, 100000000],
              [2024, 100000000],
              [2025, 100000000],
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 82000000],
              [2024, 83000000],
              [2025, 84000000], // 0.83x
            ]),
          },
        },
      });
      expect(
        warnConversion.tier2Yellow.some((f) => f.id === 'resilience-3y-cash-conversion-warn')
      ).toBe(true);

      const burningCash = evaluateInversionFlags({
        metrics: {
          operatingCashFlow: {
            annual: annualSeries([
              [2023, -50000000],
              [2024, -60000000],
              [2025, -70000000],
            ]),
          },
          financingCashFlow: {
            annual: annualSeries([
              [2023, 55000000],
              [2024, 65000000],
              [2025, 75000000],
            ]),
          },
        },
      });
      expect(
        burningCash.tier1Red.some((f) => f.id === 'cash-burn-financing-dependency')
      ).toBe(true);
    });

    it('flags negative 3Y FCF ex-SBC as Red when SBC/Rev >= 20% and Yellow when below 20%', () => {
      const heavySbcFail = evaluateInversionFlags({
        metrics: {
          revenue: {
            annual: annualSeries([
              [2023, 1000000000],
              [2024, 1100000000],
              [2025, 1200000000],
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 180000000],
              [2024, 200000000],
              [2025, 220000000],
            ]),
          },
          capitalExpenditures: {
            annual: annualSeries([
              [2023, 20000000],
              [2024, 20000000],
              [2025, 20000000], // sum FCF = 540M
            ]),
          },
          stockBasedCompensation: {
            annual: annualSeries([
              [2023, 240000000],
              [2024, 260000000],
              [2025, 290000000], // sum SBC = 790M -> FCF_ex_SBC = -250M; SBC/Rev ~ 24%
            ]),
          },
        },
      });

      expect(heavySbcFail.resilience3Y.fcfExSbc3Y).toBe(-250000000);
      expect(
        heavySbcFail.tier1Red.some((f) => f.id === 'resilience-3y-fcf-ex-sbc-fail')
      ).toBe(true);

      const moderateSbcWarn = evaluateInversionFlags({
        metrics: {
          revenue: {
            annual: annualSeries([
              [2023, 3000000000],
              [2024, 3000000000],
              [2025, 3000000000], // SBC/Rev = 10%
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 250000000],
              [2024, 250000000],
              [2025, 250000000],
            ]),
          },
          capitalExpenditures: {
            annual: annualSeries([
              [2023, 50000000],
              [2024, 50000000],
              [2025, 50000000], // sum FCF = 600M
            ]),
          },
          stockBasedCompensation: {
            annual: annualSeries([
              [2023, 250000000],
              [2024, 250000000],
              [2025, 250000000], // sum SBC = 750M -> -150M ex-SBC
            ]),
          },
        },
      });
      expect(
        moderateSbcWarn.tier2Yellow.some((f) => f.id === 'resilience-3y-fcf-ex-sbc-warn')
      ).toBe(true);
    });

    it('flags 3Y (Dividends + Buybacks) > FCF as Red when Net Debt rises, and Yellow when cash-funded', () => {
      const debtFundedReturns = evaluateInversionFlags({
        metrics: {
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 500000000],
              [2024, 500000000],
              [2025, 500000000],
            ]),
          },
          capitalExpenditures: {
            annual: annualSeries([
              [2023, 100000000],
              [2024, 100000000],
              [2025, 100000000], // 3Y FCF = 1.2B
            ]),
          },
          dividendsPaid: {
            annual: annualSeries([
              [2023, -300000000],
              [2024, -300000000],
              [2025, -300000000],
            ]),
          },
          stockRepurchases: {
            annual: annualSeries([
              [2023, 300000000],
              [2024, 300000000],
              [2025, 300000000], // Returns = 1.8B > 1.2B
            ]),
          },
          totalDebt: {
            annual: annualSeries([
              [2023, 1000000000],
              [2024, 1400000000],
              [2025, 1800000000], // Net Debt rose!
            ]),
          },
          cash: {
            annual: annualSeries([
              [2023, 300000000],
              [2024, 300000000],
              [2025, 250000000],
            ]),
          },
        },
      });
      expect(
        debtFundedReturns.tier1Red.some((f) => f.id === 'resilience-3y-debt-funded-returns-fail')
      ).toBe(true);

      const cashFundedReturns = evaluateInversionFlags({
        metrics: {
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 500000000],
              [2024, 500000000],
              [2025, 500000000],
            ]),
          },
          capitalExpenditures: {
            annual: annualSeries([
              [2023, 100000000],
              [2024, 100000000],
              [2025, 100000000],
            ]),
          },
          dividendsPaid: {
            annual: annualSeries([
              [2023, 300000000],
              [2024, 300000000],
              [2025, 300000000],
            ]),
          },
          stockRepurchases: {
            annual: annualSeries([
              [2023, 300000000],
              [2024, 300000000],
              [2025, 300000000],
            ]),
          },
          totalDebt: {
            annual: annualSeries([
              [2023, 500000000],
              [2025, 500000000],
            ]),
          },
          cash: {
            annual: annualSeries([
              [2023, 2500000000],
              [2025, 1900000000], // Still net cash!
            ]),
          },
        },
      });
      expect(
        cashFundedReturns.tier1Red.find((f) => f.id === 'resilience-3y-debt-funded-returns-fail')
      ).toBeUndefined();
      expect(
        cashFundedReturns.tier2Yellow.some((f) => f.id === 'resilience-3y-cash-drawn-returns-warn')
      ).toBe(true);
    });
  });

  describe('Retail Low-Cost Exception (COST), Inventory Bloat, Biotech Runway & AI Qualitative Merge', () => {
    it('exempts COST-style steady 3.5% operating margins with cash conversion >= 1.0x and flags inventory bloat', () => {
      const costStyle = {
        metrics: {
          revenue: {
            annual: annualSeries([
              [2023, 242000000000],
              [2024, 254000000000],
              [2025, 260000000000], // +2.4% YoY
            ]),
          },
          operatingIncome: {
            annual: annualSeries([
              [2023, 8100000000], // 3.3%
              [2024, 9100000000], // 3.6%
              [2025, 9200000000], // 3.5% (stable!)
            ]),
          },
          netIncome: {
            annual: annualSeries([
              [2023, 6292000000],
              [2024, 7367000000],
              [2025, 7600000000],
            ]),
          },
          operatingCashFlow: {
            annual: annualSeries([
              [2023, 11068000000],
              [2024, 11339000000],
              [2025, 12000000000],
            ]),
          },
          inventory: {
            annual: annualSeries([
              [2024, 18000000000],
              [2025, 22500000000], // +25% YoY vs +2.4% sales!
            ]),
          },
        },
      };

      const res = calculateTriageMetrics(costStyle, { archetype: 'RETAIL_ECOMMERCE' });
      expect(res.margins.status).toBe('pass');
      expect(res.margins.isLowCostRetailException).toBe(true);
      expect(res.inversion.tier1Red.find((f) => f.id === 'operating-margins-fail')).toBeUndefined();
      expect(res.inversion.tier3Context.some((c) => c.id === 'retail-low-cost-margin-ok')).toBe(true);
      expect(res.inversion.tier2Yellow.some((f) => f.id === 'retail-inventory-bloat-warn')).toBe(true);
    });

    it('flags pre-revenue HEALTHCARE_PHARMA with < 8 quarters cash runway and merges Schema v2 qualitative AI flags', () => {
      const bioFail = calculateTriageMetrics(
        {
          metrics: {
            revenue: { annual: annualSeries([[2025, 0]]) },
            operatingCashFlow: { annual: annualSeries([[2025, -80000000]]) }, // $20M/qtr burn
            cash: { annual: annualSeries([[2025, 100000000]]) }, // 5 quarters < 8!
          },
        },
        {
          archetype: 'HEALTHCARE_PHARMA',
          aiSummary: {
            qualitativeFlags: [
              {
                id: 'fda-binary',
                severity: 'fail',
                category: 'regulatory',
                titleHe: 'תלות במוצר יחיד ואישור FDA',
                titleEn: 'Single-Asset FDA Dependency',
                rationaleHe: 'אישור התרופה העיקרית טרם התקבל.',
                rationaleEn: 'Lead candidate awaits Phase 3 FDA review.',
                quoteEn: 'Substantially all of our value depends on successful FDA approval of Drug-X.',
                sourceRef: '10-K Item 1A',
              },
            ],
            customerConcentration: {
              detected: true,
              maxCustomerPct: 34,
              detailHe: 'לקוח יחיד מהווה 34% מההכנסות.',
              detailEn: 'Single customer accounts for 34% of revenue.',
            },
          },
        }
      );

      expect(bioFail.inversion.tier1Red.some((f) => f.id === 'pharma-cash-runway-red')).toBe(true);
      const fdaFlag = bioFail.inversion.tier1Red.find((f) => f.id === 'fda-binary');
      expect(fdaFlag).toBeDefined();
      expect(fdaFlag.badgeHe).toBe('ממצא SEC');
      expect(fdaFlag.badgeEn).toBe('SEC Filing Note');
      expect(
        bioFail.inversion.tier1Red.some((f) => f.id === 'qual-customer-concentration')
      ).toBe(true);
    });

    it('enforces 2%–6% retail margin cap, dedupes qualitative flags vs synthetic customer/governance risks, and surfaces qualitative flags when XBRL is missing', () => {
      // 1. 7.5% stable retail margin exceeds 6% low-cost cap -> fails normal <10% rule
      const midMarginRetail = calculateTriageMetrics(
        {
          metrics: {
            revenue: { annual: annualSeries([[2024, 1000000000], [2025, 1100000000]]) },
            operatingIncome: { annual: annualSeries([[2024, 75000000], [2025, 82500000]]) }, // 7.5%
          },
        },
        { archetype: 'RETAIL_ECOMMERCE' }
      );
      expect(midMarginRetail.margins.status).toBe('fail');
      expect(midMarginRetail.margins.isLowCostRetailException).toBe(false);

      // 2. Qualitative flags dedupe matching customerConcentration & governanceAndMoatRisks AND work when companyFacts is null
      const xbrlMissingWithQual = evaluateInversionFlags(null, {
        aiSummary: {
          qualitativeFlags: [
            {
              id: 'conc-main',
              severity: 'fail',
              category: 'concentration',
              titleHe: 'תלות בלקוח עוגן (28%)',
              titleEn: 'Anchor Customer Dependence (28%)',
              rationaleHe: 'לקוח יחיד מהווה 28% מהמכירות.',
              rationaleEn: 'Single customer is 28% of sales.',
            },
            {
              id: 'gov-restatement',
              severity: 'fail',
              category: 'restatement',
              titleHe: 'תיקון דוחות 10-K/A',
              titleEn: '10-K/A Restatement',
              rationaleHe: 'החברה הגישה תיקון דוח.',
              rationaleEn: 'Filed accounting restatement.',
            },
          ],
          customerConcentration: { detected: true, maxCustomerPct: 28 },
          governanceAndMoatRisks: { hasRestatement: true },
        },
      });

      expect(xbrlMissingWithQual.summary.overallStatus).toBe('fail');
      expect(xbrlMissingWithQual.summary.redCount).toBe(2);
      expect(xbrlMissingWithQual.summary.bannerEn).toContain('2 Red Flags');
      expect(xbrlMissingWithQual.tier1Red.find((f) => f.id === 'qual-customer-concentration')).toBeUndefined();
      expect(xbrlMissingWithQual.tier1Red.find((f) => f.id === 'qual-governance-severe')).toBeUndefined();
    });
  });

  describe('Educational Copy, Word-Count (<= 12w) & Zero Private Mentor Names', () => {
    it('enforces <= 12 Hebrew words per quote insightHe and prohibits private analyst/mentor names', () => {
      const entries = Object.values(WISDOM_QUOTES);
      expect(entries.length).toBeGreaterThanOrEqual(10);

      for (const q of entries) {
        const words = q.insightHe.trim().split(/\s+/).filter(Boolean);
        expect(words.length).toBeLessThanOrEqual(12);
        expect(q.attributionHe.length).toBeGreaterThan(5);
        expect(q.attributionEn.length).toBeGreaterThan(5);
        expect(q.attributionHe).toMatch(/המשקיע הנבון|באפט|Quality Compounders/);
      }
    });
  });
});
