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
  DashboardSkeleton,
} from './components/Dashboard'
import { useCompanySearch } from './hooks/useCompanySearch'
import gaapNormalizer from './utils/gaapNormalizer'
import { calculateMargins } from './utils/calculateMargins'

/**
 * Formats a large number into a human-readable string with suffix.
 * e.g., 394000000000 -> "$394.0B"
 *
 * @param {number|null} value - Raw numeric value
 * @param {string} [prefix='$'] - Currency prefix
 * @returns {string} Formatted value or '--' if null/undefined
 */
function formatLargeNumber(value, prefix = '$') {
  if (value === null || value === undefined) return '--'

  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${prefix}${abs.toFixed(0)}`
}

/**
 * Formats a percentage value (e.g., 0.284 -> "28.4%")
 *
 * @param {number|null} value - Decimal ratio (0-1 range)
 * @returns {string} Formatted percentage or '--'
 */
function formatPercentage(value) {
  if (value === null || value === undefined) return '--'
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Determines the trend direction by comparing two annual values.
 *
 * @param {Array} annualData - Array of annual data points (most recent first)
 * @returns {'up'|'down'|'neutral'|undefined} Trend direction
 */
function getTrend(annualData) {
  if (!Array.isArray(annualData) || annualData.length < 2) return undefined
  const current = annualData[0]?.value
  const previous = annualData[1]?.value
  if (current == null || previous == null) return undefined
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'neutral'
}

/**
 * Extracts key metrics from normalized company data for MetricCard display.
 *
 * @param {Object} data - Normalized company data from useCompanySearch
 * @returns {Array<Object>} Array of metric card props
 */
function extractMetrics(data) {
  if (!data?.metrics) return []

  const metrics = []

  // Revenue
  const revenueLatest = gaapNormalizer.getLatestValue(data.metrics.revenue)
  if (revenueLatest) {
    metrics.push({
      title: 'Revenue',
      value: formatLargeNumber(revenueLatest.value),
      unit: revenueLatest.fiscalYear ? `FY${revenueLatest.fiscalYear}` : undefined,
      trend: getTrend(data.metrics.revenue?.annual),
    })
  }

  // Net Income
  const netIncomeLatest = gaapNormalizer.getLatestValue(data.metrics.netIncome)
  if (netIncomeLatest) {
    metrics.push({
      title: 'Net Income',
      value: formatLargeNumber(netIncomeLatest.value),
      unit: netIncomeLatest.fiscalYear ? `FY${netIncomeLatest.fiscalYear}` : undefined,
      trend: getTrend(data.metrics.netIncome?.annual),
    })
  }

  // Free Cash Flow
  const fcfLatest = gaapNormalizer.getLatestValue(data.metrics.freeCashFlow)
  if (fcfLatest) {
    metrics.push({
      title: 'Free Cash Flow',
      value: formatLargeNumber(fcfLatest.value),
      unit: fcfLatest.fiscalYear ? `FY${fcfLatest.fiscalYear}` : undefined,
      trend: getTrend(data.metrics.freeCashFlow?.annual),
    })
  }

  // Gross Margin (calculated from grossProfit / revenue)
  const grossProfitLatest = gaapNormalizer.getLatestValue(data.metrics.grossProfit)
  if (grossProfitLatest && revenueLatest && revenueLatest.value !== 0) {
    const margin = grossProfitLatest.value / revenueLatest.value
    metrics.push({
      title: 'Gross Margin',
      value: formatPercentage(margin),
    })
  }

  // EPS
  const epsLatest = gaapNormalizer.getLatestValue(data.metrics.eps)
  if (epsLatest) {
    metrics.push({
      title: 'EPS',
      value: `$${Number(epsLatest.value).toFixed(2)}`,
      unit: epsLatest.fiscalYear ? `FY${epsLatest.fiscalYear}` : undefined,
      trend: getTrend(data.metrics.eps?.annual),
    })
  }

  // Operating Cash Flow
  const ocfLatest = gaapNormalizer.getLatestValue(data.metrics.operatingCashFlow)
  if (ocfLatest) {
    metrics.push({
      title: 'Operating Cash Flow',
      value: formatLargeNumber(ocfLatest.value),
      unit: ocfLatest.fiscalYear ? `FY${ocfLatest.fiscalYear}` : undefined,
      trend: getTrend(data.metrics.operatingCashFlow?.annual),
    })
  }

  // Limit to 6 metrics max for the grid layout
  return metrics.slice(0, 6)
}

function App() {
  const { data, loading, error, metadata, searchCompany, clearError } = useCompanySearch()

  const handleSearch = (ticker) => {
    searchCompany(ticker)
  }

  // Show compact search in header when we have data or are loading (not in welcome state)
  const showCompactSearch = data || loading

  // Extract formatted metrics from normalized data
  const metricCards = data ? extractMetrics(data) : []

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
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
              <Gem className="h-8 w-8 text-brand-500" />
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome State (no data loaded, not loading, no error) */}
        {!data && !loading && !error && (
          <div className="text-center py-16" data-testid="welcome-state">
            <Gem className="h-20 w-20 text-brand-500 mx-auto mb-6" />
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
              />
            }
            metrics={metricCards.map((metric, index) => (
              <MetricCard
                key={`${metric.title}-${index}`}
                title={metric.title}
                value={metric.value}
                unit={metric.unit}
                trend={metric.trend}
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
