# RFC-001: Arquitectura, navegación y gates de la suite social

- **Estado:** Propuesto
- **Fecha:** 2026-08-14
- **Autores:** equipo
- **Relacionados:** RFC-002 (modelo de dominio y mocks), RFC-003 (signup/onboarding), RFC-004/005/006 (UX de páginas)

## Resumen

Define el esqueleto completo de la suite social: estructura de `src/app/modules/social/` calcada del patrón multi-página de `observability`, 9 páginas lazy bajo `/social` (redirect a `overview`), entrada nueva en `NAV_MODULES` con 4 secciones e ids `social.*`, entries de `ROUTE_DATA` para breadcrumbs de 3 niveles, decisión de host class por página, política de `@defer (hydrate on viewport)`, estrategia de bundle (todo lazy, Chart.js jamás en el initial chunk, cuándo re-baselinear), plan de fixtures de Playwright, componentes shared nuevos con story, y el detalle de las 3 waves de implementación con su grafo de dependencias. Este RFC NO define interfaces de dominio ni mocks (RFC-002), ni UX de páginas concretas (RFC-004/005/006), ni el flujo de signup (RFC-003) — solo reserva sus puntos de enganche (ruta, nav, fixtures).

## Contexto y problema

El cliente pide una suite SaaS multi-tenant de análisis y gestión de redes sociales (analytics IG/FB/TikTok, insights, competencia, generación de contenido, calendario, hashtags, tendencias, y configuración por cliente de cuentas sociales y API keys de proveedores IA). El repo es una showcase sin backend: todos los módulos existentes son fachadas mock con latencia simulada, y las convenciones son estrictas (design tokens únicamente, OnPush + standalone, zoneless, SSR con hydration incremental, ESLint plugin local de 19 reglas, budgets de bundle con ~15 kB de headroom antes del warn de 790 kB, baselines visuales y a11y gates sobre fixtures de rutas).

Necesitamos decidir, **antes** de escribir la primera página, el esqueleto que las 9 páginas van a compartir: dónde vive cada cosa, cómo se navega, qué clase de host usa cada página, qué se difiere, cómo no romper el budget, y qué gates debe pasar cada PR. Sin este esqueleto acordado, 9 páginas construidas en paralelo divergen — exactamente lo que la Regla #1 del proyecto ("consistencia con lo existente") prohíbe.

## Decisión

### D1. Estructura de directorios — `modules/social/` multi-página estilo observability

```
src/app/modules/social/
  models/                     ← social.interface.ts, provider.interface.ts, social.ports.ts   (RFC-002)
  mocks/                      ← provider-catalog.ts, social-mock-utils.ts, factories          (RFC-002)
  services/                   ← SocialAnalyticsMockService, SocialPublishingMockService,
                                SocialGenerationMockService, SocialSettingsService            (RFC-002)
  utils/                      ← formatters Intl es-CL a nivel módulo; chart-tooltip clonado
                                de overview/utils/ SOLO si una página lo necesita
  components/                 ← subcomponentes compartidos ENTRE páginas sociales pero que
                                no ameritan shared/ global (p.ej. sparkline de insights)
  social-overview/
    social-overview.component.{ts,html,scss}   ← .scss vacío, por convención
    constants/  models/  components/           ← solo si la página los necesita
  social-analytics/
  social-insights/
  social-competitors/
  social-trends/
  social-planner/
  social-studio/
  social-connections/
  social-providers/
```

Reglas:

- **Capa compartida primero (Wave A).** `models/`, `mocks/`, `services/` y `utils/` son fundación: ninguna página se empieza antes de que compilen. Su contenido lo define RFC-002; este RFC solo fija ubicación y nombres de archivo.
- **Prefijo `social-` en cada dir de página** (espejo de `obs-*`): el nombre del componente es `Social<Page>Component` (`SocialOverviewComponent`, `SocialPlannerComponent`, …), selector `app-social-<page>`.
- **Promoción a `src/app/shared/` solo si ≥2 módulos NO sociales lo usarían** o si es una primitiva de catálogo (ver D8). Todo lo demás vive en `modules/social/components/` (cross-página social) o en `social-<page>/components/` (local).
- **`mock-utils` de observability no se duplica:** `seededRandom`, `minutesBefore` y `now` se importan cross-module desde `observability/mocks/mock-utils.ts` o se mueven a `shared/utils/` — la decisión fina es de RFC-002; este RFC solo prohíbe la copia.

### D2. Rutas — `/social` con children lazy, antes del catch-all

Se inserta en `src/app/app.routes.ts`, dentro de los children del layout autenticado, **inmediatamente antes** del `{ path: '**', redirectTo: '' }` (hoy `app.routes.ts:318-321`), a continuación del bloque de Observabilidad:

```typescript
// ── Social Media — suite SaaS de analytics y gestión de RRSS ──────
{
  path: 'social',
  children: [
    { path: '', redirectTo: 'overview', pathMatch: 'full' },
    {
      path: 'overview',
      data: ROUTE_DATA.socialOverview,
      loadComponent: () =>
        import(
          './modules/social/social-overview/social-overview.component'
        ).then((m) => m.SocialOverviewComponent),
    },
    {
      path: 'analytics',
      data: ROUTE_DATA.socialAnalytics,
      loadComponent: () =>
        import(
          './modules/social/social-analytics/social-analytics.component'
        ).then((m) => m.SocialAnalyticsComponent),
    },
    {
      path: 'insights',
      data: ROUTE_DATA.socialInsights,
      loadComponent: () =>
        import(
          './modules/social/social-insights/social-insights.component'
        ).then((m) => m.SocialInsightsComponent),
    },
    {
      path: 'competitors',
      data: ROUTE_DATA.socialCompetitors,
      loadComponent: () =>
        import(
          './modules/social/social-competitors/social-competitors.component'
        ).then((m) => m.SocialCompetitorsComponent),
    },
    {
      path: 'trends',
      data: ROUTE_DATA.socialTrends,
      loadComponent: () =>
        import(
          './modules/social/social-trends/social-trends.component'
        ).then((m) => m.SocialTrendsComponent),
    },
    {
      path: 'planner',
      data: ROUTE_DATA.socialPlanner,
      loadComponent: () =>
        import(
          './modules/social/social-planner/social-planner.component'
        ).then((m) => m.SocialPlannerComponent),
    },
    {
      path: 'studio',
      data: ROUTE_DATA.socialStudio,
      loadComponent: () =>
        import(
          './modules/social/social-studio/social-studio.component'
        ).then((m) => m.SocialStudioComponent),
    },
    {
      path: 'connections',
      data: ROUTE_DATA.socialConnections,
      loadComponent: () =>
        import(
          './modules/social/social-connections/social-connections.component'
        ).then((m) => m.SocialConnectionsComponent),
    },
    {
      path: 'providers',
      data: ROUTE_DATA.socialProviders,
      loadComponent: () =>
        import(
          './modules/social/social-providers/social-providers.component'
        ).then((m) => m.SocialProvidersComponent),
    },
  ],
},
```

Además, **fuera** del layout autenticado (junto a `login` y `forgot-password`), Wave A reserva la ruta de registro que RFC-003 diseña:

```typescript
{
  path: 'signup',
  canActivate: [guestGuard],
  loadComponent: () =>
    import('./modules/login/signup/signup.component').then(
      (m) => m.SignupComponent
    ),
},
```

Notas:

- **Sin rutas por red** (`/social/analytics/instagram` NO existe): la red activa es un signal en el service de filtros de vista (RFC-002 §5, "memoria"), igual que el rango 30/60/90. Menos rutas = menos fixtures/baselines y el estado sobrevive navegación intra-suite.
- **Sin detail views con `:id` en v1.** El composer del planner y el detalle de job del studio se resuelven con drawer/dialog in-page (RFC-005/006). Si una wave posterior necesita `:id`, replica el patrón `obsServiceDetail` (middle crumb con `url` de vuelta al listado).
- **`loadComponent` obligatorio en las 9 + signup** — es la única forma de mantener el initial bundle bajo budget (ver D6).

### D3. Breadcrumbs — entries en `ROUTE_DATA`

Se agregan al const `ROUTE_DATA` de `app.routes.ts` (mismo bloque `as const`), con la estructura de 3 niveles de observability: módulo → agrupamiento conceptual (= título de sección del nav, ver D4) → página. Sin `url` en el nivel medio (no hay listado intermedio navegable).

```typescript
// ── Social Media ──────────────────────────────────────────────────────
// 3 niveles como Observabilidad: el nivel intermedio es el agrupamiento
// conceptual (Analítica / Inteligencia / Contenido / Configuración) que
// espeja los títulos de sección del nav-tree, no el nombre de la página.
socialOverview: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Analítica' },
    { title: 'Overview' },
  ],
},
socialAnalytics: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Analítica' },
    { title: 'Por red' },
  ],
},
socialCompetitors: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Analítica' },
    { title: 'Competencia' },
  ],
},
socialInsights: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Inteligencia' },
    { title: 'Recomendaciones' },
  ],
},
socialTrends: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Inteligencia' },
    { title: 'Tendencias y hashtags' },
  ],
},
socialPlanner: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Contenido' },
    { title: 'Calendario' },
  ],
},
socialStudio: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Contenido' },
    { title: 'Studio IA' },
  ],
},
socialConnections: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Configuración' },
    { title: 'Cuentas conectadas' },
  ],
},
socialProviders: {
  breadcrumb: [
    { title: 'Social Media' },
    { title: 'Configuración' },
    { title: 'Proveedores IA' },
  ],
},
```

`signup` no declara breadcrumb (vive fuera del layout autenticado, como `login`). No se toca `NavStateService`: el breadcrumb por `route.data` ya tiene prioridad sobre el fallback de nav-tree.

### D4. Side-menu — entrada nueva en `NAV_MODULES`

Se agrega al final de `NAV_MODULES` (`src/app/layouts/nav/constants/nav-modules.ts`), después de `observabilidad`. Iconos duotone en el nav (patrón existente de todos los módulos). Precisión sobre el enforcement: `showcase/no-duotone-inline-icon` **no exime paths** — su criterio es el TAMAÑO: exige `text-2xl`+ en el mismo elemento para cualquier `fa-sharp-duotone` estático (los iconos del nav entran por binding `[class]="item.icon"`, fuera del scope estático del linter — ver "Scope de las reglas" en `.claude/rules/eslint-plugin.md`). Dentro de las páginas, los iconos inline son `fa-sharp fa-regular` (o `fa-brands` para logos de red, permitido: son logos de marca reales); duotone solo decorativo ≥ `text-2xl` (empty states, asides hero) — exactamente lo que la regla valida.

```typescript
{
  id: 'social',
  title: 'Social Media',
  icon: 'fa-sharp-duotone fa-regular fa-share-nodes',
  sections: [
    {
      id: 'social.analytics',
      title: 'Analítica',
      icon: 'fa-sharp-duotone fa-regular fa-chart-line-up',
      children: [
        { title: 'Overview', url: '/social/overview' },
        { title: 'Por red', url: '/social/analytics' },
        { title: 'Competencia', url: '/social/competitors' },
      ],
    },
    {
      id: 'social.insights',
      title: 'Inteligencia',
      icon: 'fa-sharp-duotone fa-regular fa-lightbulb',
      children: [
        { title: 'Recomendaciones', url: '/social/insights' },
        { title: 'Tendencias y hashtags', url: '/social/trends' },
      ],
    },
    {
      id: 'social.content',
      title: 'Contenido',
      icon: 'fa-sharp-duotone fa-regular fa-calendar-pen',
      children: [
        { title: 'Calendario', url: '/social/planner' },
        { title: 'Studio IA', url: '/social/studio' },
      ],
    },
    {
      id: 'social.settings',
      title: 'Configuración',
      icon: 'fa-sharp-duotone fa-regular fa-sliders',
      children: [
        { title: 'Cuentas conectadas', url: '/social/connections' },
        { title: 'Proveedores IA', url: '/social/providers' },
      ],
    },
  ],
},
```

Orden de navegación = analítica primero, configuración al final (mismo criterio que observability). Los títulos de sección coinciden 1:1 con el nivel medio de los breadcrumbs (D3) — un usuario que mira el crumb encuentra la sección del menú con el mismo nombre.

### D5. Host class por página y `@defer (hydrate on viewport)`

**Host class.** Tres variantes existentes en el repo; asignación por página según densidad y estructura:

| Página | Host class | Racional |
|---|---|---|
| `social-overview` | `flex-1 h-full overflow-y-auto pb-0.5` (contenedor de página, patrón overview home) | Dashboard de MÚLTIPLES cards (KPIs, charts, top posts): cada card lleva su propio `border border-surface rounded-2xl`; una card exterior duplicaría bordes |
| `social-analytics` | ídem overview | Mismo caso: grid de cards de charts + heatmap + tabla |
| `social-insights` | página-card: `flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6` (patrón `obs-services.component.ts:77-80`) | Feed único con filtros: una superficie, patrón obs-inbox |
| `social-competitors` | página-card | Tabla comparativa + charts dentro de una superficie |
| `social-trends` | página-card | Listas y tablas de discovery en una superficie |
| `social-planner` | `flex-1 h-full overflow-y-auto pb-0.5` | El calendario mensual es una card propia + toolbar + panel lateral opcional; en mobile el grid necesita respirar sin el `p-6` exterior (mismo criterio edge-to-edge responsive que `customers.component.ts:173-183`, resuelto con contenedor de página + cards internas con padding responsivo `p-4 lg:py-5 lg:px-7`) |
| `social-studio` | página-card | Formulario de generación + historial de jobs en una superficie |
| `social-connections` | página-card | Grid de cards de conector dentro de la superficie de página |
| `social-providers` | página-card | Catálogo + tabla de keys en una superficie |

Todas las páginas abren con `<app-page-header heading description>` + toolbar `mt-6 lg:mt-10 mb-4 flex items-center gap-2 lg:gap-3 flex-wrap` con `<app-refresh-toolbar>` donde haya datos remotos, y la cascada canónica `@if loadError → @else if vacío → @else datos` (patrón `obs-uptime.component.html:1-60`), con `<app-stale-data-banner>` cuando aplique. El "vacío" de la suite es el **gating de onboarding**: sin cuentas conectadas → `<app-empty-state>` con CTA a `/social/connections`; sin provider habilitado (studio) → CTA a `/social/providers`. `SocialSettingsService` es la única fuente de ese estado.

**`@defer (hydrate on viewport)` — obligatorio en:**

- **Todos los `<app-chart>`** de todas las páginas (series, donuts, growth multi-serie, share of voice) — es lo que mantiene Chart.js fuera del path crítico de hidratación.
- **Heatmap best-time** (analytics/planner), sea chart o grid HTML: bloque pesado below-the-fold.
- **Grid del calendario mensual** (planner): DOM grande (35-42 celdas con chips).
- **Grid de creativos / historial de jobs con thumbnails** (studio) y **previews de video**.
- **Tabla de top posts** cuando va debajo de charts (overview/analytics).

Cada `@defer` lleva `@placeholder` con `<p-skeleton>` de dimensiones medidas del contenido real y `aria-busy="true"` en el contenedor (regla de `.claude/rules/ssr-and-runtime.md`; nunca `animate-pulse` custom). **No** se difieren: KPI cards (`app-metric-card`) above-the-fold, headers, toolbars, ni bloques con `effect()` de tema que deban reaccionar desde el primer frame — el patrón de re-render de charts por `themeChanged()` vive DENTRO del componente diferido, como en overview.

**Zoneless guard-rail transversal:** todo objeto/array bindeado a `[(ngModel)]` (rango de fechas del planner, multiselect de redes, config de provider) sale de un field `readonly` o un `computed` memoizado — jamás de un literal inline ni de un método. Es el bug documentado 3 veces en el repo (`customers.component.ts:816-826` y siguientes) y en producción no hay guard NG0103: la página no pinta.

### D6. Estrategia de bundle

Estado de partida: initial raw 774 863 B contra warn 790 kB → **~15 kB de headroom**; además `bundle:check` falla con crecimiento >3 % de initial-raw o totalJs-raw vs `tools/bundle/baseline.json`.

1. **Todo lazy.** Las 9 páginas + signup entran solo por `loadComponent`. Ningún import de `modules/social/**` desde código eager (layouts, core, app.config). El único costo initial admitido es el texto de la entrada `NAV_MODULES` + entries `ROUTE_DATA` + los import callbacks de rutas (~1-2 kB raw): dentro del headroom.
2. **Chart.js jamás en el initial chunk.** Solo se usa vía `<app-chart>` dentro de bloques `@defer` de páginas lazy. Prohibido importar `chart.js` o `chart-registry` desde services/models de la capa compartida social (que sí pueden terminar en un chunk compartido temprano).
3. **Controllers nuevos de Chart.js** (si RFC-004 decide heatmap vía plugin matrix, o scatter para "frecuencia vs engagement" de competitors): se registran en `shared/components/chart/chart-registry.ts` con su import explícito — el costo cae en el chunk lazy que contiene Chart.js, no en el initial. Default recomendado a RFC-004: heatmap como grid HTML con tokens (cero bytes de Chart.js) o bar apilado; scatter solo si el valor demo lo justifica (~3-5 kB gz).
4. **`totalJs-raw` va a crecer sí o sí** (9 chunks nuevos) y probablemente supere el 3 %: el PR de cierre de **cada wave** que dispare el gate corre `npm run bundle:baseline` y commitea `tools/bundle/baseline.json` **en el mismo PR**, con el número justificado en la descripción. Nunca re-baselinear para tapar un crecimiento del INITIAL: si el initial sube más que los ~2 kB esperados, es una regresión a arreglar (import eager filtrado), no a absorber.
5. **Assets:** thumbnails/creativos salen de `demoAsset()` (`shared/constants/demo-assets.ts`) — no se agregan binarios al repo.

### D7. Fixtures de rutas, mocks deterministas, pre-seed de estado y baselines

Como TODO dato social deriva de las cuentas conectadas del cliente (RFC-002 D6: sin cuentas, colecciones vacías) y el runner arranca con localStorage limpio, las páginas de datos tienen DOS estados capturables: el empty de onboarding y la página poblada. Los criterios de aceptación de RFC-004/005/006 (charts, heatmap, calendario, tablas) exigen el segundo — así que el harness gana un mecanismo de **pre-seed de `TenantProviderState`**, decidido acá porque este RFC es el dueño de los fixtures:

1. **`RouteFixture` se extiende** con `seedSocialStorage?: boolean`. Cuando es `true`, el fixture de Playwright crea el contexto con `storageState.origins` pre-poblando localStorage del origin con las keys versionadas de RFC-003 D6.1 (`social:*:v1::<TEST_EMAIL>`) ANTES de la primera navegación — cero cambios a la app.
2. **La data del seed vive en `tests/fixtures/social-seed.ts`** (entregable de RFC-003, que es dueño de las keys y su shape): construye un `TenantProviderState` determinista importando las factories puras de `src/app/modules/social/mocks/` (`buildAccountMock` — puras, sin Angular, importables desde el harness): 3 cuentas conectadas (una por red, derivadas de `TEST_EMAIL` exactamente como lo haría `connectAccount`), keys `valid`, conectores `enabled`, un provider de generación activo, `checklistDismissed: true`. Timestamps relativos al momento de setup (`connectedAt` = now − 24 h, `lastSyncAt` = now − 30 min) → strings de `| relativeTime` estables ("hace 1 día") y muy lejos del `TOKEN_TTL_MS`.
3. **Qué rutas duplican entrada:** las 7 páginas de datos (overview, analytics, insights, competitors, trends, planner, studio) tienen DOS entries — la vacía (gating de onboarding) y la seeded (`-seeded`, con datos). `connections`, `providers` y `signup` tienen una sola entry vacía: su estado limpio ES la captura correcta del pitch "cero cuentas hardcodeadas". Ambas variantes alimentan visual Y a11y.

Se agregan a `ALL_ROUTES` en `tests/fixtures/routes.ts` (fuente única de visual + a11y) en el PR que crea cada ruta:

```typescript
// Social — 9 rutas + signup. Mocks con timestamps RELATIVOS a now()
// y PRNG seedeado (patrón observability/mocks/mock-utils): strings de
// | relativeTime y series estables run-a-run. Las 7 páginas de datos
// se capturan DOS veces: onboarding vacío y poblada (seedSocialStorage).
{ path: '/social/overview', name: 'social-overview', waitForData: true },
{ path: '/social/overview', name: 'social-overview-seeded', waitForData: true, seedSocialStorage: true },
{ path: '/social/analytics', name: 'social-analytics', waitForData: true },
{ path: '/social/analytics', name: 'social-analytics-seeded', waitForData: true, seedSocialStorage: true },
{ path: '/social/insights', name: 'social-insights', waitForData: true },
{ path: '/social/insights', name: 'social-insights-seeded', waitForData: true, seedSocialStorage: true },
{ path: '/social/competitors', name: 'social-competitors', waitForData: true },
{ path: '/social/competitors', name: 'social-competitors-seeded', waitForData: true, seedSocialStorage: true },
{ path: '/social/trends', name: 'social-trends', waitForData: true },
{ path: '/social/trends', name: 'social-trends-seeded', waitForData: true, seedSocialStorage: true },
{ path: '/social/planner', name: 'social-planner', waitForData: true },
{ path: '/social/planner', name: 'social-planner-seeded', waitForData: true, seedSocialStorage: true },
{ path: '/social/studio', name: 'social-studio', waitForData: true },
{ path: '/social/studio', name: 'social-studio-seeded', waitForData: true, seedSocialStorage: true },
// Connections/providers: SOLO estado vacío = onboarding determinista
// (localStorage limpio) tras fetch con mockLatency → esperar a que los
// skeletons desaparezcan igual que el resto.
{ path: '/social/connections', name: 'social-connections', waitForData: true },
{ path: '/social/providers', name: 'social-providers', waitForData: true },
{ path: '/signup', name: 'signup', guestOnly: true },
```

Reglas:

- **`waitForData: true`** en toda ruta que muestre `<p-skeleton>` sobre `mockLatency()` (las 9: incluso connections/providers simulan latencia de lectura de estado). El spec visual espera a que los skeletons desaparezcan.
- **Determinismo obligatorio de los mocks** (contrato para RFC-002): timestamps relativos a `now()` (nunca fechas absolutas que driftean en `| relativeTime`), series y shas de PRNG seedeado, calendario del planner anclado a una fecha de referencia derivada del epoch (mismo truco que `NOTIFICATIONS_REFERENCE_DATE`) para que el grid mensual capturado no cambie de layout entre runs. Las entries sin seed capturan el **default vacío** (empty state de onboarding); las `-seeded` capturan la página poblada con los datos deterministas que el seed + `clientSeed` de `TEST_EMAIL` producen.
- **Secuenciamiento:** las entries `-seeded` entran en el PR de Wave B/C que reemplaza el shell de cada página (capturar el shell seeded no aporta); las vacías entran en Wave A con los shells, como estaba previsto.
- **Baselines visuales SOLO vía el workflow manual `Visual baselines`**, nunca generadas localmente (el rendering local difiere del runner). Cada PR que agregue rutas a `GOLDEN_ROUTES` dispara el workflow y commitea las baselines en el MISMO PR.
- **a11y:** las mismas entradas (vacías Y seeded) alimentan `A11Y_ROUTES`; el gate falla con violaciones `serious`/`critical` de axe — presupuestar el fix antes del merge, no después.

### D8. Componentes shared nuevos y stories

Criterio: a `src/app/shared/` solo va lo que es primitiva de catálogo reutilizable fuera de la suite. Decisión:

| Pieza | Ubicación | Story |
|---|---|---|
| `app-network-chip` — chip icono+label de red social (IG/FB/TikTok, `fa-brands` + label), usado en todas las páginas y potencialmente en CRM | `src/app/shared/components/network-chip/` + `network-chip.tokens.ts` (patrón `status-chip`) | `src/stories/primitives/NetworkChip.stories.ts` — descripciones en español, sin `bilingualRender` |
| Chip de estado de conexión de cuenta | **NO se crea**: se reutiliza `app-health-badge` mapeando `connected/expired/error/disconnected` a `HealthState`, o `p-tag` con severity — decisión fina en RFC-004; si termina naciendo un chip nuevo, sigue el patrón component + `.tokens.ts` + story |
| Sparkline de evidencia (insights), heatmap best-time, celda de calendario, card de conector, fila de API key | `modules/social/components/` o `social-<page>/components/` — locales, **sin story** (no son shared) |

Regla operativa: si durante Waves B/C un componente local social resulta necesario en un segundo módulo no-social, se promueve a `shared/` **con story en el mismo PR** (`CLAUDE.md`: todo shared component nuevo lleva story). No se crean recipes de Storybook para páginas completas.

### D9. Waves de implementación y grafo de dependencias

```
Wave A (fundaciones)          Wave B (analítica)            Wave C (contenido)
────────────────────          ──────────────────            ──────────────────
models + ports + mocks ──┬──▶ social-overview          ┌──▶ social-planner
4 services (RFC-002)     ├──▶ social-analytics         │      ▲ cuentas (connections)
signup (RFC-003)         ├──▶ social-insights ─────────┤      ▲ hashtag service (trends)
social-connections       ├──▶ social-competitors       │      ◀ jobs adjuntos (studio)
social-providers         └──▶ social-trends ───────────┴──▶ social-studio
nav + rutas + ROUTE_DATA                                      ▲ ConnectorConfig (providers)
fixtures + baselines A
app-network-chip + story
```

- **Wave A — fundaciones + registro + configuración.** Capa compartida completa (D1), ruta `/social` con las 9 entries (las páginas de B/C entran como shell mínimo: page-header + empty state de onboarding — así nav, breadcrumbs, fixtures y baselines quedan cerrados una sola vez), `signup`, `social-connections`, `social-providers`, entrada `NAV_MODULES`, `ROUTE_DATA`, fixtures D7, `app-network-chip` + story. Al cerrar A, cualquier página de B/C se construye en paralelo sin pisarse: solo reemplaza el cuerpo de su shell.
- **Wave B — analítica e inteligencia.** `social-overview`, `social-analytics`, `social-insights`, `social-competitors`, `social-trends`. Dependencias: todas leen `SocialAnalyticsMockService` (read-only); insights deep-linkea a planner/analytics vía `actionRoute` (las rutas ya existen desde A). Si RFC-004 pide controllers extra de Chart.js, se registran acá (D6.3).
- **Wave C — contenido.** `social-planner` (consume cuentas de connections, hashtag suggestions del service de trends, best-time de analytics), `social-studio` (lee `ConnectorConfig` de providers para el selector de provider; jobs `sourceJobId` se adjuntan en planner). Última porque consume A y B.

Slicing de PRs sugerido: A en 2 PRs (①capa compartida + rutas/nav/shells/fixtures/baselines, ②connections + providers + signup); B en 2-3 PRs por página afín; C en 2 PRs (planner, studio). Cada PR pasa `npm run verify` completo.

## Alternativas consideradas

1. **Módulo flat estilo `customers` (una página con tabs internas).** NO: 9 capacidades con estado y datasets propios en una sola ruta rompe lazy-loading granular, infla un único chunk, y pierde deep-links (los `actionRoute` de insights y los CTAs de onboarding necesitan URLs). Observability ya demostró el patrón multi-página para exactamente este tamaño.
2. **Rutas por red (`/social/analytics/:network`).** NO: triplica fixtures/baselines/a11y scans sin valor demo; la red activa como signal en service sobrevive navegación intra-suite y es el patrón "filtros de vista en memoria" ya decidido para el repo. Costo: la red activa no es URL-addressable — deuda aceptada (ver Consecuencias).
3. **Derivar breadcrumbs del nav-tree en lugar de `ROUTE_DATA`.** NO: el repo ya lo intentó y lo revirtió — el rationale completo está en `app.routes.ts:4-25` (leaves múltiples apuntando a la misma URL devuelven crumbs arbitrarios). Se sigue el patrón declarativo existente.
4. **Un solo mega-service social.** NO para este RFC decidirlo en detalle (es de RFC-002), pero el esqueleto de D1 reserva 4 services porque mezcla contextos read-only con estado mutable (publishing/generation/settings) — el criterio users (`users-mock` vs `api-keys-mock`) ya separa por mutabilidad.
5. **Eager-load de la capa compartida social en `app.config.ts`** (providers explícitos). NO: los services son `providedIn: 'root'` tree-shakeable; referenciarlos eager los arrastraría al initial chunk y quema el headroom de 15 kB.
6. **Heatmap con plugin `chartjs-chart-matrix`.** Postergado a RFC-004 con default en contra: es dependencia nueva (necesita justificación según AGENTS.md) y un grid HTML con tokens de opacidad/primary cuenta la misma historia con cero bytes.
7. **Nueva sección en un módulo nav existente** (colgar de CRM). NO: la suite es un producto vendible por sí mismo (pitch SaaS); módulo de primer nivel con icono propio, como Observabilidad.

## Consecuencias

**Positivas**

- Las 9 páginas comparten esqueleto verificable (host class, cascada de estados, toolbar, defer policy) → el review compara contra una plantilla, no contra gusto.
- Nav + rutas + breadcrumbs + fixtures cerrados en Wave A: baselines visuales se generan UNA vez para los shells y solo se regeneran por página al completarla, no en cada PR intermedio.
- Bundle bajo control por construcción: ninguna decisión posterior puede meter Chart.js al initial sin violar una regla explícita de este RFC.
- Los shells con empty-state de onboarding de Wave A ya cuentan la historia "registro → conectar → módulos funcionando" antes de que exista una sola página de analytics.

**Negativas / deuda aceptada**

- Red activa y rango temporal no son URL-addressable (alternativa 2): compartir un link no preserva el filtro. Aceptado para v1; si duele, se migra a queryParams sin tocar el resto del esqueleto.
- Shells de Wave A = dos rondas de baselines para las páginas de B/C (shell y versión final). Aceptado: es el precio de cerrar navegación temprano.
- `totalJs` crece con 9 chunks y obliga a re-baselinear el delta-check por wave — ruido de diffs en `tools/bundle/baseline.json`, mitigado por la regla "solo en PR de cierre de wave, con justificación".
- Reutilizar `app-health-badge` para estados de conexión estira levemente su semántica (D8); si confunde, el costo de crear el chip propio después es bajo (patrón `.tokens.ts` + story).

## Plan de implementación

1. **[Wave A / PR-1]** Crear `modules/social/{models,mocks,services,utils,components}` con los contratos de RFC-002; agregar entrada `NAV_MODULES` (D4), bloque de rutas + `ROUTE_DATA` (D2, D3) con las 9 páginas como shells (page-header + `<app-empty-state>` de onboarding con CTA a connections/providers); crear `app-network-chip` + `network-chip.tokens.ts` + `NetworkChip.stories.ts`; agregar las 10 fixtures vacías (D7 — las entries `-seeded` llegan con los PRs de Waves B/C que reemplazan cada shell); correr workflow `Visual baselines`; `npm run bundle:baseline` si el delta-check dispara.
2. **[Wave A / PR-2]** `social-connections` y `social-providers` completos (UX según RFC-004; persistencia según RFC-002 §5) + `signup` (RFC-003). Re-baselinear las 3 rutas afectadas vía workflow.
3. **[Wave B]** `social-overview` → `social-analytics` → `social-insights` → `social-competitors` → `social-trends`, en 2-3 PRs. Consultar el MCP de PrimeNG antes de cada componente nuevo (`p-datepicker`, `p-selectbutton`, etc.). Registrar controllers de Chart.js extra solo si RFC-004 lo aprueba. Re-baselinear por PR las rutas tocadas.
4. **[Wave C]** `social-planner` y luego `social-studio` (2 PRs), cerrando las integraciones cross-página (hashtags en composer, `sourceJobId`, selector de provider desde `ConnectorConfig`).
5. En cada PR: `npm run verify` local antes de push (paridad exacta con CI).

## Criterios de aceptación verificables

Por PR (todos, sin excepción):

- [ ] `npm run verify` pasa: `lint` (19 reglas del plugin en error, incl. `no-duotone-inline-icon` — duotone solo con `text-2xl`+ en el mismo elemento —, `no-missing-dark-pair`, `no-forbidden-spacing`), `test`, `build` (budgets initial ≤ warn 790 kB), `bundle:check` (delta ≤3 % o baseline actualizada en el mismo PR con justificación), `smoke`.
- [ ] Cero imports de `modules/social/**` ni de `chart.js` alcanzables desde el initial chunk (verificable en el output de `bundle:check`: el initial-raw no crece más que el costo de nav/rutas de Wave A).
- [ ] Toda ruta nueva agregada en `tests/fixtures/routes.ts` en el mismo PR; baselines generadas vía workflow manual `Visual baselines` (nunca local) y commiteadas en el mismo PR.
- [ ] `npm run a11y` sin violaciones `serious`/`critical` en las rutas sociales.
- [ ] Todo `@defer` de la lista D5 presente, con `@placeholder` + `<p-skeleton>` dimensionado + `aria-busy="true"`.

Por wave:

- [ ] **A:** `/social` redirige a `/social/overview`; las 9 rutas navegables desde el side-menu con breadcrumb de 3 niveles correcto; shells muestran empty-state de onboarding con CTA funcional a `/social/connections` / `/social/providers`; `NetworkChip.stories.ts` visible en `npm run storybook`; `/signup` accesible solo sin sesión (guestGuard) y `/social/*` solo con sesión (authGuard) — cubierto por el smoke SSR existente + fixtures `guestOnly`.
- [ ] **B:** las 5 páginas de analítica renderizan datos mock deterministas en sus fixtures `-seeded` (dos ejecuciones del visual suite sin diff, variantes vacía y seeded); charts hidratan solo al entrar en viewport (verificable: sin `<canvas>` inicializado antes del scroll en el HTML SSR).
- [ ] **C:** planner y studio cierran los flujos cross-página (insight → planner vía `actionRoute`; job de studio adjuntable en planner; provider deshabilitado = opción disabled con tooltip en studio).
