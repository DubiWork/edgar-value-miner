import { useState } from 'react'
import { Sun, Moon, TrendingUp, DollarSign, BarChart3, Gem } from 'lucide-react'
import { TickerSearch } from './components/TickerSearch'
import { useCompanySearch } from './hooks/useCompanySearch'

function App() {
  const [darkMode, setDarkMode] = useState(true)
  const { data, loading, searchCompany } = useCompanySearch()

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  // Set dark mode on initial load
  if (darkMode && !document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.add('dark')
  }

  const handleSearch = (ticker) => {
    searchCompany(ticker)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <Gem className="h-8 w-8 text-brand-500" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                EDGAR Value Miner
              </span>
            </div>

            {/* Compact Search Bar (shown when data is loaded) */}
            {data && (
              <TickerSearch
                variant="compact"
                onSearch={handleSearch}
                isSearching={loading}
                className="flex-1 mx-8"
              />
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome State (no data loaded) */}
        {!data && (
          <div className="text-center py-16">
            <Gem className="h-20 w-20 text-brand-500 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Find gems in the market
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
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
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Visual Analysis</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Beautiful charts showing revenue, FCF, and margin trends over 5+ years.
                </p>
              </div>

              <div className="card text-left">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Smart Valuations</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  P/E fair value, DCF analysis, and margin of safety calculations.
                </p>
              </div>

              <div className="card text-left">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Quality Scoring</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Feroldi Quality Score and Anti-Fragile analysis for each company.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Loaded State (placeholder for future dashboard) */}
        {data && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              Data loaded for <strong className="text-gray-900 dark:text-white">{data.companyName}</strong> ({data.ticker})
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          Data powered by SEC EDGAR • Built for value investors
        </div>
      </footer>
    </div>
  )
}

export default App
