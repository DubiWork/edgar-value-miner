import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ThemeContext } from './ThemeContext';
import { getItem, setItem } from '../utils/storage';

const VALID_THEMES = ['light', 'dark', 'system'];
const STORAGE_KEY = 'theme';

/**
 * Reads the system color scheme preference via matchMedia.
 * @returns {'dark' | 'light'}
 */
function getSystemTheme() {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

/**
 * Reads the stored theme from localStorage.
 * Returns a valid theme string or 'system' as fallback.
 * @returns {'light' | 'dark' | 'system'}
 */
function getStoredTheme() {
  const stored = getItem(STORAGE_KEY);
  if (VALID_THEMES.includes(stored)) {
    return stored;
  }
  return 'system';
}

/**
 * Resolves the effective theme (light or dark) from the user preference.
 * @param {'light' | 'dark' | 'system'} theme
 * @returns {'light' | 'dark'}
 */
function resolveTheme(theme) {
  if (theme === 'dark' || theme === 'light') {
    return theme;
  }
  return getSystemTheme();
}

/**
 * Applies the resolved theme to the document element.
 * Adds/removes 'dark' class and sets data-theme attribute.
 * @param {'light' | 'dark'} resolved
 */
function applyThemeToDOM(resolved) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', resolved);
}

/**
 * ThemeProvider manages the application theme state.
 *
 * Responsibilities:
 * - Reads initial theme from localStorage (or system preference)
 * - Syncs theme to localStorage, <html> class, and data-theme attribute
 * - Listens for OS color scheme changes when mode is 'system'
 * - Exposes theme, resolvedTheme, and setTheme via context
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const initial = getStoredTheme();
    const resolved = resolveTheme(initial);
    // Apply to DOM synchronously during initialization
    applyThemeToDOM(resolved);
    return resolved;
  });

  /**
   * Sets the user theme preference.
   * Persists to localStorage and updates the DOM.
   */
  const setTheme = useCallback((newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) {
      return;
    }

    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);

    try {
      setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage unavailable — theme still works in-memory
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Failed to persist theme to localStorage');
      }
    }
  }, []);

  // Listen for OS color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      // Only react if user preference is 'system'
      setThemeState((currentTheme) => {
        if (currentTheme === 'system') {
          const newResolved = getSystemTheme();
          setResolvedTheme(newResolved);
          applyThemeToDOM(newResolved);
        }
        return currentTheme;
      });
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
