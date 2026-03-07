import { createContext } from 'react';

/**
 * @typedef {Object} ThemeContextValue
 * @property {'light' | 'dark' | 'system'} theme - The user's preference
 * @property {'light' | 'dark'} resolvedTheme - The actual applied theme
 * @property {(theme: 'light' | 'dark' | 'system') => void} setTheme - Update the theme
 */

/**
 * ThemeContext holds the current theme state.
 * Consumers should use the useTheme hook rather than accessing this directly.
 */
export const ThemeContext = createContext(null);
