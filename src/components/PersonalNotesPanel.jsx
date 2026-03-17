/**
 * PersonalNotesPanel — Personal research notes UI for a given company.
 *
 * Features:
 * - Rich textarea with auto-save (via usePersonalNotes hook)
 * - Auto-save indicator: "Saved" (green) / "Saving..." (amber) / "Error" (red)
 * - Unauthenticated users see a "Sign in to save notes" CTA (not empty textarea)
 * - Light/dark mode via CSS custom properties
 * - Mobile responsive (375px)
 *
 * @param {Object} props
 * @param {string} props.ticker - Stock ticker symbol (e.g. "AAPL")
 * @param {string} [props.companyName] - Company display name
 */

import PropTypes from 'prop-types';
import { usePersonalNotes } from '../hooks/usePersonalNotes';
import { useAuth } from '../hooks/useAuth';

// =============================================================================
// Sub-components
// =============================================================================

/**
 * SaveIndicator — shows auto-save status.
 *
 * States:
 * - saving=true   → amber "Saving..."
 * - error         → red   "Error saving"
 * - note exists   → green "Saved"
 * - else          → empty (no indicator — note hasn't been touched yet)
 */
function SaveIndicator({ saving, error, hasNote }) {
  if (saving) {
    return (
      <span
        data-testid="notes-save-indicator"
        className="text-xs font-medium"
        style={{ color: 'var(--color-warning, #f59e0b)' }}
      >
        Saving...
      </span>
    );
  }

  if (error) {
    return (
      <span
        data-testid="notes-save-indicator"
        className="text-xs font-medium"
        style={{ color: 'var(--color-error, #ef4444)' }}
      >
        Error saving
      </span>
    );
  }

  if (hasNote) {
    return (
      <span
        data-testid="notes-save-indicator"
        className="text-xs font-medium"
        style={{ color: 'var(--color-success, #22c55e)' }}
      >
        Saved
      </span>
    );
  }

  // No indicator yet — user hasn't typed anything
  return (
    <span
      data-testid="notes-save-indicator"
      className="text-xs"
      style={{ color: 'var(--color-text-muted)' }}
    />
  );
}

SaveIndicator.propTypes = {
  saving: PropTypes.bool.isRequired,
  error: PropTypes.string,
  hasNote: PropTypes.bool.isRequired,
};

/**
 * SignInCTA — shown to unauthenticated users instead of the textarea.
 */
function SignInCTA() {
  return (
    <div
      data-testid="notes-signin-cta"
      className="flex flex-col items-center justify-center py-8 gap-3 text-center rounded-lg"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px dashed var(--color-border)',
      }}
    >
      <span
        className="text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Sign in to save personal notes for this company
      </span>
    </div>
  );
}

// =============================================================================
// NotesEditor — rendered for authenticated users
// =============================================================================

function NotesEditor({ ticker, companyName }) {
  const { note, saving, error, updateNote } = usePersonalNotes(ticker);

  const content = note?.content ?? '';
  const hasNote = Boolean(note?.content);

  function handleChange(e) {
    updateNote(e.target.value);
  }

  return (
    <>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3
          data-testid="notes-header"
          className="font-semibold text-base"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Your Research Notes for {companyName || ticker}
        </h3>
        <SaveIndicator saving={saving} error={error} hasNote={hasNote} />
      </div>

      {/* Textarea */}
      <textarea
        data-testid="notes-textarea"
        aria-label={`Personal research notes for ${companyName || ticker}`}
        value={content}
        onChange={handleChange}
        placeholder="Add your personal analysis, investment thesis, or reminders..."
        rows={6}
        maxLength={10000}
        className="w-full rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-2 transition-colors"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          '--tw-ring-color': 'var(--color-accent)',
        }}
      />

      {/* Character count */}
      <div
        className="text-right text-xs mt-1"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {content.length} / 10,000
      </div>
    </>
  );
}

NotesEditor.propTypes = {
  ticker: PropTypes.string.isRequired,
  companyName: PropTypes.string,
};

// =============================================================================
// PersonalNotesPanel — main export
// =============================================================================

export function PersonalNotesPanel({ ticker, companyName }) {
  const { isAuthenticated } = useAuth();

  return (
    <section
      data-testid="personal-notes-panel"
      aria-label="Personal Research Notes"
      className="card mt-6"
    >
      {isAuthenticated ? (
        <NotesEditor ticker={ticker} companyName={companyName} />
      ) : (
        <SignInCTA />
      )}
    </section>
  );
}

PersonalNotesPanel.propTypes = {
  ticker: PropTypes.string.isRequired,
  companyName: PropTypes.string,
};

export default PersonalNotesPanel;
