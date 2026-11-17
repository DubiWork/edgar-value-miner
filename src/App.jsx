import { useState } from 'react'
import { TrendingUp, DollarSign, BarChart3, Gem, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { TickerSearch } from './components/TickerSearch'
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
  const { data, loading, error, metadata, searchCompany, clearError } = useCompanySearch()
  const { user, isAdmin, signInWithGoogle, signOutUser, isFirebaseAvailable } = useAdminAuth()

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
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <Gem className="h-8 w-8 text-brand-500" aria-hidden="true" />
              <span
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                EDGAR Value Miner
              </span>
            </div>

            {/* Compact Search Bar (shown when data is loaded or loading) */}
            {showCompactSearch && (
              <TickerSearch
                variant="compact"
                onSearch={handleSearch}
                isSearching={loading}
                className="flex-1 mx-8"
              />
            )}

            {/* Auth & Theme Controls */}
            <div className="flex items-center gap-3">
              {isFirebaseAvailable && (
                user ? (
                  <div className="flex items-center gap-2" data-testid="header-user-info">
                    {isAdmin && (
                      <span
                        data-testid="header-admin-badge"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      title="התנתק"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">התנתק</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="header-signin-btn"
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>התחברות</span>
                  </button>
                )
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

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
