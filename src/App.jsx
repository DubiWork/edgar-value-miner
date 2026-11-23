import { useState } from 'react'
import { TrendingUp, DollarSign, BarChart3, Gem, LogIn, LogOut, ShieldCheck, Search } from 'lucide-react'
import { TickerSearch } from './components/TickerSearch'
import { MobileSearchModal } from './components/TickerSearch/MobileSearchModal'
import { ThemeToggle } from './components/ThemeToggle'
import { ErrorFallback } from './components/ErrorBoundary'
import { Step1Triage } from './components/Stepper'
import {
  DashboardLayout,
  CompanyBanner,
  MetricCard,
  ChartContainer,
  RevenueChart,
  FCFChart,
  MarginsChart,
  ValuationPanel,
  DashboardSkeleton,
} from './components/Dashboard'
import { WatchlistPanel } from './components/Watchlist'
import { useCompanySearch } from './hooks/useCompanySearch'
import { useStockQuote } from './hooks/useStockQuote'
import { useKeyMetrics } from './hooks/useKeyMetrics'
import { useWatchlist } from './hooks/useWatchlist'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useAdminAuth } from './hooks/useAdminAuth'
import gaapNormalizer from './utils/gaapNormalizer'
import { calculateMargins } from './utils/calculateMargins'

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [dismissedAuthError, setDismissedAuthError] = useState(null)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { data, loading, error, metadata, searchCompany, clearError, reset } = useCompanySearch()
  const { user, isAdmin, authError, signInWithGoogle, signOutUser, isFirebaseAvailable } = useAdminAuth()

  const activeAuthError = authError && authError !== dismissedAuthError ? authError : null

  // Fetch live stock quote from FMP API when company data is available
  const { data: stockQuote, loading: priceLoading } = useStockQuote(data?.ticker)

  // Watchlist state
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, isFull } = useWatchlist()

  // Disable JS-driven chart animations when the user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

  const handleSearch = (ticker) => {
    setCurrentStep(1)
    searchCompany(ticker)
  }

  const handleGoHome = () => {
    setMobileSearchOpen(false)
    reset()
    setCurrentStep(1)
  }

  const handleModalSearch = (ticker) => {
    setMobileSearchOpen(false)
    handleSearch(ticker)
  }

  const handleToggleWatchlist = () => {
    if (!data) return
    if (isInWatchlist(data.ticker)) {
      removeFromWatchlist(data.ticker)
    } else {
      addToWatchlist(data.ticker, data.companyName)
    }
  }

  // Show compact search in header when we have data or are loading (not in welcome state)
  const showCompactSearch = data || loading

  // Extract formatted metrics from normalized data using the hook
  // Pass stockQuote for live Market Cap and P/E
  const metricCards = useKeyMetrics(data, stockQuote)

  // Extract latest EPS for ValuationPanel
  const latestEps = data?.metrics ? gaapNormalizer.getLatestValue(data.metrics.eps) : null

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header
        className="border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2">
            {/* Clickable Logo (icon-only on phones, icon + title on sm:+) */}
            <button
              type="button"
              data-testid="header-logo-btn"
              onClick={handleGoHome}
              aria-label="EDGAR Value Miner — Return to home"
              className="flex items-center justify-center sm:justify-start gap-2 min-w-[44px] min-h-[44px] sm:min-w-0 px-1.5 -ms-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Gem className="h-7 w-7 sm:h-8 sm:w-8 text-brand-500 shrink-0" aria-hidden="true" />
              <span
                className="hidden sm:inline text-xl font-bold whitespace-nowrap"
                style={{ color: 'var(--color-text-primary)' }}
              >
                EDGAR Value Miner
              </span>
            </button>

            {/* Compact Search Bar on tablet/desktop (hidden on <640px; mobile uses Search Modal) */}
            {showCompactSearch && (
              <div className="hidden sm:flex flex-1 min-w-0 max-w-lg mx-4 md:mx-6">
                <TickerSearch
                  variant="compact"
                  onSearch={handleSearch}
                  isSearching={loading}
                  className="w-full"
                />
              </div>
            )}

            {/* Mobile Search Icon + Auth & Theme Controls */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {showCompactSearch && (
                <button
                  type="button"
                  data-testid="mobile-search-trigger"
                  onClick={() => setMobileSearchOpen(true)}
                  aria-label="Open ticker search"
                  title="חיפוש חברה / Search ticker"
                  className="sm:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
                >
                  <Search className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
              {isFirebaseAvailable && (
                user ? (
                  <div className="flex items-center gap-1.5 sm:gap-2" data-testid="header-user-info">
                    {isAdmin && (
                      <span
                        data-testid="header-admin-badge"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0"
                        title={`Admin: ${user.email}`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Admin</span>
                      </span>
                    )}
                    <span
                      className="hidden sm:inline text-xs font-medium truncate max-w-[140px]"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title={user.email || user.displayName || ''}
                    >
                      {user.displayName || user.email}
                    </span>
                    <button
                      type="button"
                      data-testid="header-signout-btn"
                      onClick={signOutUser}
                      className="inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
                      title="התנתק"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline whitespace-nowrap">התנתק</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="header-signin-btn"
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>התחברות</span>
                  </button>
                )
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <MobileSearchModal
        isOpen={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
      >
        <TickerSearch
          variant="hero"
          onSearch={handleModalSearch}
          isSearching={loading}
          autoFocus
          autoFocusOnMobile
        />
      </MobileSearchModal>

      {/* Auth error banner (e.g. Firebase unauthorized-domain on PR preview or popup blocked) */}
      {activeAuthError && (
        <div
          dir="rtl"
          role="alert"
          data-testid="auth-error-banner"
          className="border-b border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs sm:text-sm"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
            <span>
              {/unauthorized-domain/i.test(activeAuthError) ? (
                <>
                  התחברות Google נחסמה בדומיין זה ב-Firebase (יש להוסיף את הדומיין לרשימת ה-Authorized Domains). בינתיים ניתן להתחבר דרך סביבת{' '}
                  <a
                    href="https://edgar-value-miner-staging.web.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    Staging (edgar-value-miner-staging.web.app)
                  </a>
                  .
                </>
              ) : (
                <>שגיאת התחברות: {activeAuthError}</>
              )}
            </span>
            <button
              type="button"
              onClick={() => setDismissedAuthError(activeAuthError)}
              className="px-2 py-0.5 rounded hover:bg-rose-500/15 font-semibold shrink-0 cursor-pointer"
            >
              סגור
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome State (no data loaded, not loading, no error) */}
        {!data && !loading && !error && (
          <div className="text-center py-16" data-testid="welcome-state">
            <Gem className="h-20 w-20 text-brand-500 mx-auto mb-6" aria-hidden="true" />
            <h1
              className="text-4xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Find gems in the market
            </h1>
            <p
              className="text-xl mb-8 max-w-2xl mx-auto"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Research companies with beautiful visualizations, professional scoring systems,
              and smart valuations — all powered by official SEC EDGAR data.
            </p>

            {/* Hero Search */}
            <TickerSearch
              variant="hero"
              onSearch={handleSearch}
              isSearching={loading}
              autoFocus
              className="mb-6"
            />

            {/* Quick Demo Pill for MSFT Triage testing */}
            <div className="flex items-center justify-center gap-2 mb-12">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Quick Demo:</span>
              <button
                type="button"
                onClick={() => handleSearch('MSFT')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 cursor-pointer transition-colors"
              >
                <span>MSFT (Microsoft)</span>
                <span className="text-[10px] text-sky-400 font-normal">&rarr; 10s Triage</span>
              </button>
            </div>

            {/* Watchlist Panel (shown when user has watchlist items) */}
            {watchlist.length > 0 && (
              <div className="mb-12 max-w-4xl mx-auto">
                <WatchlistPanel
                  watchlist={watchlist}
                  onRemove={removeFromWatchlist}
                  onSelect={handleSearch}
                  isFull={isFull}
                />
              </div>
            )}

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="card text-left">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)' }}
                  >
                    <TrendingUp
                      className="h-6 w-6"
                      style={{ color: 'var(--color-success)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <h3
                    className="font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Visual Analysis
                  </h3>
                </div>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Beautiful charts showing revenue, FCF, and margin trends over 5+ years.
                </p>
              </div>

              <div className="card text-left">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
                  >
                    <DollarSign
                      className="h-6 w-6"
                      style={{ color: 'var(--color-accent)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <h3
                    className="font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Smart Valuations
                  </h3>
                </div>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  P/E fair value, DCF analysis, and margin of safety calculations.
                </p>
              </div>

              <div className="card text-left">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-info) 15%, transparent)' }}
                  >
                    <BarChart3
                      className="h-6 w-6"
                      style={{ color: 'var(--color-info)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <h3
                    className="font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Quality Scoring
                  </h3>
                </div>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Feroldi Quality Score and Anti-Fragile analysis for each company.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <DashboardSkeleton heroChartHeight={400} secondaryChartHeight={400} data-testid="loading-state" />
        )}

        {/* Error State */}
        {error && !loading && (
          <div data-testid="error-state">
            <ErrorFallback
              error={error.originalError || error}
              errorType={error.type}
              resetError={() => {
                clearError()
              }}
            />
          </div>
        )}

        {/* Step 1 Triage (Stock Simplifier 10-Second UX Gatekeeper) */}
        {data && !loading && currentStep === 1 && (
          <Step1Triage
            company={{
              ticker: data.ticker || 'MSFT',
              name: data.companyName || 'Microsoft Corporation',
            }}
            companyFacts={data}
            isAdmin={isAdmin}
            cacheMetadata={metadata}
            isRefreshingCompany={loading}
            onForceRefreshCompany={(ticker) =>
              searchCompany(ticker || data.ticker, { refreshGlobalCache: true })
            }
            onContinue={() => {
              setCurrentStep(2)
            }}
          />
        )}

        {/* Step 2+ Dashboard State (data loaded & Gatekeeper passed) */}
        {data && !loading && currentStep >= 2 && (
          <DashboardLayout
            banner={
              <CompanyBanner
                companyName={data.companyName}
                ticker={data.ticker}
                isWatchlisted={isInWatchlist(data.ticker)}
                onToggleWatchlist={handleToggleWatchlist}
                watchlistFull={isFull}
              />
            }
            metrics={metricCards.map((metric, index) => (
              <MetricCard
                key={metric.id || `${metric.title}-${index}`}
                title={metric.title}
                value={metric.value}
                unit={metric.unit}
                trend={metric.trend}
                style={{ '--card-index': index }}
              />
            ))}
            heroChart={
              <ChartContainer title="Revenue (YoY Growth)" loading={false} height={400}>
                <RevenueChart
                  data={data?.metrics?.revenue?.annual}
                  animationDisabled={prefersReducedMotion}
                />
              </ChartContainer>
            }
            secondaryCharts={[
              <ChartContainer key="fcf-chart" title="Free Cash Flow (YoY Growth)" loading={false} height={400}>
                <FCFChart
                  data={data?.metrics?.freeCashFlow?.annual}
                  animationDisabled={prefersReducedMotion}
                />
              </ChartContainer>,
              <ChartContainer key="margins-chart" title="Margins" loading={false} height={400}>
                <MarginsChart
                  data={calculateMargins({
                    revenue: data?.metrics?.revenue?.annual,
                    grossProfit: data?.metrics?.grossProfit?.annual,
                    operatingIncome: data?.metrics?.operatingIncome?.annual,
                    netIncome: data?.metrics?.netIncome?.annual,
                  }, { fullHistory: true })}
                  animationDisabled={prefersReducedMotion}
                />
              </ChartContainer>,
            ]}
            valuation={
              <ValuationPanel
                eps={latestEps?.value}
                currentPrice={stockQuote?.price}
                companyName={data?.companyName}
                loading={priceLoading}
              />
            }
          />
        )}

        {/* Cache metadata indicator */}
        {metadata && data && !loading && (
          <div
            className="text-center mt-4 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            data-testid="cache-metadata"
          >
            {metadata.source && (
              <span>
                Source: {metadata.source}
                {metadata.lastUpdated && (
                  <> &bull; Updated: {new Date(metadata.lastUpdated).toLocaleDateString()}</>
                )}
              </span>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="border-t py-6 mt-auto"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Data powered by SEC EDGAR &bull; Built for value investors
        </div>
      </footer>
    </div>
  )
}

export default App
