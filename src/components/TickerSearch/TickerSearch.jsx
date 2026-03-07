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

import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Search, X, Clock, Loader2 } from 'lucide-react';
import { useTickerAutocomplete } from '../../hooks/useTickerAutocomplete';
import { useRecentSearches } from '../../hooks/useRecentSearches';
import { sanitizeTickerInput } from '../../utils/inputSanitization';

// =============================================================================
// Constants
// =============================================================================

const SUGGESTION_ID_PREFIX = 'ticker-suggestion-';
const LISTBOX_ID = 'ticker-suggestion-list';

// =============================================================================
// Sub-components
// =============================================================================

/**
 * SuggestionItem - Single suggestion row in the dropdown
 */
function SuggestionItem({ item, index, isHighlighted, onSelect, type }) {
  const itemId = `${SUGGESTION_ID_PREFIX}${index}`;

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
          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
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
 * @param {boolean} props.autoFocus - Whether to auto-focus on mount (desktop only)
 * @param {string} props.className - Additional CSS classes
 */
export function TickerSearch({
  variant = 'hero',
  onSearch,
  isSearching = false,
  autoFocus = false,
  className = '',
}) {
  // State
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);

  // Refs
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Hooks
  const {
    suggestions,
    isLoading: isTickersLoading,
    setQuery,
    loadTickers,
    clearSuggestions,
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
    (isTickersLoading && inputValue.length > 0) ||
    (!isTickersLoading && inputValue.length > 0 && suggestions.length === 0 && !showRecent)
  );

  // -------------------------------------------------------------------------
  // Auto-focus on desktop
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (autoFocus && variant === 'hero' && inputRef.current) {
      // Check if device likely has a physical keyboard (not mobile)
      const isDesktop = window.matchMedia('(min-width: 768px)').matches;
      if (isDesktop) {
        // Small delay to ensure the component is rendered
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [autoFocus, variant]);

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
    const { sanitized } = sanitizeTickerInput(raw);
    const upper = sanitized.toUpperCase();

    setInputValue(upper);
    setQuery(sanitized);
    setIsOpen(true);
    setShowRecent(false);
    setHighlightedIndex(-1);
  }, [setQuery]);

  const handleSelect = useCallback((item) => {
    const ticker = item.ticker;
    const companyName = item.name || item.companyName || '';

    setInputValue(ticker);
    setIsOpen(false);
    setShowRecent(false);
    setHighlightedIndex(-1);
    clearSuggestions();

    addRecentSearch(ticker, companyName);

    if (onSearch) {
      onSearch(ticker);
    }
  }, [onSearch, addRecentSearch, clearSuggestions]);

  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();

    // If a suggestion is highlighted, select it
    if (highlightedIndex >= 0 && highlightedIndex < displayItems.length) {
      handleSelect(displayItems[highlightedIndex]);
      return;
    }

    // Otherwise submit the raw input
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setIsOpen(false);
    setShowRecent(false);
    clearSuggestions();

    addRecentSearch(trimmed, '');

    if (onSearch) {
      onSearch(trimmed);
    }
  }, [highlightedIndex, displayItems, inputValue, onSearch, addRecentSearch, clearSuggestions, handleSelect]);

  const handleClear = useCallback(() => {
    setInputValue('');
    setQuery('');
    clearSuggestions();
    setHighlightedIndex(-1);
    setIsOpen(false);
    setShowRecent(false);
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
          aria-owns={LISTBOX_ID}
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
            aria-controls={LISTBOX_ID}
            aria-activedescendant={
              highlightedIndex >= 0
                ? `${SUGGESTION_ID_PREFIX}${highlightedIndex}`
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
              <X className={isHero ? 'h-5 w-5' : 'h-4 w-4'} />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isDropdownOpen && (
        <ul
          id={LISTBOX_ID}
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
            />
          ))}

          {/* No results message */}
          {!isTickersLoading && inputValue.length > 0 && suggestions.length === 0 && (
            <li
              className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center"
              role="presentation"
              data-testid="no-results-message"
            >
              No matching tickers found
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
  className: PropTypes.string,
};

export default TickerSearch;
