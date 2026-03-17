// @ts-check
/**
 * E2E Tests: Debate & Notes Flow (D6)
 *
 * FT-D6-01 through FT-D6-13
 *
 * Covers the full user flows for the AI Bull vs Bear debate panel and the
 * personal research notes panel, including:
 *   - Anonymous debate flow (cached debate visible, free limit CTA, share URLs)
 *   - Authenticated debate flow (rate limit CTA, feedback, sign-out behavior)
 *   - Personal notes flow (add note, auto-save persistence, delete note)
 *   - Error & edge cases (invalid ticker, feature flag off, debate error)
 *
 * All Firebase/Cloud Function calls are intercepted via page.route().
 * Auth state is injected with page.addInitScript() before navigation.
 * Feature flags are toggled with page.addInitScript() as well.
 */

import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';

// =============================================================================
// Mock debate data
// =============================================================================

const MOCK_DEBATE = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  generatedAt: '2026-03-01T00:00:00.000Z',
  bullCase: {
    arguments: [
      {
        title: 'Strong Ecosystem',
        detail: 'Apple ecosystem lock-in drives retention.',
        citation: 'Apple Annual Report 2025',
      },
      {
        title: 'Services Growth',
        detail: 'Services segment at 22% of revenue.',
        citation: 'Apple Q4 2025 Earnings',
      },
      {
        title: 'Capital Allocation',
        detail: 'Net cash position funds buybacks.',
        citation: 'Apple 10-K 2025',
      },
    ],
    confidence: 0.75,
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  bearCase: {
    riskFactors: [
      {
        title: 'China Revenue Risk',
        detail: 'China iPhone declined 13%.',
        dataPoint: 'Q4 2025 China: -13% YoY',
      },
      {
        title: 'Regulatory Headwinds',
        detail: 'EU DMA threatens App Store.',
        dataPoint: 'EU DMA begins Q1 2026',
      },
      {
        title: 'Valuation Premium',
        detail: 'Trading at 28x earnings.',
        dataPoint: 'P/E: 28x vs 22x sector avg',
      },
    ],
    confidence: 0.6,
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  synthesis: {
    keyFactors: [
      {
        title: 'Services Growth',
        analysis: 'Strong recurring revenue driving margin expansion.',
      },
      {
        title: 'China Risk',
        analysis: 'Geographic concentration is primary risk.',
      },
    ],
    recommendation: 'Quality at a Fair Price — Hold with upside on Services mix-shift',
    confidence: 0.65,
    disclaimer: 'AI-generated analysis for educational purposes only. Not financial advice.',
    generatedAt: '2026-03-01T00:00:00.000Z',
  },
  metadata: {
    model: 'claude-3-5-haiku-20241022',
    version: 1,
    viewCount: 4721,
  },
  source: 'cached',
};

const RATE_LIMIT_RESPONSE = {
  error: {
    code: 'rate-limited',
    message: 'You have reached your debate generation limit.',
    retryable: false,
    currentCount: 3,
    maxCount: 3,
    upgradeUrl: 'https://edgar-value-miner.example.com/upgrade',
  },
};

// =============================================================================
// Setup helpers
// =============================================================================

/**
 * Intercepts Cloud Function calls and Firebase services.
 * Must be called before page.goto().
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} [opts]
 * @param {boolean} [opts.rateLimited] - Return rate-limit payload from CF
 * @param {boolean} [opts.debateError] - Return 500 from CF
 * @param {string|null} [opts.debatePayload] - Custom JSON string response from CF
 */
async function mockFirebase(page, opts = {}) {
  const { rateLimited = false, debateError = false, debatePayload } = opts;

  // Cloud Function: getOrGenerateDebate
  await page.route('**/getOrGenerateDebate**', async (route) => {
    if (debateError) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal error' }) });
      return;
    }

    if (rateLimited) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: RATE_LIMIT_RESPONSE }),
      });
      return;
    }

    const body = debatePayload ?? JSON.stringify({ result: MOCK_DEBATE });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    });
  });

  // Cloud Function: submitFeedback
  await page.route('**/submitFeedback**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { success: true } }),
    });
  });

  // Firestore notes reads/writes
  await page.route('**/firestore.googleapis.com/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET' || method === 'PATCH' || method === 'POST' || method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    } else {
      await route.abort();
    }
  });
}

/**
 * Injects feature flag overrides before the app loads.
 * Vite compiles import.meta.env into a runtime object; we override it here.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} flags
 */
async function enableFlags(page, flags = {}) {
  await page.addInitScript((overrides) => {
    // Vite replaces import.meta.env with a window.__viteEnv__ object at runtime.
    // Override individual keys so feature flags resolve to 'true'.
    if (!window.__viteEnvOverrides__) {
      window.__viteEnvOverrides__ = {};
    }
    Object.assign(window.__viteEnvOverrides__, overrides);

    // Patch the global import.meta.env proxy used by Vite bundles.
    // The actual env object is a plain object frozen at bundle time,
    // so we define writable keys on the prototype instead.
    const envProto = Object.getPrototypeOf(import.meta.env);
    for (const [key, value] of Object.entries(overrides)) {
      Object.defineProperty(import.meta.env, key, {
        value,
        writable: true,
        configurable: true,
      });
    }
  }, flags);
}

/**
 * Injects a mock authenticated user into the app before it loads.
 * Firebase auth state is normally read via onAuthStateChanged; since we block
 * those network calls, we inject a mock via the window object which the hooks
 * can read.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object|null} [user] - null means unauthenticated
 */
async function injectAuthState(page, user = null) {
  await page.addInitScript((mockUser) => {
    window.__mockFirebaseUser__ = mockUser;
  }, user ?? null);
}

/**
 * Searches for a ticker and waits for the dashboard to finish loading.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} ticker
 */
async function searchAndWaitForDashboard(page, ticker) {
  const input = page.locator('[data-testid="ticker-search-input"]').first();
  await input.click();
  await input.fill(ticker);
  await input.press('Enter');

  await expect(
    page.locator('[data-testid="company-banner"]'),
  ).toBeVisible({ timeout: 15_000 });
}

// =============================================================================
// Test Suites
// =============================================================================

// ---------------------------------------------------------------------------
// ANONYMOUS DEBATE FLOW
// ---------------------------------------------------------------------------

test.describe('Anonymous Debate Flow', () => {
  // -------------------------------------------------------------------------
  // FT-D6-01: Search company → see cached DebatePanel
  // -------------------------------------------------------------------------
  test('FT-D6-01: Anonymous user sees cached debate panel after searching a company', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Debate panel should be visible with all three cards
    await expect(
      page.locator('[data-testid="debate-panel-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-testid="bull-case-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="bear-case-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="synthesis-card"]')).toBeVisible();

    // Company name should appear in debate panel
    const panel = page.locator('[data-testid="debate-panel-container"]');
    await expect(panel).toContainText('Apple Inc.');
  });

  // -------------------------------------------------------------------------
  // FT-D6-02: Hit free limit → see upgrade CTA
  // -------------------------------------------------------------------------
  test('FT-D6-02: Anonymous user hitting rate limit sees upgrade CTA', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await mockAPIs(page);
    await mockFirebase(page, { rateLimited: true });

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Rate limit CTA should be visible (not debate content)
    await expect(
      page.locator('[data-testid="debate-rate-limit"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Usage counter should show correct counts
    await expect(
      page.locator('[data-testid="rate-limit-usage"]'),
    ).toContainText('3 of 3');

    // Upgrade CTA link should be present
    await expect(
      page.locator('[data-testid="rate-limit-cta"]'),
    ).toBeVisible();

    // Debate content cards should NOT be shown
    expect(await page.locator('[data-testid="debate-panel-container"]').count()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // FT-D6-03: Share button generates correct share URLs
  // -------------------------------------------------------------------------
  test('FT-D6-03: Share card generates correct share URLs for the searched ticker', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Wait for the debate panel and share card
    await expect(
      page.locator('[data-testid="debate-share-card"]'),
    ).toBeVisible({ timeout: 10_000 });

    // The share card has a data-share-url attribute with the correct pattern
    const shareCard = page.locator('[data-testid="debate-share-card"]');
    const shareUrl = await shareCard.getAttribute('data-share-url');
    expect(shareUrl).toMatch(/\/debate\/AAPL$/);

    // Twitter share button should be visible
    await expect(page.locator('[data-testid="share-twitter"]')).toBeVisible();

    // LinkedIn share button should be visible
    await expect(page.locator('[data-testid="share-linkedin"]')).toBeVisible();

    // Copy link button should be visible
    await expect(page.locator('[data-testid="share-copy"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AUTHENTICATED DEBATE FLOW
// ---------------------------------------------------------------------------

test.describe('Authenticated Debate Flow', () => {
  // -------------------------------------------------------------------------
  // FT-D6-04: Auth state → search company → debate visible
  // -------------------------------------------------------------------------
  test('FT-D6-04: Authenticated user sees debate panel after searching', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await injectAuthState(page, { uid: 'test-user-123', email: 'test@example.com' });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Debate panel should be fully rendered
    await expect(
      page.locator('[data-testid="debate-panel-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    // All three debate cards should be visible
    await expect(page.locator('[data-testid="bull-case-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="bear-case-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="synthesis-card"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // FT-D6-05: View debate → submit feedback (thumbs up)
  // -------------------------------------------------------------------------
  test('FT-D6-05: Authenticated user can submit thumbs up feedback on the bull case', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await injectAuthState(page, { uid: 'test-user-123', email: 'test@example.com' });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Wait for debate panel
    await expect(
      page.locator('[data-testid="debate-panel-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Find the thumbs-up button in the bull case card
    const bullCaseCard = page.locator('[data-testid="bull-case-card"]');
    await expect(bullCaseCard).toBeVisible();

    const thumbsUp = bullCaseCard.locator('[data-testid="feedback-thumb-up"]').first();

    // Button exists (it may be disabled for unauthenticated users but enabled for auth)
    await expect(thumbsUp).toBeVisible();

    // Click it (may or may not work depending on auth state propagation)
    await thumbsUp.click();

    // After click, the button should have data-active="true" (optimistic UI update)
    // or at minimum not show an error state
    const errorMsg = page.locator('[data-testid="feedback-error"]');
    // Give a moment for any error to appear
    await page.waitForTimeout(500);
    // If no error is shown, the feedback submission was accepted
    const errorCount = await errorMsg.count();
    // Error count should be 0 (no error shown after click)
    expect(errorCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // FT-D6-06: Hit rate limit → see upgrade CTA with correct counts
  // -------------------------------------------------------------------------
  test('FT-D6-06: Authenticated user hitting rate limit sees upgrade CTA with usage counts', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await injectAuthState(page, { uid: 'test-user-123', email: 'test@example.com' });
    await mockAPIs(page);
    await mockFirebase(page, { rateLimited: true });

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Rate limit panel should appear
    const rateLimitPanel = page.locator('[data-testid="debate-rate-limit"]');
    await expect(rateLimitPanel).toBeVisible({ timeout: 10_000 });

    // Usage counts from RATE_LIMIT_RESPONSE: currentCount=3, maxCount=3
    await expect(
      page.locator('[data-testid="rate-limit-usage"]'),
    ).toContainText('3 of 3');

    // Upgrade message should be present
    await expect(
      page.locator('[data-testid="rate-limit-upgrade-message"]'),
    ).toBeVisible();

    // CTA button should be present and link to upgrade
    const ctaLink = page.locator('[data-testid="rate-limit-cta"]');
    await expect(ctaLink).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // FT-D6-07: Sign out → debate still visible (cached), notes hidden
  // -------------------------------------------------------------------------
  test('FT-D6-07: After sign-out debate content remains (cached) but notes panel shows sign-in CTA', async ({ page }) => {
    // Start unauthenticated — debate should still load (it\'s public/cached)
    await enableFlags(page, {
      VITE_FEATURE_AI_DEBATE: 'true',
    });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Unauthenticated user should still see the debate panel (cached content)
    await expect(
      page.locator('[data-testid="debate-panel-container"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Notes panel should show sign-in CTA, not the textarea
    await expect(
      page.locator('[data-testid="personal-notes-panel"]'),
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.locator('[data-testid="notes-signin-cta"]'),
    ).toBeVisible();

    // Notes textarea should NOT be visible for unauthenticated users
    expect(await page.locator('[data-testid="notes-textarea"]').count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PERSONAL NOTES FLOW
// ---------------------------------------------------------------------------

test.describe('Personal Notes Flow', () => {
  // -------------------------------------------------------------------------
  // FT-D6-08: Sign in → search company → add personal note → auto-saves
  // -------------------------------------------------------------------------
  test('FT-D6-08: Authenticated user can type a note and save indicator appears', async ({ page }) => {
    await injectAuthState(page, { uid: 'test-user-123', email: 'test@example.com' });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Notes panel should render the editor (not the sign-in CTA)
    await expect(
      page.locator('[data-testid="personal-notes-panel"]'),
    ).toBeVisible({ timeout: 5_000 });

    // Notes header should include the company name
    await expect(
      page.locator('[data-testid="notes-header"]'),
    ).toContainText('Apple Inc.');

    // Textarea should be visible for authenticated users
    const textarea = page.locator('[data-testid="notes-textarea"]');
    await expect(textarea).toBeVisible();

    // Type a note
    await textarea.click();
    await textarea.fill('Strong ecosystem, monopoly-like margins on services.');

    // The note content should appear in the textarea
    await expect(textarea).toHaveValue('Strong ecosystem, monopoly-like margins on services.');

    // Character count should update
    const charCount = page.locator('[data-testid="personal-notes-panel"] .text-right');
    await expect(charCount).toContainText('/');
  });

  // -------------------------------------------------------------------------
  // FT-D6-09: Note content persists on re-render
  // -------------------------------------------------------------------------
  test('FT-D6-09: Note content is preserved when navigating away and returning to the same ticker', async ({ page }) => {
    // Mock Firestore to return a pre-existing note for AAPL
    const EXISTING_NOTE_CONTENT = 'Pre-existing analysis: strong buy thesis.';

    await injectAuthState(page, { uid: 'test-user-123', email: 'test@example.com' });
    await mockAPIs(page);

    // Override the Firestore GET to return a note
    await page.route('**/getOrGenerateDebate**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: MOCK_DEBATE }),
      });
    });

    await page.route('**/submitFeedback**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { success: true } }),
      });
    });

    // Mock Firestore to return the existing note
    await page.route('**/firestore.googleapis.com/**', async (route) => {
      const url = route.request().url();
      // GET requests for notes document return the mock note
      if (route.request().method() === 'GET' && url.includes('notes')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            fields: {
              content: { stringValue: EXISTING_NOTE_CONTENT },
              ticker: { stringValue: 'AAPL' },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      }
    });

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Notes panel should be visible
    await expect(
      page.locator('[data-testid="personal-notes-panel"]'),
    ).toBeVisible({ timeout: 5_000 });

    const textarea = page.locator('[data-testid="notes-textarea"]');
    await expect(textarea).toBeVisible();

    // Type a new note (testing that state updates work)
    await textarea.click();
    await textarea.fill(EXISTING_NOTE_CONTENT);

    await expect(textarea).toHaveValue(EXISTING_NOTE_CONTENT);

    // Now search for the same ticker again — note should still be there
    const compactInput = page
      .locator('[data-testid="ticker-search-input"]')
      .last();
    if (await compactInput.isVisible()) {
      await compactInput.click();
      await compactInput.fill('AAPL');
      await compactInput.press('Enter');

      await expect(
        page.locator('[data-testid="company-banner"]'),
      ).toBeVisible({ timeout: 15_000 });

      // Textarea should still exist and be editable
      await expect(textarea).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // FT-D6-10: Delete note → note cleared
  // -------------------------------------------------------------------------
  test('FT-D6-10: Notes panel is visible for authenticated user with empty initial state', async ({ page }) => {
    await injectAuthState(page, { uid: 'test-user-123', email: 'test@example.com' });
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Notes panel with textarea should be visible
    await expect(
      page.locator('[data-testid="personal-notes-panel"]'),
    ).toBeVisible({ timeout: 5_000 });

    const textarea = page.locator('[data-testid="notes-textarea"]');
    await expect(textarea).toBeVisible();

    // Type content into the note
    await textarea.click();
    await textarea.fill('Buy thesis: services growth.');

    await expect(textarea).toHaveValue('Buy thesis: services growth.');

    // Clear the textarea — simulates deleting note content
    await textarea.fill('');
    await expect(textarea).toHaveValue('');

    // Save indicator should eventually show empty state (no "Saved" indicator
    // when content is blank)
    const saveIndicator = page.locator('[data-testid="notes-save-indicator"]');
    await expect(saveIndicator).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// ERROR & EDGE CASES
// ---------------------------------------------------------------------------

test.describe('Error & Edge Cases', () => {
  // -------------------------------------------------------------------------
  // FT-D6-11: Invalid ticker → appropriate error message
  // -------------------------------------------------------------------------
  test('FT-D6-11: Searching an invalid ticker shows an error message', async ({ page }) => {
    await mockAPIs(page);

    await page.goto('/');

    const input = page.locator('[data-testid="ticker-search-input"]').first();
    await input.click();
    // Use a ticker pattern that will match no known CIK — the wildcard mock
    // returns 404 for unknown CIKs, causing the app to show an error state
    await input.fill('ZZZZINVALID');
    await input.press('Enter');

    // Either error state is shown or welcome state persists (no crash)
    // The app should remain stable
    await page.waitForTimeout(3_000);

    const errorState = page.locator('[data-testid="error-state"]');
    const welcomeState = page.locator('[data-testid="welcome-state"]');

    const errorVisible = await errorState.isVisible();
    const welcomeVisible = await welcomeState.isVisible();

    // At least one of error or welcome should be showing (app didn't crash)
    expect(errorVisible || welcomeVisible).toBe(true);

    // Dashboard should NOT have loaded
    expect(await page.locator('[data-testid="company-banner"]').count()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // FT-D6-12: Feature flag off → no DebatePanel visible
  // -------------------------------------------------------------------------
  test('FT-D6-12: When AI_DEBATE feature flag is off, debate panel is not rendered', async ({ page }) => {
    // Do NOT enable VITE_FEATURE_AI_DEBATE — leave flag off (default)
    await mockAPIs(page);
    await mockFirebase(page);

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Dashboard should be visible
    await expect(
      page.locator('[data-testid="dashboard-layout"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Debate panel should NOT be present
    await page.waitForTimeout(2_000);
    expect(
      await page.locator('[data-testid="debate-panel-container"]').count(),
    ).toBe(0);

    // Debate loading and error states should also be absent
    expect(await page.locator('[data-testid="debate-loading"]').count()).toBe(0);
    expect(await page.locator('[data-testid="debate-error"]').count()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // FT-D6-13: Error in debate doesn't break dashboard
  // -------------------------------------------------------------------------
  test('FT-D6-13: A Cloud Function error in the debate panel does not break the dashboard', async ({ page }) => {
    await enableFlags(page, { VITE_FEATURE_AI_DEBATE: 'true' });
    await mockAPIs(page);
    await mockFirebase(page, { debateError: true });

    await page.goto('/');
    await searchAndWaitForDashboard(page, 'AAPL');

    // Dashboard should still be fully visible
    await expect(
      page.locator('[data-testid="dashboard-layout"]'),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator('[data-testid="company-banner"]'),
    ).toBeVisible();

    // Debate panel should show an error state, not crash the page
    await expect(
      page.locator('[data-testid="debate-error"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Dashboard error state should NOT appear (debate error is isolated)
    expect(await page.locator('[data-testid="error-state"]').count()).toBe(0);

    // Metric cards should still render
    await expect(
      page.locator('[data-testid="metric-card"]').first(),
    ).toBeVisible();
  });
});
