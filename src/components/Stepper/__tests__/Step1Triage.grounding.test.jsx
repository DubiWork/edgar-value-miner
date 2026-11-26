import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const {
  mockGetOrFetchCompanySummary,
  mockGetCompanyContextStatus,
  mockInvalidateCachedSummary,
  mockGetAiBudgetStatus,
  mockRefreshCompanyContext,
  mockSaveManualTranscript,
  mockTranslateSummaryOnDemand,
} = vi.hoisted(() => ({
  mockGetOrFetchCompanySummary: vi.fn(),
  mockGetCompanyContextStatus: vi.fn(),
  mockInvalidateCachedSummary: vi.fn(),
  mockGetAiBudgetStatus: vi.fn(),
  mockRefreshCompanyContext: vi.fn(),
  mockSaveManualTranscript: vi.fn(),
  mockTranslateSummaryOnDemand: vi.fn(),
}))

vi.mock('../../../services/aiSummaryService.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getOrFetchCompanySummary: mockGetOrFetchCompanySummary,
    getCompanyContextStatus: mockGetCompanyContextStatus,
    invalidateCachedSummary: mockInvalidateCachedSummary,
    getAiBudgetStatus: mockGetAiBudgetStatus,
    refreshCompanyContext: mockRefreshCompanyContext,
    saveManualTranscript: mockSaveManualTranscript,
    translateSummaryOnDemand: mockTranslateSummaryOnDemand,
  }
})

import { Step1Triage } from '../Step1Triage'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Step1Triage Grounding Auto-Upgrade (#328, #324)', () => {
  const maCompany = {
    ticker: 'MA',
    name: 'Mastercard Incorporated',
    cik: '0001141391',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvalidateCachedSummary.mockResolvedValue(true)
    mockGetAiBudgetStatus.mockResolvedValue(null)
  })

  it('auto-upgrades ungrounded cached summary when server returns _contextMissing (e.g. MA) and shows upgrading feedback', async () => {
    const upgradeDeferred = deferred()

    mockGetOrFetchCompanySummary
      .mockResolvedValueOnce({
        ticker: 'MA',
        summary: 'תקציר מוקדם מהמטמון ללא דוחות SEC',
        keyEngines: ['Payments Network'],
        source: 'cache',
        originalSource: 'mock-dynamic',
      })
      .mockImplementationOnce(() => upgradeDeferred.promise)

    mockGetCompanyContextStatus.mockResolvedValueOnce({
      tenK: { status: 'missing', error: 'Not fetched yet' },
      eightK: { status: 'missing', error: 'Not fetched yet' },
      transcript: { status: 'missing', error: 'Not fetched yet' },
      _serverReachable: true,
      _contextMissing: true,
      budgetStatus: 'active',
      hasNewerFilings: false,
    })

    render(<Step1Triage company={maCompany} />)

    await screen.findByText('תקציר מוקדם מהמטמון ללא דוחות SEC')

    // Upgrading indicator appears while server fetches missing 10-K / 8-K and regenerates
    const indicator = await screen.findByTestId('grounding-upgrading-indicator')
    expect(indicator.textContent).toContain('שולף דוחות SEC')

    expect(mockGetCompanyContextStatus).toHaveBeenCalledWith(
      'MA',
      { tenKDate: null, eightKDate: null },
      { cik: '0001141391' }
    )
    // Opportunistic upgrade must NOT pre-delete cached summary before server responds (#357)
    expect(mockInvalidateCachedSummary).not.toHaveBeenCalled()
    expect(mockGetOrFetchCompanySummary).toHaveBeenNthCalledWith(
      2,
      'MA',
      { name: 'Mastercard Incorporated', sector: undefined, cik: '0001141391' },
      { forceRefresh: true, cik: '0001141391' }
    )

    upgradeDeferred.resolve({
      ticker: 'MA',
      summary: 'מאסטרקארד מפעילה רשת סליקה גלובלית מבוססת דוח 10-K ו-8-K.',
      keyEngines: ['Global Payment Processing', 'Value-Added Services'],
      source: 'ai-live',
      ingestionStatus: {
        tenK: { status: 'ok', form: '10-K', date: '2026-02-12', url: 'https://www.sec.gov/10k' },
        eightK: { status: 'ok', form: '8-K', date: '2026-10-30', url: 'https://www.sec.gov/8k' },
        transcript: { status: 'fallback_8k', date: '2026-10-30' },
      },
    })

    await screen.findByText('מאסטרקארד מפעילה רשת סליקה גלובלית מבוססת דוח 10-K ו-8-K.')
    const badge = await screen.findByTestId('data-grounding-badge')
    expect(badge.textContent).toContain('2/3')
  })

  it('skips auto-upgrade cleanly when server reports monthly AI budget exhausted', async () => {
    mockGetOrFetchCompanySummary.mockResolvedValueOnce({
      ticker: 'MA',
      summary: 'תקציר שמור מהמטמון',
      keyEngines: ['Payments Network'],
      source: 'cache',
      originalSource: 'ai-live',
    })

    mockGetCompanyContextStatus.mockResolvedValueOnce({
      tenK: { status: 'missing' },
      eightK: { status: 'missing' },
      transcript: { status: 'missing' },
      _serverReachable: true,
      _contextMissing: true,
      budgetStatus: 'exhausted',
      hasNewerFilings: false,
    })

    render(<Step1Triage company={maCompany} />)

    await screen.findByText('תקציר שמור מהמטמון')
    await waitFor(() => {
      expect(mockGetCompanyContextStatus).toHaveBeenCalledTimes(1)
    })

    expect(mockInvalidateCachedSummary).not.toHaveBeenCalled()
    expect(mockGetOrFetchCompanySummary).toHaveBeenCalledTimes(1)
  })

  it('preserves cached summary cleanly when Cloud Functions are unavailable (returns null)', async () => {
    mockGetOrFetchCompanySummary.mockResolvedValueOnce({
      ticker: 'MA',
      summary: 'תקציר שמור במצב אופליין',
      keyEngines: ['Payments Network'],
      source: 'cache',
      originalSource: 'ai-live',
    })
    mockGetCompanyContextStatus.mockResolvedValueOnce(null)

    render(<Step1Triage company={maCompany} />)

    await screen.findByText('תקציר שמור במצב אופליין')
    await waitFor(() => {
      expect(mockGetCompanyContextStatus).toHaveBeenCalledTimes(1)
    })

    expect(mockInvalidateCachedSummary).not.toHaveBeenCalled()
    expect(mockGetOrFetchCompanySummary).toHaveBeenCalledTimes(1)
  })

  it('immediately renders v1 cache with 0ms deterministic archetype and opportunistically upgrades to v2 when !businessArchetype && !budgetExhausted (#357)', async () => {
    const upgradeDeferred = deferred()
    const adbeFacts = {
      metrics: {
        revenue: { annual: [{ fiscalYear: 2025, value: 21500000000 }] },
        grossProfit: { annual: [{ fiscalYear: 2025, value: 19100000000 }] }, // 88.8% GM
        researchAndDevelopment: { annual: [{ fiscalYear: 2025, value: 3900000000 }] }, // 18% R&D
        deferredRevenueCurrent: { annual: [{ fiscalYear: 2025, value: 6200000000 }] }, // 28.8% rev
        currentLiabilities: { annual: [{ fiscalYear: 2025, value: 10000000000 }] },
      },
    }

    mockGetOrFetchCompanySummary
      .mockResolvedValueOnce({
        ticker: 'ADBE',
        summary: 'אדובי (v1) מספקת תוכנות יצירה ומסמכים בענן.',
        keyEngines: ['Creative Cloud', 'Document Cloud'],
        source: 'cache',
        originalSource: 'ai-live',
        businessArchetype: null, // legacy v1 cached summary
        ingestionStatus: {
          tenK: { status: 'ok', form: '10-K', date: '2026-01-15' },
          eightK: { status: 'ok', form: '8-K', date: '2026-09-12' },
          transcript: { status: 'fallback_8k', date: '2026-09-12' },
        },
      })
      .mockImplementationOnce(() => upgradeDeferred.promise)

    mockGetCompanyContextStatus.mockResolvedValueOnce({
      tenK: { status: 'ok', form: '10-K', date: '2026-01-15' },
      eightK: { status: 'ok', form: '8-K', date: '2026-09-12' },
      transcript: { status: 'fallback_8k', date: '2026-09-12' },
      _serverReachable: true,
      _contextMissing: false,
      budgetStatus: 'active',
      hasNewerFilings: false,
    })

    render(
      <Step1Triage
        company={{ ticker: 'ADBE', name: 'Adobe Inc.' }}
        companyFacts={adbeFacts}
      />
    )

    // 1. Valid v1 summary renders immediately alongside 0ms deterministic archetype (no layout shift, no cache wipe)
    await screen.findByText('אדובי (v1) מספקת תוכנות יצירה ומסמכים בענן.')
    expect(screen.getByTestId('tear-sheet-blade').getAttribute('data-archetype')).toBe('TECH_SAAS')
    expect(mockInvalidateCachedSummary).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(mockGetOrFetchCompanySummary).toHaveBeenCalledTimes(2)
    })

    // 2. Live v2 upgrade completes cleanly
    upgradeDeferred.resolve({
      ticker: 'ADBE',
      summary: 'אדובי (v2) מפעילה מנויי ענן ליצירה ומסמכים (Creative & Document Cloud).',
      keyEngines: ['Creative Cloud', 'Document Cloud'],
      businessArchetype: 'TECH_SAAS',
      financialSubType: 'NONE',
      source: 'ai-live',
      schemaVersion: 2,
    })

    await screen.findByText('אדובי (v2) מפעילה מנויי ענן ליצירה ומסמכים (Creative & Document Cloud).')
    expect(mockInvalidateCachedSummary).not.toHaveBeenCalled()
  })
})
