/**
 * Visual regression — golden paths.
 *
 * Captures one screenshot per primary route at the canonical 1440×900
 * desktop viewport AND at 375×812 mobile. Captures both light and dark
 * mode for `/` (the highest-density chrome) to lock the dark-mode token
 * map; secondary routes only run light to keep CI under 60s.
 *
 * **What this catches that ESLint doesn't:**
 *   - Token-resolution regressions (CSS var renamed in Aura)
 *   - Layout shifts from new Angular versions
 *   - Font Awesome glyph swaps
 *   - PrimeNG component default changes (e.g. button radius, table padding)
 *   - Tailwind v4 utility renames
 *
 * **Failure mode:** a diff in the PR means EITHER an intentional visual
 * change (re-baseline with `--update-snapshots` after PR review) OR a
 * silent regression in a dependency / token (the value).
 *
 * Hydration completion is detected via `app-root` having `ng-version`
 * attribute populated and `@defer (hydrate on viewport)` blocks resolved.
 * `waitForLoadState('networkidle')` is the simple proxy here; if it
 * becomes flaky, replace with a targeted `page.evaluate` poll.
 */
import { test, expect } from '../fixtures/auth';

const ROUTES = [
  { path: '/', name: 'overview' },
  { path: '/customers', name: 'customers' },
  { path: '/inbox', name: 'inbox' },
  { path: '/chat', name: 'chat' },
  { path: '/cards', name: 'cards' },
  { path: '/movies', name: 'movies' },
] as const;

const VIEWPORTS = [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 375, height: 812, label: 'mobile' },
] as const;

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} @ ${viewport.label} — light`, async ({ authedPage }) => {
      await authedPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await authedPage.goto(route.path, { waitUntil: 'networkidle' });
      // Pause briefly for any post-hydration micro-tasks to settle.
      await authedPage.waitForTimeout(300);
      await expect(authedPage).toHaveScreenshot(`${route.name}-${viewport.label}-light.png`, {
        fullPage: true,
      });
    });
  }
}

// Dark mode — only the overview, since the dark-mode token map is the
// same across routes (no per-route dark stylesheet). One screenshot
// catches any regression in the dark token pipeline.
test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('overview @ desktop — dark', async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 1440, height: 900 });
    await authedPage.goto('/', { waitUntil: 'networkidle' });
    await authedPage.waitForTimeout(300);
    await expect(authedPage).toHaveScreenshot('overview-desktop-dark.png', {
      fullPage: true,
    });
  });
});
