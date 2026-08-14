/**
 * Visual regression — golden paths.
 *
 * Captures one screenshot per navigable route (the 29 entries of
 * `GOLDEN_ROUTES` in `tests/fixtures/routes.ts`) at the canonical
 * 1440×900 desktop viewport AND at 375×812 mobile. Captures both light
 * and dark mode for `/` (the highest-density chrome) to lock the
 * dark-mode token map; the rest only run light — the dark token map is
 * shared across routes, one capture catches any regression in it.
 *
 * **What this catches that ESLint doesn't:**
 *   - Token-resolution regressions (CSS var renamed in Aura)
 *   - Layout shifts from new Angular versions
 *   - Font Awesome glyph swaps
 *   - PrimeNG component default changes (e.g. button radius, table padding)
 *   - Tailwind v4 utility renames
 *
 * **Failure mode:** a diff in the PR means EITHER an intentional visual
 * change OR a silent regression in a dependency / token (the value).
 * Baselines — new routes and refreshes alike — are generated with the
 * manual `Visual baselines` workflow, NEVER locally: local rendering
 * (fonts, GPU, AA) differs from the CI runner and would contaminate
 * the diff.
 *
 * **Route list:** derives from the shared fixture (`GOLDEN_ROUTES`),
 * the same source the a11y suite iterates — a new route cannot join one
 * gate without the other. Per-route determinism flags live there too:
 * `guestOnly` (visit without the auth cookie), `waitForData` (mock
 * services with simulated latency — wait for `<p-skeleton>` to clear
 * before the capture; `networkidle` no la cubre porque el delay es rxjs,
 * no red) y `seedSocialStorage` (localStorage del cliente pre-poblado
 * antes de la primera navegación — ver `seededPage`). Known limitation:
 * `/users` y `/roles` renderizan
 * `| relativeTime` sobre fechas mock absolutas — el label ("hace N
 * meses") driftea a granularidad de mes y pide re-baseline cuando flippea
 * (ver comentario en el fixture).
 *
 * Hydration completion is detected via `waitForLoadState('networkidle')`
 * as a simple proxy; if it becomes flaky, replace with a targeted
 * `page.evaluate` poll.
 */
import type { Page } from '@playwright/test';
import { test as authedTest, expect } from '../fixtures/auth';
import { GOLDEN_ROUTES, RouteFixture } from '../fixtures/routes';
import { buildSocialSeedOrigin } from '../fixtures/social-seed';

/**
 * `seededPage` — página autenticada CON el localStorage del cliente ya
 * poblado (RFC-001 D7.1), para las entries `seedSocialStorage: true`.
 *
 * El contexto se crea con `storageState.origins` alimentado desde
 * `tests/fixtures/social-seed.ts`: las cinco keys versionadas de RFC-003
 * D6.1 quedan escritas ANTES de la primera navegación, así que la página
 * hidrata directamente en su estado poblado (cuentas conectadas, keys
 * válidas, checklist descartado) sin pasar por el gating de onboarding y
 * sin un solo cambio en la app.
 *
 * Las cookies salen de `authedPage.context().storageState()` en vez de
 * re-declararse acá: el formato del cookie de sesión vive en
 * `tests/fixtures/auth.ts` (fuera del ownership de este archivo) y
 * duplicarlo abriría drift. El costo es un contexto extra vacío por test
 * seeded — despreciable frente al screenshot.
 *
 * El mismo helper está duplicado en `tests/a11y/axe.spec.ts`: ambas
 * suites consumen las mismas entries y el fixture compartido
 * (`auth.ts`) no puede alojarlo. Si los dos divergen, es un bug.
 */
const test = authedTest.extend<{ seededPage: Page }>({
  seededPage: async ({ authedPage, browser, baseURL }, use) => {
    const { cookies } = await authedPage.context().storageState();
    const origin = new URL(baseURL ?? 'http://127.0.0.1:4000').origin;
    const context = await browser.newContext({
      storageState: { cookies, origins: [buildSocialSeedOrigin(origin)] },
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

const VIEWPORTS = [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 375, height: 812, label: 'mobile' },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

/** Navega y estabiliza la ruta; deja la página lista para el screenshot. */
async function gotoSettled(page: Page, route: RouteFixture, viewport: Viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(route.path, { waitUntil: 'networkidle' });
  if (route.waitForData) {
    // Mock latency (800-1800ms de jitter) — esperar el estado cargado:
    // sin skeletons visibles en el árbol. Timeout holgado sobre el peor
    // caso de latencia + render.
    await expect(page.locator('p-skeleton')).toHaveCount(0, { timeout: 10_000 });
  }
  // Pause briefly for any post-hydration micro-tasks to settle.
  await page.waitForTimeout(300);
}

for (const route of GOLDEN_ROUTES) {
  for (const viewport of VIEWPORTS) {
    if (route.guestOnly) {
      // Guest pages (login / forgot-password): authed sessions get
      // redirected away by guestGuard — capture with the plain
      // non-authed page fixture (same pattern as the a11y suite).
      test(`${route.name} @ ${viewport.label} — light`, async ({ page }) => {
        await gotoSettled(page, route, viewport);
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.label}-light.png`, {
          fullPage: true,
        });
      });
    } else if (route.seedSocialStorage) {
      // Entries `-seeded` (Waves B/C): mismo path que su gemela vacía,
      // capturado con el estado del cliente pre-poblado en localStorage.
      test(`${route.name} @ ${viewport.label} — light`, async ({ seededPage }) => {
        await gotoSettled(seededPage, route, viewport);
        await expect(seededPage).toHaveScreenshot(`${route.name}-${viewport.label}-light.png`, {
          fullPage: true,
        });
      });
    } else {
      test(`${route.name} @ ${viewport.label} — light`, async ({ authedPage }) => {
        await gotoSettled(authedPage, route, viewport);
        await expect(authedPage).toHaveScreenshot(`${route.name}-${viewport.label}-light.png`, {
          fullPage: true,
        });
      });
    }
  }
}

// Dark mode — only the overview, since the dark-mode token map is the
// same across routes (no per-route dark stylesheet). One screenshot
// catches any regression in the dark token pipeline.
test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('overview @ desktop — dark', async ({ authedPage }) => {
    await gotoSettled(authedPage, { path: '/', name: 'overview' }, VIEWPORTS[0]);
    await expect(authedPage).toHaveScreenshot('overview-desktop-dark.png', {
      fullPage: true,
    });
  });
});
