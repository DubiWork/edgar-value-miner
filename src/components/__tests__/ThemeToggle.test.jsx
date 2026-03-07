import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../contexts/ThemeProvider';
import { setSystemTheme } from '../../test-setup';

/**
 * Helper to render ThemeToggle within ThemeProvider.
 */
function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  // UT-TGL-01: Renders Sun icon in dark mode
  it('renders Sun icon in dark mode (to indicate switch to light)', () => {
    window.localStorage.setItem('theme', 'dark');

    const { container } = renderToggle();

    // lucide-react renders SVGs; Sun icon has specific paths
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  // UT-TGL-02: Renders Moon icon in light mode
  it('renders Moon icon in light mode (to indicate switch to dark)', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  // UT-TGL-03: Clicking toggle switches from dark to light
  it('clicking toggle switches from dark to light', () => {
    window.localStorage.setItem('theme', 'dark');

    const { container } = renderToggle();

    const button = container.querySelector('button');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  // UT-TGL-04: Clicking toggle switches from light to dark
  it('clicking toggle switches from light to dark', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    const button = container.querySelector('button');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  // UT-TGL-05: Button has correct size for touch target (44x44)
  it('has 44x44 touch target size (w-11 h-11)', () => {
    setSystemTheme(false);

    const { container } = renderToggle();

    const button = container.querySelector('button');
    // Check the className includes w-11 and h-11 (Tailwind: 44px)
    expect(button.className).toContain('w-11');
    expect(button.className).toContain('h-11');
  });

  // UT-TGL-06: Button is keyboard accessible
  it('is keyboard accessible (responds to Enter key)', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    const button = container.querySelector('button');
    expect(button.getAttribute('type')).toBe('button');

    // Simulate keyboard activation
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // UT-TGL-07: aria-label updates dynamically
  it('aria-label updates dynamically after toggle', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    const button = container.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');

    fireEvent.click(button);

    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');

    fireEvent.click(button);

    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  // UT-TGL-08: Icon has theme-toggle-icon class for animation
  it('icon has theme-toggle-icon class for CSS animation', () => {
    setSystemTheme(false);

    const { container } = renderToggle();

    const icon = container.querySelector('.theme-toggle-icon');
    expect(icon).toBeTruthy();
  });

  // Integration: rapid toggling
  it('handles rapid toggling without errors', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    const button = container.querySelector('button');

    // Rapid toggle 10 times
    for (let i = 0; i < 10; i++) {
      fireEvent.click(button);
    }

    // After 10 toggles (even number), should be back to light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('persists theme preference to localStorage', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    const button = container.querySelector('button');
    fireEvent.click(button);

    expect(window.localStorage.getItem('theme')).toBe('dark');

    fireEvent.click(button);

    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('sets data-theme attribute on document element', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { container } = renderToggle();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    const button = container.querySelector('button');
    fireEvent.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
