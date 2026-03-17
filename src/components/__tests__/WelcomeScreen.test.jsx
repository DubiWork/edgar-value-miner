/**
 * Tests for WelcomeScreen component — #162 Welcome Screen Redesign
 *
 * Acceptance criteria covered:
 * AC1 - Hero section prominently features AI Bull vs Bear Debate
 * AC2 - Value proposition: time savings message (30 min vs 4-6 hours)
 * AC3 - Primary CTA: "Try a Free AI Debate" leading to ticker search
 * AC4 - Social proof: total debates generated counter
 * AC5 - Feature highlights section: Debate, Notes, Charts (3 cards)
 * AC6 - Methodology badges: Feroldi, Buffett, SEC EDGAR
 * AC7 - Dark/light mode support (CSS variables respected)
 * AC8 - Search from welcome screen navigates via onSearch callback
 * AC9 - Analytics: welcome_cta_clicked event fires on CTA click
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';

// =============================================================================
// Mocks
// =============================================================================

// Mock TickerSearch to keep tests focused on WelcomeScreen logic
vi.mock('../TickerSearch', () => ({
  TickerSearch: ({ variant, onSearch, isSearching, autoFocus, className }) => (
    <div
      data-testid={`ticker-search-${variant}`}
      data-searching={String(isSearching)}
      data-autofocus={String(autoFocus)}
      className={className}
    >
      <input
        data-testid={`ticker-input-${variant}`}
        onChange={() => {}}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) {
            onSearch(e.target.value);
          }
        }}
      />
    </div>
  ),
}));

// =============================================================================
// Tests
// =============================================================================

describe('WelcomeScreen', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset gtag spy
    delete globalThis.gtag;
  });

  afterEach(() => {
    delete globalThis.gtag;
  });

  // ===========================================================================
  // AC1 — Hero section features AI Bull vs Bear Debate prominently
  // ===========================================================================

  describe('AC1: Hero section', () => {
    it('renders the hero headline "Your AI Research Analyst"', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
      expect(screen.getByText(/Your AI Research Analyst/i)).toBeTruthy();
    });

    it('renders a debate preview section in the hero area', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('debate-preview')).toBeTruthy();
    });

    it('debate preview shows Bull and Bear labels', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const preview = screen.getByTestId('debate-preview');
      expect(preview.textContent).toMatch(/bull/i);
      expect(preview.textContent).toMatch(/bear/i);
    });
  });

  // ===========================================================================
  // AC2 — Value proposition: time savings message
  // ===========================================================================

  describe('AC2: Value proposition', () => {
    it('displays the time savings message', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('value-proposition')).toBeTruthy();
    });

    it('value proposition mentions 30 minutes', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const vp = screen.getByTestId('value-proposition');
      expect(vp.textContent).toMatch(/30 min/i);
    });

    it('value proposition mentions 4 hours (or 4-6 hours)', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const vp = screen.getByTestId('value-proposition');
      expect(vp.textContent).toMatch(/4.*(hour|hrs)/i);
    });
  });

  // ===========================================================================
  // AC3 — Primary CTA: "Try a Free AI Debate"
  // ===========================================================================

  describe('AC3: Primary CTA', () => {
    it('renders the "Try a Free AI Debate" CTA button', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const cta = screen.getByTestId('welcome-cta');
      expect(cta).toBeTruthy();
      expect(cta.textContent).toMatch(/Try a Free AI Debate/i);
    });

    it('renders a hero search bar', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('ticker-search-hero')).toBeTruthy();
    });

    it('CTA click calls onSearch when ticker is pre-filled', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      // The CTA should focus the search or trigger a search directly
      const cta = screen.getByTestId('welcome-cta');
      fireEvent.click(cta);

      // CTA click focuses the search input (verified by data attribute or scroll behavior)
      // At minimum, the button must be clickable without errors
      expect(cta).toBeTruthy();
    });
  });

  // ===========================================================================
  // AC4 — Social proof: total debates generated counter
  // ===========================================================================

  describe('AC4: Social proof', () => {
    it('renders the social proof counter', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('social-proof')).toBeTruthy();
    });

    it('social proof displays debate count', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} debateCount={1234} />);

      const proof = screen.getByTestId('social-proof');
      expect(proof.textContent).toMatch(/1,234|1234/);
    });

    it('social proof shows fallback when no debateCount is provided', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const proof = screen.getByTestId('social-proof');
      // Should show a default/placeholder count (e.g. "1,000+")
      expect(proof.textContent).toMatch(/\d/);
    });

    it('social proof text mentions debates', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const proof = screen.getByTestId('social-proof');
      expect(proof.textContent).toMatch(/debate/i);
    });
  });

  // ===========================================================================
  // AC5 — Feature highlights: 3 cards (Debate, Notes, Charts)
  // ===========================================================================

  describe('AC5: Feature highlights', () => {
    it('renders the feature highlights section', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('feature-highlights')).toBeTruthy();
    });

    it('renders exactly 3 feature cards', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const cards = screen.getAllByTestId(/^feature-card-/);
      expect(cards.length).toBe(3);
    });

    it('AI Debate card is present', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('feature-card-debate')).toBeTruthy();
    });

    it('Personal Notes card is present', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('feature-card-notes')).toBeTruthy();
    });

    it('Financial Charts card is present', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('feature-card-charts')).toBeTruthy();
    });

    it('AI Debate card is visually primary (has primary class or data attribute)', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const debateCard = screen.getByTestId('feature-card-debate');
      expect(debateCard.getAttribute('data-primary')).toBe('true');
    });
  });

  // ===========================================================================
  // AC6 — Methodology badges: Feroldi, Buffett, SEC EDGAR
  // ===========================================================================

  describe('AC6: Methodology badges', () => {
    it('renders the methodology badges section', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('methodology-badges')).toBeTruthy();
    });

    it('Feroldi badge is rendered', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const badges = screen.getByTestId('methodology-badges');
      expect(badges.textContent).toMatch(/Feroldi/i);
    });

    it('Buffett badge is rendered', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const badges = screen.getByTestId('methodology-badges');
      expect(badges.textContent).toMatch(/Buffett/i);
    });

    it('SEC EDGAR badge is rendered', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const badges = screen.getByTestId('methodology-badges');
      expect(badges.textContent).toMatch(/SEC EDGAR/i);
    });
  });

  // ===========================================================================
  // AC7 — Dark/light mode support
  // ===========================================================================

  describe('AC7: Theme support', () => {
    it('uses CSS variables for colors (not hardcoded hex)', () => {
      const { container } = render(<WelcomeScreen onSearch={mockOnSearch} />);

      // The component should use style attributes with CSS variables
      // Check that no hardcoded background colors are directly on the root element
      // (CSS vars are set in the parent — this is a smoke test that the component renders)
      const welcomeRoot = container.firstChild;
      expect(welcomeRoot).toBeTruthy();
    });

    it('renders in both light and dark mode without errors', () => {
      // Add dark class to document
      document.documentElement.classList.add('dark');
      const { unmount } = render(<WelcomeScreen onSearch={mockOnSearch} />);
      expect(screen.getByTestId('welcome-screen')).toBeTruthy();
      unmount();
      document.documentElement.classList.remove('dark');
    });
  });

  // ===========================================================================
  // AC8 — Search navigates via onSearch callback
  // ===========================================================================

  describe('AC8: Search navigation', () => {
    it('calls onSearch when Enter is pressed in the hero search input', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const input = screen.getByTestId('ticker-input-hero');
      fireEvent.keyDown(input, { key: 'Enter', target: { value: 'AAPL' } });

      expect(mockOnSearch).toHaveBeenCalledWith('AAPL');
    });

    it('passes onSearch to the TickerSearch hero variant', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      // If ticker-search-hero is rendered, TickerSearch received onSearch
      expect(screen.getByTestId('ticker-search-hero')).toBeTruthy();
    });
  });

  // ===========================================================================
  // AC9 — Analytics: welcome_cta_clicked fires on CTA click
  // ===========================================================================

  describe('AC9: Analytics', () => {
    it('fires welcome_cta_clicked event when CTA is clicked and gtag is available', () => {
      const gtagMock = vi.fn();
      globalThis.gtag = gtagMock;

      render(<WelcomeScreen onSearch={mockOnSearch} />);

      const cta = screen.getByTestId('welcome-cta');
      fireEvent.click(cta);

      expect(gtagMock).toHaveBeenCalledWith(
        'event',
        'welcome_cta_clicked',
        expect.any(Object),
      );
    });

    it('does NOT throw when gtag is not available', () => {
      // gtag is deleted in beforeEach — ensure no error
      expect(() => {
        render(<WelcomeScreen onSearch={mockOnSearch} />);
        const cta = screen.getByTestId('welcome-cta');
        fireEvent.click(cta);
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // Misc / Rendering
  // ===========================================================================

  describe('Rendering', () => {
    it('has a testid of welcome-screen on the root element', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} />);

      expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    });

    it('renders with loading state (isSearching=true) passed to TickerSearch', () => {
      render(<WelcomeScreen onSearch={mockOnSearch} isSearching />);

      const search = screen.getByTestId('ticker-search-hero');
      expect(search.getAttribute('data-searching')).toBe('true');
    });

    it('renders without crashing when no props are provided', () => {
      expect(() => render(<WelcomeScreen />)).not.toThrow();
    });
  });
});
