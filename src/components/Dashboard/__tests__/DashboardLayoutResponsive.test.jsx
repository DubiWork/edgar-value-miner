import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardLayout } from '../DashboardLayout';

/**
 * Tests for DashboardLayout responsive CSS class structure.
 *
 * These tests verify the correct BEM CSS classes are applied
 * to layout elements, which CSS media queries use to control
 * the responsive grid behavior.
 *
 * Breakpoints defined in DashboardLayout.css:
 * - Mobile  (< 768px):  1-col grid, 1rem gap
 * - Tablet  (768px+):   metrics 2-col, 1.5rem gap
 * - Desktop (1024px+):  metrics 3-col, charts 2-col
 */

function renderLayout(props = {}) {
  return render(<DashboardLayout {...props} />);
}

describe('DashboardLayout responsive CSS structure', () => {
  // =========================================================================
  // Root container classes
  // =========================================================================

  it('applies dashboard-layout BEM root class', () => {
    const { container } = renderLayout();

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.classList.contains('dashboard-layout')).toBe(true);
  });

  it('applies mobile-first padding classes (px-4 as base)', () => {
    const { container } = renderLayout();

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.className).toContain('px-4');
    expect(layout.className).toContain('sm:px-6');
    expect(layout.className).toContain('lg:px-8');
  });

  it('applies max-width constraint for desktop readability', () => {
    const { container } = renderLayout();

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.className).toContain('max-w-7xl');
  });

  it('centers layout with mx-auto', () => {
    const { container } = renderLayout();

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.className).toContain('mx-auto');
  });

  // =========================================================================
  // Grid structure classes
  // =========================================================================

  it('applies dashboard-layout__grid class to main grid container', () => {
    const { container } = renderLayout({
      banner: <div>B</div>,
    });

    const grid = container.querySelector('.dashboard-layout__grid');
    expect(grid).toBeTruthy();
    expect(grid.parentElement.getAttribute('data-testid')).toBe('dashboard-layout');
  });

  it('applies dashboard-layout__metrics-grid class to metrics grid', () => {
    renderLayout({
      metrics: [<div key="1">M1</div>, <div key="2">M2</div>],
    });

    const metricsSection = screen.getByLabelText('Key metrics');
    const metricsGrid = metricsSection.querySelector('.dashboard-layout__metrics-grid');
    expect(metricsGrid).toBeTruthy();
  });

  it('applies dashboard-layout__charts-grid class to secondary charts grid', () => {
    renderLayout({
      secondaryCharts: [<div key="1">C1</div>, <div key="2">C2</div>],
    });

    const chartsSection = screen.getByLabelText('Secondary charts');
    const chartsGrid = chartsSection.querySelector('.dashboard-layout__charts-grid');
    expect(chartsGrid).toBeTruthy();
  });

  // =========================================================================
  // Metrics grid renders all items
  // =========================================================================

  it('renders all metrics within the responsive metrics grid', () => {
    const metrics = [
      <div key="1">Revenue</div>,
      <div key="2">FCF</div>,
      <div key="3">Margin</div>,
    ];

    renderLayout({ metrics });

    const metricsGrid = screen.getByLabelText('Key metrics')
      .querySelector('.dashboard-layout__metrics-grid');
    const articles = metricsGrid.querySelectorAll('article');
    expect(articles.length).toBe(3);
  });

  it('renders single metric within the responsive grid', () => {
    renderLayout({ metrics: [<div key="1">Solo</div>] });

    const metricsGrid = screen.getByLabelText('Key metrics')
      .querySelector('.dashboard-layout__metrics-grid');
    const articles = metricsGrid.querySelectorAll('article');
    expect(articles.length).toBe(1);
  });

  it('renders many metrics within the responsive grid', () => {
    const metrics = Array.from({ length: 6 }, (_, i) => (
      <div key={i}>Metric {i + 1}</div>
    ));

    renderLayout({ metrics });

    const metricsGrid = screen.getByLabelText('Key metrics')
      .querySelector('.dashboard-layout__metrics-grid');
    const articles = metricsGrid.querySelectorAll('article');
    expect(articles.length).toBe(6);
  });

  // =========================================================================
  // Charts grid renders all items
  // =========================================================================

  it('renders all secondary charts within the responsive charts grid', () => {
    const charts = [
      <div key="1">FCF Chart</div>,
      <div key="2">Margin Chart</div>,
    ];

    renderLayout({ secondaryCharts: charts });

    const chartsGrid = screen.getByLabelText('Secondary charts')
      .querySelector('.dashboard-layout__charts-grid');
    const articles = chartsGrid.querySelectorAll('article');
    expect(articles.length).toBe(2);
  });

  // =========================================================================
  // Full-width sections (banner, heroChart, valuation) are NOT in sub-grids
  // =========================================================================

  it('banner is a direct child of the main grid, not a sub-grid', () => {
    const { container } = renderLayout({ banner: <div>Banner</div> });

    const mainGrid = container.querySelector('.dashboard-layout__grid');
    const bannerSection = screen.getByLabelText('Company banner');
    expect(bannerSection.parentElement).toBe(mainGrid);
  });

  it('hero chart is a direct child of the main grid, not a sub-grid', () => {
    const { container } = renderLayout({ heroChart: <div>Hero</div> });

    const mainGrid = container.querySelector('.dashboard-layout__grid');
    const heroSection = screen.getByLabelText('Primary chart');
    expect(heroSection.parentElement).toBe(mainGrid);
  });

  it('valuation is a direct child of the main grid, not a sub-grid', () => {
    const { container } = renderLayout({ valuation: <div>Val</div> });

    const mainGrid = container.querySelector('.dashboard-layout__grid');
    const valSection = screen.getByLabelText('Valuation');
    expect(valSection.parentElement).toBe(mainGrid);
  });

  // =========================================================================
  // Section ordering within responsive layout
  // =========================================================================

  it('maintains correct section order in responsive layout', () => {
    const { container } = renderLayout({
      banner: <div>B</div>,
      metrics: [<div key="1">M</div>],
      heroChart: <div>H</div>,
      secondaryCharts: [<div key="1">S</div>],
      valuation: <div>V</div>,
    });

    const mainGrid = container.querySelector('.dashboard-layout__grid');
    const sections = mainGrid.querySelectorAll(':scope > section');
    expect(sections.length).toBe(5);
    expect(sections[0].getAttribute('aria-label')).toBe('Company banner');
    expect(sections[1].getAttribute('aria-label')).toBe('Key metrics');
    expect(sections[2].getAttribute('aria-label')).toBe('Primary chart');
    expect(sections[3].getAttribute('aria-label')).toBe('Secondary charts');
    expect(sections[4].getAttribute('aria-label')).toBe('Valuation');
  });

  // =========================================================================
  // className propagation with responsive classes
  // =========================================================================

  it('custom className does not interfere with responsive layout classes', () => {
    const { container } = renderLayout({
      className: 'my-custom-class',
      metrics: [<div key="1">M</div>],
      secondaryCharts: [<div key="1">C</div>],
    });

    const layout = container.querySelector('[data-testid="dashboard-layout"]');
    expect(layout.classList.contains('dashboard-layout')).toBe(true);
    expect(layout.classList.contains('my-custom-class')).toBe(true);

    // Sub-grids still exist
    expect(container.querySelector('.dashboard-layout__metrics-grid')).toBeTruthy();
    expect(container.querySelector('.dashboard-layout__charts-grid')).toBeTruthy();
  });
});
