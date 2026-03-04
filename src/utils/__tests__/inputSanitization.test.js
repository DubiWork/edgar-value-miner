/**
 * Tests for Input Sanitization Utilities
 *
 * Tests cover:
 * - Ticker input sanitization (XSS prevention)
 * - HTML tag stripping
 * - Script tag injection prevention
 * - Special character handling
 * - Allowlist enforcement (A-Z, 0-9, hyphen, period)
 * - Edge cases (null, undefined, empty, long input)
 * - General text sanitization
 * - XSS detection function
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeTickerInput,
  sanitizeTextInput,
  containsXss,
} from '../../utils/inputSanitization.js';

// =============================================================================
// Ticker Input Sanitization Tests
// =============================================================================

describe('sanitizeTickerInput', () => {
  // ---------------------------------------------------------------------------
  // Valid Inputs
  // ---------------------------------------------------------------------------

  describe('valid ticker inputs', () => {
    it('should pass through valid uppercase tickers unchanged', () => {
      const result = sanitizeTickerInput('AAPL');
      expect(result.sanitized).toBe('AAPL');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should pass through lowercase tickers (case preserved, validation is caller responsibility)', () => {
      const result = sanitizeTickerInput('aapl');
      expect(result.sanitized).toBe('aapl');
      expect(result.isValid).toBe(true);
    });

    it('should pass through mixed case tickers', () => {
      const result = sanitizeTickerInput('AaPl');
      expect(result.sanitized).toBe('AaPl');
      expect(result.isValid).toBe(true);
    });

    it('should allow hyphens in ticker (e.g., BRK-B)', () => {
      const result = sanitizeTickerInput('BRK-B');
      expect(result.sanitized).toBe('BRK-B');
      expect(result.isValid).toBe(true);
    });

    it('should allow periods in ticker (e.g., BRK.B)', () => {
      const result = sanitizeTickerInput('BRK.B');
      expect(result.sanitized).toBe('BRK.B');
      expect(result.isValid).toBe(true);
    });

    it('should allow numeric characters in ticker', () => {
      const result = sanitizeTickerInput('3M');
      expect(result.sanitized).toBe('3M');
      expect(result.isValid).toBe(true);
    });

    it('should handle single character ticker', () => {
      const result = sanitizeTickerInput('X');
      expect(result.sanitized).toBe('X');
      expect(result.isValid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty / Null / Undefined Inputs
  // ---------------------------------------------------------------------------

  describe('empty and null inputs', () => {
    it('should reject null input', () => {
      const result = sanitizeTickerInput(null);
      expect(result.sanitized).toBe('');
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Input is empty');
    });

    it('should reject undefined input', () => {
      const result = sanitizeTickerInput(undefined);
      expect(result.sanitized).toBe('');
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Input is empty');
    });

    it('should reject empty string', () => {
      const result = sanitizeTickerInput('');
      expect(result.sanitized).toBe('');
      expect(result.isValid).toBe(false);
    });

    it('should reject whitespace-only input', () => {
      const result = sanitizeTickerInput('   ');
      expect(result.sanitized).toBe('');
      expect(result.isValid).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // XSS Attack Vectors
  // ---------------------------------------------------------------------------

  describe('XSS prevention', () => {
    it('should strip script tags', () => {
      const result = sanitizeTickerInput('<script>alert("xss")</script>');
      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).not.toContain('</script>');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should strip img tags with onerror', () => {
      const result = sanitizeTickerInput('<img src=x onerror=alert(1)>');
      expect(result.sanitized).not.toContain('<img');
      expect(result.sanitized).not.toContain('onerror');
    });

    it('should strip svg tags', () => {
      const result = sanitizeTickerInput('<svg onload=alert(1)>');
      expect(result.sanitized).not.toContain('<svg');
      expect(result.sanitized).not.toContain('onload');
    });

    it('should strip iframe tags', () => {
      const result = sanitizeTickerInput('<iframe src="evil.com"></iframe>');
      expect(result.sanitized).not.toContain('<iframe');
    });

    it('should handle javascript: protocol', () => {
      const result = sanitizeTickerInput('javascript:alert(1)');
      expect(result.warnings).toContain('Input contained potential XSS pattern');
    });

    it('should handle event handlers in attributes', () => {
      const result = sanitizeTickerInput('AAPL" onmouseover="alert(1)');
      expect(result.warnings).toContain('Input contained potential XSS pattern');
    });

    it('should handle data: URIs', () => {
      const result = sanitizeTickerInput('data:text/html,<script>alert(1)</script>');
      expect(result.warnings).toContain('Input contained potential XSS pattern');
    });

    it('should remove all HTML tags and return only safe characters', () => {
      const result = sanitizeTickerInput('<b>AAPL</b>');
      expect(result.sanitized).toBe('AAPL');
      expect(result.warnings).toContain('Input contained HTML tags');
    });

    it('should handle nested tags', () => {
      const result = sanitizeTickerInput('<div><script>evil</script>MSFT</div>');
      // After stripping all tags: "evilMSFT" - all remaining chars are alphanumeric
      expect(result.sanitized).toBe('evilMSFT');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle encoded characters that bypass simple filters', () => {
      // These characters should be stripped as they are not in the allowlist
      const result = sanitizeTickerInput('AAPL%3Cscript%3E');
      // % is not in allowlist, so it gets stripped
      expect(result.sanitized).not.toContain('%');
    });
  });

  // ---------------------------------------------------------------------------
  // Special Characters
  // ---------------------------------------------------------------------------

  describe('special character handling', () => {
    it('should strip spaces from ticker', () => {
      const result = sanitizeTickerInput('AA PL');
      // Space is not in allowlist
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip @ symbol', () => {
      const result = sanitizeTickerInput('AAPL@');
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip $ symbol', () => {
      const result = sanitizeTickerInput('$AAPL');
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip # symbol', () => {
      const result = sanitizeTickerInput('#AAPL');
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip parentheses', () => {
      const result = sanitizeTickerInput('AAPL()');
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip curly braces', () => {
      const result = sanitizeTickerInput('AAPL{}');
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip semicolons', () => {
      const result = sanitizeTickerInput('AAPL;DROP');
      expect(result.sanitized).toBe('AAPLDROP');
    });

    it('should strip quotes (single and double)', () => {
      const result = sanitizeTickerInput('AAPL"\'');
      expect(result.sanitized).toBe('AAPL');
    });

    it('should strip backslash', () => {
      const result = sanitizeTickerInput('AAPL\\n');
      expect(result.sanitized).toBe('AAPLn');
    });
  });

  // ---------------------------------------------------------------------------
  // Length Validation
  // ---------------------------------------------------------------------------

  describe('length validation', () => {
    it('should truncate input exceeding max length', () => {
      const result = sanitizeTickerInput('AAPLMSFTTOOLONG');
      expect(result.sanitized.length).toBeLessThanOrEqual(10);
      expect(result.warnings.some(w => w.includes('truncated'))).toBe(true);
    });

    it('should warn about truncation', () => {
      const result = sanitizeTickerInput('VERYLONGTICKER');
      expect(result.warnings.some(w => w.includes('truncated'))).toBe(true);
    });

    it('should handle exactly max length input', () => {
      const result = sanitizeTickerInput('ABCDEFGHIJ'); // 10 chars
      expect(result.sanitized).toBe('ABCDEFGHIJ');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-string Inputs
  // ---------------------------------------------------------------------------

  describe('non-string input handling', () => {
    it('should convert number to string', () => {
      const result = sanitizeTickerInput(123);
      expect(result.sanitized).toBe('123');
      expect(result.isValid).toBe(true);
    });

    it('should handle boolean input', () => {
      const result = sanitizeTickerInput(true);
      expect(result.sanitized).toBe('true');
      expect(result.isValid).toBe(true);
    });

    it('should handle object input', () => {
      const result = sanitizeTickerInput({});
      // "[object Object]" - bracket and space get stripped
      expect(result.isValid).toBe(true); // "objectObje" after truncation/filtering
    });

    it('should handle array input', () => {
      const result = sanitizeTickerInput(['AAPL']);
      expect(result.sanitized).toBe('AAPL');
      expect(result.isValid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Original Preserved
  // ---------------------------------------------------------------------------

  describe('original input preservation', () => {
    it('should always include the original input in result', () => {
      const result = sanitizeTickerInput('<script>alert(1)</script>');
      expect(result.original).toBe('<script>alert(1)</script>');
    });

    it('should preserve original even when sanitized is different', () => {
      const result = sanitizeTickerInput('$AAPL');
      expect(result.original).toBe('$AAPL');
      expect(result.sanitized).toBe('AAPL');
    });
  });
});

// =============================================================================
// Text Input Sanitization Tests
// =============================================================================

describe('sanitizeTextInput', () => {
  it('should pass through plain text unchanged', () => {
    const result = sanitizeTextInput('Hello World');
    expect(result.sanitized).toBe('Hello World');
    expect(result.warnings).toHaveLength(0);
  });

  it('should strip HTML tags from text', () => {
    const result = sanitizeTextInput('Hello <b>World</b>');
    expect(result.sanitized).toBe('Hello World');
    expect(result.warnings).toContain('Input contained HTML tags');
  });

  it('should strip script tags from text', () => {
    const result = sanitizeTextInput('Text<script>alert(1)</script>More');
    expect(result.sanitized).not.toContain('<script>');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should truncate long text', () => {
    const longText = 'A'.repeat(600);
    const result = sanitizeTextInput(longText, { maxLength: 500 });
    expect(result.sanitized.length).toBeLessThanOrEqual(500);
    expect(result.warnings.some(w => w.includes('truncated'))).toBe(true);
  });

  it('should handle null input', () => {
    const result = sanitizeTextInput(null);
    expect(result.sanitized).toBe('');
    expect(result.warnings).toContain('Input is empty');
  });

  it('should handle undefined input', () => {
    const result = sanitizeTextInput(undefined);
    expect(result.sanitized).toBe('');
    expect(result.warnings).toContain('Input is empty');
  });

  it('should respect custom maxLength option', () => {
    const result = sanitizeTextInput('Hello World', { maxLength: 5 });
    expect(result.sanitized).toBe('Hello');
  });

  it('should detect XSS patterns in text', () => {
    const result = sanitizeTextInput('text javascript:alert(1) more');
    expect(result.warnings).toContain('Input contained potential XSS pattern');
  });
});

// =============================================================================
// XSS Detection Tests
// =============================================================================

describe('containsXss', () => {
  it('should return false for safe strings', () => {
    expect(containsXss('AAPL')).toBe(false);
    expect(containsXss('Hello World')).toBe(false);
    expect(containsXss('BRK.B')).toBe(false);
    expect(containsXss('123')).toBe(false);
  });

  it('should detect script tags', () => {
    expect(containsXss('<script>alert(1)</script>')).toBe(true);
  });

  it('should detect img tags', () => {
    expect(containsXss('<img src=x onerror=alert(1)>')).toBe(true);
  });

  it('should detect svg tags', () => {
    expect(containsXss('<svg onload=alert(1)>')).toBe(true);
  });

  it('should detect iframe tags', () => {
    expect(containsXss('<iframe src="evil.com">')).toBe(true);
  });

  it('should detect javascript: protocol', () => {
    expect(containsXss('javascript:alert(1)')).toBe(true);
  });

  it('should detect event handlers', () => {
    expect(containsXss('onmouseover=alert(1)')).toBe(true);
  });

  it('should detect data: URIs', () => {
    expect(containsXss('data:text/html,evil')).toBe(true);
  });

  it('should return false for null input', () => {
    expect(containsXss(null)).toBe(false);
  });

  it('should return false for undefined input', () => {
    expect(containsXss(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(containsXss('')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(containsXss(123)).toBe(false);
  });

  it('should detect generic HTML tags', () => {
    expect(containsXss('<div>text</div>')).toBe(true);
  });
});
