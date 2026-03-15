import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './LoadingStates';

// =============================================================================
// Validation helpers
// =============================================================================

function validateEmail(email) {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  return null;
}

function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

// =============================================================================
// Component
// =============================================================================

/**
 * LoginModal — Email/password sign-in and sign-up modal.
 *
 * - Toggle between sign-in and sign-up modes
 * - Client-side validation: email format, password min 6 chars
 * - Error display for auth failures
 * - Loading spinner during auth calls
 * - Works in light and dark mode via CSS custom properties
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {() => void} props.onClose - Callback when modal should close
 */
export function LoginModal({ isOpen, onClose }) {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setFieldErrors({});
    setAuthError(null);
    setSubmitting(false);
  }, []);

  const handleToggleMode = useCallback(() => {
    resetForm();
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
  }, [resetForm]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Client-side validation
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    if (emailErr || passwordErr) {
      setFieldErrors({ email: emailErr, password: passwordErr });
      return;
    }

    setFieldErrors({});
    setAuthError(null);
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      handleClose();
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, mode, signIn, signUp, handleClose]);

  if (!isOpen) return null;

  const isSignUp = mode === 'signup';
  const heading = isSignUp ? 'Create Account' : 'Sign In';
  const submitLabel = isSignUp ? 'Create Account' : 'Sign In';
  const toggleLabel = isSignUp ? 'Sign In' : 'Create Account';
  const toggleText = isSignUp ? 'Already have an account?' : "Don't have an account?";

  return (
    <div
      data-testid="login-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-heading"
        className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Heading */}
        <h2
          id="login-modal-heading"
          className="text-2xl font-bold mb-6"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {heading}
        </h2>

        {/* Auth error */}
        {authError && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
              color: 'var(--color-danger)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
            }}
          >
            {authError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="mb-4">
            <label
              htmlFor="login-email"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: `1px solid ${fieldErrors.email ? 'var(--color-danger)' : 'var(--color-border)'}`,
              }}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email && (
              <p id="login-email-error" className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: `1px solid ${fieldErrors.password ? 'var(--color-danger)' : 'var(--color-border)'}`,
              }}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password && (
              <p id="login-password-error" className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors duration-200 disabled:opacity-60"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: '#ffffff',
            }}
          >
            {submitting && <LoadingSpinner size="sm" />}
            {submitLabel}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {toggleText}{' '}
          <button
            type="button"
            onClick={handleToggleMode}
            className="font-medium underline"
            style={{ color: 'var(--color-accent-text)' }}
          >
            {toggleLabel}
          </button>
        </p>
      </div>
    </div>
  );
}

LoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LoginModal;
