/**
 * Centralized catalog of data-testid selectors used across the app.
 *
 * Grouped by component/feature area. Dynamic selectors that depend on
 * an index or key are exposed as functions.
 *
 * Keep this file in sync with the JSX source — when a component adds or
 * renames a data-testid, update the corresponding entry here.
 */

export const SELECTORS = {
  // -----------------------------------------------------------------------
  // App-level states (src/App.jsx)
  // -----------------------------------------------------------------------
  app: {
    welcomeState: 'welcome-state',
    loadingState: 'loading-state',
    errorState: 'error-state',
    cacheMetadata: 'cache-metadata',
  },

  // -----------------------------------------------------------------------
  // Dashboard layout (src/components/Dashboard/DashboardLayout.jsx)
  // -----------------------------------------------------------------------
  dashboard: {
    layout: 'dashboard-layout',
    skeleton: 'dashboard-skeleton',
  },

  // -----------------------------------------------------------------------
  // Company banner (src/components/Dashboard/CompanyBanner.jsx)
  // -----------------------------------------------------------------------
  companyBanner: {
    root: 'company-banner',
    skeleton: 'company-banner-skeleton',
    companyName: 'banner-company-name',
    ticker: 'ticker-badge',
    price: 'price-display',
  },

  // -----------------------------------------------------------------------
  // Ticker search (src/components/TickerSearch/TickerSearch.jsx)
  // -----------------------------------------------------------------------
  tickerSearch: {
    root: 'ticker-search',
    input: 'ticker-search-input',
    clear: 'ticker-search-clear',
    dropdown: 'suggestion-dropdown',
    noResults: 'no-results-message',
    srAnnouncement: 'sr-announcement',
    clearRecent: 'clear-recent-searches',
    /** Returns the data-testid for a suggestion item at the given index. */
    suggestionItem: (index) => `suggestion-item-${index}`,
  },

  // -----------------------------------------------------------------------
  // Charts (Revenue, FCF, Margins)
  // -----------------------------------------------------------------------
  charts: {
    container: 'chart-container',
    containerSkeleton: 'chart-container-skeleton',

    // Revenue chart
    revenueChart: 'revenue-chart',
    revenueChartEmpty: 'revenue-chart-empty',

    // FCF chart
    fcfChart: 'fcf-chart',
    fcfChartEmpty: 'fcf-chart-empty',
    fcfReferenceLine: 'fcf-reference-line',
    fcfTooltip: 'fcf-tooltip',

    // Margins chart
    marginsChart: 'margins-chart',
    marginsChartEmpty: 'margins-chart-empty',
    marginsLegend: 'margins-legend',
    marginsTooltip: 'margins-tooltip',
    /** Returns the data-testid for a legend item with the given key. */
    legendKey: (key) => `legend-${key}`,
  },

  // -----------------------------------------------------------------------
  // Metric cards (src/components/Dashboard/MetricCard.jsx)
  // -----------------------------------------------------------------------
  metricCard: {
    root: 'metric-card',
    skeleton: 'metric-card-skeleton',
    title: 'metric-title',
    value: 'metric-value',
    unit: 'metric-unit',
    trend: 'metric-trend',
  },

  // -----------------------------------------------------------------------
  // Valuation panel (src/components/Dashboard/ValuationPanel.jsx)
  // -----------------------------------------------------------------------
  valuation: {
    panel: 'valuation-panel',
  },

  // -----------------------------------------------------------------------
  // Watchlist (src/components/Watchlist/)
  // -----------------------------------------------------------------------
  watchlist: {
    panel: 'watchlist-panel',
    toggle: 'watchlist-toggle',
    grid: 'watchlist-grid',
    card: 'watchlist-card',
    tickerBadge: 'watchlist-ticker-badge',
    price: 'watchlist-price',
    change: 'watchlist-change',
    timestamp: 'watchlist-timestamp',
    removeBtn: 'watchlist-remove-btn',
    shimmer: 'watchlist-shimmer',
    countBadge: 'watchlist-count-badge',
    upgradeCta: 'watchlist-upgrade-cta',
    upgradePrompt: 'watchlist-upgrade-prompt',
  },

  // -----------------------------------------------------------------------
  // Theme toggle
  // -----------------------------------------------------------------------
  theme: {
    toggle: 'theme-toggle',
  },
};
