import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Step1Triage } from '../Step1Triage'
import { setCachedSummary } from '../../../services/aiSummaryService.js'

function annualSeries(valuesByYear) {
  return valuesByYear.map(([fiscalYear, value]) => ({ fiscalYear, value }))
}

describe('Step1Triage Option C Inversion & A1 Guardrails UI (#357 Slice 4)', () => {
  beforeEach(async () => {
    await setCachedSummary('MSFT', {
      ticker: 'MSFT',
      summary: 'מייקרוסופט מפעילה פלטפורמות ענן (Azure) ותוכנה ארגונית במנויים.',
      keyEngines: ['Azure Cloud', 'Microsoft 365'],
      businessArchetype: 'TECH_SAAS',
      financialSubType: 'NONE',
      schemaVersion: 2,
      source: 'ai-live',
    })
  })

  it('renders flush single-line top inversion strip (h-10) and collapses MSFT healthy pass to 1 compact clean row', async () => {
    const scrollIntoViewMock = vi.fn()
    const msftCleanFacts = {
      metrics: {
        revenue: {
          annual: annualSeries([
            [2022, 198270000000],
            [2023, 211915000000],
            [2024, 245122000000],
            [2025, 281724000000],
          ]),
        },
        grossProfit: { annual: annualSeries([[2025, 194000000000]]) },
        operatingIncome: {
          annual: annualSeries([
            [2022, 83472000000],
            [2023, 88580000000],
            [2024, 109324000000],
            [2025, 128466000000],
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
            [2025, 136162000000],
          ]),
        },
        weightedAverageSharesDiluted: {
          annual: annualSeries([
            [2024, 7469000000],
            [2025, 7433000000],
          ]),
        },
        currentAssets: { annual: annualSeries([[2025, 185000000000]]) },
        currentLiabilities: { annual: annualSeries([[2025, 115000000000]]) },
      },
    }

    render(
      <Step1Triage
        company={{ ticker: 'MSFT', name: 'Microsoft Corporation' }}
        companyFacts={msftCleanFacts}
      />
    )

    const strip = screen.getByTestId('step1-inversion-strip')
    expect(strip.className).toContain('h-10')
    expect(strip.className).toContain('whitespace-nowrap')
    expect(strip.textContent).toContain('0 דגלים אדומים')

    const breakdown = screen.getByTestId('step1-risk-breakdown')
    breakdown.scrollIntoView = scrollIntoViewMock

    expect(screen.getByTestId('risk-breakdown-clean-pass')).toBeTruthy()
    expect(screen.queryByTestId('risk-tier1-red')).toBeNull()
    expect(screen.queryByTestId('risk-tier2-yellow')).toBeNull()

    fireEvent.click(strip)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(breakdown.className).toContain('ring-2')
  })

  it('renders Tier 1 Red flags on AER-like lessor profile with expandable Buffett/Graham quote drawer & EN toggle', async () => {
    await setCachedSummary('AER', {
      ticker: 'AER',
      summary: 'אירקאפ מחכירה מטוסים לחברות תעופה ברחבי העולם באמצעות מימון חוב.',
      keyEngines: ['Aircraft Leasing'],
      businessArchetype: 'FINANCIAL_SPREAD',
      financialSubType: 'NON_BANK_FINANCE',
      schemaVersion: 2,
      source: 'ai-live',
    })

    const aerFacts = {
      metrics: {
        revenue: {
          annual: annualSeries([
            [2023, 4700000000],
            [2024, 4600000000],
            [2025, 4500000000],
          ]),
        },
        operatingIncome: {
          annual: annualSeries([
            [2023, 600000000],
            [2024, 550000000],
            [2025, 500000000],
          ]),
        },
        netIncome: {
          annual: annualSeries([
            [2023, 350000000],
            [2024, 220000000],
            [2025, -150000000],
          ]),
        },
        interestExpense: {
          tag: 'InterestExpenseOperating',
          annual: annualSeries([[2025, 1900000000]]),
        },
        totalAssets: { annual: annualSeries([[2025, 72000000000]]) },
        totalLiabilities: { annual: annualSeries([[2025, 60000000000]]) }, // L/E = 5.0x
        stockholdersEquity: { annual: annualSeries([[2025, 12000000000]]) },
      },
    }

    render(
      <Step1Triage
        company={{ ticker: 'AER', name: 'AerCap Holdings', sic: 7359 }}
        companyFacts={aerFacts}
      />
    )

    const strip = screen.getByTestId('step1-inversion-strip')
    expect(strip.textContent).toContain('דגלים אדומים')
    expect(strip.className).toContain('rose')

    const redSection = screen.getByTestId('risk-tier1-red')
    expect(redSection).toBeTruthy()
    expect(screen.getByTestId('inversion-flag-high-leverage-fail')).toBeTruthy()
    expect(screen.getByTestId('inversion-flag-weak-interest-coverage-fail')).toBeTruthy()

    const quoteToggle = screen.getByTestId('quote-toggle-high-leverage-fail')
    expect(screen.queryByTestId('quote-drawer-high-leverage-fail')).toBeNull()
    fireEvent.click(quoteToggle)

    const drawer = screen.getByTestId('quote-drawer-high-leverage-fail')
    expect(drawer.textContent).toContain('מכתבי וורן באפט')
    expect(drawer.textContent).toContain('zip up your wallet')

    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByTestId('step1-inversion-strip').textContent).toContain('Red Flags')
    expect(screen.getByTestId('quote-drawer-high-leverage-fail').textContent).toContain(
      'Warren Buffett Shareholder Letters'
    )
  })

  it('renders HD Buyback Cannibal calm Slate/Sky guardrail & Green Health Pass without false Red fail', async () => {
    await setCachedSummary('HD', {
      ticker: 'HD',
      summary: 'הום דיפו מפעילה רשת חנויות לשיפוץ הבית.',
      keyEngines: ['Home Improvement Stores'],
      businessArchetype: 'RETAIL_ECOMMERCE',
      financialSubType: 'NONE',
      schemaVersion: 2,
      source: 'ai-live',
    })

    const hdFacts = {
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
        capitalExpenditures: { annual: annualSeries([[2025, 3200000000]]) },
        interestExpense: { annual: annualSeries([[2025, 1690000000]]) }, // 14.2x
        totalAssets: { annual: annualSeries([[2025, 76000000000]]) },
        stockholdersEquity: { annual: annualSeries([[2025, -1500000000]]) },
        retainedEarnings: { annual: annualSeries([[2025, 78000000000]]) },
        treasuryStock: { annual: annualSeries([[2025, -82000000000]]) },
        totalDebt: { annual: annualSeries([[2025, 42000000000]]) },
        cash: { annual: annualSeries([[2025, 3500000000]]) },
        currentAssets: { annual: annualSeries([[2025, 31000000000]]) },
        currentLiabilities: { annual: annualSeries([[2025, 19500000000]]) },
      },
    }

    render(
      <Step1Triage
        company={{ ticker: 'HD', name: 'Home Depot', sic: 5211 }}
        companyFacts={hdFacts}
      />
    )

    expect(screen.queryByTestId('risk-tier1-red')).toBeNull()
    expect(screen.getByTestId('risk-breakdown-clean-pass')).toBeTruthy()
    expect(screen.getByTestId('buyback-cannibal-sound-badge').textContent).toContain('מאזן יציב')

    const buybackPill = screen.getByTestId('guardrail-pill-buyback')
    expect(buybackPill.textContent).toContain('ℹ️ הון שלילי מרכישה עצמית — תקין')
    expect(buybackPill.className).toContain('sky-')

    fireEvent.click(buybackPill)
    const sheet = await screen.findByTestId('tooltip-portal-sheet')
    expect(sheet.textContent).toContain('לקנות בחזרה מניות של עצמה')

    expect(screen.getByTestId('risk-tier3-context')).toBeTruthy()
    expect(screen.getByTestId('inversion-flag-a1-buyback-cannibal')).toBeTruthy()
  })

  it('renders ADBE SaaS deferred revenue 1.7x (מתואם) + מדווח: 0.9x and calm Slate/Sky pill', async () => {
    await setCachedSummary('ADBE', {
      ticker: 'ADBE',
      summary: 'אדובי מספקת תוכנות ענן ליצירה ומסמכים.',
      keyEngines: ['Creative Cloud'],
      businessArchetype: 'TECH_SAAS',
      financialSubType: 'NONE',
      schemaVersion: 2,
      source: 'ai-live',
    })

    const adbeFacts = {
      metrics: {
        revenue: {
          annual: annualSeries([
            [2023, 19409000000],
            [2024, 21505000000],
            [2025, 24000000000],
          ]),
        },
        grossProfit: { annual: annualSeries([[2025, 21300000000]]) },
        operatingIncome: {
          annual: annualSeries([
            [2023, 6650000000],
            [2024, 7500000000],
            [2025, 8640000000],
          ]),
        },
        currentAssets: { annual: annualSeries([[2025, 9000000000]]) },
        currentLiabilities: { annual: annualSeries([[2025, 10000000000]]) },
        deferredRevenueCurrent: { annual: annualSeries([[2025, 4705882353]]) },
      },
    }

    render(
      <Step1Triage
        company={{ ticker: 'ADBE', name: 'Adobe Inc.' }}
        companyFacts={adbeFacts}
      />
    )

    const balanceCard = screen.getByTestId('fundamental-card-balance-sheet')
    expect(balanceCard.getAttribute('data-status')).toBe('pass')
    expect(balanceCard.textContent).toContain('1.7x (מתואם)')
    expect(screen.getByTestId('balance-sheet-reported-sublabel').textContent).toContain('מדווח: 0.9x')

    const saasPill = screen.getByTestId('guardrail-pill-saas')
    expect(saasPill.textContent).toContain('ℹ️ תשלומי מנויים מראש — לא חוב')
    expect(screen.getByTestId('inversion-flag-a1-saas-deferred-revenue')).toBeTruthy()
  })

  it('caps Tier 2 Yellow warnings at 3 visible items with interactive +N expand toggle', async () => {
    await setCachedSummary('MULTIWARN', {
      ticker: 'MULTIWARN',
      summary: 'חברה עתירת אזהרות למעקב.',
      keyEngines: ['SaaS'],
      businessArchetype: 'TECH_SAAS',
      financialSubType: 'NONE',
      schemaVersion: 2,
      source: 'ai-live',
      qualitativeFlags: [
        {
          id: 'q1',
          severity: 'warn',
          category: 'supply-chain',
          titleHe: 'אזהרה 1: תלות בספק בודד',
          titleEn: 'Warn 1: Supplier concentration',
          rationaleHe: 'ספק יחיד מהווה 40% מהרכיבים.',
          rationaleEn: 'Single supplier accounts for 40%.',
        },
        {
          id: 'q2',
          severity: 'warn',
          category: 'turnover',
          titleHe: 'אזהרה 2: עזיבת סמנכ״ל כספים',
          titleEn: 'Warn 2: CFO departure',
          rationaleHe: 'שינוי הנהלה תכוף.',
          rationaleEn: 'Frequent CFO turnover.',
        },
        {
          id: 'q3',
          severity: 'warn',
          category: 'patent',
          titleHe: 'אזהרה 3: פקיעת פטנט קרובה',
          titleEn: 'Warn 3: Patent cliff',
          rationaleHe: 'פטנט מרכזי פג בשנה הקרובה.',
          rationaleEn: 'Core patent expires next year.',
        },
        {
          id: 'q4',
          severity: 'warn',
          category: 'litigation',
          titleHe: 'אזהרה 4: תביעה ייצוגית תלויה',
          titleEn: 'Warn 4: Pending litigation',
          rationaleHe: 'תביעה מהותית בהליך.',
          rationaleEn: 'Pending material lawsuit.',
        },
        {
          id: 'q5',
          severity: 'warn',
          category: 'fx',
          titleHe: 'אזהרה 5: חשיפת מט״ח גבוהה',
          titleEn: 'Warn 5: FX exposure',
          rationaleHe: 'תנודתיות חריגה בשערי חליפין.',
          rationaleEn: 'High FX sensitivity.',
        },
      ],
    })

    const basicFacts = {
      metrics: {
        revenue: {
          annual: annualSeries([
            [2024, 1000000000],
            [2025, 1150000000],
          ]),
        },
      },
    }

    render(
      <Step1Triage
        company={{ ticker: 'MULTIWARN', name: 'MultiWarn Corp' }}
        companyFacts={basicFacts}
      />
    )

    const yellowContainer = await screen.findByTestId('risk-tier2-yellow')
    expect(yellowContainer.querySelectorAll('[data-severity="yellow"]')).toHaveLength(3)

    const expandBtn = screen.getByTestId('risk-yellow-expand-btn')
    expect(expandBtn.textContent).toContain('+2')

    fireEvent.click(expandBtn)
    expect(yellowContainer.querySelectorAll('[data-severity="yellow"]')).toHaveLength(5)
  })
})
