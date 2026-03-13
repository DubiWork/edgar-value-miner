import { TrendingUp, DollarSign, BarChart3, Gem } from 'lucide-react'
import { TickerSearch } from './components/TickerSearch'
import { ThemeToggle } from './components/ThemeToggle'
import { ErrorFallback } from './components/ErrorBoundary'
import {
  DashboardLayout,
  CompanyBanner,
  MetricCard,
  ChartContainer,
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
import gaapNormalizer from './utils/gaapNormalizer'
import { calculateMargins } from './utils/calculateMargins'

function App() {
  const { data, loading, error, metadata, searchCompany, clearError } = useCompanySearch()

  // Fetch live stock quote from FMP API when company data is available
  const { data: stockQuote, loading: priceLoading } = useStockQuote(data?.ticker)

  // Watchlist state
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, isFull } = useWatchlist()

  const handleSearch = (ticker) => {
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

            {/* Theme Toggle */}
            <ThemeToggle />
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
              className="mb-12"
            />

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
          <DashboardSkeleton data-testid="loading-state" />
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

        {/* Dashboard State (data loaded) */}
        {data && !loading && (
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
              <ChartContainer title="Revenue" loading={false}>
                <div
                  className="flex items-center justify-center h-full"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Chart placeholder — Recharts integration coming in Issue #5
                </div>
              </ChartContainer>
            }
            secondaryCharts={[
              <ChartContainer key="fcf-chart" title="Free Cash Flow" loading={false}>
                <FCFChart
                  data={data?.metrics?.freeCashFlow?.annual}
                  animationDisabled={false}
                />
              </ChartContainer>,
              <ChartContainer key="margins-chart" title="Margins" loading={false}>
                <MarginsChart
                  data={calculateMargins({
                    revenue: data?.metrics?.revenue?.annual,
                    grossProfit: data?.metrics?.grossProfit?.annual,
                    operatingIncome: data?.metrics?.operatingIncome?.annual,
                    netIncome: data?.metrics?.netIncome?.annual,
                  })}
                  animationDisabled={false}
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
