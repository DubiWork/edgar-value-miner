/**
 * TickerSearch Component
 *
 * Primary search component for the EDGAR Value Miner. Supports two layout
 * variants: "hero" (large, centered for welcome state) and "compact" (smaller
 * for header bar). Includes autocomplete with keyboard navigation, recent
 * searches, and full ARIA combobox accessibility.
 *
 * @module TickerSearch
 */

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import PropTypes from 'prop-types';
import { Search, X, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useTickerAutocomplete } from '../../hooks/useTickerAutocomplete';
import { useRecentSearches } from '../../hooks/useRecentSearches';
import * as sanitization from '../../utils/inputSanitization';

const TICKER_SHAPE_REGEX = /^[A-Z]{1,5}(?:[.-][A-Z0-9]{1,2})?$/;

// =============================================================================
// Sub-components
// =============================================================================

/**
 * SuggestionItem - Single suggestion row in the dropdown
 */
function SuggestionItem({ item, index, isHighlighted, onSelect, type, idPrefix }) {
  const itemId = `${idPrefix}${index}`;

  return (
    <li
      id={itemId}
      role="option"
      aria-selected={isHighlighted}
      data-testid={`suggestion-item-${index}`}
      className={`
        flex items-center justify-between px-4 py-3 cursor-pointer
        min-h-[44px]
        ${isHighlighted
          ? 'bg-brand-50 dark:bg-brand-900/20 text-gray-900 dark:text-white'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }
      `}
      onMouseDown={(e) => {
        // Use mouseDown instead of click to fire before blur
        e.preventDefault();
        onSelect(item);
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {type === 'recent' && (
          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true" />
        )}
        <span className="font-semibold text-sm shrink-0">{item.ticker}</span>
        <span className="text-gray-500 dark:text-gray-400 text-sm truncate">
          {item.name || item.companyName}
        </span>
      </div>
    </li>
  );
}

SuggestionItem.propTypes = {
  item: PropTypes.shape({
    ticker: PropTypes.string.isRequired,
    name: PropTypes.string,
    companyName: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  isHighlighted: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  type: PropTypes.oneOf(['suggestion', 'recent']),
  idPrefix: PropTypes.string.isRequired,
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * TickerSearch - The main search input with autocomplete
 *
 * @param {Object} props
 * @param {'hero'|'compact'} props.variant - Layout variant
 * @param {Function} props.onSearch - Callback when a search is triggered
 * @param {boolean} props.isSearching - Whether a search is currently in progress
 * @param {boolean} props.autoFocus - Whether to auto-focus on mount (desktop only unless autoFocusOnMobile)
 * @param {boolean} props.autoFocusOnMobile - Allow auto-focus even on mobile viewports (e.g. inside modal)
 * @param {string} props.className - Additional CSS classes
 */
export function TickerSearch({
  variant = 'hero',
  onSearch,
  isSearching = false,
  autoFocus = false,
  autoFocusOnMobile = false,
  className = '',
}) {
  // State
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);
  const [inlineFeedback, setInlineFeedback] = useState(null);

  // Instance-unique IDs for ARIA (supports multiple TickerSearch instances)
  const instanceId = useId();
  const listboxId = `${instanceId}-listbox`;
  const suggestionIdPrefix = `${instanceId}-suggestion-`;

  // Refs
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Hooks
  const {
    suggestions,
    isLoading: isTickersLoading,
    isReady: isTickersReady,
    loadError: tickersLoadError,
    setQuery,
    loadTickers,
    clearSuggestions,
    resolveQuery,
    resolveQuerySync,
  } = useTickerAutocomplete();

  const {
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  } = useRecentSearches();

  // Determine what items are currently shown in the dropdown
  const displayItems = showRecent && !inputValue
    ? recentSearches.map((r) => ({ ...r, name: r.companyName }))
    : suggestions;

  const isDropdownOpen = isOpen && (
    displayItems.length > 0 ||
    Boolean(inlineFeedback) ||
    (isTickersLoading && inputValue.length > 0) ||
    (!isTickersLoading && inputValue.length > 0 && suggestions.length === 0 && !showRecent)
  );

  // -------------------------------------------------------------------------
  // Auto-focus on desktop
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const isDesktopHero =
        variant === 'hero' && window.matchMedia('(min-width: 768px)').matches;
      if (autoFocusOnMobile || isDesktopHero) {
        // Small delay to ensure the component is rendered
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [autoFocus, autoFocusOnMobile, variant]);

  // -------------------------------------------------------------------------
  // Click outside handler
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowRecent(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleFocus = useCallback(() => {
    loadTickers();
    setIsOpen(true);
    if (!inputValue && recentSearches.length > 0) {
      setShowRecent(true);
    }
  }, [inputValue, recentSearches.length, loadTickers]);

  const handleInputChange = useCallback((e) => {
    const raw = e.target.value;
    const sanitizeFn = sanitization.sanitizeSearchQuery || sanitization.sanitizeTickerInput;
    const { sanitized } = sanitizeFn(raw);
    const upper = sanitized.toUpperCase();

    setInputValue(upper);
    setQuery(sanitized);
    setIsOpen(true);
    setShowRecent(false);
    setHighlightedIndex(-1);
    setInlineFeedback(null);
  }, [setQuery]);

  const handleSelect = useCallback((item) => {
    const ticker = item.ticker;
    const companyName = item.name || item.companyName || '';

    setInputValue(ticker);
    setIsOpen(false);
    setShowRecent(false);
    setHighlightedIndex(-1);
    setInlineFeedback(null);
    clearSuggestions();

    addRecentSearch(ticker, companyName);

    if (onSearch) {
      onSearch(ticker);
    }
  }, [onSearch, addRecentSearch, clearSuggestions]);

  const submitResolvedTicker = useCallback((ticker, companyName = '') => {
    setIsOpen(false);
    setShowRecent(false);
    setHighlightedIndex(-1);
    setInlineFeedback(null);
    clearSuggestions();

    addRecentSearch(ticker, companyName);

    if (onSearch) {
      onSearch(ticker);
    }
  }, [onSearch, addRecentSearch, clearSuggestions]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    // 1. If a suggestion is highlighted, select it immediately
    if (highlightedIndex >= 0 && highlightedIndex < displayItems.length) {
      handleSelect(displayItems[highlightedIndex]);
      return;
    }

    const trimmed = inputValue.trim().toUpperCase();
    if (!trimmed) return;

    const isTickerShape = TICKER_SHAPE_REGEX.test(trimmed);
    const alias = trimmed.includes('.') ? trimmed.replace(/\./g, '-') : trimmed.replace(/-/g, '.');

    // 2. Check current live suggestions first
    if (suggestions.length > 0) {
      const exactInSuggestions = suggestions.find((item) => {
        const t = String(item.ticker || '').toUpperCase();
        return t === trimmed || t === alias;
      });
      if (exactInSuggestions) {
        handleSelect(exactInSuggestions);
        return;
      }
      if (!isTickerShape || suggestions.length > 0) {
        handleSelect(suggestions[0]);
        return;
      }
    }

    // 3. If directory is already loaded synchronously, check exact/company-name matches before debounce
    if (isTickersReady && typeof resolveQuerySync === 'function') {
      const syncResult = resolveQuerySync(trimmed);
      if (syncResult.exactTickerMatch) {
        handleSelect(syncResult.exactTickerMatch);
        return;
      }
      if (syncResult.bestMatch) {
        handleSelect(syncResult.bestMatch);
        return;
      }
    }

    // 4. For company-name / multi-word / long queries (not a valid ticker shape), resolve via directory
    // and show helpful inline guidance instead of navigating to a full-page Error screen.
    if (!isTickerShape) {
      if (typeof resolveQuery === 'function') {
        const resolved = await resolveQuery(trimmed);
        if (resolved.exactTickerMatch) {
          handleSelect(resolved.exactTickerMatch);
          return;
        }
        if (resolved.bestMatch) {
          handleSelect(resolved.bestMatch);
          return;
        }
        setIsOpen(true);
        setShowRecent(false);
        setInlineFeedback(
          resolved.loadFailed
            ? 'לא הצלחנו לטעון הצעות כרגע — נסה להזין סימול מניה קצר באנגלית (כמו AAPL, MSFT, SAP) או ללחוץ לניסיון חוזר.'
            : `לא נמצאה חברה תואמת עבור "${trimmed}" — נסה שם חברה באנגלית או סימול מניה (כמו AAPL, MSFT, SAP).`
        );
        return;
      }
    }

    // 5. Direct short ticker symbol submission
    submitResolvedTicker(trimmed, '');
  }, [
    highlightedIndex,
    displayItems,
    inputValue,
    suggestions,
    isTickersReady,
    resolveQuerySync,
    resolveQuery,
    handleSelect,
    submitResolvedTicker,
  ]);

  const handleClear = useCallback(() => {
    setInputValue('');
    setQuery('');
    clearSuggestions();
    setHighlightedIndex(-1);
    setIsOpen(false);
    setShowRecent(false);
    setInlineFeedback(null);
    inputRef.current?.focus();
  }, [setQuery, clearSuggestions]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!isDropdownOpen) {
          setIsOpen(true);
          if (!inputValue && recentSearches.length > 0) {
            setShowRecent(true);
          }
          return;
        }
        setHighlightedIndex((prev) => {
          const next = prev + 1;
          return next >= displayItems.length ? 0 : next;
        });
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        if (!isDropdownOpen) return;
        setHighlightedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? displayItems.length - 1 : next;
        });
        break;
      }

      case 'Enter': {
        e.preventDefault();
        handleSubmit();
        break;
      }

      case 'Escape': {
        e.preventDefault();
        if (isDropdownOpen) {
          e.stopPropagation();
          setIsOpen(false);
          setShowRecent(false);
          setHighlightedIndex(-1);
        }
        break;
      }

      case 'Tab': {
        setIsOpen(false);
        setShowRecent(false);
        setHighlightedIndex(-1);
        break;
      }

      default:
        break;
    }
  }, [isDropdownOpen, displayItems.length, inputValue, recentSearches.length, handleSubmit]);

  // -------------------------------------------------------------------------
  // Variant-specific styles
  // -------------------------------------------------------------------------

  const isHero = variant === 'hero';

  const containerClasses = isHero
    ? 'w-full max-w-xl mx-auto'
    : 'w-full max-w-lg';

  const inputClasses = isHero
    ? 'w-full pl-12 pr-12 py-4 text-lg rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow'
    : 'w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow';

  const iconClasses = isHero
    ? 'absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6'
    : 'absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5';

  const clearBtnClasses = isHero
    ? 'absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center'
    : 'absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className={`relative ${containerClasses} ${className}`}
      data-testid="ticker-search"
    >
      <form
        role="search"
        onSubmit={handleSubmit}
        aria-label="Search for a company by ticker symbol or name"
      >
        <div
          role="combobox"
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
          aria-owns={listboxId}
        >
          {/* Search Icon or Loading Spinner */}
          {isSearching ? (
            <Loader2
              className={`${iconClasses} text-brand-500 animate-spin`}
              aria-hidden="true"
            />
          ) : (
            <Search
              className={`${iconClasses} text-gray-400`}
              aria-hidden="true"
            />
          )}

          {/* Input */}
          <input
            ref={inputRef}
            type="search"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search by ticker or company name..."
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={
              highlightedIndex >= 0
                ? `${suggestionIdPrefix}${highlightedIndex}`
                : undefined
            }
            aria-label="Search for a company by ticker symbol or name"
            enterKeyHint="search"
            className={inputClasses}
            data-testid="ticker-search-input"
          />

          {/* Clear Button */}
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className={clearBtnClasses}
              data-testid="ticker-search-clear"
            >
              <X className={isHero ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isDropdownOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-[400px] overflow-y-auto"
          data-testid="suggestion-dropdown"
        >
          {/* Section header for recent searches */}
          {showRecent && !inputValue && recentSearches.length > 0 && (
            <li
              className="flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50"
              role="presentation"
            >
              <span>Recent Searches</span>
              <button
                type="button"
                onClick={() => clearRecentSearches()}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Clear all recent searches"
                data-testid="clear-recent-searches"
              >
                Clear All
              </button>
            </li>
          )}

          {/* Loading indicator */}
          {isTickersLoading && inputValue.length > 0 && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center" role="presentation">
              Loading suggestions...
            </li>
          )}

          {/* Suggestions / Recent items */}
          {displayItems.map((item, index) => (
            <SuggestionItem
              key={item.ticker}
              item={item}
              index={index}
              isHighlighted={index === highlightedIndex}
              onSelect={handleSelect}
              type={showRecent && !inputValue ? 'recent' : 'suggestion'}
              idPrefix={suggestionIdPrefix}
            />
          ))}

          {/* Inline feedback on unmatched company-name Enter */}
          {inlineFeedback && (
            <li
              className="px-4 py-3 text-sm text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/30 border-t border-amber-200/70 dark:border-amber-800/40 text-center"
              role="status"
              dir="auto"
              data-testid="search-inline-feedback"
            >
              {inlineFeedback}
            </li>
          )}

          {/* Directory load error with retry action */}
          {!isTickersLoading && tickersLoadError && !inlineFeedback && inputValue.trim().length > 0 && suggestions.length === 0 && (
            <li
              className="px-4 py-3 text-sm text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30 flex flex-col items-center gap-2 text-center"
              role="presentation"
              data-testid="tickers-load-error-message"
            >
              <span dir="auto">
                לא ניתן לטעון הצעות כרגע — הקלד סימול מניה קצר (למשל MSFT, AAPL, SAP) ולחץ Enter
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  loadTickers();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-amber-200/70 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 cursor-pointer transition-colors"
                data-testid="retry-load-tickers-btn"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>נסה לטעון הצעות שוב</span>
              </button>
            </li>
          )}

          {/* No results message */}
          {!isTickersLoading && !tickersLoadError && !inlineFeedback && inputValue.trim().length > 0 && suggestions.length === 0 && (
            <li
              className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center"
              role="presentation"
              data-testid="no-results-message"
            >
              No matching tickers found — try an English company name or ticker symbol (e.g. AAPL, MSFT, SAP)
            </li>
          )}

          {/* Recent search remove buttons (shown inline) */}
          {showRecent && !inputValue && recentSearches.length > 0 && (
            <li className="sr-only" role="presentation">
              Use arrow keys to navigate recent searches
            </li>
          )}
        </ul>
      )}

      {/* Screen reader live region for suggestion count */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="sr-announcement"
      >
        {isDropdownOpen && displayItems.length > 0 && (
          `${displayItems.length} suggestion${displayItems.length !== 1 ? 's' : ''} available`
        )}
      </div>
    </div>
  );
}

TickerSearch.propTypes = {
  variant: PropTypes.oneOf(['hero', 'compact']),
  onSearch: PropTypes.func,
  isSearching: PropTypes.bool,
  autoFocus: PropTypes.bool,
  autoFocusOnMobile: PropTypes.bool,
  className: PropTypes.string,
};

export default TickerSearch;
