import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Step1Triage } from '../Step1Triage'
import { setCachedSummary } from '../../../services/aiSummaryService.js'

describe('Step1Triage Component', () => {
  const mockCompany = {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology',
  }

  beforeEach(async () => {
    // Pre-populate cache for MSFT to speed up tests
    await setCachedSummary('MSFT', {
      ticker: 'MSFT',
      summary:
        'מייקרוסופט היא ענקית טכנולוגיה שמרוויחה כסף ממכירת רישיונות תוכנה (Windows, Office), שירותי ענן לארגונים (Azure), ומוצרי חומרה וגיימינג. המודל נשען על הכנסות חוזרות ממנויים (SaaS).',
      keyEngines: [
        'Azure Cloud & Server',
        'Office 365 SaaS',
        'Windows & Enterprise OEM',
        'Xbox & Gaming Subscriptions',
      ],
    })
  })

  it('renders Step 1 header and company details', () => {
    render(<Step1Triage company={mockCompany} />)

    expect(screen.getByText('Step 1 of 5')).toBeTruthy()
    expect(screen.getByText('Microsoft Corporation')).toBeTruthy()
    expect(screen.getByText('(MSFT)')).toBeTruthy()
    expect(screen.getByText('10-Second Triage')).toBeTruthy()
  })

  it('renders Business Clarity card in RTL Hebrew by default with company logo, 5 moat pillars, transparent grounding, and switches cleanly to LTR English', async () => {
    render(<Step1Triage company={mockCompany} />)

    const blade = screen.getByTestId('tear-sheet-blade')
    expect(blade.getAttribute('dir')).toBe('rtl')
    expect(screen.getByTestId('company-logo')).toBeTruthy()
    expect(screen.getByText('בהירות עסקית (מעגל הכשירות)')).toBeTruthy()

    const expectedText =
      'מייקרוסופט היא ענקית טכנולוגיה שמרוויחה כסף ממכירת רישיונות תוכנה (Windows, Office), שירותי ענן לארגונים (Azure), ומוצרי חומרה וגיימינג. המודל נשען על הכנסות חוזרות ממנויים (SaaS).'

    const summaryEl = await screen.findByText(expectedText)
    expect(summaryEl).toBeTruthy()

    // Core Model pill removed & replaced by transparent grounding badge
    expect(screen.queryByText('Core Model')).toBeNull()
    expect(screen.getByTestId('data-grounding-badge')).toBeTruthy()

    // Inline 5 canonical moat categories & headers visible even before expanding Tear Sheet
    expect(screen.getByText('מאפייני המודל העסקי:')).toBeTruthy()
    const moatCats = screen.getByTestId('moat-inline-categories')
    expect(moatCats.textContent).toContain('עלויות מעבר')
    expect(moatCats.textContent).toContain('יעילות קנה מידה')
    expect(screen.getByText('מקורות הכנסה עיקריים (מוצרי ליבה):')).toBeTruthy()

    // Toggle card language to English -> only the card switches to LTR & English headings
    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(blade.getAttribute('dir')).toBe('ltr')
    expect(screen.getByText('Business Clarity (Circle of Competence)')).toBeTruthy()
    expect(screen.getByText('Business Model Traits:')).toBeTruthy()
    expect(screen.getByText('Core Revenue Streams:')).toBeTruthy()
    const enMoatCats = await screen.findByTestId('moat-inline-categories')
    expect(enMoatCats.textContent).toContain('Switching Costs')
    expect(enMoatCats.textContent).toContain('Efficient Scale')
  })

  it('renders the 4 Fast Fundamentals indicators with updated titles and target thresholds', () => {
    render(<Step1Triage company={mockCompany} />)

    // Check all 4 indicator titles (including Current Ratio (Liquidity))
    expect(screen.getByText('Revenue Growth')).toBeTruthy()
    expect(screen.getByText('Operating Margins')).toBeTruthy()
    expect(screen.getByText('Share Dilution')).toBeTruthy()
    expect(screen.getByText('Current Ratio (Liquidity)')).toBeTruthy()

    // Check target baseline text
    expect(screen.getByText('Target: > 1.0')).toBeTruthy()

    // Check all 4 Hebrew descriptions
    expect(screen.getByText('צמיחה עקבית של ~14% בשנה')).toBeTruthy()
    expect(screen.getByText('שוליים יציבים מעל 40%')).toBeTruthy()
    expect(screen.getByText('החברה רוכשת מניות חזרה')).toBeTruthy()
    expect(screen.getByText('Current Ratio תקין > 1')).toBeTruthy()
  })

  it('renders educational tooltips with the required rationales for beginners', async () => {
    render(<Step1Triage company={mockCompany} />)

    // 7 Educational Info buttons (Business Clarity, Business Model Traits, Core Revenue Streams, and 4 Fundamentals)
    const infoButtons = screen.getAllByRole('button', { name: /educational rationale/i })
    expect(infoButtons).toHaveLength(7)

    // 1. Business Clarity Tooltip
    expect(
      screen.getByText(/מעגל הכשירות: הכלל הראשון בהשקעות הוא לא להשקיע בעסק שאנחנו לא מבינים/i)
    ).toBeTruthy()

    // 2. Business Model Traits Tooltip
    expect(
      screen.getByText(/איך החברה בנויה להרוויח כסף/i)
    ).toBeTruthy()

    // 3. Core Revenue Streams Tooltip
    expect(
      screen.getByText(/המוצרים, השירותים והחטיבות העיקריים שמייצרים לחברה הכנסות כיום/i)
    ).toBeTruthy()

    // Wait for async summary load to settle cleanly
    await screen.findByTestId('toggle-tear-sheet-btn')

    // 4. Revenue Growth Tooltip
    expect(
      screen.getByText(/צמיחה בהכנסות: עסק בריא הוא עסק שצומח/i)
    ).toBeTruthy()

    // 5. Operating Margins Tooltip
    expect(
      screen.getByText(/שולי רווח תפעולי: המדד ליעילות ויציבות/i)
    ).toBeTruthy()

    // 6. Share Dilution Tooltip
    expect(
      screen.getByText(/דילול מניות: כשהחברה מנפיקה עוד מניות/i)
    ).toBeTruthy()

    // 7. Balance Sheet / Current Ratio Tooltip
    expect(
      screen.getByText(/יחס שוטף \(Current Ratio\): אנחנו רוצים לישון בשקט בלילה/i)
    ).toBeTruthy()
  })

  it('computes and updates metrics when real companyFacts are provided', () => {
    const customFacts = {
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2024, value: 500000000 },
            { fiscalYear: 2023, value: 400000000 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2024, value: 25000000 }, // 5% margin -> fail (<10%)
            { fiscalYear: 2023, value: 20000000 },
          ],
        },
        weightedAverageSharesDiluted: {
          annual: [
            { fiscalYear: 2024, value: 95000000 }, // decreasing -> buybacks (pass)
            { fiscalYear: 2023, value: 100000000 },
          ],
        },
        currentAssets: {
          annual: [{ fiscalYear: 2024, value: 89000000 }],
        },
        currentLiabilities: {
          annual: [{ fiscalYear: 2024, value: 100000000 }], // 0.89x -> fail (< 1.0)
        },
      },
    }

    render(<Step1Triage company={mockCompany} companyFacts={customFacts} />)

    // 2 of 4 passed (Revenue & Buybacks passed; Margins 5% & CR 0.89x failed)
    expect(screen.getByText('2 of 4 Passed')).toBeTruthy()
    expect(screen.getByText('+25% YoY')).toBeTruthy()
    expect(screen.getByText('5%+')).toBeTruthy()
    expect(screen.getByText('Low Margins')).toBeTruthy()
    expect(screen.getByText('Share Buybacks')).toBeTruthy()
    expect(screen.getByText('0.89x')).toBeTruthy()
    expect(screen.getByText('At Risk (< 1.0)')).toBeTruthy()
    expect(screen.getByText('Target: > 1.0')).toBeTruthy()
  })

  it('renders The Gatekeeper button and calls onContinue when clicked', () => {
    const handleContinue = vi.fn()
    render(<Step1Triage company={mockCompany} onContinue={handleContinue} />)

    const continueBtn = screen.getByRole('button', {
      name: /I understand how this company makes money - Continue/i,
    })
    expect(continueBtn).toBeTruthy()

    fireEvent.click(continueBtn)
    expect(handleContinue).toHaveBeenCalledTimes(1)
  })

  it('hides admin controls for regular users and displays them when isAdmin is true', async () => {
    const { rerender } = render(<Step1Triage company={mockCompany} isAdmin={false} />)
    expect(screen.queryByTestId('admin-controls-panel')).not.toBeTruthy()

    rerender(
      <Step1Triage
        company={mockCompany}
        isAdmin={true}
        cacheMetadata={{ source: 'firestore' }}
        onForceRefreshCompany={vi.fn()}
      />
    )

    expect(screen.getByTestId('admin-controls-panel')).toBeTruthy()
    expect(screen.getByTestId('admin-refresh-ai-btn')).toBeTruthy()
    expect(screen.getByTestId('admin-force-refresh-company-btn')).toBeTruthy()
    expect(screen.getByTestId('admin-edgar-source-badge').textContent).toContain('firestore')
  })

  it('expands the Tear Sheet Blade (#319) to show segments, geography, Mermaid diagram, competitors, and moat breakdown', async () => {
    render(<Step1Triage company={mockCompany} />)

    const toggleBtn = await screen.findByTestId('toggle-tear-sheet-btn')
    expect(screen.getByTestId('moat-summary-badge')).toBeTruthy()
    expect(screen.getByTestId('business-model-traits')).toBeTruthy()

    fireEvent.click(toggleBtn)

    expect(screen.getByTestId('tear-sheet-expanded-content')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-segments-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-geo-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-mermaid-diagram')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-growth-engines-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-competitors-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-moat-sources')).toBeTruthy()
  })
})
