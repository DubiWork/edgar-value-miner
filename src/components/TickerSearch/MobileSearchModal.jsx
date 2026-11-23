import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * Centered full-width search overlay rendered via Portal for mobile viewports.
 * Dismisses cleanly on Escape, backdrop tap, or close button click while locking body scroll.
 */
export function MobileSearchModal({ isOpen, onClose, children }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      data-testid="mobile-search-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search companies"
        data-testid="mobile-search-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            dir="auto"
            className="text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            חיפוש חברה · Search Ticker
          </span>
          <button
            type="button"
            data-testid="mobile-search-close"
            onClick={onClose}
            aria-label="Close search"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

MobileSearchModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default MobileSearchModal;
