/**
 * Component-level visual regression — baselines captured from Storybook
 * stories in isolation.
 *
 * **Why this complements golden-paths.spec.ts**
 *
 *   - `golden-paths.spec.ts` captures full routes — catches layout-level
 *     regressions but a single component change can hide inside a noisy
 *     diff.
 *   - This file captures each story in isolation at a fixed viewport,
 *     producing per-component baselines. A button-padding bump shows up
 *     as a small focused diff in `Button-primary.png`, not buried in a
 *     full-page screenshot.
 *
 * Pattern mirrors what Chromatic does for Polaris / Primer / Atlassian DS
 * but without the SaaS dependency.
 *
 * Set-up: this suite presumes Storybook is built and served at
 * `STORYBOOK_BASE_URL` (default http://127.0.0.1:6006). CI flow:
 *   1. `npm run build-storybook` → `dist/storybook/`
 *   2. Serve `dist/storybook/` (e.g. `npx http-server dist/storybook -p 6006`)
 *   3. Run this suite.
 *
 * The Storybook iframe URL is `/iframe.html?id=<story-id>&viewMode=story`.
 * Story IDs follow the kebab-case `title/name` convention from each
 * .stories.ts file.
 */
import { test, expect } from '@playwright/test';

const STORYBOOK_BASE_URL = process.env.STORYBOOK_BASE_URL ?? 'http://127.0.0.1:6006';

// Story IDs — keep in sync with the title + export names in stories files.
// Each entry generates ONE screenshot per theme.
const STORIES = [
  // Primitives
  'primitives-button--primary',
  'primitives-button--secondary',
  'primitives-button--secondary-outlined',
  'primitives-button--secondary-text',
  'primitives-button--danger',
  'primitives-button--loading',
  'primitives-button--disabled',
  'primitives-button--icon-only',
  'primitives-button--severity-grid',

  'primitives-tag--success',
  'primitives-tag--danger',
  'primitives-tag--warn',
  'primitives-tag--severity-grid',

  'primitives-avatar--with-image',
  'primitives-avatar--initials',
  'primitives-avatar--status-badge',
  'primitives-avatar--size-scale',

  'primitives-card--data-card',
  'primitives-card--form-card',
  'primitives-card--expanded-header',

  'primitives-list-item--chat-row',
  'primitives-list-item--inbox-row',
  'primitives-list-item--nav-in-page',
  'primitives-list-item--settings-row',

  'primitives-empty-state--no-data',
  'primitives-empty-state--no-results',
  'primitives-empty-state--error-state',

  // Recipes
  'recipes-page-header--standard',
  'recipes-page-header--title-only',
  'recipes-page-header--with-count-pill',
  'recipes-form-card--profile',
  'recipes-form-card--minimal',
  'recipes-multi-panel-layout--two-column',
  'recipes-multi-panel-layout--three-column',
  'recipes-data-table--basic',
  'recipes-data-table--with-caption-toolbar',
  'recipes-data-table--empty',
] as const;

const THEMES = [
  { name: 'light', searchParam: '' },
  { name: 'dark', searchParam: '&globals=theme:dark' },
] as const;

test.describe('Storybook component baselines', () => {
  test.beforeAll(async () => {
    // Sanity check — Storybook must be served.
    const ping = await fetch(STORYBOOK_BASE_URL).catch(() => null);
    if (!ping || !ping.ok) {
      throw new Error(
        `Storybook is not reachable at ${STORYBOOK_BASE_URL}. ` +
          'Run `npm run build-storybook && npx http-server dist/storybook -p 6006 -c-1 --silent &` first.',
      );
    }
  });

  for (const storyId of STORIES) {
    for (const theme of THEMES) {
      test(`${storyId} @ ${theme.name}`, async ({ page }) => {
        const url =
          `${STORYBOOK_BASE_URL}/iframe.html?id=${storyId}&viewMode=story${theme.searchParam}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        // Wait a beat for Angular hydration and Aura CSS injection.
        await page.waitForTimeout(300);

        // Capture the root container of the rendered story. Storybook
        // mounts components into `#storybook-root`; capturing that element
        // alone produces tight, focused baselines.
        const root = page.locator('#storybook-root');
        await expect(root).toBeVisible();
        await expect(root).toHaveScreenshot(`${storyId}-${theme.name}.png`);
      });
    }
  }
});
