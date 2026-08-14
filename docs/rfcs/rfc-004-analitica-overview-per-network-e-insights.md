# RFC-004 — Analítica: overview cross-red, per-network e insights

- **Estado:** Propuesto
- **Fecha:** 2026-08-14
- **Autores:** equipo
- **Relacionados:** RFC-001 (esqueleto/rutas/gates — host class y defer policy ya asignados), RFC-002 (contratos congelados que este RFC consume), RFC-003 (patrón de empty states de onboarding, que acá solo se aplica), RFC-005 (competencia/tendencias — fuera de alcance acá)

## Resumen

Diseña las tres páginas de analítica pura de la suite social: `social-overview` (dashboard cross-red), `social-analytics` (per-network IG/FB/TikTok con selector de red y rango) y `social-insights` (feed de mejoras/correcciones/oportunidades con dismiss). Cierra las decisiones técnicas que RFC-001 delegó: **cero controllers nuevos en `chart-registry.ts`** (el heatmap best-time es grid CSS con tokens y las sparklines son SVG inline — ambos con costo cero de Chart.js), fetch único multi-red con recorte client-side de red y rango (la red activa y el rango 7/30/90 viven como signals en un `SocialViewFiltersService` root-scoped), colores de charts siempre vía `getComputedStyle(--p-primary-*)` con re-render en `themeChanged()` + `untracked`, legend custom HTML, tooltip external clonado a `modules/social/utils/`, todo `<app-chart>` en `@defer (hydrate on viewport)`, y formatters `Intl` es-CL a nivel módulo. Los tres campos FB que este RFC necesita (CTR, organic vs paid, reactions breakdown) **ya están incorporados al contrato congelado de RFC-002 D2** — D7 documenta el mapeo, sin coordinación pendiente. No cubre competencia, tendencias ni hashtags (RFC-005), ni la mecánica de mocks (RFC-002), ni el diseño del onboarding (RFC-003 — acá solo se aplica su patrón de gating).

## Contexto y problema

Las tres páginas comparten problema: visualizar series temporales y agregados mock deterministas con el vocabulario visual del repo (single-hue primary, sin sombras, tokens only) y bajo gates duros — ~15 kB de headroom en el initial bundle, delta-check de 3 %, baselines visuales pixel-estables, axe sin `serious/critical`, y el guard-rail zoneless de identidad estable en `[ngModel]`.

Lo que ya está decidido y NO se rediscute acá:

- **RFC-001 D5:** host class por página (`social-overview`/`social-analytics` = contenedor de página `flex-1 h-full overflow-y-auto pb-0.5` con cards propias; `social-insights` = página-card `border border-surface rounded-2xl p-6`), toolbar canónica, cascada `@if loadError → @else if vacío → @else datos`, y la lista de bloques `@defer`.
- **RFC-002:** entidades (`MetricSeries` con 90 buckets y `delta` 30d precalculado, `PostSummary`, `AudienceSnapshot` con `activeHours`/`activeDays`/`trafficSources`, `Recommendation` inmutable), puertos (`SocialAnalyticsPort`, `InsightsPort`), `RecommendationDismissalsStore`, scoping por `clientSeed`, y que las páginas dependen **solo de puertos y entidades**.
- **Sin rutas por red** (RFC-001 alternativa 2): la red activa es estado en memoria.

Lo que este RFC cierra: cómo se ensamblan los datos en cada página, qué se dibuja con Chart.js y qué no, cómo se implementa el heatmap distintivo de la categoría, cómo se muestran métricas incomparables sin sumarlas, y la anatomía exacta del feed de insights.

## Decisión

### D1. Estructura de archivos

```
src/app/modules/social/
  utils/
    format.ts                     ← formatters Intl es-CL a nivel módulo (D10)
    chart-tooltip.ts              ← clon del external tooltip de overview (D9)
    analytics-data.ts             ← loadNetworkRows(): ensamblado forkJoin cross-red (D3)
    metric-math.ts                ← sliceRange / deltaPct / weightedEngagementRate (puros, testeables)
    best-time.ts                  ← topSlots(): cómputo puro de mejores franjas — lo consume el
                                    heatmap (D6.8) Y el planner de RFC-006 (que le agrega nextBestSlot)
  components/
    sparkline/
      sparkline.component.ts      ← app-social-sparkline, SVG inline (D2) — cross-página
  models/
    analytics-vm.interface.ts     ← NetworkAnalyticsRow y VMs de página (D3)
  social-overview/
    social-overview.component.{ts,html,scss}      ← .scss vacío
    utils/overview-charts.ts      ← builders de followers multi-serie + donut engagement
  social-analytics/
    social-analytics.component.{ts,html,scss}
    constants/network-kpis.ts     ← NETWORK_KPI_CONFIG: qué KPI cards por red (D6)
    utils/analytics-charts.ts     ← builders de series por red + bar de audiencia
    components/
      best-time-heatmap/
        best-time-heatmap.component.ts   ← grid CSS día×hora (D2, D6)
      audience-breakdown/
        audience-breakdown.component.ts  ← barras HTML de género/país/traffic source (D6)
  social-insights/
    social-insights.component.{ts,html,scss}
    constants/recommendation-type.tokens.ts   ← labels/iconos de improvement/fix/opportunity (D8)
    components/
      insight-card/
        insight-card.component.ts  ← card de recomendación con evidencia + CTA (D8)
```

Todos los componentes: OnPush, standalone, selector `app-social-*`, imports agrupados `NG_MODULES`/`PRIME_MODULES`/`LOCAL_COMPONENTS`, `inject()` sin constructor DI. Ninguno es shared global → **cero stories nuevas** (regla RFC-001 D8: story solo al promover a `shared/`). `app-network-chip` (shared, con story) llega hecho de Wave A y acá solo se consume.

### D2. Chart.js: cero registros nuevos en `chart-registry.ts`

Inventario completo de visualizaciones de las 3 páginas contra los controllers YA registrados (`BarController`, `LineController`, `DoughnutController` + `Filler` + `Tooltip`):

| Visualización | Página | Implementación | Costo bundle |
|---|---|---|---|
| Followers por red, multi-serie | overview | `<app-chart type="line">`, 3 datasets | 0 (LineController ya está) |
| Donut de engagement por red | overview | `<app-chart type="doughnut">` | 0 |
| Series temporales por métrica (reach, ER, views…) | analytics | `<app-chart type="line">` con `fill: true` (Filler ya está) | 0 |
| Organic vs paid reach (FB) | analytics | `<app-chart type="bar">` apilado, 2 datasets (patrón overview home) | 0 |
| Edad de audiencia | analytics | `<app-chart type="bar">` | 0 |
| Género / país / traffic source FYP | analytics | Barras HTML `bg-primary` con `[style.width.%]` precomputado | 0 |
| **Heatmap best-time día×hora** | analytics | **Grid CSS con tokens** (abajo) | **0** — evita la dependencia `chartjs-chart-matrix` |
| Sparkline de evidencia (×8-10 en el feed) | insights | **SVG inline** `app-social-sparkline` (abajo) | 0 — evita 10 canvas + Chart.js en insights |

**Decisión dura:** este RFC NO toca `shared/components/chart/chart-registry.ts`. Si RFC-005 necesita scatter para competitors, lo registra RFC-005 (el costo cae en el chunk lazy, RFC-001 D6.3).

**Heatmap = grid CSS.** Réplica conceptual del segment grid de `obs-uptime` (colores precomputados en el modelo, bindeados por `[style.backgroundColor]` — permitido por el DS para valores dinámicos): celdas `div` en un grid `grid-cols-[repeat(24,minmax(0,1fr))]` de 7 filas. La intensidad usa `color-mix` sobre el token primary:

```typescript
// best-time-heatmap.component.ts — celda precomputada (nunca resolver color en template)
interface HeatmapCell {
  readonly intensity: number;   // 0-100
  readonly color: string;       // precomputado una vez por VM, no por CD
  readonly label: string;       // 'Martes 19:00 — ER estimado 4,2 %'
}

const cellColor = (intensity: number): string =>
  // color-mix con CSS var: theme-aware SIN getComputedStyle ni re-render
  // en themeChanged — la var resuelve al valor del tema activo en paint.
  `color-mix(in srgb, var(--p-primary-500) ${Math.round(intensity * 0.9 + 8)}%, transparent)`;
```

Ventajas medidas contra el plugin matrix: cero dependencia nueva (AGENTS.md exige justificación para deps), cero bytes de Chart.js, dark mode gratis vía la CSS var, y SSR renderiza el grid completo (el heatmap es contenido, no canvas). Sigue yendo dentro de `@defer (hydrate on viewport)` por tamaño de DOM (168 celdas), con `@placeholder` de `<p-skeleton>` a la altura real del grid.

**Sparkline = SVG inline.** `app-social-sparkline` (en `modules/social/components/` — lo comparten insights hoy y las trend-cards de RFC-005): `<svg viewBox="0 0 100 28" preserveAspectRatio="none" role="img" [attr.aria-label]="ariaLabel()">` con un `<polyline>` de `stroke="var(--p-primary-500)"` + `fill="none"` y un `<polygon>` de área con `fill="var(--p-primary-100)"` (par dark automático vía tema Aura; DESIGN.md ya sanciona `fill="var(--p-primary-color)"` para SVG inline). El path se computa en un `computed` desde `points = input.required<readonly number[]>()`. Cero canvas, cero `getComputedStyle`, SSR-safe por construcción, y 10 instancias en el feed cuestan lo que 10 `<svg>` estáticos. **Contrato ÚNICO congelado acá** (RFC-005 lo consume tal cual): a11y = `role="img"` + `ariaLabel = input.required<string>()` con la frase descriptiva (nunca `aria-hidden` + texto hermano — un solo mecanismo para todos los consumidores), stroke fijo `--p-primary-500` sin input de color.

### D3. Ensamblado de datos: fetch único multi-red, recorte client-side

`trackedResource` es list-shaped y su `rxResource` interno no re-fetchea por signals leídos en el stream. En vez de pelear contra eso, el modelo de datos de ambas páginas de analytics **es naturalmente una lista: una fila por red conectada.**

```typescript
// models/analytics-vm.interface.ts
export interface NetworkAnalyticsRow {
  readonly account: SocialAccount;
  readonly network: SocialNetwork;
  /** Series completas (90 buckets) por kind relevante de la red — el recorte
   *  a 7/30/90 lo hace la UI con sliceRange(), sin re-fetch. */
  readonly series: ReadonlyMap<MetricKind, MetricSeries>;
  readonly topPosts: readonly PostSummary[];
  readonly audience: AudienceSnapshot;
}
```

```typescript
// utils/analytics-data.ts — función pura de composición sobre el puerto.
// Recibe el puerto por parámetro (patrón buildRow de obs-uptime: sin DI,
// testeable con un stub del puerto).
export const loadNetworkRows = (
  api: SocialAnalyticsPort,
  kinds: ReadonlyMap<SocialNetwork, readonly MetricKind[]>,
): Observable<readonly NetworkAnalyticsRow[]> =>
  api.getAccounts().pipe(
    switchMap((accounts) => {
      const connected = accounts.filter((a) => a.status === 'connected' || a.status === 'expired');
      if (connected.length === 0) return of([] as readonly NetworkAnalyticsRow[]);
      return forkJoin(connected.map((account) => buildRow$(api, account, kinds)));
    }),
  );
```

- **Un solo fetch por página** (todas las redes, todos los kinds relevantes): cambiar de red o de rango es instantáneo (computed que filtra/recorta), sin flash de skeleton, y las baselines visuales capturan un único estado de datos. El puerto sigue siendo per-account/per-kind — un backend real hace exactamente los mismos N requests vía `forkJoin`; la decisión de "traer todo" es de la página, no del contrato.
- Cuentas `expired` **sí** entran a las filas (tienen histórico backfilleado) — la página muestra el `<app-stale-data-banner>` con copy "Token de {red} expirado — los datos pueden estar desactualizados" y CTA `retry`→`/social/connections` cuando alguna fila viene de cuenta `expired`. `disconnected`/`error` sin historia no producen fila.
- Ambas páginas envuelven `loadNetworkRows` en `trackedResource<NetworkAnalyticsRow>` (field initializer, injection context) → `loading`/`loadError`/`lastFetchedAt`/`retry()` gratis para la cascada canónica y `<app-refresh-toolbar>`.
- `kinds` por red vive en `constants/network-kpis.ts` (D6) — overview pide el subset mínimo (`followers`, `reach`, `engagement-rate`, más `impressions`/`video-views` para el lado-a-lado), analytics pide el set completo de su red.

### D4. Red activa y rango: `SocialViewFiltersService` + recorte puro

```typescript
// services/social-view-filters.service.ts  (modules/social/services/ — Wave B)
export type MetricRangeDays = 7 | 30 | 90;

/**
 * Filtros de vista de la suite de analítica — EN MEMORIA por decisión
 * RFC-002 §5: sobreviven navegación intra-SPA (volver de insights a
 * analytics conserva red y rango), no ameritan storage ni URL (RFC-001
 * alternativa 2). providedIn root: chunk lazy igual (solo lo inyectan
 * componentes lazy).
 *
 * DUEÑO Y FIRMA CONGELADA: este RFC crea el service y fija los nombres —
 * `network` y `rangeDays`. RFC-005 (competitors/trends) consume `network`
 * tal cual; ningún otro RFC redefine ni renombra estos signals.
 */
@Injectable({ providedIn: 'root' })
export class SocialViewFiltersService {
  readonly network = signal<SocialNetwork>('instagram');
  readonly rangeDays = signal<MetricRangeDays>(30);
}
```

- UI del selector: `p-selectbutton` para la red (options con `app-network-chip`-style: icono `fa-brands` + label) y `p-selectbutton` para 7/30/90 ("7 días" / "30 días" / "90 días"). Ambos bindean `[ngModel]` a **valores primitivos** (string/number) → identidad estable garantizada, sin riesgo del loop zoneless documentado en `customers.component.ts:816-826`. Las options son fields `readonly` del componente.
- Recorte y deltas en `utils/metric-math.ts`, funciones puras con spec vitest:

```typescript
/** Últimos `days` buckets de una serie de 90. */
export const sliceRange = (points: readonly MetricPoint[], days: MetricRangeDays): readonly MetricPoint[] =>
  points.slice(-days);

/**
 * Delta % del período visible vs el período anterior del mismo largo.
 * El `delta` congelado de MetricSeries (RFC-002) es el canónico a 30d;
 * este util lo generaliza para 7/90 SIN tocar el contrato. Con rango 90
 * no hay período anterior completo (la serie tiene 90 buckets) → null,
 * y la KPI card omite el bloque de delta (app-metric-card ya lo soporta).
 */
export const deltaPct = (points: readonly MetricPoint[], days: MetricRangeDays): number | null => { /* … */ };

/** ER ponderado por reach: Σ(ERᵢ·reachᵢ)/Σ(reachᵢ) — nunca promedio simple. */
export const weightedEngagementRate = (
  rows: readonly { er: number; reach: number }[],
): number => { /* … */ };
```

Todo lo derivado (KPIs, datasets de charts) son `computed` sobre `rows()` + `network()` + `rangeDays()` — cadena signals pura, cero re-fetch, cero estado duplicado.

### D5. `social-overview` — composición

Orden vertical (host de página, cards propias `border border-surface rounded-2xl`):

1. **`<app-page-header heading="Overview" description="…">`** con pill informativo proyectado "N cuentas conectadas" (patrón statusPill de obs-uptime: `<div role="status">`, NO `p-button`).
2. **`<app-onboarding-checklist>`** (RFC-003 D3, montado por Wave A — **PR-B2 lo CONSERVA al reemplazar el shell**, no lo borra): ARRIBA de la cascada de datos, visible mientras esté incompleto y no descartado, incluso con cuentas ya conectadas (le queda el paso opcional de IA).
3. **Toolbar canónica** con `<app-refresh-toolbar>` + el selector de rango (el de red NO va acá: overview es cross-red por definición).
4. **Fila de KPI cards** — grid `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-6`, 4 × `app-metric-card` (no diferidas, above-the-fold por RFC-001 D5):
   - *Audiencia total* — Σ followers (sí es sumable: misma unidad y semántica), `formatCompact`, delta = `deltaPct` del agregado.
   - *Alcance total* — Σ reach del rango (reach es sumable entre redes: misma definición "cuentas únicas alcanzadas por red").
   - *Interacciones* — Σ (likes+comments+shares+saves) del rango.
   - *ER ponderado* — `weightedEngagementRate`, unit `%`, `direction="up-good"`.
5. **Regla anti-suma (lado a lado etiquetado).** Impressions (IG/FB) y video views (TikTok) **jamás se suman ni se promedian**: se muestran en una card "Volumen por red" con una mini-fila por red — `app-network-chip` + valor + label de la métrica REAL de esa red ("Impresiones" para IG/FB, "Reproducciones de video" para TikTok) + delta propio. El template no tiene ninguna rama que combine kinds distintos; el reviewer enterprise ve las unidades etiquetadas, exactamente como Metricool/Sprout.
6. **Chart followers multi-serie** (`@defer hydrate on viewport`): line chart, un dataset por red en orden `SOCIAL_NETWORKS`, colores de la rampa primary — `--p-primary-600` (IG), `--p-primary-400` (FB), `--p-primary-200` (TikTok), hover un paso más oscuro (patrón exacto de los 3 datasets de overview home; single-hue del DS, la distinción la da la **legend custom HTML**: dots `w-2.5 h-2.5 rounded-full` con `[style.backgroundColor]` precomputado + label de red).
7. **Donut de distribución de engagement por red** (`@defer`): mismos 3 colores, legend custom con valor absoluto + % (los % de un donut sí son comparables: misma métrica "interacciones").
8. **Top posts cross-red** (`@defer`, va debajo de charts): `p-table` con `TRANSPARENT_TABLE_TOKENS`, 6-8 filas, columnas thumbnail (`demoAsset`, `rounded-lg overflow-hidden`), caption `line-clamp-1`, red (`app-network-chip`), formato (`p-tag`), ER (`pSortableColumn`), reach. Sin paginator (es teaser; el análisis fino vive en analytics).
9. **Teaser de insights**: card "Recomendaciones" con las **top-3** no-descartadas (orden: severidad `critical→warn→info`, luego `detectedAt` desc — mismo criterio SEVERITY_RANK de obs-uptime), cada una como fila compacta `severity-chip + título + chevron`, y `<a>` "Ver todas las recomendaciones" con la receta de link del DS → `/social/insights`. Lee `InsightsPort.getRecommendations()` dentro del mismo forkJoin de página (un solo `trackedResource` extra) y filtra con `RecommendationDismissalsStore` vía computed.

Gating de onboarding (patrón RFC-003 aplicado): `rows().length === 0 && !loading()` → `<app-empty-state icon="fa-plug" title="Conectá tu primera cuenta" description="…" actionLabel="Conectar cuentas" (actionClick)="router → /social/connections">`. **En overview, el empty state se OMITE mientras el checklist (bloque 2) esté visible** — el checklist es el estado de onboarding y dos CTAs idénticas apiladas serían ruido (decisión compartida con RFC-003 D3); aplica solo si el checklist fue descartado y sigue sin cuentas. En analytics (sin checklist) el gating aplica siempre.

### D6. `social-analytics` — per-network

1. Header + toolbar con **ambos** selectores (red + rango) del `SocialViewFiltersService`.
2. `selectedRow = computed(() => rows().find(r => r.network === filters.network()))` — sin fila para la red elegida (cuenta no conectada) → empty state específico "No tenés {red} conectada" con CTA a connections.
3. **KPI cards por red** — data-driven desde `constants/network-kpis.ts` (cero `@if` por red en el template para las cards):

```typescript
// social-analytics/constants/network-kpis.ts
export interface KpiDescriptor {
  readonly kind: MetricKind;
  readonly label: string;               // es-CL: 'Alcance', 'Guardados', …
  readonly icon: string;                // fa-sharp fa-regular fa-*
  readonly unit: '' | '%' | 'min';
  readonly direction: 'up-good' | 'up-bad';
  readonly aggregate: 'sum' | 'avg' | 'last';   // cómo colapsar el rango a un número
}

/** Métricas REALES de cada API — nombres del vocabulario Graph/TikTok (RFC-002 D2). */
export const NETWORK_KPI_CONFIG: Record<SocialNetwork, readonly KpiDescriptor[]> = {
  instagram: [ /* reach, engagement-rate, saves, profile-visits, watch-time (Reels) */ ],
  facebook:  [ /* reach, impressions, link-clicks (→ CTR derivado), engagement-rate */ ],
  tiktok:    [ /* video-views, completion-rate, watch-time, net-follower-growth */ ],
};
```

4. **Series temporales** (`@defer` por card de chart): 2 line charts con la métrica principal y secundaria de la red (IG: reach + ER; FB: reach organic vs paid — bar apilado; TikTok: video views + completion rate). El builder vive en `utils/analytics-charts.ts` con la firma del patrón overview (recibe `darkTheme` + lee `getComputedStyle`).
5. **Secciones "wow" específicas por red** (acá SÍ hay `@switch` por red, es contenido distinto):
   - **FB:** *reactions breakdown* — donut agregando `metrics.reactions` de los top posts (campo de RFC-002 D2, ver D7), legend custom con los 6 tipos; *CTR* — KPI derivado `link-clicks / impressions` (formateado `formatPercent`); *organic vs paid* — bar apilado de `reach` y `paid-reach`.
   - **TikTok:** *traffic sources* — barras HTML de `audience.trafficSources` con la fila FYP destacada (`font-semibold` + valor grande): "68 % de tus views vienen del For You"; *completion rate* como KPI.
   - **IG:** breakdown por `PostFormat` (Reels vs feed vs stories) — barras HTML de ER promedio por formato desde `topPosts` (vende la historia "Reels duplican tu ER" que alimenta insights).
6. **Top posts de la red**: `p-table` completa, ordenable por cualquier métrica (`pSortableColumn` sobre campos numéricos crudos del VM de fila; los formateados van en campos hermanos `*Label` — patrón severityRank/uptimeLabel de obs-uptime), `[paginator]="true" [rows]="5" paginatorStyleClass="!bg-transparent"`.
7. **Audiencia** (`@defer`): bar chart de `byAge` + `audience-breakdown` (barras HTML de género y top-5 países con `[style.width.%]` precomputado, valores `formatPercent`).
8. **Heatmap best-time** (`@defer`, D2): 7×24, celda = `activeDays[d] × activeHours[h]` normalizado y escalado alrededor del ER de la cuenta (`label` por celda con día/hora/ER estimado). **El cómputo de score y top franjas NO vive en el componente:** nace en `utils/best-time.ts` (`topSlots(audience, count)` — D1) desde el primer PR, porque el planner de RFC-006 consume la MISMA lógica (marca días y sugiere horario) — así no hay refactor cross-wave después. A11y patrón obs-uptime: cada fila (día) es un contenedor tabbable con `[attr.aria-label]` rico ("Martes: mejor franja 18:00–20:00, ER estimado 4,2 %"); las celdas individuales son `aria-hidden` (detalle visual, el label de fila lleva la información — WCAG 1.4.1 sin depender del color). Debajo, texto resumen: "Tu mejor franja: martes y jueves 18:00–20:00" — computed sobre `topSlots(aud, 3)`, y es lo que los insights citan.

### D7. Campos FB del contrato (ya incorporados a RFC-002 — mapeo documentado)

Las métricas FB del pedido (CTR, organic vs paid, reactions breakdown) están cubiertas por tres campos que **RFC-002 D2 ya declara en el contrato congelado** (incorporados a pedido de este RFC — acá solo se documenta el mapeo, no hay coordinación pendiente):

```typescript
// social.interface.ts (RFC-002 D2) — MetricKind incluye:
'link-clicks'   // FB: link_clicks; IG: website_taps → habilita CTR = link-clicks / impressions
'paid-reach'    // → habilita organic = reach − paid-reach (bar apilado FB)

// PostSummary.metrics incluye el campo opcional (Graph API expone reactions por post;
// la vista FB agrega los top posts client-side para el donut):
readonly reactions?: readonly {
  readonly type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
  readonly count: number;
}[];   // solo network 'facebook' — undefined en el resto
```

Las factories de RFC-002 (Wave A) los generan con los seeds estándar (`${clientSeed}:series:${accountId}:link-clicks`, etc. — RFC-002 plan §5). Este RFC solo los consume.

### D8. `social-insights` — feed tipificado con dismiss

Página-card única (RFC-001 D5). Anatomía:

1. Header + toolbar (refresh). Pill informativo: "N recomendaciones activas".
2. **Filtros** — tres `p-selectbutton` single-select con opción "Todas" (`null`): tipo (`improvement`/`fix`/`opportunity`), severidad (`critical`/`warn`/`info`), red. Valores primitivos en `[ngModel]` → zoneless-safe. Estado **local al componente** (signals): a diferencia de red/rango de analytics, los filtros del feed no necesitan sobrevivir navegación (paridad con los column filters de obs-uptime, que tampoco persisten).
3. **Feed** — lista vertical de `app-social-insight-card` (`divide-y divide-surface-200 dark:divide-surface-800` dentro de la página-card):

```typescript
// social-insights.component.ts — derivación completa por computed
private readonly data = trackedResource<Recommendation>(() => this.api.getRecommendations());
private readonly dismissals = inject(RecommendationDismissalsStore);

protected readonly visible = computed<readonly Recommendation[]>(() => {
  const all = this.data.value() ?? [];
  const acked = this.dismissals.dismissed();          // ReadonlySet<string>
  return all
    .filter((r) => !acked.has(r.id))
    .filter((r) => this.typeFilter() === null || r.type === this.typeFilter())
    .filter((r) => this.severityFilter() === null || r.severity === this.severityFilter())
    .filter((r) => this.networkFilter() === null || r.network === this.networkFilter())
    .toSorted((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      || b.detectedAt.localeCompare(a.detectedAt));
});
```

4. **`insight-card`** (componente local, inputs `recommendation` + output `dismissed`):
   - Fila superior: chip de **tipo** (`app-pill` con icono de `recommendation-type.tokens.ts`: `fa-arrow-trend-up` mejora / `fa-wrench` corrección / `fa-lightbulb` oportunidad + label es-CL) + **`app-severity-chip`** reusado tal cual (`RecommendationSeverity` es la MISMA union que `AlertSeverity` — TypeScript estructural, cero adapter; los labels "Crítico/Advertencia/Info" de `severity-chip.tokens.ts` aplican) + `app-network-chip` + `{{ r.detectedAt | relativeTime }}`.
   - Título `text-color font-bold leading-6` (receta título de card) + `detail` en `text-muted-color leading-6`.
   - **Evidencia**: `app-social-sparkline [points]="r.evidence.sparkline"` + valores observado vs esperado formateados (`formatMetric(r.evidence.metric, value)` de D10) — "ER Reels observado 4,2 % · esperado 2,1 %". `ariaLabel` de la sparkline = esa misma frase.
   - **Acciones**: `suggestedAction` como texto + CTA `<p-button [label]="ctaLabel" outlined [routerLink]="r.actionRoute" />` cuando `actionRoute` existe (label derivado de la ruta: `/social/planner` → "Ir al calendario", `/social/analytics` → "Ver analítica", `/social/connections` → "Revisar conexión" — mapa const en los tokens de tipo). Dismiss: `<p-button icon="fa-sharp fa-regular fa-xmark" text ariaLabel="Descartar recomendación" pTooltip="Descartar recomendación" />` (icon-only ⇒ ambos obligatorios).
   - Antes de navegar por `actionRoute="/social/analytics"`, el card setea `SocialViewFiltersService.network` a `r.network` — el deep-link aterriza con la red correcta seleccionada.
5. **Dismiss**: optimista — el click llama `dismissals.dismiss(r.id)` (el feed reacciona por computed al instante) y `InsightsPort.dismissRecommendation(id)` en paralelo (que en el mock delega en el mismo store; en producción sería el POST). Sin undo en v1 (el store expone `undismiss` si RFC-005+ lo quiere).
6. **Vacíos, dos variantes** (regla ux-patterns): (a) sin recomendaciones activas → empty state celebratorio "Todo en orden — sin recomendaciones pendientes" (`<app-empty-state icon="fa-circle-check">` — el input recibe el nombre pelado, el componente antepone `fa-sharp-duotone fa-regular` y aplica `text-4xl`; sin CTA); (b) filtros sin match → variante "Sin resultados con estos filtros" + CTA "Limpiar filtros" (resetea los 3 signals). Sin cuentas conectadas → gating de onboarding igual que D5.

### D9. Runtime de charts — reglas transversales

- **Colores:** SIEMPRE `getComputedStyle(document.documentElement).getPropertyValue('--p-primary-*' | '--p-surface-*')` dentro de los builders de `utils/*-charts.ts`, tras guard `isPlatformBrowser`. Cero hex. Ticks `surface-400/500` y grid `surface-100/900` condicionales por `darkTheme` (patrón `setChartOptions` de overview, líneas 168-200).
- **Re-render por tema:** cada componente con charts declara en el constructor el effect canónico de overview — **`untracked` es load-bearing** (leer `darkTheme()` dentro de `initCharts` sin registrar dependencia; si no, el effect dispara antes de que `.p-dark` esté aplicado y Chart.js lee los colores del tema anterior):

```typescript
constructor() {
  effect(() => {
    this.filters.network();                    // deps explícitas de datos
    this.filters.rangeDays();
    this.configService.themeChanged();
    untracked(() => this.initCharts());        // lee darkTheme() sin trackear
  });
}
```

- **Legend:** built-in SIEMPRE `display: false`; legend custom HTML por chart (dots con color precomputado en un signal `legendItems` que el builder retorna junto a data/options).
- **Tooltip:** `tooltip: { enabled: false, external: externalTooltipHandler }` importado de `modules/social/utils/chart-tooltip.ts` — **clon** del de `overview/utils/chart-tooltip.ts` con JSDoc de origen. Se clona (no se importa cross-módulo: acoplaría features hermanas, mismo rationale que RFC-002 D8) y no se promueve a `shared/` todavía (ver Alternativas #5).
- **`@defer (hydrate on viewport)`** en todo bloque de la lista RFC-001 D5 (todos los `<app-chart>`, heatmap, tabla de top posts bajo charts), cada uno con `@placeholder` de `<p-skeleton>` con las dimensiones del contenido real y `aria-busy="true"` en el contenedor. Los KPI cards y el teaser de insights NO se difieren. El effect de tema vive DENTRO del componente de página; los charts diferidos leen los signals `chartData`/`chartOptions` que ese effect setea — al hidratar tarde toman el último valor, sin carrera.
- **`ariaLabel` obligatorio** en cada `<app-chart>` (el input existe): frase con el resumen numérico ("Evolución de seguidores últimos 30 días: Instagram 12.400, Facebook 8.100, TikTok 15.900").

### D10. Formatters `Intl` es-CL a nivel módulo

`modules/social/utils/format.ts` (precedente: `observability/utils/format.ts` + regla "formatear en .ts, jamás pipes de formateo"):

```typescript
const COMPACT = new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 });
const INT = new Intl.NumberFormat('es-CL');
const PCT = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

export const formatCompact = (n: number): string => COMPACT.format(n);   // 12.400 → '12,4 mil'
export const formatInt = (n: number): string => INT.format(n);
export const formatPercent = (n: number): string => `${PCT.format(n)} %`;
/** Dispatcher por MetricKind → formatter + unidad ('' | '%' | 'min') para KPI cards y evidencia. */
export const formatMetric = (kind: MetricKind, v: number): string => { /* … */ };
```

Instancias UNA vez a nivel módulo (Intl es caro de instanciar — JSDoc de obs-uptime:85-90). Los VMs de fila llevan los valores preformateados (`reachLabel`, `erLabel`) junto a los crudos para sort. Única excepción de pipe: `| relativeTime` (sancionada).

### D11. Layout y estados — aplicación del patrón (sin novedades)

Las tres páginas siguen la anatomía obs-uptime literal: `<app-page-header>` → toolbar `mt-6 lg:mt-10 mb-4 flex items-center gap-2 lg:gap-3 flex-wrap` con `<app-refresh-toolbar [lastFetchedAt] [loading] (refresh)>` → cascada `@if (vacío && loadError) → @else if (vacío && !loading) → @else` (predicados NO espejados, con `@else if`) → `<app-stale-data-banner>` sobre datos viejos + error de refresh. Cards data-heavy con padding responsivo `p-4 lg:py-5 lg:px-7`. Dark pairs en todo `bg-surface-*`. Los empty states de onboarding usan el copy/CTA que RFC-003 estandariza — este RFC no los rediseña, los invoca.

## Alternativas consideradas

1. **Heatmap con `chartjs-chart-matrix`.** Dependencia nueva (AGENTS.md la exige justificada), ~4-6 kB gz en el chunk lazy, canvas sin SSR, colores vía `getComputedStyle` + re-render en cada theme change, y a11y de canvas siempre peor que DOM. El grid CSS da lo mismo con cero costo y dark mode gratis. **No.**
2. **Sparklines con `<app-chart type="line">`.** 8-10 canvas en un feed = 8-10 inicializaciones de Chart.js + resize observers, para un dibujo de 14 puntos sin ejes ni tooltip. SVG inline es dos órdenes de magnitud más barato y SSR-friendly. **No.**
3. **Re-fetch al cambiar red/rango** (pasar los signals como `params` de `rxResource`). Flash de skeleton en cada toggle, N estados de datos distintos para baselines, y cero beneficio con mocks que generan todo del mismo seed. El fetch único + computed es más simple y más rápido. **No.**
4. **Sumar impressions IG + FB + views TikTok en una KPI "Total impresiones".** Métricas con definiciones distintas (impression ≠ view ≠ play); los referentes (Sprout, Metricool) las muestran lado a lado etiquetadas y un reviewer enterprise detecta la suma ciega al instante. **No** — card "Volumen por red" (D5.5).
5. **Promover `chart-tooltip` a `shared/utils/` con re-export en overview** (espejo de RFC-002 D8). Correcto a largo plazo, pero hoy serían 2 consumidores y el churn en overview cae en medio de Wave B sin necesidad. Regla registrada: **al tercer consumidor se promueve con re-export**; mientras tanto, clon con JSDoc de origen. **Postergado.**
6. **Chip nuevo `app-recommendation-severity-chip`.** `RecommendationSeverity` ≡ `AlertSeverity` (misma union por decisión explícita RFC-002) → `app-severity-chip` funciona por tipado estructural sin adapter. Crear un chip idéntico viola "consistencia con lo existente". **No.**
7. **Persistir los filtros del feed de insights en el `SocialViewFiltersService`.** Los filtros de un feed son contexto de la visita, no preferencia (paridad con column filters de obs-uptime, que se descartan al navegar). Solo red+rango tienen semántica cross-página. **No.**
8. **Página `social-insights` derivando las recomendaciones client-side desde las series** (motor de reglas en el componente). El contrato RFC-002 ya entrega `Recommendation` con evidencia precomputada por la factory; duplicar el motor en UI rompe "los componentes dependen solo de puertos" y el backend real jamás lo haría en el cliente. **No.**

## Consecuencias

**Positivas**

- `chart-registry.ts` intacto → cero bytes nuevos de Chart.js; el heatmap y las sparklines (las dos visualizaciones más numerosas en DOM) cuestan solo HTML/SVG y funcionan en SSR.
- Cambio de red/rango instantáneo y sin estados de carga intermedios; una sola forma de datos (`NetworkAnalyticsRow[]`) para dos páginas → menos código y baselines de un único estado.
- `metric-math.ts` y `analytics-data.ts` puros y testeados: el ER ponderado y los deltas por rango (los números que un cliente va a auditar) tienen spec, no fe.
- Los campos FB de D7 mantienen el principio "vocabulario de la API real" — el swap a Graph API sigue siendo mapeo 1:1 incluso para CTR/reactions.
- Reuso agresivo de vocabulario existente (severity-chip, SEVERITY_RANK, cascada, trackedResource) → el review compara contra patrones conocidos.

**Negativas / deuda aceptada**

- El fetch único trae kinds que la vista actual quizá no muestra (~18 series de 90 puntos): irrelevante con mocks, y con backend real la página puede pasar a fetch por red sin tocar el contrato — deuda consciente y barata de revertir.
- Con rango 90 no hay delta (no existe período anterior en la serie de 90 buckets) — las KPI cards omiten el bloque; documentado en el JSDoc de `deltaPct`. Extender la serie a 180 buckets es cambio de RFC-002 que no se justifica hoy.
- El heatmap deriva "ER por franja" de `activeHours × activeDays` (proxy): es honesto para un mock pero el JSDoc lo declara — un backend real traería la matriz directa.
- Clon de `chart-tooltip` = dos copias hasta el tercer consumidor (alternativa 5).
- Filtros del feed de insights no sobreviven navegación — asumido (alternativa 7).

## Plan de implementación (Wave B — orden dentro de la wave)

1. **[PR-B1] Fundación de analítica:** `utils/format.ts`, `utils/metric-math.ts` (+ specs vitest: sliceRange bordes, deltaPct con rango 90 → null, weightedEngagementRate vs promedio simple), `utils/chart-tooltip.ts` (clon), `utils/analytics-data.ts` (+ spec con stub del puerto: sin cuentas → `[]`, expired incluida, forkJoin de 3 redes), `models/analytics-vm.interface.ts`, `services/social-view-filters.service.ts`, `components/sparkline/` (+ spec del path computed). Verificar que los campos FB de D7 llegaron con la capa de Wave A (ya declarados en RFC-002 D2); si el PR de Wave A los omitió, agregarlos acá citando RFC-002 (aditivo). `npm run verify`.
2. **[PR-B2] `social-overview`:** reemplaza el shell de Wave A **conservando el `onboarding-checklist` que Wave A montó** (D5.2 — checklist arriba de la cascada; verificable en review del diff). Builders en `utils/overview-charts.ts`, KPI row, card "Volumen por red", charts diferidos, top posts, teaser de insights. Agregar la fixture `social-overview-seeded` (RFC-001 D7). Consultar el MCP de PrimeNG antes de cada componente (`p-selectbutton`, `p-table`, `p-tag`) — no asumir API. Actualizar baseline visual de la ruta vía workflow `Visual baselines`; `npm run a11y`.
3. **[PR-B3] `social-analytics`:** `constants/network-kpis.ts`, builders, secciones por red (`@switch`), `utils/best-time.ts` (`topSlots` + spec del cómputo de score/mejor franja — nace acá como util puro porque RFC-006 lo consume), `best-time-heatmap` (consume el util), `audience-breakdown`, tabla ordenable. Fixture `social-analytics-seeded`. Baselines + a11y de la ruta.
4. **[PR-B4] `social-insights`:** tokens de tipo, `insight-card`, feed con filtros y dismiss, integración con `SocialViewFiltersService` para el deep-link a analytics. Fixture `social-insights-seeded`. Baselines + a11y.
5. Cada PR corre `npm run verify` completo antes de push. Si el delta-check de `totalJs` dispara por los chunks nuevos, la re-baseline va en el PR de cierre de la wave con justificación (regla RFC-001 D6.4) — nunca por el initial.

## Criterios de aceptación verificables

- [ ] `npm run verify` pasa en cada PR (lint 19 reglas — en particular `no-missing-dark-pair`, `no-forbidden-spacing`, `no-duotone-inline-icon` (duotone solo en empty states ≥ `text-4xl` y nav), `no-icon-button-without-tooltip` en el dismiss, `hover-requires-cursor-pointer` — + test + build + bundle:check + smoke).
- [ ] **`git diff` de `shared/components/chart/chart-registry.ts` vacío** al cierre de Wave B (decisión D2 verificable por inspección) y cero dependencias nuevas en `package.json`.
- [ ] Initial bundle sin crecimiento atribuible a estas páginas (`bundle:check`: todo `modules/social/**` y `chart.js` solo en chunks lazy).
- [ ] Grep-gates: cero hex/rgb en `utils/*-charts.ts` (solo `getPropertyValue`/`var(--p-*)`); cero `Math.random()`/`Date.now()` en las 3 páginas; cero literal inline u método en `[ngModel]` (solo fields readonly / primitivos).
- [ ] Selector de red y rango sobreviven navegar a otra página social y volver (signal en service root-scoped); cambiarlos NO muestra skeleton (sin re-fetch).
- [ ] Overview: ninguna expresión del template ni computed suma kinds distintos entre redes (revisable: la card "Volumen por red" itera por red con label de métrica propio).
- [ ] Analytics: con red TikTok se ve el breakdown de traffic sources con FYP destacado; con FB, CTR + organic vs paid + reactions donut; con IG, ER por formato — usando exclusivamente los tipos de RFC-002 (incl. los campos FB de D7); verificado sobre la fixture `-seeded` (RFC-001 D7) y en manual QA.
- [ ] Heatmap: SSR entrega el grid renderizado (view-source sin `<canvas>`); cada fila de día expone `aria-label` con la mejor franja; `npm run a11y` sin `serious`/`critical` en las 3 rutas.
- [ ] Insights: dismiss remueve la card al instante y sobrevive navegar away/back en la misma sesión (store en memoria); el CTA de un insight con `actionRoute="/social/analytics"` aterriza con la red del insight ya seleccionada; ambas variantes de vacío ("todo en orden" vs "sin resultados + limpiar filtros") alcanzables.
- [ ] Todo `@defer` de la lista D9 presente con `@placeholder` + `<p-skeleton>` dimensionado + `aria-busy="true"`; los charts no hidratan antes del scroll (HTML SSR sin canvas inicializado).
- [ ] Baselines visuales de `/social/overview`, `/social/analytics`, `/social/insights` — variantes vacía Y `-seeded` (RFC-001 D7) — regeneradas vía workflow manual `Visual baselines` en el PR correspondiente; dos runs consecutivos sin diff (mocks deterministas por seed + epoch).
- [ ] Sin stories nuevas (ningún componente promovido a `shared/`); si durante la implementación algo se promueve, story en el mismo PR.
