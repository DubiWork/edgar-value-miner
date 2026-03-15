import { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// =============================================================================
// Tier badge config
// =============================================================================

/**
 * @typedef {'Free'|'Basic'|'Premium'} UserTier
 */

const TIER_STYLES = {
  Free: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' },
  Basic: { bg: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent-text)' },
  Premium: { bg: 'color-mix(in srgb, var(--color-info) 15%, transparent)', color: 'var(--color-info)' },
};

// =============================================================================
// Component
// =============================================================================

/**
 * UserMenu — Dropdown showing user email, tier badge, and sign-out button.
 *
 * Integrates into the application header for authenticated users.
 * Sign-out clears auth state (handled by AuthProvider).
 *
 * @param {object} props
 * @param {UserTier} [props.tier='Free'] - User subscription tier
 */
export function UserMenu({ tier = 'Free' }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    try {
      await signOut();
    } catch {
      // signOut errors are handled by AuthProvider
    }
  }, [signOut]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const email = user?.email ?? '';
  const tierStyle = TIER_STYLES[tier] ?? TIER_STYLES.Free;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 max-w-[200px] px-3 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          backgroundColor: open ? 'var(--color-bg-hover)' : 'transparent',
          color: 'var(--color-text-secondary)',
        }}
        aria-label={email}
      >
        <span className="truncate overflow-hidden text-sm max-w-[140px]">{email}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          data-testid="user-menu-dropdown"
          role="menu"
          className="absolute right-0 mt-1 w-56 rounded-xl shadow-xl z-40 py-2"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <p
              className="text-xs mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Signed in as
            </p>
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {email}
            </p>
            {/* Tier badge */}
            <span
              data-testid="user-tier-badge"
              className="inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: tierStyle.bg, color: tierStyle.color }}
            >
              {tier}
            </span>
          </div>

          {/* Sign out */}
          <div className="px-2 pt-2">
            <button
              type="button"
              role="menuitem"
              data-testid="user-menu-signout"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-200"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <LogOut size={14} aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

UserMenu.propTypes = {
  tier: PropTypes.oneOf(['Free', 'Basic', 'Premium']),
};

export default UserMenu;
