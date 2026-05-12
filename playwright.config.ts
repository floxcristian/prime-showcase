// @ts-check
/**
 * Playwright config for visual regression + a11y CI.
 *
 * Two projects share this config:
 *   - `visual` runs `tests/visual/**` against the SSR build and writes
 *     baseline screenshots into `tests/visual/__screenshots__/`. Pixel
 *     diff threshold mirrors Chromatic defaults (Stripe / Shopify): 0.2.
 *   - `a11y` runs `tests/a11y/**` and asserts axe-core finds zero
 *     `serious`/`critical` violations.
 *
 * `prefers-reduced-motion: reduce` is emulated globally so transition-bound
 * pixels don't flake. Browser is locked to chromium-only because:
 *   - Visual regression should be deterministic per-browser; cross-browser
 *     adds noise without catching design-system bugs.
 *   - Webkit/Firefox font metrics differ enough to make any baseline
 *     useless across browsers. If a feature needs cross-browser coverage,
 *     it goes in a separate functional Playwright suite.
 *
 * Local-dev: `npm run visual` (assumes `npm run build && npm run serve:ssr:prime-showcase`
 * already running on :4000 OR the webServer block below boots one).
 *
 * Baseline update: `npm run visual -- --update-snapshots` ONLY when the
 * change is intentional and approved by the PR reviewer. Updated baselines
 * must be reviewed pixel-by-pixel in the diff.
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4000';
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  // Snapshot path canónico — Playwright por default escribe a
  // `<spec-file>.ts-snapshots/<arg>.png` (junto al spec). El proyecto
  // tiene `.gitignore` whitelisteando `tests/visual/__screenshots__/
  // **/*.png` (todas las PNGs son ignoradas globalmente excepto ese
  // path). Sin este template, las baselines se generaban en el path
  // default y `.gitignore` las descartaba como untracked → el workflow
  // `Visual baselines` no detectaba ningún cambio.
  //
  // Template segmenta por nombre del spec así golden-paths y
  // storybook viven en directorios distintos sin colisión.
  snapshotPathTemplate: '{testFileDir}/__screenshots__/{testFileName}/{arg}{ext}',
  expect: {
    // Visual regression threshold. 0.2 matches Chromatic's default.
    // Anything higher hides real regressions; lower flakes on font rendering.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Stable viewport for screenshot determinism.
    viewport: { width: 1440, height: 900 },
    // Honor reduced-motion always — visual baselines must not include
    // mid-animation frames.
    reducedMotion: 'reduce',
    // Force light color scheme by default; dark-mode is opted in per-test
    // via `test.use({ colorScheme: 'dark' })`.
    colorScheme: 'light',
    // Lock locale to es-CL so Intl.NumberFormat / Intl.DateTimeFormat
    // produce stable output across machines.
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
  },
  projects: [
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'a11y',
      testMatch: /a11y\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Boot the SSR server if no external base URL is provided.
        // Build is expected to have happened already (`npm run build`).
        command: 'npm run serve:ssr:prime-showcase',
        url: BASE_URL,
        timeout: 60_000,
        reuseExistingServer: !CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
