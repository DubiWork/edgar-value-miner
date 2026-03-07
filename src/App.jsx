import { useState } from 'react'
import { Search, TrendingUp, DollarSign, BarChart3, Gem } from 'lucide-react'
import { ThemeToggle } from './components/ThemeToggle'

function App() {
  const [ticker, setTicker] = useState('')

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

            {/* Search Bar */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Search by ticker (e.g., AAPL)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome State */}
        <div className="text-center py-16">
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

          {/* Large Search */}
          <div className="max-w-xl mx-auto mb-12">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                type="text"
                placeholder="Enter a ticker symbol to get started..."
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

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
