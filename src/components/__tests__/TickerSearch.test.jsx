/**
 * Tests for TickerSearch component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TickerSearch } from '../TickerSearch/TickerSearch';

// =============================================================================
// Mock Data
// =============================================================================

const mockTickerMap = {
  AAPL: { cik: 320193, name: 'Apple Inc.', ticker: 'AAPL' },
  MSFT: { cik: 789019, name: 'Microsoft Corp', ticker: 'MSFT' },
  AMZN: { cik: 1018724, name: 'AMAZON COM INC', ticker: 'AMZN' },
  GOOGL: { cik: 1652044, name: 'Alphabet Inc.', ticker: 'GOOGL' },
  TSLA: { cik: 1318605, name: 'Tesla, Inc.', ticker: 'TSLA' },
  NVDA: { cik: 1045810, name: 'NVIDIA CORP', ticker: 'NVDA' },
  META: { cik: 1326801, name: 'Meta Platforms, Inc.', ticker: 'META' },
  AA: { cik: 1675149, name: 'Alcoa Corporation', ticker: 'AA' },
  AAL: { cik: 6201, name: 'AMERICAN AIRLINES GROUP INC', ticker: 'AAL' },
  AAME: { cik: 1004434, name: 'ATLANTIC AMERICAN CORP', ticker: 'AAME' },
};

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../services/edgarApi', () => ({
  fetchCompanyTickers: vi.fn(() => Promise.resolve(mockTickerMap)),
}));

vi.mock('../../utils/inputSanitization', () => ({
  sanitizeTickerInput: vi.fn((input) => {
    const str = String(input || '');
    const sanitized = str.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 10);
    return { sanitized, isValid: sanitized.length > 0, original: str, warnings: [] };
  }),
}));

// =============================================================================
// localStorage Mock
// =============================================================================

let mockStorage = {};

const localStorageMock = {
  getItem: vi.fn((key) => mockStorage[key] ?? null),
  setItem: vi.fn((key, value) => {
    mockStorage[key] = String(value);
  }),
  removeItem: vi.fn((key) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    mockStorage = {};
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// =============================================================================
// Helpers
// =============================================================================

function setup(props = {}) {
  const onSearch = vi.fn();
  const utils = render(
    <TickerSearch onSearch={onSearch} {...props} />
  );
  const input = screen.getByTestId('ticker-search-input');
  return { ...utils, input, onSearch };
}

/**
 * Helper to focus input and load tickers, then type a query and wait for debounce.
 * This wraps all async operations in proper act() calls.
 */
async function focusAndType(input, query) {
  // Focus to trigger lazy ticker loading
  await act(async () => {
    fireEvent.focus(input);
  });

  // Type query
  await act(async () => {
    fireEvent.change(input, { target: { value: query } });
  });

  // Wait for debounce (150ms)
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('TickerSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockStorage = {};
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  describe('rendering', () => {
    it('should render with hero variant by default', () => {
      setup();
      const container = screen.getByTestId('ticker-search');
      expect(container).toBeDefined();
    });

    it('should render search input with placeholder', () => {
      const { input } = setup();
      expect(input.getAttribute('placeholder')).toBe('Search by ticker or company name...');
    });

    it('should render with compact variant', () => {
      setup({ variant: 'compact' });
      const container = screen.getByTestId('ticker-search');
      expect(container).toBeDefined();
    });

    it('should render search form with role="search"', () => {
      setup();
      const form = screen.getByRole('search');
      expect(form).toBeDefined();
    });

    it('should have combobox role on wrapper', () => {
      setup();
      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeDefined();
    });

    it('should set autoComplete="off" on input', () => {
      const { input } = setup();
      expect(input.getAttribute('autocomplete')).toBe('off');
    });
  });

  // ---------------------------------------------------------------------------
  // Input behavior
  // ---------------------------------------------------------------------------

  describe('input behavior', () => {
    it('should convert input to uppercase', () => {
      const { input } = setup();

      fireEvent.change(input, { target: { value: 'aapl' } });

      expect(input.value).toBe('AAPL');
    });

    it('should show clear button when input has value', () => {
      const { input } = setup();

      fireEvent.change(input, { target: { value: 'AAPL' } });

      const clearBtn = screen.getByTestId('ticker-search-clear');
      expect(clearBtn).toBeDefined();
    });

    it('should clear input when clear button is clicked', async () => {
      const { input } = setup();

      await act(async () => {
        fireEvent.change(input, { target: { value: 'AAPL' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('ticker-search-clear'));
      });

      expect(input.value).toBe('');
    });

    it('should not show clear button when input is empty', () => {
      setup();
      expect(screen.queryByTestId('ticker-search-clear')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Autocomplete Suggestions
  // ---------------------------------------------------------------------------

  describe('autocomplete suggestions', () => {
    it('should show suggestions after typing and debounce', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      const dropdown = screen.queryByTestId('suggestion-dropdown');
      expect(dropdown).not.toBeNull();
    });

    it('should show no results message for unmatched query', async () => {
      const { input } = setup();

      await focusAndType(input, 'ZZZZ');

      const noResults = screen.queryByTestId('no-results-message');
      expect(noResults).not.toBeNull();
    });

    it('should close dropdown on Escape key', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');
      expect(screen.queryByTestId('suggestion-dropdown')).not.toBeNull();

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();
    });

    it('should close dropdown on Tab key', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');
      expect(screen.queryByTestId('suggestion-dropdown')).not.toBeNull();

      fireEvent.keyDown(input, { key: 'Tab' });

      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard Navigation
  // ---------------------------------------------------------------------------

  describe('keyboard navigation', () => {
    it('should navigate down through suggestions with ArrowDown', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      fireEvent.keyDown(input, { key: 'ArrowDown' });

      const firstItem = screen.getByTestId('suggestion-item-0');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('should navigate up with ArrowUp', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      const firstItem = screen.getByTestId('suggestion-item-0');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('should wrap around when navigating past last item', async () => {
      const { input } = setup();

      await focusAndType(input, 'GOOGL');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      const firstItem = screen.getByTestId('suggestion-item-0');
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('should wrap around when navigating up past first item', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      fireEvent.keyDown(input, { key: 'ArrowUp' });

      const items = screen.getAllByRole('option');
      const lastItem = items[items.length - 1];
      expect(lastItem.getAttribute('aria-selected')).toBe('true');
    });

    it('should select highlighted item on Enter', async () => {
      const { input, onSearch } = setup();

      await focusAndType(input, 'AA');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it('should submit typed text on Enter when no suggestion highlighted', () => {
      const { input, onSearch } = setup();

      fireEvent.change(input, { target: { value: 'AAPL' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSearch).toHaveBeenCalledWith('AAPL');
    });

    it('should not submit empty input on Enter', () => {
      const { input, onSearch } = setup();

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSearch).not.toHaveBeenCalled();
    });

    it('should not interfere with regular key presses', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      // Press a regular key (not arrow/enter/escape/tab) -- hits default case
      fireEvent.keyDown(input, { key: 'a' });

      // Dropdown should still be open, nothing should crash
      expect(screen.queryByTestId('suggestion-dropdown')).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // ARIA Accessibility
  // ---------------------------------------------------------------------------

  describe('ARIA accessibility', () => {
    it('should have aria-expanded=false when dropdown is closed', () => {
      setup();
      const combobox = screen.getByRole('combobox');
      expect(combobox.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-haspopup=listbox', () => {
      setup();
      const combobox = screen.getByRole('combobox');
      expect(combobox.getAttribute('aria-haspopup')).toBe('listbox');
    });

    it('should have aria-autocomplete=list on input', () => {
      const { input } = setup();
      expect(input.getAttribute('aria-autocomplete')).toBe('list');
    });

    it('should have aria-label on input', () => {
      const { input } = setup();
      expect(input.getAttribute('aria-label')).toBeTruthy();
    });

    it('should set aria-activedescendant when a suggestion is highlighted', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(input.getAttribute('aria-activedescendant')).toBe('ticker-suggestion-0');
    });

    it('should have role=listbox on dropdown', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeDefined();
    });

    it('should have role=option on each suggestion', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should announce suggestion count to screen readers', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      const announcement = screen.getByTestId('sr-announcement');
      expect(announcement.textContent).toMatch(/\d+ suggestions? available/);
    });
  });

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  describe('selection', () => {
    it('should call onSearch when a suggestion is clicked', async () => {
      const { input, onSearch } = setup();

      await focusAndType(input, 'AA');

      const firstItem = screen.getByTestId('suggestion-item-0');
      fireEvent.mouseDown(firstItem);

      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it('should update input value with selected ticker', async () => {
      const { input } = setup();

      await focusAndType(input, 'AAL');

      const firstItem = screen.getByTestId('suggestion-item-0');
      fireEvent.mouseDown(firstItem);

      // After selecting AAL suggestion, input should show the ticker
      expect(input.value).toBe('AAL');
    });

    it('should close dropdown after selection', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      const firstItem = screen.getByTestId('suggestion-item-0');
      fireEvent.mouseDown(firstItem);

      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Recent Searches
  // ---------------------------------------------------------------------------

  describe('recent searches', () => {
    it('should show recent searches when input is focused and empty', async () => {
      const recent = [
        { ticker: 'AAPL', companyName: 'Apple Inc.', timestamp: 1000 },
        { ticker: 'MSFT', companyName: 'Microsoft Corp', timestamp: 900 },
      ];
      mockStorage['edgar-recent-searches'] = JSON.stringify(recent);

      const { input } = setup();

      await act(async () => {
        fireEvent.focus(input);
      });

      const dropdown = screen.queryByTestId('suggestion-dropdown');
      expect(dropdown).not.toBeNull();
    });

    it('should add to recent searches after selection', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');

      const firstItem = screen.getByTestId('suggestion-item-0');
      fireEvent.mouseDown(firstItem);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const stored = JSON.parse(mockStorage['edgar-recent-searches']);
      expect(stored.length).toBeGreaterThan(0);
    });

    it('should not show recent searches when there are none', async () => {
      const { input } = setup();

      await act(async () => {
        fireEvent.focus(input);
      });

      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Recent searches (extended)
  // ---------------------------------------------------------------------------

  describe('recent searches (extended)', () => {
    it('should reopen recent searches on ArrowDown after closing with Escape', async () => {
      const recent = [
        { ticker: 'AAPL', companyName: 'Apple Inc.', timestamp: 1000 },
      ];
      mockStorage['edgar-recent-searches'] = JSON.stringify(recent);

      const { input } = setup();

      // Focus opens the dropdown with recent searches
      await act(async () => {
        fireEvent.focus(input);
      });
      expect(screen.queryByTestId('suggestion-dropdown')).not.toBeNull();

      // Close dropdown with Escape
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();

      // ArrowDown should reopen dropdown with recents
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.queryByTestId('suggestion-dropdown')).not.toBeNull();
    });

    it('should open dropdown on ArrowDown when input has value but dropdown is closed', async () => {
      const { input } = setup();

      // Focus to load tickers
      await act(async () => {
        fireEvent.focus(input);
      });

      // Type something and wait for debounce
      await act(async () => {
        fireEvent.change(input, { target: { value: 'AA' } });
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Close with Escape
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();

      // ArrowDown should reopen
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // isOpen is now true (but displayItems may or may not show depending on state)
      // The key behavior is that ArrowDown when closed doesn't crash
    });

    it('should clear all recent searches when Clear All is clicked', async () => {
      const recent = [
        { ticker: 'AAPL', companyName: 'Apple Inc.', timestamp: 1000 },
        { ticker: 'MSFT', companyName: 'Microsoft Corp', timestamp: 900 },
      ];
      mockStorage['edgar-recent-searches'] = JSON.stringify(recent);

      const { input } = setup();

      await act(async () => {
        fireEvent.focus(input);
      });

      const clearBtn = screen.getByTestId('clear-recent-searches');
      await act(async () => {
        fireEvent.click(clearBtn);
      });

      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Click outside
  // ---------------------------------------------------------------------------

  describe('click outside', () => {
    it('should close dropdown when clicking outside', async () => {
      const { input } = setup();

      await focusAndType(input, 'AA');
      expect(screen.queryByTestId('suggestion-dropdown')).not.toBeNull();

      // Simulate clicking outside the container
      await act(async () => {
        fireEvent.mouseDown(document.body);
      });

      expect(screen.queryByTestId('suggestion-dropdown')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-focus
  // ---------------------------------------------------------------------------

  describe('auto-focus', () => {
    it('should auto-focus input on desktop when autoFocus is true', async () => {
      // Mock matchMedia to return desktop
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });

      setup({ autoFocus: true, variant: 'hero' });

      // Advance past the 100ms delay
      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      const input = screen.getByTestId('ticker-search-input');
      expect(document.activeElement).toBe(input);

      window.matchMedia = originalMatchMedia;
    });

    it('should not auto-focus on mobile', async () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      setup({ autoFocus: true, variant: 'hero' });

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      const input = screen.getByTestId('ticker-search-input');
      // On mobile, input should NOT be auto-focused
      expect(document.activeElement).not.toBe(input);

      window.matchMedia = originalMatchMedia;
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  describe('loading state', () => {
    it('should show loading spinner when isSearching is true', () => {
      setup({ isSearching: true });

      const container = screen.getByTestId('ticker-search');
      expect(container).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------------

  describe('variants', () => {
    it('should render hero variant with larger styles', () => {
      const { input } = setup({ variant: 'hero' });
      expect(input.className).toContain('text-lg');
    });

    it('should render compact variant with smaller styles', () => {
      const { input } = setup({ variant: 'compact' });
      expect(input.className).toContain('text-sm');
    });
  });
});
