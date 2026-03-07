import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

/**
 * ThemeToggle button for switching between light and dark themes.
 *
 * Features:
 * - 44x44px touch target (WCAG 2.1 AA)
 * - Keyboard accessible (Tab, Enter, Space)
 * - Screen reader announces current theme
 * - 200ms rotation animation (respects prefers-reduced-motion)
 * - Uses Sun icon in dark mode, Moon icon in light mode
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const label = isDark
    ? 'Switch to light theme'
    : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-11 h-11 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
      style={{
        backgroundColor: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {isDark ? (
        <Sun
          className="theme-toggle-icon"
          size={20}
          aria-hidden="true"
        />
      ) : (
        <Moon
          className="theme-toggle-icon"
          size={20}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default ThemeToggle;
