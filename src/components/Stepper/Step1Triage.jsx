import { useState, useMemo, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Check,
  Clock,
  RefreshCw,
  Database,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts'
import { calculateTriageMetrics } from '../../utils/triageCalculator.js'
import {
  getOrFetchCompanySummary,
  invalidateCachedSummary,
  getAiBudgetStatus,
  getCompanyContextStatus,
  refreshCompanyContext,
  saveManualTranscript,
  translateSummaryOnDemand,
  resolveTraitDisplay,
  translateMoatRating,
} from '../../services/aiSummaryService.js'

/**
 * Renders the company logo from FMP's stock image CDN with a clean ticker monogram fallback.
 */
function CompanyLogo({ ticker, companyName, isLoading }) {
  const [failedTicker, setFailedTicker] = useState(null)

  const normTicker = String(ticker || 'MS').toUpperCase().trim()
  const hasError = failedTicker === normTicker
  const logoUrl = `https://financialmodelingprep.com/image-stock/${encodeURIComponent(normTicker)}.png`

  return (
    <div
      data-testid="company-logo"
      className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-2xs shrink-0 ${
        isLoading ? 'animate-pulse' : ''
      }`}
    >
      {!hasError ? (
        <img
          src={logoUrl}
          alt={`${companyName || normTicker} logo`}
          className="w-7 h-7 object-contain"
          onError={() => setFailedTicker(normTicker)}
        />
      ) : (
        <span className="text-xs font-extrabold tracking-tight text-sky-700 dark:text-sky-300">
          {normTicker.slice(0, 4)}
        </span>
      )}
    </div>
  )
}

CompanyLogo.propTypes = {
  ticker: PropTypes.string.isRequired,
  companyName: PropTypes.string,
  isLoading: PropTypes.bool,
}

/**
 * Computes transparent data-grounding status from the summary source and SEC ingestionStatus.
 */
function buildGroundingInfo(aiSummary, ingestionStatus, lang, isLoading) {
  const isHe = lang === 'he'
  if (isLoading) {
    return {
      isMock: false,
      verifiedCount: 0,
      badgeLabel: isHe ? 'בודק מקורות מידע...' : 'Checking data sources...',
      subtitle: isHe ? 'מאמת זמינות דוח 10-K, 8-K ותמליל שיחת ועידה...' : 'Verifying SEC 10-K, 8-K & transcript sources...',
      toneClass:
        'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border-sky-300/40 dark:border-sky-800/50',
      checks: [],
    }
  }

  const effectiveSource =
    aiSummary?.source === 'cache' ? aiSummary?.originalSource || 'cache' : aiSummary?.source
  const isMock = effectiveSource === 'mock-preset' || effectiveSource === 'mock-dynamic'

  const hasTenK = !isMock && ingestionStatus?.tenK?.status === 'ok'
  const hasEightK =
    !isMock &&
    (ingestionStatus?.eightK?.status === 'ok' || ingestionStatus?.transcript?.status === 'fallback_8k')
  const hasTranscript =
    !isMock &&
    (ingestionStatus?.transcript?.status === 'ok' || ingestionStatus?.transcript?.status === 'manual')

  const checks = [
    {
      id: 'tenK',
      ok: hasTenK,
      label: isHe ? 'דוח שנתי SEC 10-K (סעיפים 1, 1A, 7)' : 'SEC 10-K Annual Report (Item 1, 1A, 7)',
      detail: hasTenK
        ? isHe
          ? `חולץ (${ingestionStatus.tenK.date || 'עדכני'})`
          : `Extracted (${ingestionStatus.tenK.date || 'Latest'})`
        : isMock
        ? isHe
          ? 'לא נשלף (תצוגת דוגמה)'
          : 'Not fetched (Demo preset)'
        : isHe
        ? 'טרם חולץ בשרת'
        : 'Not yet attached',
    },
    {
      id: 'eightK',
      ok: hasEightK,
      label: isHe ? 'דיווח כספי רבעוני SEC 8-K (Item 2.02)' : 'SEC 8-K Earnings Release (Item 2.02)',
      detail: hasEightK
        ? isHe
          ? `חולץ (${ingestionStatus.eightK?.date || ingestionStatus.transcript?.date || 'עדכני'})`
          : `Extracted (${ingestionStatus.eightK?.date || ingestionStatus.transcript?.date || 'Latest'})`
        : isMock
        ? isHe
          ? 'לא נשלף (תצוגת דוגמה)'
          : 'Not fetched (Demo preset)'
        : isHe
        ? 'לא זמין'
        : 'Unavailable',
    },
    {
      id: 'transcript',
      ok: hasTranscript,
      label: isHe ? 'תמליל שיחת ועידה (Earnings Call)' : 'Earnings Call Transcript',
      detail: hasTranscript
        ? isHe
          ? `זמין (${ingestionStatus.transcript.status === 'manual' ? 'הוזן ידנית' : ingestionStatus.transcript.source || 'רשמי'})`
          : `Available (${ingestionStatus.transcript.status === 'manual' ? 'Manual' : ingestionStatus.transcript.source || 'Verified'})`
        : !isMock && ingestionStatus?.transcript?.status === 'fallback_8k'
        ? isHe
          ? 'אין תמליל שיחה — הסתמכות על 8-K'
          : 'No transcript — using 8-K fallback'
        : isHe
        ? 'אין תמליל שיחת ועידה'
        : 'No earnings transcript available',
    },
  ]

  const verifiedCount = [hasTenK, hasEightK, hasTranscript].filter(Boolean).length

  if (isMock) {
    return {
      isMock: true,
      verifiedCount: 0,
      badgeLabel: isHe ? 'ביסוס נתונים: 0/3 (דוגמת תצוגה)' : 'Data Grounding: 0/3 (Demo)',
      subtitle: isHe
        ? 'תקציר דוגמה מובנה • ללא קריאת דוח 10-K או שיחת ועידה מה-SEC'
        : 'Structured demo summary • Live SEC 10-K & transcript not yet fetched',
      toneClass:
        'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
      checks,
    }
  }

  if (verifiedCount === 0) {
    return {
      isMock: false,
      verifiedCount: 0,
      badgeLabel: isHe ? 'ביסוס נתונים: 0/3 (AI כללי)' : 'Data Grounding: 0/3 (General AI)',
      subtitle: isHe
        ? 'ניתוח AI כללי • טרם צורפו דוחות 10-K או תמליל שיחת ועידה מהשרת'
        : 'General AI output • SEC 10-K and earnings call transcript not yet attached',
      toneClass:
        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      checks,
    }
  }

  const partsHe = [
    hasTenK ? 'דוח 10-K' : null,
    hasEightK ? 'דיווח 8-K' : null,
    hasTranscript ? 'תמליל שיחת ועידה' : null,
  ].filter(Boolean)

  const partsEn = [
    hasTenK ? 'SEC 10-K' : null,
    hasEightK ? '8-K Filing' : null,
    hasTranscript ? 'Earnings Call' : null,
  ].filter(Boolean)

  return {
    isMock: false,
    verifiedCount,
    badgeLabel: isHe
      ? `ביסוס נתונים: ${verifiedCount}/3 מקורות`
      : `Data Grounding: ${verifiedCount}/3 Sources`,
    subtitle: isHe
      ? `מבוסס בפועל על: ${partsHe.join(' + ')}${!hasTranscript ? ' • ללא תמליל שיחת ועידה' : ''}`
      : `Grounded in: ${partsEn.join(' + ')}${!hasTranscript ? ' • No Earnings Transcript' : ''}`,
    toneClass:
      verifiedCount === 3
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
        : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300/40 dark:border-sky-800/50',
    checks,
  }
}

/**
 * Parses a Mermaid `flowchart LR` / `graph LR` string into ordered flow nodes
 * so it can render as a crisp, zero-CDN interactive flowchart in the Tear Sheet.
 */
function parseMermaidFlowNodes(mermaidCode) {
  if (!mermaidCode || typeof mermaidCode !== 'string') return []
  const labelMatches = Array.from(mermaidCode.matchAll(/\["([^"]+)"\]|\[([^\]]+)\]/g))
  const seen = new Set()
  const nodes = []
  for (const m of labelMatches) {
    const label = (m[1] || m[2] || '').trim()
    if (label && !seen.has(label)) {
      seen.add(label)
      nodes.push(label)
    }
  }
  return nodes
}

/**
 * InfoTooltip Component
 * Subtle info ("i") icon with a floating dark tooltip bubble on hover/focus.
 */
function InfoTooltip({ text, align = 'center', dir = 'rtl' }) {
  const alignClasses = {
    left: 'left-0 sm:-left-3',
    right: 'right-0 sm:-right-3',
    start: 'start-0',
    end: 'end-0',
    center: 'left-1/2 -translate-x-1/2',
  }[align] || 'left-1/2 -translate-x-1/2'

  const arrowClasses = {
    left: 'left-3 sm:left-4',
    right: 'right-3 sm:right-4',
    start: 'start-3',
    end: 'end-3',
    center: 'left-1/2 -translate-x-1/2',
  }[align] || 'left-1/2 -translate-x-1/2'

  return (
    <span className="relative inline-flex items-center group/tooltip">
      <button
        type="button"
        aria-label="Educational rationale"
        className="text-slate-400 hover:text-sky-500 dark:text-slate-500 dark:hover:text-sky-400 transition-colors p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-help"
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.5" r="0.85" fill="currentColor" />
        </svg>
      </button>

      {/* Floating Tooltip Bubble */}
      <span
        role="tooltip"
        dir={dir}
        className={`pointer-events-none absolute bottom-full mb-2 ${alignClasses} w-64 sm:w-72 p-3 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs rounded-xl shadow-xl border border-slate-700/60 dark:border-slate-800 ${
          dir === 'rtl' ? 'text-right' : 'text-left'
        } opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-all duration-200 z-50 font-sans font-normal normal-case tracking-normal`}
      >
        {text}
        {/* Tooltip Downward Arrow */}
        <span
          className={`absolute top-full ${arrowClasses} border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-950/95`}
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

InfoTooltip.propTypes = {
  text: PropTypes.string.isRequired,
  align: PropTypes.oneOf(['left', 'right', 'start', 'end', 'center']),
  dir: PropTypes.oneOf(['rtl', 'ltr']),
}

/**
 * Step1Triage - 10-Second Gatekeeper & Business Clarity Screen
 * Inspired by Stock Simplifier's guided investment flow.
 *
 * Focuses strictly on:
 * 1. Circle of Competence (Do I understand how they make money? AI Summary with Skeleton Loader)
 * 2. 4 Instant Fundamental Health Checks (Revenue, Margins, Shares, Liquidity)
 * 3. 10-15 Year Sparklines with YAxis domain for clear trends
 * 4. The Gatekeeper CTA to unlock deep research
 */
export function Step1Triage({
  company = {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology · Infrastructure Software',
  },
  companyFacts = null,
  onContinue,
  isAdmin = false,
  cacheMetadata = null,
  onForceRefreshCompany = null,
  isRefreshingCompany = false,
}) {
  const [hasAcknowledged, setHasAcknowledged] = useState(false)
  const [aiSummary, setAiSummary] = useState(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [adminStatusMessage, setAdminStatusMessage] = useState(null)
  const [aiBudget, setAiBudget] = useState(null)
  const [ingestionStatus, setIngestionStatus] = useState(null)
  const [showManualUpload, setShowManualUpload] = useState(false)
  const [manualTranscriptInput, setManualTranscriptInput] = useState('')
  const [isSavingTranscript, setIsSavingTranscript] = useState(false)
  const [isBladeOpen, setIsBladeOpen] = useState(false)
  const [lang, setLang] = useState('he')
  const [isTranslating, setIsTranslating] = useState(false)
  const [showRawMermaid, setShowRawMermaid] = useState(false)

  const ticker = company?.ticker || companyFacts?.ticker || 'MSFT'
  const companyName = company?.name || companyFacts?.companyName || ticker

  const refreshAdminBudget = useCallback(async () => {
    if (!isAdmin) return
    const [status, ctxStatus] = await Promise.all([
      getAiBudgetStatus(),
      getCompanyContextStatus(ticker),
    ])
    if (status) {
      setAiBudget(status)
    }
    if (ctxStatus) {
      setIngestionStatus(ctxStatus)
    }
  }, [isAdmin, ticker])

  useEffect(() => {
    if (isAdmin) {
      refreshAdminBudget()
    }
  }, [isAdmin, refreshAdminBudget])

  // Fetch or load from cache AI summary on ticker change + sync server grounding status
  useEffect(() => {
    let isCancelled = false
    setIsLoadingSummary(true)
    setAdminStatusMessage(null)
    setIngestionStatus(null)

    getOrFetchCompanySummary(ticker, {
      name: companyName,
      sector: company?.sector,
    })
      .then(async (result) => {
        if (isCancelled) return
        setAiSummary(result)
        if (result?.ingestionStatus) {
          setIngestionStatus(result.ingestionStatus)
        } else {
          const ctxStatus = await getCompanyContextStatus(ticker)
          if (!isCancelled && ctxStatus) {
            setIngestionStatus(ctxStatus)
          }
        }
        setIsLoadingSummary(false)
        if (isAdmin) {
          refreshAdminBudget()
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('[Step1Triage] Error loading AI summary:', err)
          setIsLoadingSummary(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [ticker, companyName, company?.sector, isAdmin, refreshAdminBudget])

  // Admin handler: Clear cached AI summary for this ticker and force a fresh Vertex AI generation
  const handleRefreshAiSummary = useCallback(async () => {
    setIsLoadingSummary(true)
    setAdminStatusMessage('מנקה מטמון תקציר ופונה ל-Vertex AI...')
    try {
      const freshResult = await getOrFetchCompanySummary(
        ticker,
        {
          name: companyName,
          sector: company?.sector,
        },
        { forceRefresh: true }
      )
      setAiSummary(freshResult)
      await refreshAdminBudget()
      if (freshResult.source === 'ai-live') {
        setAdminStatusMessage(`תקציר AI חד-פעמי נוצר בהצלחה מ-Vertex AI ונשמר במטמון (${ticker}).`)
      } else if (freshResult.budgetExhausted) {
        setAdminStatusMessage(
          'הקריאה החוצה ל-Vertex AI נעצרה אוטומטית עקב סיום התקציב החודשי — מוצג המידע הקיים.'
        )
      } else {
        setAdminStatusMessage(
          `קריאת ה-AI החיה נכשלה (${freshResult.fallbackError || 'Unknown error'}) — הוחזר תקציר גיבוי (${freshResult.source}).`
        )
      }
    } catch (err) {
      console.error('[Step1Triage] Admin refresh AI summary failed:', err)
      setAdminStatusMessage(`שגיאה ברענון תקציר: ${err?.message || 'Unknown error'}`)
    } finally {
      setIsLoadingSummary(false)
    }
  }, [ticker, companyName, company?.sector, refreshAdminBudget])

  // Admin handler: Clear both EDGAR + AI caches and force refresh company facts from SEC into Firestore DB
  const handleFullCompanyCacheReset = useCallback(async () => {
    setAdminStatusMessage(`מנקה מטמון עבור ${ticker} ומרענן נתוני SEC + דוחות 10-K/8-K ל-Firestore...`)
    await invalidateCachedSummary(ticker)
    if (onForceRefreshCompany) {
      await onForceRefreshCompany(ticker)
    }
    const freshCtx = await refreshCompanyContext(ticker)
    if (freshCtx) {
      setIngestionStatus(freshCtx)
    }
    await handleRefreshAiSummary()
  }, [ticker, onForceRefreshCompany, handleRefreshAiSummary])

  const handleSaveManualTranscript = useCallback(async () => {
    if (!manualTranscriptInput.trim()) return
    setIsSavingTranscript(true)
    setAdminStatusMessage(`שומר תמליל שיחת ועידה ידני עבור ${ticker} ב-Firestore...`)
    try {
      const updatedStatus = await saveManualTranscript(ticker, manualTranscriptInput.trim())
      if (updatedStatus) {
        setIngestionStatus(updatedStatus)
      }
      setShowManualUpload(false)
      setManualTranscriptInput('')
      setAdminStatusMessage(`תמליל שיחת ועידה נשמר בהצלחה עבור ${ticker}. מרענן תקציר AI...`)
      await handleRefreshAiSummary()
    } catch (err) {
      setAdminStatusMessage(`שגיאה בשמירת תמליל ידני: ${err?.message || 'Unknown error'}`)
    } finally {
      setIsSavingTranscript(false)
    }
  }, [ticker, manualTranscriptInput, handleRefreshAiSummary])

  // Calculate real fundamental indicators & 10-15Y historical sparklines
  const triageData = useMemo(() => {
    return calculateTriageMetrics(companyFacts)
  }, [companyFacts])

  // 4 Fast Fundamentals Indicators with Sparklines
  const fundamentalIndicators = [
    {
      id: 'revenue-growth',
      title: triageData.revenue.title,
      status: triageData.revenue.status,
      value: triageData.revenue.value,
      target: triageData.revenue.target,
      badge: triageData.revenue.badge,
      detail: triageData.revenue.detail,
      metricSummary: triageData.revenue.metricSummary,
      sparkline: triageData.revenue.sparkline,
      tooltip:
        'צמיחה בהכנסות: עסק בריא הוא עסק שצומח. אנחנו מחפשים חברות שמצליחות להגדיל את ההכנסות (Top Line) בעקביות, מה שמעיד על ביקוש גובר למוצרים שלהן.',
      tooltipAlign: 'left',
      icon: TrendingUp,
    },
    {
      id: 'operating-margins',
      title: triageData.margins.title,
      status: triageData.margins.status,
      value: triageData.margins.value,
      target: triageData.margins.target,
      badge: triageData.margins.badge,
      detail: triageData.margins.detail,
      metricSummary: triageData.margins.metricSummary,
      sparkline: triageData.margins.sparkline,
      tooltip:
        'שולי רווח תפעולי: המדד ליעילות ויציבות. שולי רווח יציבים (או צומחים) לאורך זמן מעידים על חפיר כלכלי (יתרון תחרותי) חזק וכוח תמחור אל מול המתחרים.',
      tooltipAlign: 'left',
      icon: Percent,
    },
    {
      id: 'share-dilution',
      title: triageData.shares.title,
      status: triageData.shares.status,
      value: triageData.shares.value,
      target: triageData.shares.target,
      badge: triageData.shares.badge,
      detail: triageData.shares.detail,
      metricSummary: triageData.shares.metricSummary,
      sparkline: triageData.shares.sparkline,
      tooltip:
        'דילול מניות: כשהחברה מנפיקה עוד מניות, הנתח שלנו כמשקיעים קטן (דילול). באידיאל, נחפש חברות שלא מדללות באגרסיביות, או עדיף - חברות שרוכשות מניות חזרה (Buybacks) ומגדילות את חלקנו ברווח.',
      tooltipAlign: 'right',
      icon: Coins,
    },
    {
      id: 'balance-sheet',
      title: triageData.currentRatio.title,
      status: triageData.currentRatio.status,
      value: triageData.currentRatio.value,
      target: triageData.currentRatio.target,
      badge: triageData.currentRatio.badge,
      detail: triageData.currentRatio.detail,
      metricSummary: triageData.currentRatio.metricSummary,
      sparkline: triageData.currentRatio.sparkline,
      tooltip:
        'יחס שוטף (Current Ratio): אנחנו רוצים לישון בשקט בלילה. יחס שוטף מעל 1 אומר שלחברה יש מספיק נכסים נזילים כדי לכסות את התחייבויותיה הקרובות, ומונע סיכון מיידי של פשיטת רגל.',
      tooltipAlign: 'right',
      icon: ShieldCheck,
    },
  ]

  const passedCount = fundamentalIndicators.filter((i) => i.status === 'pass').length

  const handleLanguageSwitch = useCallback(
    async (nextLang) => {
      setLang(nextLang)
      if (
        nextLang === 'en' &&
        aiSummary &&
        (!aiSummary.translations?.en?.summary || aiSummary.translations?.en?._isFallbackTranslation)
      ) {
        setIsTranslating(true)
        try {
          const updated = await translateSummaryOnDemand(ticker, aiSummary, 'en')
          setAiSummary(updated)
        } finally {
          setIsTranslating(false)
        }
      }
    },
    [ticker, aiSummary]
  )

  const activeSummaryText =
    lang === 'en' && aiSummary?.translations?.en?.summary
      ? aiSummary.translations.en.summary
      : aiSummary?.summary

  const activeGrowthEngines =
    lang === 'en' && Array.isArray(aiSummary?.translations?.en?.growthEngines)
      ? aiSummary.translations.en.growthEngines
      : aiSummary?.growthEngines || []

  const activeMoat =
    lang === 'en' && aiSummary?.translations?.en?.moat
      ? aiSummary.translations.en.moat
      : aiSummary?.moat || null

  const grounding = useMemo(
    () => buildGroundingInfo(aiSummary, ingestionStatus, lang, isLoadingSummary),
    [aiSummary, ingestionStatus, lang, isLoadingSummary]
  )

  const mermaidNodes = useMemo(
    () => parseMermaidFlowNodes(aiSummary?.mermaidDiagram),
    [aiSummary?.mermaidDiagram]
  )

  const handleContinue = () => {
    setHasAcknowledged(true)
    if (onContinue) {
      onContinue()
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-4 animate-fade-in">
      {/* Stepper Header / Progress indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-400/10 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm border border-sky-500/20">
            01
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-sky-600 dark:text-sky-400">
                Step 1 of 5
              </span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                10-Second Triage
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {companyName}{' '}
              <span className="text-slate-400 dark:text-slate-500 font-normal">
                ({ticker})
              </span>
            </h1>
          </div>
        </div>

        {/* Mini Step Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-center bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-full border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="px-3 py-1 font-semibold rounded-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs">
            1. Triage
          </span>
          <span className="px-2.5 py-1 text-slate-400 dark:text-slate-500">
            2. Moat
          </span>
          <span className="px-2.5 py-1 text-slate-400 dark:text-slate-500">
            3. Financials
          </span>
          <span className="px-2.5 py-1 text-slate-400 dark:text-slate-500">
            4. Valuation
          </span>
        </div>
      </div>

      {/* ADMIN CONTROLS BAR (Visible only to authenticated Admin) */}
      {isAdmin && (
        <div
          dir="rtl"
          data-testid="admin-controls-panel"
          className="rounded-2xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-4 sm:p-5 shadow-xs space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    Admin Mode
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    ניהול מטמון ובקרת מקור נתונים ({ticker})
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    מקור תקציר AI:{' '}
                    <strong
                      data-testid="admin-ai-source-badge"
                      className={
                        aiSummary?.source === 'ai-live'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : aiSummary?.source === 'cache'
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {isLoadingSummary
                        ? 'טוען...'
                        : aiSummary?.source === 'cache'
                        ? `cache (מקור: ${aiSummary?.originalSource || 'unknown'})`
                        : aiSummary?.source || ' לא ידוע'}
                    </strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    מקור נתוני SEC:{' '}
                    <strong
                      data-testid="admin-edgar-source-badge"
                      className="text-slate-900 dark:text-slate-200"
                    >
                      {cacheMetadata?.source || 'לא ידוע'}
                    </strong>
                    {cacheMetadata?.lastUpdated && (
                      <> ({new Date(cacheMetadata.lastUpdated).toLocaleTimeString()})</>
                    )}
                  </span>
                  {aiBudget && (
                    <>
                      <span>&bull;</span>
                      <span data-testid="admin-ai-budget-badge">
                        תקציב AI:{' '}
                        <strong
                          className={
                            aiBudget.status === 'exhausted'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {aiBudget.status === 'exhausted'
                            ? `נגמר ($${aiBudget.spentUsd.toFixed(2)} / $${aiBudget.monthlyLimitUsd.toFixed(2)})`
                            : `פעיל ($${aiBudget.spentUsd.toFixed(3)} / $${aiBudget.monthlyLimitUsd.toFixed(2)} · ${aiBudget.totalCalls} קריאות)`}
                        </strong>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          (מתחדש ב-{new Date(aiBudget.resetsAt).toLocaleDateString('he-IL')}, בעוד{' '}
                          {aiBudget.daysUntilReset} ימים)
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="admin-refresh-ai-btn"
                onClick={handleRefreshAiSummary}
                disabled={isLoadingSummary || aiBudget?.status === 'exhausted'}
                title={
                  aiBudget?.status === 'exhausted'
                    ? 'תקציב ה-AI החודשי תם — הרענון החוצה חסום אוטומטית עד לחידוש התקציב'
                    : 'נקה מטמון וצור תקציר חדש מ-Vertex AI'
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-50 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? 'animate-spin' : ''}`} />
                <span>נקה ורענן תקציר AI</span>
              </button>

              {onForceRefreshCompany && (
                <button
                  type="button"
                  data-testid="admin-force-refresh-company-btn"
                  onClick={handleFullCompanyCacheReset}
                  disabled={isLoadingSummary || isRefreshingCompany}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>נקה מטמון ורענן נתוני חברה ל-DB</span>
                </button>
              )}
            </div>
          </div>

          {(aiBudget?.status === 'exhausted' || aiSummary?.budgetExhausted) && (
            <div
              data-testid="admin-budget-exhausted-banner"
              className="flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                תקציב ה-AI החודשי הסתיים — קריאות חדשות החוצה ל-Vertex AI נעצרו אוטומטית והמערכת משתמשת בנתונים הקיימים בלבד.
                {aiBudget?.resetsAt && (
                  <>
                    {' '}
                    התקציב יתחדש אוטומטית ב-
                    <strong>{new Date(aiBudget.resetsAt).toLocaleDateString('he-IL')}</strong> (בעוד{' '}
                    {aiBudget.daysUntilReset} ימים).
                  </>
                )}
              </span>
            </div>
          )}

          {aiSummary?.fallbackError && (
            <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                שגיאת קריאה ל-Vertex AI Cloud Function: <code dir="ltr">{aiSummary.fallbackError}</code>
              </span>
            </div>
          )}

          {adminStatusMessage && (
            <div
              data-testid="admin-status-message"
              className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-500/10 rounded-lg px-3 py-1.5"
            >
              {adminStatusMessage}
            </div>
          )}

          {/* Admin Document Ingestion Monitor (10-K / Transcript / 8-K) */}
          <div
            data-testid="admin-ingestion-monitor"
            className="pt-2 border-t border-amber-500/20 flex flex-col gap-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  ניטור קבצי מקור ב-DB:
                </span>
                <span data-testid="admin-tenk-status">
                  10-K (Item 1/1A/7):{' '}
                  <strong
                    className={
                      ingestionStatus?.tenK?.status === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {ingestionStatus?.tenK?.status === 'ok'
                      ? `תקין (${ingestionStatus.tenK.date || 'OK'})`
                      : ingestionStatus?.tenK?.error || 'טרם נשלף'}
                  </strong>
                </span>
                <span>&bull;</span>
                <span data-testid="admin-transcript-status">
                  שיחת ועידה / 8-K:{' '}
                  <strong
                    className={
                      ingestionStatus?.transcript?.status === 'ok' ||
                      ingestionStatus?.transcript?.status === 'manual'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : ingestionStatus?.transcript?.status === 'fallback_8k'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {ingestionStatus?.transcript?.status === 'ok'
                      ? `תמליל (${ingestionStatus.transcript.source})`
                      : ingestionStatus?.transcript?.status === 'manual'
                      ? `תמליל ידני (${ingestionStatus.transcript.date})`
                      : ingestionStatus?.transcript?.status === 'fallback_8k'
                      ? `גיבוי 8-K (${ingestionStatus.transcript.date})`
                      : ingestionStatus?.transcript?.error || 'חסר'}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                data-testid="admin-toggle-manual-transcript-btn"
                onClick={() => setShowManualUpload((prev) => !prev)}
                className="px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                {showManualUpload ? 'סגור הזנת תמליל' : '+ הזן תמליל שיחת ועידה ידנית'}
              </button>
            </div>

            {showManualUpload && (
              <div
                data-testid="admin-manual-transcript-panel"
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 space-y-2"
              >
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  הדבק טקסט שיחת ועידה (Earnings Call Transcript) עבור {ticker}:
                </label>
                <textarea
                  rows={4}
                  value={manualTranscriptInput}
                  onChange={(e) => setManualTranscriptInput(e.target.value)}
                  placeholder="Paste raw earnings call transcript text here..."
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSavingTranscript || !manualTranscriptInput.trim()}
                    onClick={handleSaveManualTranscript}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingTranscript ? 'שומר...' : 'שמור ב-Firestore ורענן AI'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 1: Business Clarity & Economic Moat Tear Sheet Blade (#319) */}
      <div
        data-testid="tear-sheet-blade"
        dir={lang === 'he' ? 'rtl' : 'ltr'}
        className="relative rounded-2xl border border-sky-500/20 bg-linear-to-b from-sky-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-900 shadow-sm p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <CompanyLogo ticker={ticker} companyName={companyName} isLoading={isLoadingSummary} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {lang === 'he'
                    ? 'בהירות עסקית (מעגל הכשירות)'
                    : 'Business Clarity (Circle of Competence)'}
                </h2>
                <InfoTooltip
                  text={
                    lang === 'he'
                      ? 'מעגל הכשירות: הכלל הראשון בהשקעות הוא לא להשקיע בעסק שאנחנו לא מבינים. המטרה היא לוודא שאנחנו יודעים להסביר בפשטות כיצד החברה מייצרת כסף. אם אי אפשר להסביר את זה בפשטות - עוברים הלאה.'
                      : 'Circle of Competence: Never invest in a business you cannot simply explain. Make sure you clearly understand how the company makes money before analyzing numbers.'
                  }
                  align="start"
                  dir={lang === 'he' ? 'rtl' : 'ltr'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span data-testid="grounding-subtitle">{grounding.subtitle}</span>
                {ingestionStatus?.tenK?.url && !grounding.isMock && (
                  <a
                    href={ingestionStatus.tenK.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="inline-flex items-center gap-0.5 font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    SEC {ingestionStatus.tenK.form || '10-K'} ↗
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Economic Moat Summary Badge (Clickable + Hover Explanation of the 5 Categories) */}
            {!isLoadingSummary && activeMoat?.rating && (
              <div className="relative group/moatbadge">
                <button
                  type="button"
                  data-testid="moat-summary-badge"
                  onClick={() => setIsBladeOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    {translateMoatRating(activeMoat.rating, lang)}
                    {activeMoat.score
                      ? lang === 'he'
                        ? ` (${activeMoat.score} מקורות)`
                        : ` (${activeMoat.score} Sources)`
                      : ''}
                  </span>
                </button>
                <div
                  role="tooltip"
                  dir={lang === 'he' ? 'rtl' : 'ltr'}
                  className={`pointer-events-none absolute top-full mt-2 end-0 w-72 p-3 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs rounded-xl shadow-xl border border-slate-700/60 ${
                    lang === 'he' ? 'text-right' : 'text-left'
                  } opacity-0 invisible group-hover/moatbadge:opacity-100 group-hover/moatbadge:visible group-focus-within/moatbadge:opacity-100 group-focus-within/moatbadge:visible transition-all duration-200 z-50 space-y-1.5`}
                >
                  <div className="font-bold text-emerald-300">
                    {lang === 'he'
                      ? 'ציון החפיר הכלכלי (מתוך 5 מקורות קלאסיים):'
                      : 'Economic Moat Score (Out of 5 Classic Sources):'}
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    {lang === 'he'
                      ? 'עלויות מעבר, אפקט רשת, יתרון עלות וגודל, נכסים בלתי מוחשיים ויעילות קנה מידה. לחץ כדי לפתוח את הפירוט המלא.'
                      : 'Switching Costs, Network Effects, Cost Advantage, Intangible Assets, and Efficient Scale. Click to open full breakdown.'}
                  </p>
                </div>
              </div>
            )}

            {/* On-Demand Language Toggle (HE | EN) */}
            <div
              data-testid="summary-language-toggle"
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-xs"
            >
              <button
                type="button"
                data-testid="lang-btn-he"
                onClick={() => handleLanguageSwitch('he')}
                className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                  lang === 'he'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                עב
              </button>
              <button
                type="button"
                data-testid="lang-btn-en"
                onClick={() => handleLanguageSwitch('en')}
                className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                  lang === 'en'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* Transparent Data Grounding Confidence Indicator (Replaces Core Model) */}
            {isLoadingSummary || isTranslating ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-300/40 dark:border-sky-800/50 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                {lang === 'he' ? 'מנתח...' : 'AI Thinking...'}
              </span>
            ) : (
              <div className="relative group/grounding">
                <button
                  type="button"
                  data-testid="data-grounding-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-help transition-colors ${grounding.toneClass}`}
                >
                  <span>{grounding.badgeLabel}</span>
                </button>
                <div
                  role="tooltip"
                  dir={lang === 'he' ? 'rtl' : 'ltr'}
                  className={`pointer-events-none absolute top-full mt-2 end-0 w-72 sm:w-80 p-3.5 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs rounded-xl shadow-xl border border-slate-700/60 ${
                    lang === 'he' ? 'text-right' : 'text-left'
                  } opacity-0 invisible group-hover/grounding:opacity-100 group-hover/grounding:visible group-focus-within/grounding:opacity-100 group-focus-within/grounding:visible transition-all duration-200 z-50 space-y-2`}
                >
                  <div className="font-bold text-sky-300 border-b border-slate-700/70 pb-1.5">
                    {lang === 'he'
                      ? 'שקיפות מקורות מידע וביסוס הניתוח:'
                      : 'Data Grounding & Source Verification:'}
                  </div>
                  <ul className="space-y-1.5">
                    {grounding.checks.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-200">
                          <span className={item.ok ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                            {item.ok ? '✓' : '✕'}
                          </span>
                          <span>{item.label}</span>
                        </span>
                        <span className={item.ok ? 'text-emerald-300 font-medium shrink-0' : 'text-slate-400 shrink-0'}>
                          {item.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 1. Business Model Trait Pill Badges with Localized Header, Tooltip & Hover Explanations */}
        <div
          data-testid="business-model-traits"
          className="flex flex-wrap items-center gap-2 mb-3 text-xs"
        >
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-semibold">
            <span>
              {lang === 'he' ? 'מאפייני המודל העסקי:' : 'Business Model Traits:'}
            </span>
            <InfoTooltip
              text={
                lang === 'he'
                  ? 'איך החברה בנויה להרוויח כסף (למשל: מכירה לארגונים B2B מול צרכנים B2C, הכנסות חוזרות ממנויים SaaS, או רווחיות תפעולית גבוהה). עמוד עם העכבר על כל תגית להסבר מפורט.'
                  : 'How the company is structured to earn money (e.g., B2B vs B2C, recurring SaaS vs transactional sales, or high operating margins). Hover any badge for details.'
              }
              align="start"
              dir={lang === 'he' ? 'rtl' : 'ltr'}
            />
          </span>
          {isLoadingSummary ? (
            <>
              <div className="h-5 w-28 bg-slate-200 dark:bg-slate-700/60 rounded-full animate-pulse" />
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700/60 rounded-full animate-pulse" />
            </>
          ) : (
            Array.isArray(aiSummary?.businessModelTraits) &&
            aiSummary.businessModelTraits.map((rawTrait) => {
              const traitInfo = resolveTraitDisplay(rawTrait, lang)
              return (
                <div key={traitInfo.key} className="relative group/trait inline-flex">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-colors cursor-help focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <span>{traitInfo.displayLabel}</span>
                    <span className="text-[10px] opacity-65 font-normal">ⓘ</span>
                  </button>
                  {traitInfo.explanation && (
                    <span
                      role="tooltip"
                      dir={lang === 'he' ? 'rtl' : 'ltr'}
                      className={`pointer-events-none absolute bottom-full mb-2 start-0 w-64 p-2.5 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs rounded-xl shadow-xl border border-slate-700/60 ${
                        lang === 'he' ? 'text-right' : 'text-left'
                      } opacity-0 invisible group-hover/trait:opacity-100 group-hover/trait:visible group-focus-within/trait:opacity-100 group-focus-within/trait:visible transition-all duration-200 z-50 font-normal`}
                    >
                      {traitInfo.explanation}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Elevator Pitch / Skeleton Loader (also shown while translating on-demand) */}
        {isLoadingSummary || isTranslating ? (
          <div
            data-testid="ai-summary-skeleton"
            className="rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-3"
          >
            {isTranslating && (
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
                {lang === 'en' ? 'Translating analysis to English...' : 'מתרגם את הניתוח לעברית...'}
              </p>
            )}
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-full animate-pulse" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-11/12 animate-pulse" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-3/4 animate-pulse" />
          </div>
        ) : (
          <div
            className={`rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 ${
              lang === 'he' ? 'text-right' : 'text-left'
            } font-sans space-y-2.5`}
          >
            <p className="text-base sm:text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
              {activeSummaryText}
            </p>
            {activeMoat && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                {activeMoat.summary && (
                  <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                    🛡️ {activeMoat.summary}
                  </p>
                )}

                {/* Transparent 5-Category Economic Moat Pills */}
                {Array.isArray(activeMoat.sources) && activeMoat.sources.length > 0 && (
                  <div
                    data-testid="moat-inline-categories"
                    className="flex flex-wrap items-center gap-1.5 text-[11px]"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {lang === 'he' ? '5 מקורות החפיר:' : '5 Moat Pillars:'}
                    </span>
                    {activeMoat.sources.map((src) => {
                      const label = lang === 'he' ? src.labelHe || src.name : src.labelEn || src.name
                      const defText =
                        lang === 'he' ? src.descriptionHe : src.descriptionEn
                      return (
                        <div key={src.name} className="relative group/moatcat inline-flex">
                          <button
                            type="button"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium cursor-help transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                              src.active
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/70'
                            }`}
                          >
                            <span>{src.active ? '✓' : '✕'}</span>
                            <span>{label}</span>
                          </button>
                          <div
                            role="tooltip"
                            dir={lang === 'he' ? 'rtl' : 'ltr'}
                            className={`pointer-events-none absolute bottom-full mb-2 start-0 w-64 sm:w-72 p-3 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs rounded-xl shadow-xl border border-slate-700/60 ${
                              lang === 'he' ? 'text-right' : 'text-left'
                            } opacity-0 invisible group-hover/moatcat:opacity-100 group-hover/moatcat:visible group-focus-within/moatcat:opacity-100 group-focus-within/moatcat:visible transition-all duration-200 z-50 space-y-1`}
                          >
                            <div className="font-bold text-emerald-300">
                              {label} ({src.name})
                            </div>
                            {defText && <div className="text-slate-400 text-[11px]">{defText}</div>}
                            {src.rationale && (
                              <div className="text-slate-100 pt-1 border-t border-slate-800">
                                {src.rationale}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Revenue Pillars / Core Revenue Streams */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-semibold">
              <span>
                {lang === 'he'
                  ? 'מקורות הכנסה עיקריים (מוצרי ליבה):'
                  : 'Core Revenue Streams:'}
              </span>
              <InfoTooltip
                text={
                  lang === 'he'
                    ? 'המוצרים, השירותים והחטיבות העיקריים שמייצרים לחברה הכנסות כיום. מנועי הצמיחה העתידיים של החברה מפורטים בתוך כרטיס הניתוח המלא.'
                    : 'The primary products, services, and divisions generating current revenue. Future growth drivers appear inside the Full Tear Sheet.'
                }
                align="start"
                dir={lang === 'he' ? 'rtl' : 'ltr'}
              />
            </span>
            {isLoadingSummary ? (
              <>
                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700/60 rounded-md animate-pulse" />
                <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700/60 rounded-md animate-pulse" />
                <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700/60 rounded-md animate-pulse" />
              </>
            ) : (
              aiSummary?.keyEngines?.map((engine, idx) => {
                const dotColors = ['bg-sky-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-amber-500']
                const dotClass = dotColors[idx % dotColors.length]
                return (
                  <span
                    key={engine}
                    dir="ltr"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    {engine}
                  </span>
                )
              })
            )}
          </div>

          {!isLoadingSummary && (
            <button
              type="button"
              data-testid="toggle-tear-sheet-btn"
              onClick={() => setIsBladeOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 hover:bg-sky-500/20 cursor-pointer transition-colors"
            >
              <span>
                {isBladeOpen
                  ? lang === 'he'
                    ? 'הסתר כרטיס ניתוח מלא'
                    : 'Hide Full Tear Sheet Blade'
                  : lang === 'he'
                  ? 'פתח כרטיס ניתוח מלא (מגזרים, גיאוגרפיה, זרימה וחפיר)'
                  : 'Open Full Tear Sheet Blade (Segments, Geo, Flow & Moat)'}
              </span>
            </button>
          )}
        </div>

        {/* EXPANDABLE GENERATIVE UI TEAR SHEET BLADE (Progressive Disclosure) */}
        {!isLoadingSummary && isBladeOpen && (
          <div
            data-testid="tear-sheet-expanded-content"
            className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-5 animate-fade-in"
          >
            {/* 2. Revenue Segments & Geographic Footprint Visual Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Revenue Segments Progress Bars */}
              <div
                data-testid="tear-sheet-segments-card"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    {lang === 'he'
                      ? 'פילוח הכנסות לפי מגזרים (10-K)'
                      : 'Revenue Segments Breakdown'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {lang === 'he' ? 'תמהיל חטיבות' : '10-K Segment Mix'}
                  </span>
                </div>
                <div className="space-y-2.5" dir="ltr">
                  {aiSummary?.revenueSegments?.map((seg, idx) => {
                    const barColors = [
                      'bg-sky-500',
                      'bg-emerald-500',
                      'bg-indigo-500',
                      'bg-amber-500',
                    ]
                    const barClass = barColors[idx % barColors.length]
                    const pctVal = Math.max(0, Math.min(100, Number(seg.pct) || 0))
                    return (
                      <div key={seg.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {seg.name}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {pctVal}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass}`}
                            style={{ width: `${pctVal}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Geographic Footprint Progress Bars */}
              <div
                data-testid="tear-sheet-geo-card"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {lang === 'he' ? 'פילוח הכנסות גיאוגרפי' : 'Geographic Footprint'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {lang === 'he' ? 'חלוקה גלובלית' : 'Global Revenue Split'}
                  </span>
                </div>
                <div className="space-y-2.5" dir="ltr">
                  {aiSummary?.geoBreakdown?.map((geo, idx) => {
                    const geoColors = [
                      'bg-indigo-500',
                      'bg-sky-500',
                      'bg-teal-500',
                      'bg-amber-500',
                    ]
                    const barClass = geoColors[idx % geoColors.length]
                    const pctVal = Math.max(0, Math.min(100, Number(geo.pct) || 0))
                    return (
                      <div key={geo.region} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {geo.region}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {pctVal}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass}`}
                            style={{ width: `${pctVal}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 3. Business Flow Diagram (Generative UI — Mermaid.js Flowchart) */}
            {aiSummary?.mermaidDiagram && (
              <div
                data-testid="tear-sheet-mermaid-diagram"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {lang === 'he'
                      ? 'תרשים זרימת הכסף בעסק (מודל ההכנסות)'
                      : 'Business Flow Diagram (Generative UI · Mermaid.js)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRawMermaid((prev) => !prev)}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    {showRawMermaid
                      ? lang === 'he'
                        ? 'הסתר קוד תרשים'
                        : 'Hide Mermaid Source'
                      : lang === 'he'
                      ? 'הצג קוד תרשים'
                      : 'View Mermaid Syntax'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 py-2" dir="ltr">
                  {mermaidNodes.map((nodeLabel, idx) => (
                    <div key={nodeLabel} className="flex items-center gap-2">
                      <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-500/30 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-2xs">
                        {nodeLabel}
                      </div>
                      {idx < mermaidNodes.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-sky-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {showRawMermaid && (
                  <pre dir="ltr" className="p-3 rounded-lg bg-slate-900 text-slate-200 text-xs overflow-x-auto font-mono">
                    {aiSummary.mermaidDiagram}
                  </pre>
                )}
              </div>
            )}

            {/* 4. Compact Cards Grid: Growth Engines, Competitive Landscape & Economic Moat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Growth Engines Card */}
              <div
                data-testid="tear-sheet-growth-engines-card"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2.5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {lang === 'he' ? 'מנועי צמיחה עתידיים' : 'Key Growth Engines'}
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {activeGrowthEngines.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Competitive Landscape (Competitor Chips/Tags) */}
              <div
                data-testid="tear-sheet-competitors-card"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2.5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {lang === 'he'
                    ? 'מפת תחרות ומתחרים עיקריים (10-K)'
                    : 'Competitive Landscape (10-K Peers)'}
                </h3>
                <div className="flex flex-wrap gap-2" dir="ltr">
                  {aiSummary?.competitors?.map((comp) => (
                    <span
                      key={comp}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25"
                    >
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Detailed Economic Moat Sources (All 5 Categories) & SEC Filing Citations */}
            {Array.isArray(activeMoat?.sources) && activeMoat.sources.length > 0 && (
              <div
                data-testid="tear-sheet-moat-sources"
                className="rounded-xl border border-emerald-500/25 bg-emerald-50/30 dark:bg-emerald-950/15 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {lang === 'he'
                      ? `פירוט 5 מקורות החפיר הכלכלי (${translateMoatRating(activeMoat.rating, 'he')} · ${activeMoat.score})`
                      : `Economic Moat Breakdown (${activeMoat.rating} · ${activeMoat.score})`}
                  </h3>
                  {ingestionStatus?.tenK?.url && !grounding.isMock && (
                    <a
                      href={ingestionStatus.tenK.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      SEC {ingestionStatus.tenK.form || '10-K'} ({ingestionStatus.tenK.date}) ↗
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeMoat.sources.map((src) => {
                    const sourceTitle =
                      lang === 'he'
                        ? `${src.labelHe || src.name} (${src.name})`
                        : src.labelEn || src.name
                    const sourceDesc =
                      lang === 'he' ? src.descriptionHe : src.descriptionEn
                    return (
                      <div
                        key={src.name}
                        className={`p-3 rounded-lg border space-y-1.5 ${
                          src.active
                            ? 'bg-white dark:bg-slate-900 border-emerald-500/25'
                            : 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-85'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {sourceTitle}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                              src.active
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {src.active
                              ? lang === 'he'
                                ? 'פעיל ✓'
                                : 'Active ✓'
                              : lang === 'he'
                              ? 'לא זוהה ✕'
                              : 'Inactive'}
                          </span>
                        </div>
                        {sourceDesc && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {sourceDesc}
                          </p>
                        )}
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {src.rationale}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: Fast Fundamentals Indicators (4 Grid Cards with Sparklines) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Instant Fundamentals Check
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              4 quick health checks with 10-15 year trendlines to eliminate weak candidates in under 10 seconds
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              passedCount === 4
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/20'
                : passedCount >= 2
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-500/20'
                : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-500/20'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {passedCount} of 4 Passed
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {fundamentalIndicators.map((indicator) => {
            const Icon = indicator.icon
            const isPass = indicator.status === 'pass'
            const sparklineColor = isPass ? '#10b981' : '#f43f5e'

            return (
              <div
                key={indicator.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Icon + Pass/Fail Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isPass
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isPass
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPass ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      {indicator.badge}
                    </span>
                  </div>

                  {/* Title + Info Tooltip */}
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {indicator.title}
                    </h4>
                    <InfoTooltip text={indicator.tooltip} align={indicator.tooltipAlign} />
                  </div>

                  {/* Highlight Value + Target Baseline */}
                  <div className="mt-0.5">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {indicator.value}
                    </div>
                    {indicator.target && (
                      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {indicator.target}
                      </div>
                    )}
                  </div>

                  {/* Micro Sparkline (10-15 Year Clean Trendline with YAxis domain) */}
                  {indicator.sparkline && indicator.sparkline.length > 1 && (
                    <div className="h-10 w-full my-2.5" aria-hidden="true">
                      <ResponsiveContainer width="100%" height={40}>
                        <LineChart
                          data={indicator.sparkline}
                          margin={{ top: 3, right: 2, bottom: 3, left: 2 }}
                        >
                          <YAxis domain={['dataMin', 'dataMax']} hide />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={sparklineColor}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Hebrew Quick Detail / Explanation */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <p
                    dir="rtl"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 text-right leading-relaxed"
                  >
                    {indicator.detail}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {indicator.metricSummary}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 3: The Gatekeeper (Bottom Action Button) */}
      <div className="pt-4 pb-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 sm:p-8 text-center max-w-2xl mx-auto shadow-xs">
          <div className="inline-flex p-3 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-3">
            <Check className="w-6 h-6 stroke-[2.5]" />
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Circle of Competence Gatekeeper
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            "Never invest in a business you cannot understand."
            <br />
            Confirm your comprehension of the revenue model to proceed to deep financial analysis.
          </p>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-md shadow-sky-600/20 hover:shadow-lg hover:shadow-sky-600/30 transition-all cursor-pointer text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <span>I understand how this company makes money - Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {hasAcknowledged && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3 animate-fade-in">
              Confirmed! Moving to next step...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

Step1Triage.propTypes = {
  company: PropTypes.shape({
    ticker: PropTypes.string,
    name: PropTypes.string,
    exchange: PropTypes.string,
    sector: PropTypes.string,
  }),
  companyFacts: PropTypes.object,
  onContinue: PropTypes.func,
  isAdmin: PropTypes.bool,
  cacheMetadata: PropTypes.object,
  onForceRefreshCompany: PropTypes.func,
  isRefreshingCompany: PropTypes.bool,
}

export default Step1Triage
