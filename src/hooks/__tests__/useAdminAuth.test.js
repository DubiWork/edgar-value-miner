import { describe, it, expect } from 'vitest';
import { isAdminEmail, getAdminEmails } from '../useAdminAuth';

describe('useAdminAuth helpers', () => {
  it('recognizes default admin email case-insensitively', () => {
    expect(getAdminEmails()).toContain('dubigreenfeld@gmail.com');
    expect(isAdminEmail('dubigreenfeld@gmail.com')).toBe(true);
    expect(isAdminEmail('DubiGreenfeld@gmail.com')).toBe(true);
  });

  it('returns false for non-admin or invalid emails', () => {
    expect(isAdminEmail('visitor@example.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});
