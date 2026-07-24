/**
 * Standard viewport configurations for responsive E2E testing.
 *
 * Each preset provides width and height values that can be passed
 * directly to `page.setViewportSize()` in Playwright tests.
 */

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};
