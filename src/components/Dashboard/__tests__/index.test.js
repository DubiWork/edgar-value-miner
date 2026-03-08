import { describe, it, expect } from 'vitest';

describe('Dashboard barrel exports', () => {
  it('exports all skeleton components', async () => {
    const barrel = await import('../index.js');

    expect(barrel.CompanyBannerSkeleton).toBeDefined();
    expect(typeof barrel.CompanyBannerSkeleton).toBe('function');

    expect(barrel.MetricCardSkeleton).toBeDefined();
    expect(typeof barrel.MetricCardSkeleton).toBe('function');

    expect(barrel.ChartContainerSkeleton).toBeDefined();
    expect(typeof barrel.ChartContainerSkeleton).toBe('function');

    expect(barrel.DashboardSkeleton).toBeDefined();
    expect(typeof barrel.DashboardSkeleton).toBe('function');
  });

  it('exports all real components alongside skeletons', async () => {
    const barrel = await import('../index.js');

    expect(barrel.DashboardLayout).toBeDefined();
    expect(barrel.CompanyBanner).toBeDefined();
    expect(barrel.MetricCard).toBeDefined();
    expect(barrel.ChartContainer).toBeDefined();
  });
});
