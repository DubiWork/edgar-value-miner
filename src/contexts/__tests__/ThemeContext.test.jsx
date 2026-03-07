import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';
import { ThemeContext } from '../ThemeContext';
import { useContext } from 'react';
import { setSystemTheme } from '../../test-setup';

/**
 * Helper component that reads from ThemeContext and renders its values.
 * Also exposes setTheme for testing.
 */
function ThemeConsumer() {
  const context = useContext(ThemeContext);
  if (!context) {
    return <div data-testid="no-context">No context</div>;
  }
  return (
    <div>
      <span data-testid="theme">{context.theme}</span>
      <span data-testid="resolved-theme">{context.resolvedTheme}</span>
      <button
        data-testid="set-dark"
        onClick={() => context.setTheme('dark')}
      />
      <button
        data-testid="set-light"
        onClick={() => context.setTheme('light')}
      />
      <button
        data-testid="set-system"
        onClick={() => context.setTheme('system')}
      />
      <button
        data-testid="set-invalid"
        onClick={() => context.setTheme('blue')}
      />
    </div>
  );
}

describe('ThemeProvider', () => {
  // UT-CTX-01
  it('defaults to system/light when no localStorage and no system dark preference', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('theme').textContent).toBe('system');
    expect(getByTestId('resolved-theme').textContent).toBe('light');
  });

  // UT-CTX-02
  it('reads saved dark theme from localStorage on mount', () => {
    window.localStorage.setItem('theme', 'dark');

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('resolved-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // UT-CTX-03
  it('follows system dark preference when theme is system', () => {
    window.localStorage.setItem('theme', 'system');
    setSystemTheme(true);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('theme').textContent).toBe('system');
    expect(getByTestId('resolved-theme').textContent).toBe('dark');
  });

  // UT-CTX-04
  it('setTheme updates context value and persists to localStorage', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('resolved-theme').textContent).toBe('light');

    act(() => {
      getByTestId('set-dark').click();
    });

    expect(getByTestId('resolved-theme').textContent).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // UT-CTX-05
  it('handles localStorage corruption gracefully (falls back to system)', () => {
    window.localStorage.setItem('theme', 'blue');
    setSystemTheme(false);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // Invalid value -> falls back to 'system', which resolves to 'light'
    expect(getByTestId('resolved-theme').textContent).toBe('light');
  });

  // UT-CTX-06
  it('responds to matchMedia change when theme is system', () => {
    window.localStorage.setItem('theme', 'system');
    const mql = setSystemTheme(false);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('resolved-theme').textContent).toBe('light');

    // Simulate OS changing to dark mode
    act(() => {
      mql._triggerChange(true);
    });

    expect(getByTestId('resolved-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // UT-CTX-07
  it('does NOT follow system changes when user has explicit preference', () => {
    window.localStorage.setItem('theme', 'light');
    const mql = setSystemTheme(false);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('resolved-theme').textContent).toBe('light');

    // Simulate OS changing to dark mode
    act(() => {
      mql._triggerChange(true);
    });

    // Should NOT change because user explicitly chose 'light'
    expect(getByTestId('resolved-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  // UT-CTX-08
  it('cleans up matchMedia listener on unmount', () => {
    const mql = setSystemTheme(false);

    const { unmount } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  // UT-CTX-09
  it('handles localStorage.setItem throwing (private browsing)', () => {
    setSystemTheme(false);
    window.localStorage.removeItem('theme');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // Now mock setItem to throw (simulating private browsing / quota exceeded)
    const origSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    // Should not crash
    act(() => {
      getByTestId('set-dark').click();
    });

    expect(getByTestId('resolved-theme').textContent).toBe('dark');
    expect(warnSpy).toHaveBeenCalledWith('Failed to persist theme to localStorage');

    // Restore
    window.localStorage.setItem = origSetItem;
    warnSpy.mockRestore();
  });

  // UT-CTX-10 (tests useTheme but the error case)
  it('ignores invalid theme values passed to setTheme', () => {
    setSystemTheme(false);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    act(() => {
      getByTestId('set-invalid').click();
    });

    // Should remain as system/light (unchanged)
    expect(getByTestId('theme').textContent).toBe('system');
    expect(getByTestId('resolved-theme').textContent).toBe('light');
  });

  it('sets data-theme attribute on document element', () => {
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles from dark to light correctly', () => {
    window.localStorage.setItem('theme', 'dark');

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('resolved-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      getByTestId('set-light').click();
    });

    expect(getByTestId('resolved-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('handles system preference change from light to dark to light', () => {
    window.localStorage.setItem('theme', 'system');
    const mql = setSystemTheme(false);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('resolved-theme').textContent).toBe('light');

    act(() => {
      mql._triggerChange(true);
    });
    expect(getByTestId('resolved-theme').textContent).toBe('dark');

    act(() => {
      mql._triggerChange(false);
    });
    expect(getByTestId('resolved-theme').textContent).toBe('light');
  });
});
