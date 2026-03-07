import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardLayout } from '../DashboardLayout';

/**
 * Helper: renders DashboardLayout with the given props.
 */
function renderLayout(props = {}) {
  return render(<DashboardLayout {...props} />);
}

describe('DashboardLayout', () => {
  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders without crashing when no props are provided', () => {
    const { container } = renderLayout();

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout).toBeTruthy();
  });

  it('renders the outer container with correct base classes', () => {
    const { container } = renderLayout();

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.className).toContain('max-w-7xl');
    expect(layout.className).toContain('mx-auto');
    expect(layout.className).toContain('py-6');

    // gap-6 is on the inner grid div
    const innerGrid = layout.querySelector('div');
    expect(innerGrid.className).toContain('gap-6');
  });

  it('renders with no sections when all props are undefined', () => {
    const { container } = renderLayout();

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(0);
  });

  // =========================================================================
  // Banner section
  // =========================================================================

  it('renders banner section when banner prop is provided', () => {
    renderLayout({ banner: <div>Company Banner</div> });

    const section = screen.getByLabelText('Company banner');
    expect(section).toBeTruthy();
    expect(section.tagName).toBe('SECTION');
    expect(section.textContent).toBe('Company Banner');
  });

  it('does not render banner section when banner prop is null', () => {
    renderLayout({ banner: null });

    expect(screen.queryByLabelText('Company banner')).toBeNull();
  });

  // =========================================================================
  // Metrics section
  // =========================================================================

  it('renders metrics section with correct grid classes', () => {
    const metrics = [
      <div key="1">Metric 1</div>,
      <div key="2">Metric 2</div>,
      <div key="3">Metric 3</div>,
    ];

    renderLayout({ metrics });

    const section = screen.getByLabelText('Key metrics');
    expect(section).toBeTruthy();
    expect(section.tagName).toBe('SECTION');

    const grid = section.querySelector('div');
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
    expect(grid.className).toContain('gap-6');
  });

  it('renders each metric inside an article element', () => {
    const metrics = [
      <div key="1">Revenue</div>,
      <div key="2">FCF</div>,
    ];

    renderLayout({ metrics });

    const articles = screen.getByLabelText('Key metrics').querySelectorAll('article');
    expect(articles.length).toBe(2);
    expect(articles[0].getAttribute('aria-label')).toBe('Metric 1');
    expect(articles[1].getAttribute('aria-label')).toBe('Metric 2');
    expect(articles[0].textContent).toBe('Revenue');
    expect(articles[1].textContent).toBe('FCF');
  });

  it('does not render metrics section when metrics is an empty array', () => {
    renderLayout({ metrics: [] });

    expect(screen.queryByLabelText('Key metrics')).toBeNull();
  });

  it('does not render metrics section when metrics is undefined', () => {
    renderLayout({});

    expect(screen.queryByLabelText('Key metrics')).toBeNull();
  });

  // =========================================================================
  // Hero chart section
  // =========================================================================

  it('renders hero chart section when heroChart prop is provided', () => {
    renderLayout({ heroChart: <div>Revenue Chart</div> });

    const section = screen.getByLabelText('Primary chart');
    expect(section).toBeTruthy();
    expect(section.tagName).toBe('SECTION');
    expect(section.textContent).toBe('Revenue Chart');
  });

  it('does not render hero chart section when heroChart is null', () => {
    renderLayout({ heroChart: null });

    expect(screen.queryByLabelText('Primary chart')).toBeNull();
  });

  // =========================================================================
  // Secondary charts section
  // =========================================================================

  it('renders secondary charts section with correct 2-col grid', () => {
    const charts = [
      <div key="1">Margin Chart</div>,
      <div key="2">Growth Chart</div>,
    ];

    renderLayout({ secondaryCharts: charts });

    const section = screen.getByLabelText('Secondary charts');
    expect(section).toBeTruthy();
    expect(section.tagName).toBe('SECTION');

    const grid = section.querySelector('div');
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('lg:grid-cols-2');
    expect(grid.className).toContain('gap-6');
  });

  it('renders each secondary chart inside an article element', () => {
    const charts = [
      <div key="1">Chart A</div>,
      <div key="2">Chart B</div>,
      <div key="3">Chart C</div>,
    ];

    renderLayout({ secondaryCharts: charts });

    const articles = screen.getByLabelText('Secondary charts').querySelectorAll('article');
    expect(articles.length).toBe(3);
    expect(articles[0].getAttribute('aria-label')).toBe('Chart 1');
    expect(articles[1].getAttribute('aria-label')).toBe('Chart 2');
    expect(articles[2].getAttribute('aria-label')).toBe('Chart 3');
  });

  it('does not render secondary charts section when array is empty', () => {
    renderLayout({ secondaryCharts: [] });

    expect(screen.queryByLabelText('Secondary charts')).toBeNull();
  });

  it('does not render secondary charts section when undefined', () => {
    renderLayout({});

    expect(screen.queryByLabelText('Secondary charts')).toBeNull();
  });

  // =========================================================================
  // Valuation section
  // =========================================================================

  it('renders valuation section when valuation prop is provided', () => {
    renderLayout({ valuation: <div>P/E Analysis</div> });

    const section = screen.getByLabelText('Valuation');
    expect(section).toBeTruthy();
    expect(section.tagName).toBe('SECTION');
    expect(section.textContent).toBe('P/E Analysis');
  });

  it('does not render valuation section when valuation is null', () => {
    renderLayout({ valuation: null });

    expect(screen.queryByLabelText('Valuation')).toBeNull();
  });

  // =========================================================================
  // Full layout
  // =========================================================================

  it('renders all sections when all props are provided', () => {
    renderLayout({
      banner: <div>Banner</div>,
      metrics: [<div key="1">M1</div>, <div key="2">M2</div>],
      heroChart: <div>Hero</div>,
      secondaryCharts: [<div key="1">S1</div>, <div key="2">S2</div>],
      valuation: <div>Val</div>,
    });

    expect(screen.getByLabelText('Company banner')).toBeTruthy();
    expect(screen.getByLabelText('Key metrics')).toBeTruthy();
    expect(screen.getByLabelText('Primary chart')).toBeTruthy();
    expect(screen.getByLabelText('Secondary charts')).toBeTruthy();
    expect(screen.getByLabelText('Valuation')).toBeTruthy();
  });

  it('renders sections in correct order: banner, metrics, hero, secondary, valuation', () => {
    const { container } = renderLayout({
      banner: <div>Banner</div>,
      metrics: [<div key="1">M1</div>],
      heroChart: <div>Hero</div>,
      secondaryCharts: [<div key="1">S1</div>],
      valuation: <div>Val</div>,
    });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(5);
    expect(sections[0].getAttribute('aria-label')).toBe('Company banner');
    expect(sections[1].getAttribute('aria-label')).toBe('Key metrics');
    expect(sections[2].getAttribute('aria-label')).toBe('Primary chart');
    expect(sections[3].getAttribute('aria-label')).toBe('Secondary charts');
    expect(sections[4].getAttribute('aria-label')).toBe('Valuation');
  });

  // =========================================================================
  // Partial props
  // =========================================================================

  it('renders only banner when only banner is provided', () => {
    const { container } = renderLayout({ banner: <div>Only Banner</div> });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(1);
    expect(sections[0].getAttribute('aria-label')).toBe('Company banner');
  });

  it('renders only metrics when only metrics is provided', () => {
    const { container } = renderLayout({
      metrics: [<div key="1">Only Metric</div>],
    });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(1);
    expect(sections[0].getAttribute('aria-label')).toBe('Key metrics');
  });

  it('renders only heroChart when only heroChart is provided', () => {
    const { container } = renderLayout({ heroChart: <div>Only Hero</div> });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(1);
    expect(sections[0].getAttribute('aria-label')).toBe('Primary chart');
  });

  it('renders only valuation when only valuation is provided', () => {
    const { container } = renderLayout({ valuation: <div>Only Val</div> });

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(1);
    expect(sections[0].getAttribute('aria-label')).toBe('Valuation');
  });

  // =========================================================================
  // className forwarding
  // =========================================================================

  it('forwards className prop to the container', () => {
    const { container } = renderLayout({ className: 'custom-class' });

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.className).toContain('custom-class');
  });

  it('preserves base classes when className is provided', () => {
    const { container } = renderLayout({ className: 'extra' });

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.className).toContain('max-w-7xl');
    expect(layout.className).toContain('mx-auto');
    expect(layout.className).toContain('extra');
  });

  it('does not add extra space when className is empty string', () => {
    const { container } = renderLayout({ className: '' });

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    // Should not end with a trailing space
    expect(layout.className).not.toMatch(/\s$/);
  });

  // =========================================================================
  // Semantic HTML structure
  // =========================================================================

  it('uses section elements for all content areas', () => {
    renderLayout({
      banner: <div>B</div>,
      metrics: [<div key="1">M</div>],
      heroChart: <div>H</div>,
      secondaryCharts: [<div key="1">S</div>],
      valuation: <div>V</div>,
    });

    const sections = document.querySelectorAll('section');
    expect(sections.length).toBe(5);

    // All sections have aria-label for accessibility
    sections.forEach((section) => {
      expect(section.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('uses article elements for individual metrics and charts', () => {
    renderLayout({
      metrics: [<div key="1">M1</div>, <div key="2">M2</div>],
      secondaryCharts: [<div key="1">C1</div>],
    });

    const articles = document.querySelectorAll('article');
    expect(articles.length).toBe(3); // 2 metrics + 1 chart

    articles.forEach((article) => {
      expect(article.getAttribute('aria-label')).toBeTruthy();
    });
  });

  // =========================================================================
  // Responsive grid classes
  // =========================================================================

  it('applies mobile-first single column to outer grid', () => {
    const { container } = renderLayout({
      banner: <div>B</div>,
      metrics: [<div key="1">M</div>],
    });

    const outerGrid = container.querySelector('[data-testid="dashboard-layout"] > div');
    expect(outerGrid.className).toContain('grid-cols-1');
  });

  it('applies 3-breakpoint responsive grid to metrics', () => {
    renderLayout({
      metrics: [<div key="1">M1</div>],
    });

    const metricsGrid = screen.getByLabelText('Key metrics').querySelector('div');
    // Mobile: 1 col, Tablet: 2 col, Desktop: 3 col
    expect(metricsGrid.className).toContain('grid-cols-1');
    expect(metricsGrid.className).toContain('md:grid-cols-2');
    expect(metricsGrid.className).toContain('lg:grid-cols-3');
  });

  it('applies 2-breakpoint responsive grid to secondary charts', () => {
    renderLayout({
      secondaryCharts: [<div key="1">C1</div>],
    });

    const chartsGrid = screen.getByLabelText('Secondary charts').querySelector('div');
    // Mobile: 1 col, Desktop: 2 col
    expect(chartsGrid.className).toContain('grid-cols-1');
    expect(chartsGrid.className).toContain('lg:grid-cols-2');
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('handles single metric in array', () => {
    renderLayout({ metrics: [<div key="1">Solo</div>] });

    const articles = screen.getByLabelText('Key metrics').querySelectorAll('article');
    expect(articles.length).toBe(1);
    expect(articles[0].textContent).toBe('Solo');
  });

  it('handles many metrics gracefully', () => {
    const manyMetrics = Array.from({ length: 12 }, (_, i) => (
      <div key={i}>Metric {i + 1}</div>
    ));

    renderLayout({ metrics: manyMetrics });

    const articles = screen.getByLabelText('Key metrics').querySelectorAll('article');
    expect(articles.length).toBe(12);
  });

  it('handles single secondary chart in array', () => {
    renderLayout({ secondaryCharts: [<div key="1">Alone</div>] });

    const articles = screen.getByLabelText('Secondary charts').querySelectorAll('article');
    expect(articles.length).toBe(1);
  });

  // =========================================================================
  // Snapshot test
  // =========================================================================

  it('matches snapshot for full layout', () => {
    const { container } = renderLayout({
      banner: <div className="card">AAPL - Apple Inc.</div>,
      metrics: [
        <div key="rev" className="card">Revenue: $394B</div>,
        <div key="fcf" className="card">FCF: $111B</div>,
        <div key="margin" className="card">Margin: 28%</div>,
      ],
      heroChart: <div className="card">Revenue Chart Placeholder</div>,
      secondaryCharts: [
        <div key="margin-chart" className="card">Margin Chart</div>,
        <div key="growth-chart" className="card">Growth Chart</div>,
      ],
      valuation: <div className="card">P/E Fair Value: $185</div>,
    });

    expect(container.firstChild).toMatchSnapshot();
  });
});
