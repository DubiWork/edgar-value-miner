/**
 * Additional edge case tests for DashboardLayout component.
 *
 * Supplements the existing DashboardLayout.test.jsx and
 * DashboardLayoutResponsive.test.jsx with data flow and
 * composition edge cases.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardLayout } from '../DashboardLayout';
import { CompanyBanner } from '../CompanyBanner';
import { MetricCard } from '../MetricCard';
import { ChartContainer } from '../ChartContainer';

describe('DashboardLayout composition tests', () => {
  // =========================================================================
  // Real component composition
  // =========================================================================

  it('renders with real CompanyBanner component', () => {
    render(
      <DashboardLayout
        banner={
          <CompanyBanner
            companyName="Apple Inc."
            ticker="AAPL"
            price={178.5}
          />
        }
      />,
    );

    expect(screen.getByTestId('company-banner')).toBeTruthy();
    expect(screen.getByText('Apple Inc.')).toBeTruthy();
    expect(screen.getByText('AAPL')).toBeTruthy();
    expect(screen.getByText('$178.50')).toBeTruthy();
  });

  it('renders with real MetricCard components', () => {
    render(
      <DashboardLayout
        metrics={[
          <MetricCard key="rev" title="Revenue" value="$394B" trend="up" />,
          <MetricCard key="ni" title="Net Income" value="$97B" trend="up" />,
          <MetricCard key="fcf" title="FCF" value="$111B" trend="neutral" />,
        ]}
      />,
    );

    const metricCards = screen.getAllByTestId('metric-card');
    expect(metricCards.length).toBe(3);

    // Verify headings
    expect(screen.getByRole('heading', { name: 'Revenue' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Net Income' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'FCF' })).toBeTruthy();
  });

  it('renders with real ChartContainer components', () => {
    render(
      <DashboardLayout
        heroChart={
          <ChartContainer title="Revenue" loading={false}>
            <div data-testid="revenue-chart">Revenue Chart</div>
          </ChartContainer>
        }
        secondaryCharts={[
          <ChartContainer key="fcf" title="FCF" loading={false}>
            <div data-testid="fcf-chart">FCF Chart</div>
          </ChartContainer>,
          <ChartContainer key="margins" title="Margins" loading={false}>
            <div data-testid="margins-chart">Margins Chart</div>
          </ChartContainer>,
        ]}
      />,
    );

    expect(screen.getByLabelText('Revenue chart')).toBeTruthy();
    expect(screen.getByLabelText('FCF chart')).toBeTruthy();
    expect(screen.getByLabelText('Margins chart')).toBeTruthy();
    expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    expect(screen.getByTestId('fcf-chart')).toBeTruthy();
    expect(screen.getByTestId('margins-chart')).toBeTruthy();
  });

  // =========================================================================
  // Full dashboard with all real components
  // =========================================================================

  it('renders a complete dashboard with all real components', () => {
    const { container } = render(
      <DashboardLayout
        banner={
          <CompanyBanner
            companyName="Microsoft Corporation"
            ticker="MSFT"
            price={415.2}
          />
        }
        metrics={[
          <MetricCard key="rev" title="Revenue" value="$236B" unit="FY2025" trend="up" />,
          <MetricCard key="ni" title="Net Income" value="$82B" trend="up" />,
          <MetricCard key="margin" title="Margin" value="69.5" unit="%" />,
        ]}
        heroChart={
          <ChartContainer title="Revenue Trend" height={400}>
            <div>Revenue chart placeholder</div>
          </ChartContainer>
        }
        secondaryCharts={[
          <ChartContainer key="fcf" title="Free Cash Flow">
            <div>FCF chart</div>
          </ChartContainer>,
          <ChartContainer key="margins" title="Margins Analysis">
            <div>Margins chart</div>
          </ChartContainer>,
        ]}
        valuation={<div>P/E Fair Value: $380</div>}
      />,
    );

    // All sections present: 5 layout sections + 3 chart container sections = 8
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(8);

    // All real content present
    expect(screen.getByText('Microsoft Corporation')).toBeTruthy();
    expect(screen.getByText('MSFT')).toBeTruthy();
    expect(screen.getByText('$415.20')).toBeTruthy();
    expect(screen.getAllByTestId('metric-card').length).toBe(3);
    expect(screen.getAllByTestId('chart-container').length).toBe(3);
  });

  // =========================================================================
  // Loading state composition
  // =========================================================================

  it('renders loading MetricCards within layout', () => {
    render(
      <DashboardLayout
        metrics={[
          <MetricCard key="1" title="Revenue" loading={true} />,
          <MetricCard key="2" title="Net Income" loading={true} />,
          <MetricCard key="3" title="FCF" loading={true} />,
        ]}
      />,
    );

    const loadingCards = document.querySelectorAll('.metric-card--loading');
    expect(loadingCards.length).toBe(3);
  });

  it('renders loading ChartContainers within layout', () => {
    render(
      <DashboardLayout
        heroChart={<ChartContainer title="Revenue" loading={true} />}
        secondaryCharts={[
          <ChartContainer key="1" title="FCF" loading={true} />,
          <ChartContainer key="2" title="Margins" loading={true} />,
        ]}
      />,
    );

    // Each loading chart container has a ShimmerChart with role="status"
    const statusElements = screen.getAllByRole('status');
    expect(statusElements.length).toBe(3);
  });

  // =========================================================================
  // Mixed loading and loaded states
  // =========================================================================

  it('can mix loaded and loading components', () => {
    render(
      <DashboardLayout
        banner={<CompanyBanner companyName="Apple Inc." ticker="AAPL" />}
        metrics={[
          <MetricCard key="1" title="Revenue" value="$394B" />,
          <MetricCard key="2" title="Net Income" loading={true} />,
        ]}
        heroChart={<ChartContainer title="Revenue" loading={true} />}
      />,
    );

    // Banner loaded
    expect(screen.getByText('Apple Inc.')).toBeTruthy();
    // First metric loaded, second loading
    expect(screen.getByLabelText('Value: $394B')).toBeTruthy();
    expect(document.querySelector('.metric-card--loading')).toBeTruthy();
  });
});
