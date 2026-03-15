/**
 * Tests for LoginModal component
 *
 * UT-LOGIN-01 through UT-LOGIN-16
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginModal } from '../LoginModal';
import { AuthContext } from '../../contexts/AuthContext';

// =============================================================================
// Helpers
// =============================================================================

function buildAuthCtx(overrides = {}) {
  return {
    user: null,
    loading: false,
    error: null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn(),
    ...overrides,
  };
}

function renderModal(props = {}, authOverrides = {}) {
  const ctx = buildAuthCtx(authOverrides);
  const onClose = props.onClose ?? vi.fn();

  const utils = render(
    <AuthContext.Provider value={ctx}>
      <LoginModal isOpen={true} onClose={onClose} {...props} />
    </AuthContext.Provider>
  );

  return { ...utils, ctx, onClose };
}

// =============================================================================
// Tests
// =============================================================================

describe('LoginModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-LOGIN-01: Renders nothing when isOpen is false
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AuthContext.Provider value={buildAuthCtx()}>
        <LoginModal isOpen={false} onClose={vi.fn()} />
      </AuthContext.Provider>
    );
    expect(container.firstChild).toBeNull();
  });

  // UT-LOGIN-02: Renders sign-in form by default
  it('renders sign-in form by default', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  // UT-LOGIN-03: Toggle to sign-up mode
  it('toggles to sign-up mode when "Create account" link is clicked', () => {
    renderModal();
    const toggleBtn = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('heading', { name: /create account/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create account/i, hidden: false })).toBeTruthy();
  });

  // UT-LOGIN-04: Toggle back to sign-in from sign-up
  it('toggles back to sign-in mode from sign-up', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeTruthy();
  });

  // UT-LOGIN-05: Client-side validation — empty email
  it('shows validation error for empty email on submit', async () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /^sign in$/i });
    fireEvent.click(submitBtn);
    expect(await screen.findByText(/email is required/i)).toBeTruthy();
  });

  // UT-LOGIN-06: Client-side validation — invalid email format
  it('shows validation error for invalid email format', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'notanemail' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/valid email/i)).toBeTruthy();
  });

  // UT-LOGIN-07: Client-side validation — empty password
  it('shows validation error for empty password', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/password is required/i)).toBeTruthy();
  });

  // UT-LOGIN-08: Client-side validation — password too short (< 6 chars)
  it('shows validation error when password is less than 6 characters', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/at least 6 characters/i)).toBeTruthy();
  });

  // UT-LOGIN-09: Calls signIn with correct credentials
  it('calls signIn with email and password on valid sign-in submit', async () => {
    const { ctx } = renderModal();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => {
      expect(ctx.signIn).toHaveBeenCalledWith('user@test.com', 'password123');
    });
  });

  // UT-LOGIN-10: Calls signUp in sign-up mode
  it('calls signUp with email and password on valid sign-up submit', async () => {
    const { ctx } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } });
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
    await waitFor(() => {
      expect(ctx.signUp).toHaveBeenCalledWith('new@test.com', 'mypassword');
    });
  });

  // UT-LOGIN-11: Displays loading spinner during auth call
  it('shows loading spinner while auth call is in progress', async () => {
    let resolveSignIn;
    const signIn = vi.fn(() => new Promise((resolve) => { resolveSignIn = resolve; }));
    renderModal({}, { signIn });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /loading/i })).toBeTruthy();
    });

    resolveSignIn();
  });

  // UT-LOGIN-12: Displays auth error message from failed signIn
  it('displays auth error when signIn rejects', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('auth/wrong-password'));
    renderModal({}, { signIn });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  // UT-LOGIN-13: Close button calls onClose
  it('close button calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // UT-LOGIN-14: Clicking backdrop calls onClose
  it('clicking the backdrop overlay calls onClose', () => {
    const { onClose } = renderModal();
    const backdrop = screen.getByTestId('login-modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // UT-LOGIN-15: Form fields are accessible with labels
  it('email and password inputs have associated labels', () => {
    renderModal();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  // UT-LOGIN-16: onClose called after successful sign-in
  it('calls onClose after successful sign-in', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    const { onClose } = renderModal({}, { signIn });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
