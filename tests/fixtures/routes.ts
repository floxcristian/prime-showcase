/**
 * Shared route fixtures for the Playwright suites (a11y + visual).
 *
 * Single source of truth for "which routes exist and how do we name them
 * in test titles / snapshot files". Keep in sync with
 * `src/app/app.routes.ts` when routes are added or removed.
 *
 * Two tiers:
 *
 *   - `GOLDEN_ROUTES` — the six primary routes that the VISUAL suite
 *     (`tests/visual/golden-paths.spec.ts`) captures. Adding a route here
 *     requires generating new baselines via the manual `Visual baselines`
 *     workflow, so this list only grows deliberately.
 *
 *   - `A11Y_ROUTES` — full coverage for the axe-core gate: golden routes
 *     plus admin (users/roles), notifications, the guest pages
 *     (login/forgot-password), and the whole observability module,
 *     including one representative detail view per `:id` route (ids come
 *     from the deterministic mocks in
 *     `src/app/modules/observability/mocks/`). Adding a route here is
 *     free — no baseline artifacts, just an extra axe scan.
 *
 * `guestOnly` marks routes served OUTSIDE the authed layout: they must be
 * visited WITHOUT the auth cookie (an authed session gets redirected away
 * from them by `guestGuard`).
 */

export interface RouteFixture {
  readonly path: string;
  readonly name: string;
  /** Route is guest-only (guestGuard) — visit without the auth cookie. */
  readonly guestOnly?: boolean;
}

/** Primary routes captured by the visual golden-path suite. */
export const GOLDEN_ROUTES: readonly RouteFixture[] = [
  { path: '/', name: 'overview' },
  { path: '/customers', name: 'customers' },
  { path: '/inbox', name: 'inbox' },
  { path: '/chat', name: 'chat' },
  { path: '/cards', name: 'cards' },
  { path: '/movies', name: 'movies' },
];

/**
 * Full route coverage for the a11y gate. Detail-view ids reference stable
 * mock data: `svc-auth` (services-mock.ts) and `alert-000` (alerts-mock.ts).
 */
export const A11Y_ROUTES: readonly RouteFixture[] = [
  ...GOLDEN_ROUTES,
  { path: '/users', name: 'users' },
  { path: '/roles', name: 'roles' },
  { path: '/notifications', name: 'notifications' },
  { path: '/login', name: 'login', guestOnly: true },
  { path: '/forgot-password', name: 'forgot-password', guestOnly: true },
  // Observabilidad — 8 rutas (incluye una detail view por :id)
  { path: '/observability/inbox', name: 'obs-inbox' },
  { path: '/observability/services', name: 'obs-services' },
  { path: '/observability/services/svc-auth', name: 'obs-service-detail' },
  { path: '/observability/alerts', name: 'obs-alerts' },
  { path: '/observability/alerts/alert-000', name: 'obs-alert-detail' },
  { path: '/observability/uptime', name: 'obs-uptime' },
  { path: '/observability/preferences', name: 'obs-preferences' },
  { path: '/observability/notifications-history', name: 'obs-notifications-history' },
];
