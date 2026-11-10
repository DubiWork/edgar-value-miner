import { useState, useMemo, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  Sparkles,
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
} from '../../services/aiSummaryService.js'

/**
 * InfoTooltip Component
 * Subtle info ("i") icon with a floating dark tooltip bubble on hover/focus.
 */
function InfoTooltip({ text, align = 'center' }) {
  const alignClasses = {
    left: 'left-0 sm:-left-3',
    right: 'right-0 sm:-right-3',
    center: 'left-1/2 -translate-x-1/2',
  }[align] || 'left-1/2 -translate-x-1/2'

  const arrowClasses = {
    left: 'left-3 sm:left-4',
    right: 'right-3 sm:right-4',
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
        dir="rtl"
        className={`pointer-events-none absolute bottom-full mb-2 ${alignClasses} w-64 sm:w-72 p-3 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xs rounded-xl shadow-xl border border-slate-700/60 dark:border-slate-800 text-right opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-all duration-200 z-50 font-sans font-normal normal-case tracking-normal`}
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
  align: PropTypes.oneOf(['left', 'right', 'center']),
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

  const ticker = company?.ticker || companyFacts?.ticker || 'MSFT'
  const companyName = company?.name || companyFacts?.companyName || ticker

  const refreshAdminBudget = useCallback(async () => {
    if (!isAdmin) return
    const status = await getAiBudgetStatus()
    if (status) {
      setAiBudget(status)
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) {
      refreshAdminBudget()
    }
  }, [isAdmin, refreshAdminBudget])

  // Fetch or load from cache AI summary on ticker change
  useEffect(() => {
    let isCancelled = false
    setIsLoadingSummary(true)
    setAdminStatusMessage(null)

    getOrFetchCompanySummary(ticker, {
      name: companyName,
      sector: company?.sector,
    })
      .then((result) => {
        if (!isCancelled) {
          setAiSummary(result)
          setIsLoadingSummary(false)
          if (isAdmin) {
            refreshAdminBudget()
          }
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
    setAdminStatusMessage(`מנקה מטמון עבור ${ticker} ומרענן נתוני SEC ל-Firestore...`)
    await invalidateCachedSummary(ticker)
    if (onForceRefreshCompany) {
      await onForceRefreshCompany(ticker)
    }
    await handleRefreshAiSummary()
  }, [ticker, onForceRefreshCompany, handleRefreshAiSummary])

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
        </div>
      )}

      {/* SECTION 1: Business Clarity (Circle of Competence) - AI Summary */}
      <div className="relative rounded-2xl border border-sky-500/20 bg-linear-to-b from-sky-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-900 shadow-sm p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 ${
                isLoadingSummary ? 'animate-pulse' : ''
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Business Clarity (Circle of Competence)
                </h2>
                <InfoTooltip
                  text="מעגל הכשירות: הכלל הראשון בהשקעות הוא לא להשקיע בעסק שאנחנו לא מבינים. המטרה היא לוודא שאנחנו יודעים להסביר בפשטות כיצד החברה מייצרת כסף. אם אי אפשר להסביר את זה בפשטות - עוברים הלאה."
                  align="left"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI Summary &bull; How does this company generate its cash flows?
              </p>
            </div>
          </div>
          {isLoadingSummary ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-300/40 dark:border-sky-800/50 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
              AI Thinking...
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300/40 dark:border-sky-800/50">
              Core Model
            </span>
          )}
        </div>

        {/* Hebrew Summary Content / Skeleton Loader */}
        {isLoadingSummary ? (
          <div
            data-testid="ai-summary-skeleton"
            className="rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-3"
          >
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-full animate-pulse" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-11/12 animate-pulse" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md w-3/4 animate-pulse" />
          </div>
        ) : (
          <div
            dir="rtl"
            className="rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 text-right font-sans"
          >
            <p className="text-base sm:text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
              {aiSummary?.summary}
            </p>
          </div>
        )}

        {/* Revenue Pillars / Breakdown Tags */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-medium mr-1">
            Key Engines:
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  {engine}
                </span>
              )
            })
          )}
        </div>
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
