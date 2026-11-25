import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Step1Triage, tokenizeBidiText } from '../Step1Triage'
import { setCachedSummary } from '../../../services/aiSummaryService.js'

const mockMsftFacts = {
  metrics: {
    revenue: {
      annual: [
        { fiscalYear: 2015, value: 93580000000 },
        { fiscalYear: 2016, value: 95000000000 },
        { fiscalYear: 2017, value: 98000000000 },
        { fiscalYear: 2018, value: 110360000000 },
        { fiscalYear: 2019, value: 125843000000 },
        { fiscalYear: 2020, value: 143015000000 },
        { fiscalYear: 2021, value: 168088000000 },
        { fiscalYear: 2022, value: 198270000000 },
        { fiscalYear: 2023, value: 211915000000 },
        { fiscalYear: 2024, value: 245120000000 },
      ],
    },
    operatingIncome: {
      annual: [
        { fiscalYear: 2015, value: 32753000000 }, // 35.0%
        { fiscalYear: 2016, value: 33250000000 }, // 35.0%
        { fiscalYear: 2017, value: 34300000000 }, // 35.0%
        { fiscalYear: 2018, value: 38626000000 }, // 35.0%
        { fiscalYear: 2019, value: 44045000000 }, // 35.0%
        { fiscalYear: 2020, value: 52959000000 }, // 37.0%
        { fiscalYear: 2021, value: 69916000000 }, // 41.6%
        { fiscalYear: 2022, value: 83383000000 }, // 42.1%
        { fiscalYear: 2023, value: 88523000000 }, // 41.8%
        { fiscalYear: 2024, value: 109433000000 }, // 44.6% (spread 9.6pp, steady pass)
      ],
    },
    weightedAverageSharesDiluted: {
      annual: [
        { fiscalYear: 2015, value: 8027000000 },
        { fiscalYear: 2016, value: 7808000000 },
        { fiscalYear: 2017, value: 7708000000 },
        { fiscalYear: 2018, value: 7677000000 },
        { fiscalYear: 2019, value: 7643000000 },
        { fiscalYear: 2020, value: 7571000000 },
        { fiscalYear: 2021, value: 7547000000 },
        { fiscalYear: 2022, value: 7464000000 },
        { fiscalYear: 2023, value: 7440000000 },
        { fiscalYear: 2024, value: 7430000000 },
      ],
    },
    currentAssets: {
      annual: [
        { fiscalYear: 2023, value: 184257000000 },
        { fiscalYear: 2024, value: 180000000000 },
      ],
    },
    currentLiabilities: {
      annual: [
        { fiscalYear: 2023, value: 104149000000 },
        { fiscalYear: 2024, value: 100000000000 }, // 1.80x >= 1.5x -> pass
      ],
    },
  },
}

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

  it('renders the 4 Fast Fundamentals indicators from explicit MSFT facts in Hebrew by default with sparkline timelines and switches cleanly to English', () => {
    render(<Step1Triage company={mockCompany} companyFacts={mockMsftFacts} />)

    // Hebrew default Section 2 titles & targets
    expect(screen.getByText(/בדיקת נתוני בסיס מהירה/)).toBeTruthy()
    expect(screen.getByText('צמיחה בהכנסות')).toBeTruthy()
    expect(screen.getByText('שולי רווח תפעולי')).toBeTruthy()
    expect(screen.getByText('רכישה עצמית / דילול')).toBeTruthy()
    expect(screen.getByText('יחס שוטף (נזילות)')).toBeTruthy()
    expect(screen.getByText('4 מתוך 4 עברו')).toBeTruthy()
    const revCard = screen.getByTestId('fundamental-card-revenue-growth')
    const marginsCard = screen.getByTestId('fundamental-card-operating-margins')
    const sharesCard = screen.getByTestId('fundamental-card-share-dilution')
    const balanceCard = screen.getByTestId('fundamental-card-balance-sheet')

    expect(balanceCard.textContent).toContain('תנאי למעבר: מעל 1.5x')

    // Minimalist year timeline shown under sparkline + share buyback pace trend (no duplicate arrows)
    const revTimeline = screen.getByTestId('sparkline-timeline-revenue-growth')
    expect(revTimeline.textContent).toContain('2015')
    expect(revTimeline.textContent).toContain('2024')
    const shareTrendEl = screen.getByTestId('fundamental-trend-share-dilution')
    expect(shareTrendEl.textContent).toContain('קצב רכישה עצמית:')
    expect(shareTrendEl.textContent).not.toMatch(/[↓↑]/)

    // Check all 4 Hebrew descriptions + BiDi <bdi dir="ltr"> isolation (#344, #356) & pipe separator (#364)
    expect(revCard.textContent).toContain('(שנה אחרונה / YoY)')
    expect(revCard.textContent).toContain('צמיחה עקבית של ~16% בשנה')
    expect(revCard.textContent).toContain('צמיחה שנתית (CAGR) | ')
    expect(revCard.textContent).not.toContain('·')
    expect(marginsCard.textContent).toContain('שוליים יציבים מעל 40%')
    expect(marginsCard.textContent).toContain('ממוצע ')
    expect(marginsCard.textContent).toContain('הקו המקווקו בגרף')
    expect(marginsCard.textContent).not.toContain('·')
    expect(sharesCard.textContent).toContain('בכמות המניות (שנה אחרונה)')
    expect(sharesCard.textContent).toContain('פחות מניות מאז')
    expect(sharesCard.textContent).not.toMatch(/[↓↑]/)
    expect(balanceCard.textContent).toContain('יחס שוטף תקין ובטוח')
    expect(balanceCard.textContent).toContain('נכסים שוטפים מכסים בנוחות התחייבויות קרובות')

    // Verify Dedicated Status Legend in Hebrew (#364)
    const legendHe = screen.getByTestId('fundamentals-status-legend')
    expect(legendHe.textContent).toContain('ירוק — תקין')
    expect(legendHe.textContent).toContain('צהוב — אזהרה / למעקב')
    expect(legendHe.textContent).toContain('אדום — דגל אדום')
    expect(legendHe.textContent).toContain('אפור — חסר מידע')

    const bdiNodes = revCard.querySelectorAll('bdi[dir="ltr"]')
    expect(bdiNodes.length).toBeGreaterThan(0)
    expect(Array.from(bdiNodes).some((el) => el.textContent === 'CAGR')).toBe(true)
    expect(Array.from(bdiNodes).some((el) => el.textContent === 'YoY')).toBe(true)

    // Switch to English -> Section 2 + Status Legend translate seamlessly too
    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByText('Instant Fundamentals Check')).toBeTruthy()
    const legendEn = screen.getByTestId('fundamentals-status-legend')
    expect(legendEn.textContent).toContain('Green — Pass')
    expect(legendEn.textContent).toContain('Yellow — Caution / Watch')
    expect(legendEn.textContent).toContain('Red — Red Flag')
    expect(legendEn.textContent).toContain('Gray — No SEC Data')
    expect(screen.getByText('Revenue Growth', { selector: 'h4' })).toBeTruthy()
    expect(screen.getByText('Operating Margins', { selector: 'h4' })).toBeTruthy()
    expect(screen.getByText('Share Dilution', { selector: 'h4' })).toBeTruthy()
    expect(screen.getByText('Current Ratio (Liquidity)', { selector: 'h4' })).toBeTruthy()
    expect(screen.getByText('Target: >= 1.5x')).toBeTruthy()
    expect(screen.getByTestId('fundamental-trend-share-dilution').textContent).toContain('Buyback pace:')
  })

  it('renders neutral unavailable state (no fake MSFT fallback) and chart placeholders when companyFacts is null', () => {
    render(<Step1Triage company={mockCompany} companyFacts={null} />)

    const summaryBadge = screen.getByTestId('fundamentals-passed-badge')
    expect(summaryBadge.textContent).toContain('אין נתוני SEC זמינים')
    expect(summaryBadge.className).toContain('slate')

    for (const cardId of ['revenue-growth', 'operating-margins', 'share-dilution', 'balance-sheet']) {
      const card = screen.getByTestId(`fundamental-card-${cardId}`)
      expect(card.getAttribute('data-status')).toBe('unavailable')
      expect(card.textContent).toContain('אין נתוני SEC')
      expect(screen.getByTestId(`sparkline-unavailable-${cardId}`).textContent).toContain(
        'אין היסטוריית SEC להצגת גרף'
      )
    }

    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByTestId('fundamentals-passed-badge').textContent).toContain('No SEC Data Available')
    expect(screen.getByTestId('sparkline-unavailable-revenue-growth').textContent).toContain(
      'No SEC history available'
    )
  })

  it('renders educational tooltips with the required beginner-friendly Hebrew rationales and thresholds', async () => {
    render(<Step1Triage company={mockCompany} companyFacts={mockMsftFacts} />)

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

    // 4. Structured Revenue Growth Tooltip (bold title, explanation, colored threshold rows)
    const revTooltip = screen
      .getByTestId('fundamental-card-revenue-growth')
      .querySelector('[role="tooltip"]')
    expect(revTooltip).toBeTruthy()
    expect(revTooltip.textContent).toContain('צמיחה בהכנסות (Revenue Growth)')
    expect(revTooltip.textContent).toContain('YoY')
    expect(revTooltip.textContent).toContain('CAGR')
    expect(revTooltip.querySelector('.bg-emerald-400')).toBeTruthy()
    expect(revTooltip.querySelector('.bg-amber-400')).toBeTruthy()
    expect(revTooltip.querySelector('.bg-rose-400')).toBeTruthy()
    expect(revTooltip.textContent).toContain('ירוק:')
    expect(revTooltip.textContent).toContain('צהוב:')
    expect(revTooltip.textContent).toContain('אדום:')

    // 5. Structured Operating Margins Tooltip (dashed-line historical average explanation)
    const marginsTooltip = screen
      .getByTestId('fundamental-card-operating-margins')
      .querySelector('[role="tooltip"]')
    expect(marginsTooltip).toBeTruthy()
    expect(marginsTooltip.textContent).toContain('שולי רווח תפעולי (Operating Margins)')
    expect(marginsTooltip.textContent).toContain('הקו המקווקו בגרף = הממוצע ההיסטורי לכל התקופה המוצגת')
    expect(marginsTooltip.querySelector('.bg-emerald-400')).toBeTruthy()
    expect(marginsTooltip.textContent).toContain('ירוק:')
    expect(marginsTooltip.textContent).toContain('צהוב:')
    expect(marginsTooltip.textContent).toContain('אדום:')

    // 6. Structured Share Dilution Tooltip (explains annual vs cumulative & Buybacks)
    const sharesTooltip = screen
      .getByTestId('fundamental-card-share-dilution')
      .querySelector('[role="tooltip"]')
    expect(sharesTooltip).toBeTruthy()
    expect(sharesTooltip.textContent).toContain('דילול מניות ורכישה עצמית (Buybacks)')
    expect(sharesTooltip.textContent).toContain('Buybacks')
    expect(sharesTooltip.textContent).toContain('השינוי השנתי')
    expect(sharesTooltip.querySelector('.bg-amber-400')).toBeTruthy()
    expect(sharesTooltip.textContent).toContain('ירוק:')
    expect(sharesTooltip.textContent).toContain('צהוב:')
    expect(sharesTooltip.textContent).toContain('אדום:')

    // 7. Structured Balance Sheet / Current Ratio Tooltip
    const crTooltip = screen
      .getByTestId('fundamental-card-balance-sheet')
      .querySelector('[role="tooltip"]')
    expect(crTooltip).toBeTruthy()
    expect(crTooltip.textContent).toContain('יחס שוטף / נזילות (Current Ratio)')
    expect(crTooltip.textContent).toContain('1.5x')
    expect(crTooltip.querySelector('.bg-rose-400')).toBeTruthy()
    expect(crTooltip.textContent).toContain('ירוק:')
    expect(crTooltip.textContent).toContain('צהוב:')
    expect(crTooltip.textContent).toContain('אדום:')

    // Switch to English -> structured KPI tooltips translate cleanly
    fireEvent.click(screen.getByTestId('lang-btn-en'))
    const revTooltipEn = screen
      .getByTestId('fundamental-card-revenue-growth')
      .querySelector('[role="tooltip"]')
    expect(revTooltipEn.textContent).toContain('Revenue Growth')
    expect(revTooltipEn.textContent).toContain('Green:')
    expect(revTooltipEn.textContent).toContain('Yellow:')
    expect(revTooltipEn.textContent).toContain('Red:')
  })

  it('computes and updates metrics when real companyFacts are provided (including 4-state styling)', () => {
    const customFacts = {
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2024, value: 500000000 },
            { fiscalYear: 2023, value: 400000000 }, // +25% YoY -> pass
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
            { fiscalYear: 2024, value: 101500000 }, // +1.5% dilution -> warn
            { fiscalYear: 2023, value: 100000000 },
          ],
        },
        // currentAssets / currentLiabilities omitted -> unavailable
      },
    }

    render(<Step1Triage company={mockCompany} companyFacts={customFacts} />)

    // 1 of 3 available passed (1 pass, 1 warn, 1 fail, 1 unavailable)
    const passedBadge = screen.getByTestId('fundamentals-passed-badge')
    expect(passedBadge.textContent).toContain('1 מתוך 3 עברו')
    expect(passedBadge.className).toContain('rose')

    const revCard = screen.getByTestId('fundamental-card-revenue-growth')
    const marginsCard = screen.getByTestId('fundamental-card-operating-margins')
    const sharesCard = screen.getByTestId('fundamental-card-share-dilution')
    const balanceCard = screen.getByTestId('fundamental-card-balance-sheet')

    expect(revCard.getAttribute('data-status')).toBe('pass')
    expect(revCard.innerHTML).toContain('emerald')
    expect(revCard.textContent).toContain('+25% (שנה אחרונה / YoY)')
    const revBdiTexts = Array.from(revCard.querySelectorAll('bdi[dir="ltr"]')).map((el) => el.textContent)
    expect(revBdiTexts).toContain('+25%')
    expect(revBdiTexts).toContain('YoY')

    expect(marginsCard.getAttribute('data-status')).toBe('fail')
    expect(marginsCard.innerHTML).toContain('rose')
    expect(marginsCard.textContent).toContain('5.0%')
    expect(marginsCard.textContent).toContain('שוליים נמוכים')

    expect(sharesCard.getAttribute('data-status')).toBe('warn')
    expect(sharesCard.innerHTML).toContain('amber')
    expect(sharesCard.textContent).toContain('דילול מתון')
    expect(sharesCard.textContent).toContain('+1.5% בכמות המניות (שנה אחרונה)')
    expect(sharesCard.textContent).not.toMatch(/[↓↑]/)

    expect(balanceCard.getAttribute('data-status')).toBe('unavailable')
    expect(balanceCard.innerHTML).toContain('slate')
    expect(balanceCard.textContent).toContain('אין נתוני SEC')

    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByText('1 of 3 Passed')).toBeTruthy()
    expect(screen.getByText('+25% YoY')).toBeTruthy()
    expect(screen.getByText('5.0%')).toBeTruthy()
    expect(screen.getByText('Low Margins')).toBeTruthy()
    expect(screen.getByText('Moderate Dilution')).toBeTruthy()
    expect(screen.getByText('+1.5% shares (YoY)')).toBeTruthy()
    expect(screen.getByText('Target: >= 1.5x')).toBeTruthy()
  })

  it('tokenizeBidiText keeps Hebrew prefix + hyphen RTL and isolates AER negative/positive percentages cleanly', () => {
    // AER canonical failure fix: ל-48.0% must NEVER become ל-48.0%-
    expect(tokenizeBidiText('בין -14.3% ל-48.0%')).toEqual([
      { text: 'בין ', isLtr: false },
      { text: '-14.3%', isLtr: true },
      { text: ' ל-', isLtr: false },
      { text: '48.0%', isLtr: true },
    ])

    expect(tokenizeBidiText('ל-48.0%')).toEqual([
      { text: 'ל-', isLtr: false },
      { text: '48.0%', isLtr: true },
    ])
    expect(tokenizeBidiText('מ-10%')).toEqual([
      { text: 'מ-', isLtr: false },
      { text: '10%', isLtr: true },
    ])
    expect(tokenizeBidiText('ב-9 ש׳')).toEqual([
      { text: 'ב-', isLtr: false },
      { text: '9', isLtr: true },
      { text: ' ש׳', isLtr: false },
    ])
    expect(tokenizeBidiText('ל-1.0')).toEqual([
      { text: 'ל-', isLtr: false },
      { text: '1.0', isLtr: true },
    ])
    expect(tokenizeBidiText('(-14.3%)')).toEqual([
      { text: '(', isLtr: false },
      { text: '-14.3%', isLtr: true },
      { text: ')', isLtr: false },
    ])
    expect(tokenizeBidiText('טווח 2015–2024 וגם -14.3%–48.0% וגם 1.0x–1.5x')).toEqual([
      { text: 'טווח ', isLtr: false },
      { text: '2015–2024', isLtr: true },
      { text: ' וגם ', isLtr: false },
      { text: '-14.3%–48.0%', isLtr: true },
      { text: ' וגם ', isLtr: false },
      { text: '1.0x–1.5x', isLtr: true },
    ])
    expect(tokenizeBidiText('תשואה +25% או -5.0% עם $50M ו-€10B בדוח 10-K (CAGR / YoY)')).toEqual([
      { text: 'תשואה ', isLtr: false },
      { text: '+25%', isLtr: true },
      { text: ' או ', isLtr: false },
      { text: '-5.0%', isLtr: true },
      { text: ' עם ', isLtr: false },
      { text: '$50M', isLtr: true },
      { text: ' ו-', isLtr: false },
      { text: '€10B', isLtr: true },
      { text: ' בדוח ', isLtr: false },
      { text: '10-K', isLtr: true },
      { text: ' (', isLtr: false },
      { text: 'CAGR', isLtr: true },
      { text: ' / ', isLtr: false },
      { text: 'YoY', isLtr: true },
      { text: ')', isLtr: false },
    ])
    expect(tokenizeBidiText('ממוצע רב-שנתי')).toEqual([
      { text: 'ממוצע רב-שנתי', isLtr: false },
    ])

    // Render AER-like operating margin data in DOM and verify <bdi dir="ltr"> isolation
    const aerFacts = {
      metrics: {
        revenue: {
          annual: [
            { fiscalYear: 2020, value: 4500000000 },
            { fiscalYear: 2024, value: 4100000000 },
          ],
        },
        operatingIncome: {
          annual: [
            { fiscalYear: 2020, value: -643500000 }, // -14.3%
            { fiscalYear: 2024, value: 1968000000 }, // 48.0%
          ],
        },
      },
    }

    render(<Step1Triage company={{ ticker: 'AER', name: 'AerCap Holdings' }} companyFacts={aerFacts} />)
    const marginsCard = screen.getByTestId('fundamental-card-operating-margins')
    expect(marginsCard.getAttribute('data-status')).toBe('fail')
    expect(marginsCard.textContent).toContain('תנודתיים (שנת הפסד)')
    expect(marginsCard.textContent).toContain('בין -14.3% ל-48.0%')

    const bdiTexts = Array.from(marginsCard.querySelectorAll('bdi[dir="ltr"]')).map((el) => el.textContent)
    expect(bdiTexts).toContain('-14.3%')
    expect(bdiTexts).toContain('48.0%')
    expect(bdiTexts.some((txt) => txt.startsWith('-48.0'))).toBe(false)
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

  it('renders mobile/tablet tooltips via Portal in document.body with backdrop, close button, and Escape dismissal (#327)', async () => {
    render(<Step1Triage company={mockCompany} />)

    const moatBadge = await screen.findByTestId('moat-summary-badge')
    const allInlineTooltips = screen.getAllByRole('tooltip')
    expect(allInlineTooltips.length).toBeGreaterThan(0)
    for (const tip of allInlineTooltips) {
      expect(tip.className).toContain('lg:absolute')
    }

    // Portal sheet is closed initially
    expect(screen.queryByTestId('tooltip-portal-sheet')).toBeNull()

    // Tap first educational info button -> mounts Portal backdrop & sheet in document.body
    const infoButtons = screen.getAllByRole('button', { name: /educational rationale/i })
    fireEvent.click(infoButtons[0])
    const sheet = await screen.findByTestId('tooltip-portal-sheet')
    const backdrop = screen.getByTestId('tooltip-portal-backdrop')
    expect(infoButtons[0].parentElement.contains(sheet)).toBe(false)
    expect(document.body.contains(sheet)).toBe(true)
    expect(sheet.className).toContain('max-h-[75dvh]')
    expect(backdrop.className).toContain('safe-area-inset-bottom')

    // Tapping close button dismisses Portal tooltip cleanly
    const closeBtn = screen.getByRole('button', { name: 'סגור הסבר' })
    fireEvent.click(closeBtn)
    expect(screen.queryByTestId('tooltip-portal-sheet')).toBeNull()

    // Tap again -> clicking backdrop dismisses, clicking sheet inside does NOT dismiss
    fireEvent.click(infoButtons[0])
    expect(screen.getByTestId('tooltip-portal-sheet')).toBeTruthy()
    fireEvent.click(screen.getByTestId('tooltip-portal-sheet'))
    expect(screen.getByTestId('tooltip-portal-sheet')).toBeTruthy()
    fireEvent.click(screen.getByTestId('tooltip-portal-backdrop'))
    expect(screen.queryByTestId('tooltip-portal-sheet')).toBeNull()

    // Tapping moat badge opens Portal sheet without expanding Tear Sheet, and Escape closes it
    fireEvent.click(moatBadge)
    expect(screen.getByTestId('tooltip-portal-sheet')).toBeTruthy()
    expect(screen.queryByTestId('tear-sheet-expanded-content')).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('tooltip-portal-sheet')).toBeNull()

    // Tapping a Section 2 Fundamental KPI info button renders structured title, description, and threshold rows inside Portal sheet (#364)
    const revInfoBtn = screen
      .getByTestId('fundamental-card-revenue-growth')
      .querySelector('button[aria-label="Educational rationale"]')
    expect(revInfoBtn).toBeTruthy()
    fireEvent.click(revInfoBtn)
    const kpiPortalSheet = await screen.findByTestId('tooltip-portal-sheet')
    expect(kpiPortalSheet.textContent).toContain('צמיחה בהכנסות (Revenue Growth)')
    expect(kpiPortalSheet.querySelector('.bg-emerald-400')).toBeTruthy()
    expect(kpiPortalSheet.querySelector('.bg-amber-400')).toBeTruthy()
    expect(kpiPortalSheet.querySelector('.bg-rose-400')).toBeTruthy()
    expect(kpiPortalSheet.textContent).toContain('ירוק:')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('tooltip-portal-sheet')).toBeNull()
  })

  it('dynamically renders actual SEC filing forms (20-F for SAP, 40-F for SHOP, 10-K for MSFT) across grounding, admin monitor, and Tear Sheet headers (#369)', async () => {
    // 1. Foreign Private Issuer: SAP SE (Form 20-F + 6-K)
    await setCachedSummary('SAP', {
      ticker: 'SAP',
      summary: 'סאפ מספקת תוכנות ERP ארגוניות וענן גלובלי.',
      keyEngines: ['Cloud ERP Suite', 'Business Technology Platform'],
      revenueSegments: [
        { name: 'Applications, Technology & Support', pct: 86 },
        { name: 'Qualtrics & Services', pct: 14 },
      ],
      competitors: [{ name: 'ORCL', relativeSize: 'larger', summary: 'Enterprise ERP' }],
      source: 'ai-live',
      ingestionStatus: {
        tenK: { status: 'ok', form: '20-F', date: '2026-02-26', url: 'https://www.sec.gov/sap-20f' },
        eightK: { status: 'missing', form: '6-K' },
        transcript: { status: 'missing' },
      },
    })

    const { unmount } = render(
      <Step1Triage company={{ ticker: 'SAP', name: 'SAP SE' }} isAdmin={true} />
    )

    await screen.findByText('סאפ מספקת תוכנות ERP ארגוניות וענן גלובלי.')
    expect(screen.getByTestId('grounding-subtitle').textContent).toContain('דוח 20-F')
    expect(screen.getByTestId('grounding-subtitle').textContent).not.toContain('10-K')
    expect(screen.getByRole('link', { name: /SEC 20-F/ })).toBeTruthy()

    const sapGroundingBadge = screen.getByTestId('data-grounding-badge')
    const sapGroundingTip = sapGroundingBadge.parentElement.querySelector('[role="tooltip"]')
    expect(sapGroundingTip.textContent).toContain('דוח שנתי SEC 20-F (סעיפים 3, 4, 5)')
    expect(sapGroundingTip.textContent).toContain('דיווח כספי רבעוני SEC 6-K')
    expect(sapGroundingTip.textContent).not.toContain('סעיפים 1, 1A, 7')
    expect(sapGroundingTip.textContent).not.toContain('Item 2.02')

    expect(screen.getByTestId('admin-tenk-status').textContent).toContain('20-F (Item 3/4/5):')
    expect(screen.getByTestId('admin-transcript-status').textContent).toContain('שיחת ועידה / 6-K:')

    fireEvent.click(screen.getByTestId('toggle-tear-sheet-btn'))
    expect(screen.getByTestId('tear-sheet-segments-card').textContent).toContain(
      'פילוח הכנסות לפי מגזרים (20-F)'
    )
    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByTestId('grounding-subtitle').textContent).toContain('SEC 20-F')
    expect(screen.getByTestId('tear-sheet-segments-card').textContent).toContain('20-F Segment Mix')
    expect(screen.getByTestId('tear-sheet-competitors-card').textContent).toContain(
      'Competitive Landscape (20-F Peers)'
    )
    unmount()

    // 2. Canadian MJDS Issuer: SHOP (Form 40-F — generic annual report label without 10-K Item numbers)
    await setCachedSummary('SHOP', {
      ticker: 'SHOP',
      summary: 'שופיפיי מספקת פלטפורמת מסחר אלקטרוני לסוחרים.',
      keyEngines: ['Subscription Solutions', 'Merchant Solutions'],
      revenueSegments: [{ name: 'Merchant Solutions', pct: 74 }],
      competitors: [{ name: 'AMZN', relativeSize: 'larger', summary: 'Commerce platform' }],
      source: 'ai-live',
      ingestionStatus: {
        tenK: { status: 'ok', form: '40-F', date: '2026-02-18', url: 'https://www.sec.gov/shop-40f' },
        eightK: { status: 'ok', form: '6-K', date: '2026-11-01' },
        transcript: { status: 'ok', source: 'SEC' },
      },
    })

    const shopRender = render(
      <Step1Triage company={{ ticker: 'SHOP', name: 'Shopify Inc.' }} isAdmin={true} />
    )
    await screen.findByText('שופיפיי מספקת פלטפורמת מסחר אלקטרוני לסוחרים.')
    expect(screen.getByTestId('grounding-subtitle').textContent).toContain('דוח 40-F')
    expect(screen.getByTestId('grounding-subtitle').textContent).not.toContain('10-K')
    const shopGroundingTip = screen
      .getByTestId('data-grounding-badge')
      .parentElement.querySelector('[role="tooltip"]')
    expect(shopGroundingTip.textContent).toContain('דוח שנתי SEC 40-F')
    expect(shopGroundingTip.textContent).not.toContain('1, 1A, 7')
    expect(screen.getByTestId('admin-tenk-status').textContent).toContain('40-F:')
    fireEvent.click(screen.getByTestId('toggle-tear-sheet-btn'))
    expect(screen.getByTestId('tear-sheet-segments-card').textContent).toContain('(40-F)')
    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByTestId('tear-sheet-competitors-card').textContent).toContain(
      'Competitive Landscape (40-F Peers)'
    )
    shopRender.unmount()

    // 3. US Filer: MSFT (Form 10-K retains Item 1, 1A, 7 and 10-K headings)
    await setCachedSummary('MSFT', {
      ticker: 'MSFT',
      summary: 'מייקרוסופט היא ענקית טכנולוגיה וענן.',
      keyEngines: ['Azure Cloud'],
      revenueSegments: [{ name: 'Intelligent Cloud', pct: 45 }],
      competitors: [{ name: 'GOOGL', relativeSize: 'similar', summary: 'Cloud & AI' }],
      source: 'ai-live',
      ingestionStatus: {
        tenK: { status: 'ok', form: '10-K', date: '2026-07-30', url: 'https://www.sec.gov/msft-10k' },
        eightK: { status: 'ok', form: '8-K', date: '2026-10-29' },
        transcript: { status: 'ok', source: 'FMP' },
      },
    })

    render(<Step1Triage company={mockCompany} isAdmin={true} />)
    await screen.findByText('מייקרוסופט היא ענקית טכנולוגיה וענן.')
    expect(screen.getByTestId('grounding-subtitle').textContent).toContain('דוח 10-K')
    const msftGroundingTip = screen
      .getByTestId('data-grounding-badge')
      .parentElement.querySelector('[role="tooltip"]')
    expect(msftGroundingTip.textContent).toContain('דוח שנתי SEC 10-K (סעיפים 1, 1A, 7)')
    expect(msftGroundingTip.textContent).toContain('דיווח כספי רבעוני SEC 8-K (Item 2.02)')
    expect(screen.getByTestId('admin-tenk-status').textContent).toContain('10-K (Item 1/1A/7):')
  })
})
