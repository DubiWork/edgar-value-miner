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

  it('renders the 4 Fast Fundamentals indicators in Hebrew by default with sparkline timelines and switches cleanly to English', () => {
    render(<Step1Triage company={mockCompany} />)

    // Hebrew default Section 2 titles & targets
    expect(screen.getByText(/בדיקת נתוני בסיס מהירה/)).toBeTruthy()
    expect(screen.getByText('צמיחה בהכנסות')).toBeTruthy()
    expect(screen.getByText('שולי רווח תפעולי')).toBeTruthy()
    expect(screen.getByText('רכישה עצמית / דילול')).toBeTruthy()
    expect(screen.getByText('יחס שוטף (נזילות)')).toBeTruthy()
    expect(screen.getByText('4 מתוך 4 עברו')).toBeTruthy()
    expect(screen.getByText('תנאי למעבר: מעל 1.0')).toBeTruthy()

    // Minimalist year timeline shown under sparkline
    const revTimeline = screen.getByTestId('sparkline-timeline-revenue-growth')
    expect(revTimeline.textContent).toContain('2015')
    expect(revTimeline.textContent).toContain('2024')

    // Check all 4 Hebrew descriptions
    expect(screen.getByText('צמיחה עקבית של ~14% בשנה')).toBeTruthy()
    expect(screen.getByText('שוליים יציבים מעל 40%')).toBeTruthy()
    expect(screen.getByText('החברה רוכשת מניות חזרה')).toBeTruthy()
    expect(screen.getByText('Current Ratio תקין > 1')).toBeTruthy()

    // Switch to English -> Section 2 translates seamlessly too
    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByText('Instant Fundamentals Check')).toBeTruthy()
    expect(screen.getByText('Revenue Growth')).toBeTruthy()
    expect(screen.getByText('Operating Margins')).toBeTruthy()
    expect(screen.getByText('Share Dilution')).toBeTruthy()
    expect(screen.getByText('Current Ratio (Liquidity)')).toBeTruthy()
    expect(screen.getByText('Target: > 1.0')).toBeTruthy()
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
      screen.getByText(/שולי רווח תפעולי: המדד ליעילות וכוח תמחור/i)
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

    // 2 of 4 passed in Hebrew default, and switch to English verifies English labels
    expect(screen.getByText('2 מתוך 4 עברו')).toBeTruthy()
    expect(screen.getByText('+25% בשנה')).toBeTruthy()
    expect(screen.getByText('5.0%')).toBeTruthy()
    expect(screen.getByText('שוליים נמוכים')).toBeTruthy()
    expect(screen.getByText('-5.0% מניות בשנה')).toBeTruthy()
    expect(screen.getByText('0.89x')).toBeTruthy()
    expect(screen.getByText('סיכון (< 1.0)')).toBeTruthy()
    expect(screen.getByText('תנאי למעבר: מעל 1.0')).toBeTruthy()

    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByText('2 of 4 Passed')).toBeTruthy()
    expect(screen.getByText('+25% YoY')).toBeTruthy()
    expect(screen.getByText('5%+')).toBeTruthy()
    expect(screen.getByText('Low Margins')).toBeTruthy()
    expect(screen.getByText('Share Buybacks')).toBeTruthy()
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

  it('expands the Tear Sheet Blade (#319) to show segments, geography, visual infographic, scaled competitors, jargon glossary, and omits redundant moat/mermaid-code blocks', async () => {
    render(<Step1Triage company={mockCompany} />)

    const toggleBtn = await screen.findByTestId('toggle-tear-sheet-btn')
    const moatBadge = screen.getByTestId('moat-summary-badge')
    expect(moatBadge).toBeTruthy()
    expect(screen.getByTestId('business-model-traits')).toBeTruthy()

    // Clicking the Moat informational badge must NOT unexpectedly expand the Tear Sheet
    fireEvent.click(moatBadge)
    expect(screen.queryByTestId('tear-sheet-expanded-content')).toBeNull()

    fireEvent.click(toggleBtn)

    expect(screen.getByTestId('tear-sheet-expanded-content')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-segments-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-geo-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-infographic')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-growth-engines-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-competitors-card')).toBeTruthy()
    expect(screen.getByTestId('tear-sheet-glossary-card')).toBeTruthy()

    // Redundant Mermaid raw code toggle and duplicate moat card are removed cleanly
    expect(screen.queryByText(/הצג קוד תרשים|View Mermaid Syntax/)).toBeNull()
    expect(screen.queryByTestId('tear-sheet-moat-sources')).toBeNull()
  })
})
