/**
 * Shared route fixtures for the Playwright suites (a11y + visual).
 *
 * Single source of truth for "which routes exist and how do we name them
 * in test titles / snapshot files". Keep in sync with
 * `src/app/app.routes.ts` when routes are added or removed.
 *
 * Both suites iterate the SAME underlying list (`ALL_ROUTES`), so a new
 * route cannot be added to one gate without the other:
 *
 *   - `GOLDEN_ROUTES` — consumed by the VISUAL suite
 *     (`tests/visual/golden-paths.spec.ts`). Adding a route here requires
 *     generating new baselines via the manual `Visual baselines` workflow
 *     (NEVER locally — local rendering differs from the CI runner).
 *
 *   - `A11Y_ROUTES` — consumed by the axe-core gate
 *     (`tests/a11y/axe.spec.ts`). No baseline artifacts, just an extra
 *     axe scan per entry.
 *
 * Detail-view ids reference stable mock data: `svc-auth`
 * (services-mock.ts) and `alert-000` (alerts-mock.ts).
 *
 * `guestOnly` marks routes served OUTSIDE the authed layout: they must be
 * visited WITHOUT the auth cookie (an authed session gets redirected away
 * from them by `guestGuard`).
 *
 * `seedSocialStorage` marks routes captured con el estado del cliente ya
 * configurado: el contexto se crea con `storageState.origins` alimentado
 * desde `tests/fixtures/social-seed.ts` (RFC-001 D7.1).
 */

export interface RouteFixture {
  readonly path: string;
  readonly name: string;
  /** Route is guest-only (guestGuard) — visit without the auth cookie. */
  readonly guestOnly?: boolean;
  /**
   * La vista carga data client-side vía mock services con latencia
   * simulada (`mockLatency()`: 800-1800ms de jitter, rxjs `delay` — sin
   * requests de red, así que `networkidle` NO la cubre) y muestra
   * `<p-skeleton>` mientras tanto. El visual spec espera a que los
   * skeletons desaparezcan antes del screenshot; sin el flag capturaría
   * el loading state a mitad de camino, no determinista por el jitter.
   */
  readonly waitForData?: boolean;
  /**
   * Pre-seed del estado del cliente (RFC-001 D7.1). Cuando es `true`, el
   * spec crea el contexto de Playwright con `storageState.origins`
   * pre-poblando el localStorage del origin con las keys versionadas de
   * RFC-003 D6.1 (`social:*:v1::<TEST_EMAIL>`) ANTES de la primera
   * navegación — **cero cambios a la app**: la página lee su configuración
   * como si el cliente ya hubiera completado el onboarding (registro →
   * keys válidas → 3 redes conectadas → checklist descartado).
   *
   * La data del seed vive en `tests/fixtures/social-seed.ts`
   * (`buildSocialSeedOrigin`), construida con las factories puras de
   * `src/app/modules/social/mocks/` y con timestamps relativos al momento
   * de setup (RFC-001 D7.2).
   *
   * Sin el flag la ruta captura el **default vacío**: el gating de
   * onboarding (sin cuentas conectadas → `<app-empty-state>` con CTA a
   * `/social/connections`), que es la captura correcta del pitch "cero
   * cuentas hardcodeadas".
   */
  readonly seedSocialStorage?: boolean;
}

/**
 * Todas las rutas navegables de `src/app/app.routes.ts` — 29 entradas.
 * Fuente única: `GOLDEN_ROUTES` y `A11Y_ROUTES` son alias de esta lista.
 */
const ALL_ROUTES: readonly RouteFixture[] = [
  { path: '/', name: 'overview' },
  { path: '/customers', name: 'customers', waitForData: true },
  { path: '/inbox', name: 'inbox' },
  { path: '/chat', name: 'chat' },
  { path: '/cards', name: 'cards' },
  { path: '/movies', name: 'movies' },
  // Admin — `users`/`roles` renderizan `| relativeTime` sobre fechas mock
  // ABSOLUTAS (abril 2026), así que el texto ("hace N meses") driftea a
  // granularidad de MES. Estable dentro de un run de CI; cuando el label
  // flippea, re-baseline vía el workflow manual `Visual baselines`.
  { path: '/users', name: 'users', waitForData: true },
  { path: '/roles', name: 'roles', waitForData: true },
  // Notificaciones — determinista: el grouping/formatting se ancla a
  // `NOTIFICATIONS_REFERENCE_DATE` (2026-04-22), no a `new Date()`.
  { path: '/notifications', name: 'notifications' },
  { path: '/login', name: 'login', guestOnly: true },
  { path: '/forgot-password', name: 'forgot-password', guestOnly: true },
  // Observabilidad — 8 rutas (incluye una detail view por :id). Mocks con
  // timestamps RELATIVOS a now() (`minutesAgo`), así que los strings de
  // `| relativeTime` son estables run-a-run ("hace 12 min" siempre);
  // sparklines/commit shas vienen de PRNG seedeado (mock-utils). Las
  // fechas absolutas de obs-uptime solo viven en tooltips (no capturadas).
  { path: '/observability/inbox', name: 'obs-inbox', waitForData: true },
  { path: '/observability/services', name: 'obs-services', waitForData: true },
  { path: '/observability/services/svc-auth', name: 'obs-service-detail', waitForData: true },
  { path: '/observability/alerts', name: 'obs-alerts', waitForData: true },
  { path: '/observability/alerts/alert-000', name: 'obs-alert-detail', waitForData: true },
  { path: '/observability/uptime', name: 'obs-uptime', waitForData: true },
  { path: '/observability/preferences', name: 'obs-preferences' },
  { path: '/observability/notifications-history', name: 'obs-notifications-history' },
  // Social — 9 rutas + signup. Mocks con timestamps RELATIVOS a now()
  // y PRNG seedeado (patrón observability/mocks/mock-utils): strings de
  // | relativeTime y series estables run-a-run. Las 7 páginas de datos
  // se capturan DOS veces: onboarding vacío y poblada (seedSocialStorage).
  //
  // Wave A entra SOLO con las entries vacías (los shells de B/C no tienen
  // datos que poblar: capturar un shell seeded no aporta). Las entries
  // `-seeded` — mismo `path`, `name` con sufijo `-seeded`,
  // `seedSocialStorage: true` — llegan en el PR de Wave B/C que reemplaza
  // el cuerpo de cada shell, junto con sus baselines (RFC-001 D7,
  // "Secuenciamiento").
  { path: '/social/overview', name: 'social-overview', waitForData: true },
  { path: '/social/analytics', name: 'social-analytics', waitForData: true },
  { path: '/social/insights', name: 'social-insights', waitForData: true },
  { path: '/social/competitors', name: 'social-competitors', waitForData: true },
  { path: '/social/trends', name: 'social-trends', waitForData: true },
  { path: '/social/planner', name: 'social-planner', waitForData: true },
  { path: '/social/studio', name: 'social-studio', waitForData: true },
  // Connections/providers: SOLO estado vacío = onboarding determinista
  // (localStorage limpio) tras fetch con mockLatency → esperar a que los
  // skeletons desaparezcan igual que el resto.
  { path: '/social/connections', name: 'social-connections', waitForData: true },
  { path: '/social/providers', name: 'social-providers', waitForData: true },
  { path: '/signup', name: 'signup', guestOnly: true },
];

/**
 * Rutas capturadas por el visual golden-path suite. Alias de `ALL_ROUTES`
 * (cobertura completa): agregar una ruta acá implica generar sus baselines
 * con el workflow manual `Visual baselines` en el MISMO PR.
 */
export const GOLDEN_ROUTES: readonly RouteFixture[] = ALL_ROUTES;

/** Full route coverage for the a11y gate. Alias de `ALL_ROUTES`. */
export const A11Y_ROUTES: readonly RouteFixture[] = ALL_ROUTES;
