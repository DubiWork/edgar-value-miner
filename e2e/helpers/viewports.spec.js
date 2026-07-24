// @ts-check
import { test, expect } from '@playwright/test';
import { VIEWPORTS } from '../helpers/viewports.js';

test.describe('VIEWPORTS helper', () => {
  test('exports mobile viewport with width 375', () => {
    expect(VIEWPORTS.mobile).toBeDefined();
    expect(VIEWPORTS.mobile.width).toBe(375);
    expect(VIEWPORTS.mobile.height).toBeGreaterThan(0);
  });

  test('exports tablet viewport with width 768', () => {
    expect(VIEWPORTS.tablet).toBeDefined();
    expect(VIEWPORTS.tablet.width).toBe(768);
    expect(VIEWPORTS.tablet.height).toBeGreaterThan(0);
  });

  test('exports desktop viewport with width 1280', () => {
    expect(VIEWPORTS.desktop).toBeDefined();
    expect(VIEWPORTS.desktop.width).toBe(1280);
    expect(VIEWPORTS.desktop.height).toBeGreaterThan(0);
  });

  test('all viewports have width and height as numbers', () => {
    for (const [, vp] of Object.entries(VIEWPORTS)) {
      expect(typeof vp.width).toBe('number');
      expect(typeof vp.height).toBe('number');
      expect(vp.width).toBeGreaterThan(0);
      expect(vp.height).toBeGreaterThan(0);
    }
  });
});
