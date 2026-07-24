// @ts-check
import { test, expect } from '@playwright/test';
import { SELECTORS } from '../helpers/selectors.js';

test.describe('SELECTORS helper', () => {
  // -------------------------------------------------------------------
  // Structure validation
  // -------------------------------------------------------------------
  test('exports an object with grouped selector categories', () => {
    expect(typeof SELECTORS).toBe('object');
    expect(SELECTORS).not.toBeNull();
  });

  test('has app-level selectors', () => {
    expect(SELECTORS.app).toBeDefined();
    expect(SELECTORS.app.welcomeState).toBe('welcome-state');
    expect(SELECTORS.app.loadingState).toBe('loading-state');
    expect(SELECTORS.app.errorState).toBe('error-state');
    expect(SELECTORS.app.cacheMetadata).toBe('cache-metadata');
  });

  test('has dashboard selectors', () => {
    expect(SELECTORS.dashboard).toBeDefined();
    expect(SELECTORS.dashboard.layout).toBe('dashboard-layout');
    expect(SELECTORS.dashboard.skeleton).toBe('dashboard-skeleton');
  });

  test('has company banner selectors', () => {
    expect(SELECTORS.companyBanner).toBeDefined();
    expect(SELECTORS.companyBanner.root).toBe('company-banner');
    expect(SELECTORS.companyBanner.skeleton).toBe('company-banner-skeleton');
    expect(SELECTORS.companyBanner.companyName).toBe('banner-company-name');
    expect(SELECTORS.companyBanner.ticker).toBe('banner-ticker');
    expect(SELECTORS.companyBanner.price).toBe('banner-price');
  });

  test('has ticker search selectors', () => {
    expect(SELECTORS.tickerSearch).toBeDefined();
    expect(SELECTORS.tickerSearch.root).toBe('ticker-search');
    expect(SELECTORS.tickerSearch.input).toBe('ticker-search-input');
    expect(SELECTORS.tickerSearch.clear).toBe('ticker-search-clear');
    expect(SELECTORS.tickerSearch.dropdown).toBe('suggestion-dropdown');
    expect(SELECTORS.tickerSearch.noResults).toBe('no-results-message');
    expect(SELECTORS.tickerSearch.srAnnouncement).toBe('sr-announcement');
    expect(SELECTORS.tickerSearch.clearRecent).toBe('clear-recent-searches');
  });

  test('has chart selectors', () => {
    expect(SELECTORS.charts).toBeDefined();
    expect(SELECTORS.charts.container).toBe('chart-container');
    expect(SELECTORS.charts.containerSkeleton).toBe('chart-container-skeleton');
    expect(SELECTORS.charts.revenueChart).toBe('revenue-chart');
    expect(SELECTORS.charts.revenueChartEmpty).toBe('revenue-chart-empty');
    expect(SELECTORS.charts.fcfChart).toBe('fcf-chart');
    expect(SELECTORS.charts.fcfChartEmpty).toBe('fcf-chart-empty');
    expect(SELECTORS.charts.fcfReferenceLine).toBe('fcf-reference-line');
    expect(SELECTORS.charts.fcfTooltip).toBe('fcf-tooltip');
    expect(SELECTORS.charts.marginsChart).toBe('margins-chart');
    expect(SELECTORS.charts.marginsChartEmpty).toBe('margins-chart-empty');
    expect(SELECTORS.charts.marginsLegend).toBe('margins-legend');
    expect(SELECTORS.charts.marginsTooltip).toBe('margins-tooltip');
  });

  test('has metric card selectors', () => {
    expect(SELECTORS.metricCard).toBeDefined();
    expect(SELECTORS.metricCard.root).toBe('metric-card');
    expect(SELECTORS.metricCard.skeleton).toBe('metric-card-skeleton');
    expect(SELECTORS.metricCard.title).toBe('metric-title');
    expect(SELECTORS.metricCard.value).toBe('metric-value');
    expect(SELECTORS.metricCard.unit).toBe('metric-unit');
    expect(SELECTORS.metricCard.trend).toBe('metric-trend');
  });

  test('has valuation panel selectors', () => {
    expect(SELECTORS.valuation).toBeDefined();
    expect(SELECTORS.valuation.panel).toBe('valuation-panel');
  });

  test('has watchlist selectors', () => {
    expect(SELECTORS.watchlist).toBeDefined();
    expect(SELECTORS.watchlist.panel).toBe('watchlist-panel');
    expect(SELECTORS.watchlist.toggle).toBe('watchlist-toggle');
    expect(SELECTORS.watchlist.grid).toBe('watchlist-grid');
    expect(SELECTORS.watchlist.card).toBe('watchlist-card');
    expect(SELECTORS.watchlist.tickerBadge).toBe('watchlist-ticker-badge');
    expect(SELECTORS.watchlist.price).toBe('watchlist-price');
    expect(SELECTORS.watchlist.change).toBe('watchlist-change');
    expect(SELECTORS.watchlist.timestamp).toBe('watchlist-timestamp');
    expect(SELECTORS.watchlist.removeBtn).toBe('watchlist-remove-btn');
    expect(SELECTORS.watchlist.shimmer).toBe('watchlist-shimmer');
    expect(SELECTORS.watchlist.countBadge).toBe('watchlist-count-badge');
    expect(SELECTORS.watchlist.upgradeCta).toBe('watchlist-upgrade-cta');
    expect(SELECTORS.watchlist.upgradePrompt).toBe('watchlist-upgrade-prompt');
  });

  test('has theme selectors', () => {
    expect(SELECTORS.theme).toBeDefined();
    expect(SELECTORS.theme.toggle).toBe('theme-toggle');
  });

  // -------------------------------------------------------------------
  // Dynamic selector helpers
  // -------------------------------------------------------------------
  test('suggestionItem returns indexed selector', () => {
    expect(SELECTORS.tickerSearch.suggestionItem(0)).toBe('suggestion-item-0');
    expect(SELECTORS.tickerSearch.suggestionItem(3)).toBe('suggestion-item-3');
  });

  test('legendKey returns keyed selector', () => {
    expect(SELECTORS.charts.legendKey('grossMargin')).toBe('legend-grossMargin');
    expect(SELECTORS.charts.legendKey('netMargin')).toBe('legend-netMargin');
  });

  // -------------------------------------------------------------------
  // All values are strings
  // -------------------------------------------------------------------
  test('all static selector values are strings', () => {
    for (const [, group] of Object.entries(SELECTORS)) {
      for (const [, value] of Object.entries(group)) {
        if (typeof value !== 'function') {
          expect(typeof value).toBe('string');
        }
      }
    }
  });
});
