/**
 * Tests for UserMenu component
 *
 * UT-USERMENU-01 through UT-USERMENU-10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserMenu } from '../UserMenu';
import { AuthContext } from '../../contexts/AuthContext';

// =============================================================================
// Helpers
// =============================================================================

function buildAuthCtx(overrides = {}) {
  return {
    user: { uid: 'u1', email: 'investor@example.com', displayName: 'Investor' },
    loading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderMenu(userOverrides = {}, authOverrides = {}) {
  const ctx = buildAuthCtx({
    user: { uid: 'u1', email: 'investor@example.com', displayName: 'Investor', ...userOverrides },
    ...authOverrides,
  });

  const utils = render(
    <AuthContext.Provider value={ctx}>
      <UserMenu />
    </AuthContext.Provider>
  );

  return { ...utils, ctx };
}

// =============================================================================
// Tests
// =============================================================================

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-USERMENU-01: Renders trigger button with user email
  it('renders trigger button showing user email', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /investor@example\.com/i })).toBeTruthy();
  });

  // UT-USERMENU-02: Dropdown is closed by default
  it('dropdown is closed by default', () => {
    renderMenu();
    expect(screen.queryByTestId('user-menu-dropdown')).toBeNull();
  });

  // UT-USERMENU-03: Click trigger opens dropdown
  it('clicking trigger button opens dropdown', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /investor@example\.com/i }));
    expect(screen.getByTestId('user-menu-dropdown')).toBeTruthy();
  });

  // UT-USERMENU-04: Dropdown shows user email
  it('dropdown displays user email', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /investor@example\.com/i }));
    const dropdown = screen.getByTestId('user-menu-dropdown');
    expect(dropdown.textContent).toContain('investor@example.com');
  });

  // UT-USERMENU-05: Dropdown shows tier badge (defaults to Free)
  it('dropdown shows Free tier badge by default', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /investor@example\.com/i }));
    expect(screen.getByTestId('user-tier-badge')).toBeTruthy();
    expect(screen.getByTestId('user-tier-badge').textContent).toMatch(/free/i);
  });

  // UT-USERMENU-06: Sign-out button calls signOut
  it('sign-out button calls signOut', async () => {
    const { ctx } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /investor@example\.com/i }));
    fireEvent.click(screen.getByTestId('user-menu-signout'));
    await waitFor(() => {
      expect(ctx.signOut).toHaveBeenCalledTimes(1);
    });
  });

  // UT-USERMENU-07: Email truncated when long
  it('truncates long email in trigger button', () => {
    renderMenu({ email: 'verylongemailaddress.thatisway@toolong.example.com' });
    const btn = screen.getByRole('button', { name: /verylongemailaddress/i });
    // The inner text span should have overflow/truncate class
    const textSpan = btn.querySelector('span');
    expect(textSpan.className).toMatch(/truncate|overflow/);
  });

  // UT-USERMENU-08: Clicking trigger again closes dropdown
  it('clicking trigger again closes dropdown', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: /investor@example\.com/i });
    fireEvent.click(trigger);
    expect(screen.getByTestId('user-menu-dropdown')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByTestId('user-menu-dropdown')).toBeNull();
  });

  // UT-USERMENU-09: Dropdown closes after sign-out
  it('dropdown closes after sign-out is triggered', async () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /investor@example\.com/i }));
    fireEvent.click(screen.getByTestId('user-menu-signout'));
    await waitFor(() => {
      expect(screen.queryByTestId('user-menu-dropdown')).toBeNull();
    });
  });

  // UT-USERMENU-10: Trigger button is keyboard accessible
  it('trigger button has type="button" for keyboard accessibility', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: /investor@example\.com/i });
    expect(trigger.getAttribute('type')).toBe('button');
  });
});
