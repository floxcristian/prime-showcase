# RFC-005: Competencia, tendencias y hashtags

- **Estado:** Propuesto
- **Fecha:** 2026-08-14
- **Autores:** equipo
- **Relacionados:** RFC-001 (esqueleto, rutas, host classes, defer policy), RFC-002 (dominio, puertos, mocks — fuente de los tipos `Competitor`/`CompetitorBenchmark`/`Trend`/`HashtagSuggestion`/`HashtagPerformance`), RFC-004 (insights + registro de charts + filtros de vista compartidos), RFC-006 (composer del planner, consumidor del recomendador de hashtags)

## Resumen

Diseña las dos páginas de "inteligencia externa" de la suite social:

- **`social-competitors`** (`/social/competitors`): 3 perfiles trackeados por red, tabla comparativa side-by-side (con la cuenta propia como fila fija destacada), chart de follower growth multi-serie, share of voice con `p-metergroup` (cero Chart.js), scatter frecuencia-de-posteo vs engagement **sin registrar controllers nuevos**, panel de benchmarks own-vs-competitor con `position` precomputada, y sentiment como badge estático mock.
- **`social-trends`** (`/social/trends`): página única de discovery con **tres secciones apiladas** (no tabs, no multi-panel — justificado en D6): (a) tendencias por red con momentum + sparkline, sonidos TikTok y menciones recientes de marca; (b) recomendador de hashtags con `debouncedSearch` y chips agrupados alto/medio/nicho con copy-to-clipboard; (c) tabla de performance de hashtags usados.

Decisiones transversales: cargar los datos de las 3 redes en un solo fetch (`forkJoin`) y filtrar client-side con `computed` (switch de red instantáneo, una sola cascada de loading); **cero cambios al `chart-registry`** (coordinado con RFC-004); las dos entidades que este RFC necesitaba (`Competitor.topRecentPost`, `BrandMention` + `getBrandMentions`) ya están incorporadas al contrato congelado de RFC-002; la lógica de agrupación de hashtags vive en un util puro de `modules/social/utils/` para que el composer (RFC-006) la reuse sin acoplarse a esta página.

## Contexto y problema

El pedido cubre tres capacidades (§2.4, §2.5, §2.8 de la investigación de producto) en dos páginas ya fijadas por el mapa del arquitecto. Los referentes marcan el mínimo creíble: Sprout para el side-by-side de competencia (SoV, engagement, sentiment), Later para la segmentación de hashtags por volumen, y un panel de trends estático "trend discovery" — explícitamente NO listening real-time (§3 de producto: los streams en vivo envejecen mal en demo).

Restricciones del repo que condicionan el diseño:

1. **Bundle:** ~15 kB de headroom en el initial; `bundle:check` falla con delta >3 %. RFC-001 D6.3 fija default en contra de controllers nuevos de Chart.js — cada uno cuesta 3-5 kB gz en el chunk lazy y este RFC no puede tocar `chart-registry.ts` sin coordinar con RFC-004.
2. **Determinismo:** las dos rutas ya están en `tests/fixtures/routes.ts` con `waitForData: true` (RFC-001 D7) — todo dato visible sale de factories seeded de RFC-002.
3. **Consistencia:** la cascada canónica `@if loadError → @else if vacío → @else datos` (`obs-uptime`), `trackedResource`, `TRANSPARENT_TABLE_TOKENS`, `debouncedSearch`, host classes de RFC-001 D5 (ambas páginas: página-card).
4. **Tipos congelados en RFC-002**: el "mejor post reciente" del competidor y las menciones de marca, detectados como huecos por este RFC, ya están declarados en RFC-002 D2/D4 (D2 documenta el uso) — nunca tipos paralelos locales.
5. **Reuso hacia RFC-006:** el composer del planner necesita las mismas sugerencias de hashtags — el contrato ya es el puerto (`InsightsPort.getHashtagSuggestions`), pero la presentación (agrupar por volumen) no puede quedar enterrada en el componente de esta página.

## Decisión

### D1. Alcance y archivos

```
src/app/modules/social/
  social-competitors/
    social-competitors.component.{ts,html,scss}       ← .scss vacío
    components/
      competitor-benchmarks/                          ← panel own-vs-competitor (local)
      sentiment-badge/                                ← badge estático de sentiment (local)
    models/
      competitor-row.interface.ts                     ← view-model de fila (D9)
  social-trends/
    social-trends.component.{ts,html,scss}
    components/
      trend-card/                                     ← card de tendencia con momentum + sparkline
      hashtag-recommender/                            ← sección (b) completa, autocontenida
      brand-mentions-list/                            ← lista finita de menciones
    models/
      hashtag-group.interface.ts                      ← view-model de grupos (D7)
  utils/
    hashtag-grouping.ts                               ← util puro compartido con RFC-006 (D7)
    percent-format.ts                                 ← formatters Intl es-CL compartidos (D9)
```

Ningún componente nuevo va a `src/app/shared/` (criterio RFC-001 D8: nada de esto se usa fuera de la suite → sin stories). El sparkline NO se crea acá: `modules/social/components/` ya lo reserva RFC-004 para la evidencia de insights — esta página lo consume (D5.4). `app-network-chip` (shared, Wave A) se usa en tablas y cards.

### D2. Entidades de competencia y menciones (ya incorporadas al contrato de RFC-002)

Los dos huecos que este RFC detectó entre los tipos congelados y el pedido — el "mejor post reciente" del competidor y las menciones de marca — están **incorporados al contrato congelado de RFC-002** a pedido de este RFC (sin coordinación pendiente): `CompetitorTopPost` + `Competitor.topRecentPost` y `BrandMention` en RFC-002 D2, `InsightsPort.getBrandMentions()` en RFC-002 D4. Acá se documenta solo el uso:

- `topRecentPost` alimenta la columna "Mejor post reciente" de la tabla comparativa (D4.1); mock curado, sin permalink real.
- `getBrandMentions()` alimenta la sección "Menciones recientes" de trends (D6) — lista FINITA (10-15), trend discovery, NO listening.

Factories (especificadas en RFC-002 D7 y plan §5): `topRecentPost` se genera dentro de `buildCompetitorsMock` (seed existente `${clientSeed}:comp:${network}`); menciones en `mocks/mentions-mock.ts` → `buildBrandMentionsMock(epoch, clientSeed, accounts)` con seed `${clientSeed}:mentions`, 4-5 por red conectada (máx. 15 total, mix de sentiments garantizado por round-robin — mismo truco que las recommendations de RFC-002 D7). Se implementa en `SocialAnalyticsMockService` (dueño de `InsightsPort`).

### D3. Filtro de red compartido — consumo, no creación

Ambas páginas filtran por red con el **mismo selector** que `social-analytics`. RFC-002 §5 fijó "filtros de vista = signals en service root-scoped, en memoria"; RFC-004 (analytics) es el dueño de ese service. Este RFC consume el contrato mínimo:

```typescript
// services/social-view-filters.service.ts — LO CREA RFC-004, que es el DUEÑO
// del shape congelado (RFC-004 D4: `network` + `rangeDays`). Acá solo el
// contrato consumido — estas páginas usan `network`; `rangeDays` existe
// pero competitors/trends no lo consumen (recortan a 30 fijo).
@Injectable({ providedIn: 'root' })
export class SocialViewFiltersService {
  /** Red activa compartida entre analytics / competitors / trends —
   *  cambiar de página conserva la red seleccionada. */
  readonly network = signal<SocialNetwork>('instagram');
  readonly rangeDays = signal<MetricRangeDays>(30);
}
```

UI del selector: `p-selectbutton` con el patrón exacto de `obs-services.component.html:81-93` (`[ngModel]="filters.network()"` + `(ngModelChange)="filters.network.set($event)"`, `[allowEmpty]="false"`, template de item con icono `fa-brands fa-{instagram,facebook,tiktok}` — logos de marca reales, permitido por DESIGN.md). Guard-rail zoneless: `NETWORK_OPTIONS` es `readonly` field a nivel de clase (identidad estable), nunca literal inline en el template.

Si al momento de implementar RFC-004 aún no mergeó el service, esta página lo crea con el shape exacto de RFC-004 D4 (que es la única fuente — este RFC NO define nombres propios) y RFC-004 lo adopta sin cambios.

### D4. `social-competitors` — estructura de página

Host class **página-card** (RFC-001 D5): `flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6`. Anatomía top-down:

1. **`<app-page-header>`** — `heading="Competencia"`, `description="Comparativa contra los perfiles que trackeás en cada red."`
2. **Toolbar canónica** (`mt-6 lg:mt-10 mb-4 flex items-center gap-2 lg:gap-3 flex-wrap`): `<app-refresh-toolbar [lastFetchedAt] [loading] (refresh)>` + `p-selectbutton` de red (D3).
3. **Cascada de estados** (D8).
4. **Contenido con datos**, en orden:
   - **Tabla comparativa** (D4.1) — el side-by-side es el corazón de la página, arriba.
   - **Grid `grid grid-cols-1 xl:grid-cols-2 gap-6`**: card de follower growth multi-serie (D5.1) + card de share of voice (D5.2); debajo, card del scatter frecuencia vs engagement (D5.3) a ancho completo.
   - **Panel de benchmarks** (D4.2), reactivo a la fila seleccionada de la tabla.

**Datos.** Un solo `trackedResource` por página con `forkJoin` de las 3 redes; el switch de red filtra client-side (instantáneo, cero re-fetch, una sola cascada de skeletons — patrón "fetch amplio + computed" de obs-services):

```typescript
// social-competitors.component.ts (extracto)
private readonly analytics = inject(SocialAnalyticsMockService);
protected readonly filters = inject(SocialViewFiltersService);

protected readonly competitorsRes = trackedResource(() =>
  forkJoin(
    SOCIAL_NETWORKS.map((n) => this.analytics.getCompetitors(n)),
  ).pipe(map((byNetwork) => byNetwork.flat())),
);
protected readonly accountsRes = trackedResource(() => this.analytics.getAccounts());

/** Competidores de la red activa — filtrado client-side. */
protected readonly rows = computed<CompetitorRow[]>(() => {
  const network = this.filters.network();
  const own = this.accountsRes.value()?.find((a) => a.network === network);
  const competitors = (this.competitorsRes.value() ?? []).filter(
    (c) => c.network === network,
  );
  return buildCompetitorRows(own, competitors); // D9 — view-model precalculado
});
```

#### D4.1 Tabla comparativa

`<p-table [value]="rows()" [dt]="TRANSPARENT_TABLE_TOKENS" [scrollable]="true" scrollHeight="flex" [tableStyle]="{ 'min-width': '64rem' }" selectionMode="single" [(selection)]="selectedRow" dataKey="id">`. Sin paginator (máx. 4 filas: propia + 3 competidores). Columnas:

| Columna | Contenido | Fuente |
|---|---|---|
| Perfil | `p-avatar` (imagen o iniciales `!bg-primary-100 !text-primary-950`) + displayName + `@handle` en `text-xs leading-4 text-muted-color` | `Competitor` / `SocialAccount` |
| Followers | número formateado es-CL | `followers` |
| Growth 30d | valor % + icono `fa-arrow-trend-up/down`; el signo NO se colorea (delta puede ser bueno o malo según fila — el color queda para benchmarks donde `position` ya lo resuelve) | derivado de `followersSeries` en el view-model (D9) |
| Posts/semana | número con 1 decimal | `postsPerWeek` |
| ER promedio | % con 1 decimal | `avgEngagementRate` |
| Mejor post reciente | caption recortada (`line-clamp-1`) + `p-tag` del formato + ER en `text-xs` | `topRecentPost` (D2) |
| Sentiment | `<app-sentiment-badge>` (abajo) | `sentiment` |
| SoV | % — barra fina inline (`div` con `bg-primary` a `[style.width.%]` bindeado — valor dinámico, permitido) | `shareOfVoicePct` |

**Fila propia:** la cuenta del cliente es la **primera fila, fija y destacada** — `[ngClass]` `bg-surface-50 dark:bg-surface-900` + `p-tag` "Tu cuenta" `severity="info"`. Es el side-by-side de Sprout: uno se compara contra el set, no mira al set en abstracto. La fila propia no es seleccionable para benchmarks (comparar la cuenta consigo misma no significa nada) — `selectionMode` se maneja con `[pSelectableRow]` solo en filas de competidor.

**`<app-sentiment-badge>`** (local, `social-competitors/components/`): muestra el sentiment **dominante** como `p-tag` (`positive→success`, `neutral→secondary`, `negative→danger`, labels es "Positivo 62 %") con `pTooltip` del breakdown completo ("62 % positivo · 28 % neutro · 10 % negativo"). Honesto con el alcance: un badge estático, no un análisis. JSDoc: "Sentiment mock curado — en producción vendría de un pipeline NLP del backend".

#### D4.2 Benchmarks own-vs-competitor

Debajo de los charts, reactivo a la selección de tabla. Sin selección → hint `text-muted-color leading-6` ("Seleccioná un competidor en la tabla para ver el detalle métrica a métrica."). Con selección, fetch lazy cacheado (el `Map` por par de RFC-002 D5) vía `rxResource` con params — `trackedResource` no parametriza y acá el trigger es la selección:

```typescript
protected readonly selectedRow = signal<CompetitorRow | undefined>(undefined);

private readonly benchmarksResource = rxResource({
  params: () => ({
    accountId: this.ownAccountId(),          // computed sobre accountsRes + red activa
    competitorId: this.selectedRow()?.id,
  }),
  stream: ({ params }) =>
    !params.accountId || !params.competitorId
      ? of([] as readonly CompetitorBenchmark[])
      : this.analytics.getBenchmarks(params.accountId, params.competitorId),
});
protected readonly benchmarks = computed(() => [...(this.benchmarksResource.value() ?? [])]);
protected readonly benchmarksLoading = computed(() => this.benchmarksResource.isLoading());
```

Render: lista de filas (patrón settings-row de DESIGN.md), una por métrica: label de métrica + dos valores formateados (propio / competidor) + `p-tag` de `position` (`ahead→success` "Adelante", `even→secondary` "Parejo", `behind→danger` "Atrás") + `gapPct` en `text-xs text-muted-color`. `position` y `gapPct` vienen precomputados de la factory (RFC-002) — el template solo mapea, jamás calcula. Loading: 5 filas de `p-skeleton height="2.5rem"` con `aria-busy="true"`.

### D5. Charts — cero cambios al `chart-registry`

Compromiso duro coordinado con RFC-004: **este RFC no registra ningún controller/scale/plugin nuevo.** Las cuatro visualizaciones se resuelven con lo ya registrado (`LineController`, `BarController`, `DoughnutController`, `PointElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Filler`) o sin Chart.js:

1. **Follower growth multi-serie** — `<app-chart type="line">` con 4 datasets (propia + 3 competidores), 90 puntos recortados a 30 client-side. Colores SIEMPRE vía `getComputedStyle(...).getPropertyValue()`: cuenta propia `--p-primary-500` (línea más gruesa, `borderWidth: 3`); competidores `--p-primary-300`, `--p-surface-400`, `--p-surface-500` (`borderWidth: 2`, sin `fill`). Legend built-in desactivada, **legend custom HTML** debajo del canvas (swatch `w-3 h-3 rounded-full` con `[style.backgroundColor]` + handle) — regla de AGENTS.md. Tooltip external con el handler clonado/reusado de `overview/utils/chart-tooltip.ts` según lo que RFC-004 deje en `modules/social/utils/`. Re-render en cambio de tema con el `effect()` + `untracked` canónico de `overview.component.ts:95-114`, viviendo DENTRO del bloque `@defer`.
2. **Share of voice** — **`p-metergroup`** (ya usado en overview; consultar el MCP de PrimeNG antes de implementar, como siempre): un meter por perfil con `[style.]`-color desde las mismas CSS vars del punto 1, `labelPosition="end"` y template `#label` custom con `app-network-chip`-menos: avatar + handle + %. Los `shareOfVoicePct` de RFC-002 suman 100 por construcción → el meter llena la barra completa. Cero bytes de Chart.js, mejor a11y (es DOM, no canvas) y consistencia con overview. 
3. **Scatter posting-frequency vs engagement** — `<app-chart type="line">` con dataset `{ showLine: false, pointRadius: 6, pointHoverRadius: 8, parsing: false, data: [{ x: postsPerWeek, y: avgEngagementRate }, …] }` y `options.scales.x = { type: 'linear', title: 'Posts por semana' }`. Un scatter de Chart.js ES un line chart sin línea sobre escala linear — `LineController` + `PointElement` + `LinearScale` ya están registrados, `ScatterController` sería bundle duplicado. Punto propio en `--p-primary-500` radio 8; competidores en `--p-surface-400`. 4 puntos: los labels van como anotación HTML en la legend custom (no data labels plugin — no existe en el registry y no se agrega).
4. **Sparkline de `volumeSeries`** (trend-card, D6) — **SVG inline**, no Chart.js: el componente `app-social-sparkline` que RFC-004 crea en `modules/social/components/` para la evidencia de insights. Se consume con el **contrato ÚNICO que RFC-004 D2 congela**: polyline precomputada en `computed`, `stroke="var(--p-primary-500)"` fijo (sin input de color), a11y = `role="img"` + `ariaLabel` requerido — esta página pasa la frase descriptiva de la tendencia ("Volumen últimos 30 días: en ascenso, +42 %"), NO `aria-hidden`. Esta página lo consume con los 30 puntos de `volumeSeries` normalizados; la decisión conjunta (SVG, no canvas) queda fijada en ambos RFCs.

Los tres bloques con canvas van en `@defer (hydrate on viewport)` con `@placeholder` de `<p-skeleton>` dimensionado (`height="20rem"` los cards de chart) y `aria-busy="true"` (RFC-001 D5). El metergroup NO se difiere (es DOM liviano y above-the-fold en xl).

### D6. `social-trends` — layout por secciones apiladas (decisión: NO tabs, NO multi-panel)

**Decisión: una sola página scrolleable con tres secciones apiladas**, host página-card, cada sección con el patrón "header de card" de DESIGN.md (`flex items-center gap-6 mb-6` + título `text-color font-semibold leading-6`) y separadas por `mt-10` (excepción sancionada de separadores).

Contra las alternativas del repo:

- **Multi-panel (chat/inbox) NO:** ese patrón de DESIGN.md es master-detail con scrolls independientes y paneles con altura completa. Acá no hay relación maestro→detalle entre tendencias, recomendador y performance: son tres bloques de discovery que se consumen secuencialmente. Forzar paneles crearía tres scrolls angostos compitiendo por ancho en xl y colapsaría mal (<xl el patrón esconde paneles — esconder el recomendador, la feature clave, es inaceptable).
- **Tabs NO:** no existe prior art de `p-tabs` en el repo (regla #1: no inventar patrones); el nav in-page con `selectbutton`/botones existe pero se usa para *filtrar la misma vista*, no para ocultar contenido heterogéneo. Además las capturas golden-path verían solo la primera tab y el pitch de la página ("dos capacidades en una vista cohesiva") se pierde.
- **Secciones apiladas SÍ:** es el patrón de overview/dashboard del repo (cards apiladas en un scroll), deep-linkeable por scroll natural, y la captura visual muestra las tres capacidades de una vez.

Estructura top-down:

1. **`<app-page-header heading="Tendencias y hashtags" description="Descubrí qué está creciendo en tu rubro y qué hashtags te rinden.">`** + toolbar canónica con `<app-refresh-toolbar>` y `p-selectbutton` de red (D3 — filtra las secciones (a) y (c); el recomendador toma la red activa como default pero es la misma señal).
2. **Sección (a) — Tendencias.** Grid `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-6` de `<app-trend-card>` (local): título, `p-tag` de `kind` ("Audio", "Formato", "Tema", "Challenge" — labels es-CL), badge de momentum (`rising→success` "En ascenso", `peaking→warn` "En su pico", `declining→secondary` "En baja") con icono `fa-sharp fa-regular fa-arrow-trend-up/arrow-right/arrow-trend-down`, sparkline (D5.4), volumen + `trendDelta` % y `windowDays` ("~2 semanas de vigencia") en `text-xs leading-4`. Con red TikTok activa, los trends `kind === 'audio'` se agrupan primero bajo un subheader "Sonidos en tendencia" — es LA sección esperable de TikTok. Card clickeable NO (no hay detalle) → sin `cursor-pointer`, sin hover (regla hover⇄cursor).
3. **Sección (a2) — Menciones recientes de la marca.** `<app-brand-mentions-list>` (local): lista finita (10-15, D2) con el patrón "item de lista" de DESIGN.md — avatar iniciales, `@authorHandle`, excerpt `line-clamp-1`, `| relativeTime` sobre `mentionedAt`, dot de sentiment como `<i class="fa-sharp fa-solid fa-circle">` con color **precomputado en el VM** (patrón `customers-format.util.ts:154-161` / `obs-uptime.component.ts:482-497` — rojo NO está en la allow-list de `no-hardcoded-colors`): positivo `text-green-500` (excepción sancionada de dot icon), neutro `text-muted-color`, negativo `[style.color]="'var(--p-red-500)'"` (CSS var primitiva del tema, prior art `customers-row-actions.component.html:88`); siempre acompañado del label textual en el tooltip (WCAG 1.4.1, no color-only). Copy del header honesto: "Menciones recientes" + descripción "Últimas menciones detectadas en la sincronización — no es monitoreo en tiempo real." (decisión de producto §2.5/§3: trend discovery, no listening).
4. **Sección (b) — Recomendador de hashtags** (D7).
5. **Sección (c) — Performance de hashtags usados.** `<p-table [dt]="TRANSPARENT_TABLE_TOKENS">` sobre `HashtagPerformance` filtrado por red activa: tag (con `#` antepuesto en render, `text-primary font-medium`), usos, reach promedio, ER promedio, último uso (`| relativeTime`). 8-10 filas, sin paginator, `sortField` default `avgEngagementRate` desc — la pregunta que responde es "¿cuáles me rinden?".

**Datos:** mismo criterio que competitors — `trackedResource` con `forkJoin` de `getTrends` y de `getHashtagPerformance` por las 3 redes + `getBrandMentions()`, filtrado client-side por `computed`. Tres `trackedResource` (trends, mentions, performance) alimentando un `loading`/`loadError` combinado con `computed` para una cascada única de página (D8); el recomendador tiene ciclo de vida propio (D7).

### D7. Recomendador de hashtags — reactivo, reusable por RFC-006

**Componente:** `<app-hashtag-recommender>` en `social-trends/components/` — autocontenido (input + resultados), para que la página quede legible. **La lógica reusable NO vive en el componente:**

- El **fetch** es el puerto: `InsightsPort.getHashtagSuggestions(topic, network)` (RFC-002, determinista por topic normalizado). El composer de RFC-006 llama al mismo método — cero dependencia sobre esta página.
- La **agrupación Later-style** es un util puro compartido en `modules/social/utils/hashtag-grouping.ts`:

```typescript
import type { HashtagSuggestion } from '../models/social.interface';

export type HashtagBucket = 'alto' | 'medio' | 'nicho';

export interface HashtagGroups {
  readonly alto: readonly HashtagSuggestion[];    // difficulty 'high' — volumen masivo, difícil rankear
  readonly medio: readonly HashtagSuggestion[];   // difficulty 'medium'
  readonly nicho: readonly HashtagSuggestion[];   // difficulty 'low' — específicos, mejor conversión
}

/**
 * Segmentación estilo Later: los buckets salen de `difficulty` (ya
 * seeded en factory), ordenados por relevanceScore desc dentro de cada
 * grupo. Puro y sin Angular — lo consume el recomendador de
 * social-trends Y el composer del planner (RFC-006).
 */
export const groupHashtagSuggestions = (
  suggestions: readonly HashtagSuggestion[],
): HashtagGroups => { /* … */ };
```

**Reactividad del input:** `debouncedSearch(300)` (300 ms: acá cada término dispara un "fetch", no un filtro local — un debounce apenas mayor al default evita ráfagas de requests mock) + `rxResource` con `params` (mismo rationale que D4.2 — `trackedResource` no parametriza y el trigger es el término):

```typescript
protected readonly topicSearch = debouncedSearch(300);   // field initializer — injection context

private readonly suggestionsResource = rxResource({
  params: () => ({
    topic: this.topicSearch.term().trim().toLowerCase(),
    network: this.filters.network(),
  }),
  stream: ({ params }) =>
    params.topic.length < 3
      ? of([] as readonly HashtagSuggestion[])
      : this.analytics.getHashtagSuggestions(params.topic, params.network),
});

protected readonly groups = computed(() =>
  groupHashtagSuggestions(this.suggestionsResource.value() ?? []),
);
protected readonly searching = computed(() => this.suggestionsResource.isLoading());
```

**UI:** input con `p-iconfield` + `fa-magnifying-glass` (receta de DESIGN.md), placeholder "Tema, producto o rubro — ej: ferretería". Estados:

- Término `< 3` chars → hint `text-muted-color leading-6` ("Escribí al menos 3 letras para ver sugerencias."). NO `<app-empty-state>` — es guía inline, no estado de página.
- Buscando → fila de 8 `p-skeleton width="6rem" height="2rem" borderRadius="0.5rem"` (forma de chip) con `aria-busy="true"`.
- Cero resultados con término válido → variante "sin resultados" (`ux-patterns.md`): "Sin sugerencias para «{{ term }}». Probá un tema más general."
- Resultados → tres grupos con subheader (`text-color font-semibold leading-6` "Volumen alto" / "Volumen medio" / "Nicho" + contador `text-xs text-muted-color`) y chips `flex flex-wrap gap-2`.

**Chip de hashtag** — `<button type="button">` (regla `no-button-without-type`) estilo nav in-page: `px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors bg-surface-100 dark:bg-surface-800 text-color`; contenido: `#tag` en `font-medium`, volumen abreviado (`12,4 k/día`) en `text-xs text-muted-color`, icono `fa-sharp fa-regular fa-copy` `aria-hidden="true"`. Click = **copy-to-clipboard**:

```typescript
protected async copyTag(s: HashtagSuggestion): Promise<void> {
  try {
    await navigator.clipboard.writeText(`#${s.tag}`);   // handler de click — nunca corre en SSR
    this.messages.add({ severity: 'success', summary: 'Hashtag copiado',
      detail: `#${s.tag} quedó en tu portapapeles.`, life: 3000 });
  } catch {
    this.messages.add({ severity: 'error', summary: 'No se pudo copiar',
      detail: 'Copialo manualmente seleccionando el texto.', life: 5000 });
  }
}
```

`aria-label="Copiar hashtag {{ s.tag }}"` en cada chip. Tags relacionados: al final de cada grupo, línea `text-xs text-muted-color` "Relacionados: #a · #b · #c" (de `relatedTags` del primer resultado del grupo) — informativos, sin interacción (no duplicar N chips clickeables de segundo orden).

`trendDelta` positivo destacado con `fa-arrow-trend-up text-primary` — señal de "aprovechalo ahora" que conecta discovery con acción.

### D8. Estados — cascada canónica y gating de onboarding

Ambas páginas siguen `obs-uptime` estrictamente (`@if / @else if / @else`, nunca predicados espejados):

```html
@if (loadError()) {
  <app-load-error-state title="No se pudieron cargar los datos de competencia" (retry)="retryAll()" />
} @else if (loading()) {
  <div aria-busy="true"><!-- skeletons dimensionados por sección --></div>
} @else if (noAccounts()) {
  <app-empty-state
    icon="fa-users-viewfinder"
    title="Conectá una cuenta para comparar"
    description="La comparativa necesita al menos una cuenta social conectada para tener contra qué medir."
    actionLabel="Conectar cuentas" actionIcon="fa-sharp fa-regular fa-plug"
    (actionClick)="goToConnections()" />
} @else {
  <!-- contenido -->
}
```

- `loading()`/`loadError()` son `computed` combinados de los `trackedResource` de la página (OR de loadings, primer error gana). `retryAll()` reintenta todos los resources con error.
- **Gating (RFC-001 D5):** `noAccounts()` = cero cuentas conectadas en la red — CTA a `/social/connections`. En trends el gating es más laxo: tendencias y recomendador funcionan sin cuenta (son datos de mercado), pero menciones y performance de hashtags requieren cuenta → esas DOS secciones muestran su propio `<app-empty-state size="compact" bordered>` local con CTA a connections, y el resto de la página vive. Racional de producto: el discovery es el gancho de onboarding — mostrarlo vacío entero desperdicia el "aha". **Esta decisión es la canónica y la tabla de copy de RFC-003 D3 la refleja** (trends = única página con gating parcial por sección; las demás usan el empty de página completa).
- `<app-stale-data-banner (retry)>` encima del contenido cuando hay datos previos + error de refresh (mismo criterio obs).
- Icono duotone SOLO dentro de `<app-empty-state>` (el componente ya lo aplica a `text-4xl` — uso sancionado); todo icono inline de estas páginas es `fa-sharp fa-regular` o `fa-brands` (logos de red).

### D9. View-models y formateo (es-CL, en el .ts)

Cero pipes de formateo en templates (salvo `| relativeTime`). Formatters compartidos a nivel módulo en `utils/percent-format.ts` — instancias `Intl` únicas, no por fila (patrón `obs-uptime.component.ts:85-90`):

```typescript
export const SOCIAL_NUMBER_FORMAT = new Intl.NumberFormat('es-CL');                    // 12.480
export const SOCIAL_COMPACT_FORMAT = new Intl.NumberFormat('es-CL', {
  notation: 'compact', maximumFractionDigits: 1,                                        // 12,4 k
});
export const SOCIAL_PERCENT_FORMAT = new Intl.NumberFormat('es-CL', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,                 // 4,2 %
});
```

`CompetitorRow` (`social-competitors/models/competitor-row.interface.ts`) precalcula TODO lo que la tabla muestra — strings formateados, `growth30dPct` derivado de `followersSeries` (último valor vs valor 30 posiciones atrás), flags (`isOwn`), y clases precomputadas donde haya condicional repetido (patrón colores precomputados de `obs-uptime.component.ts:44-49`). El template mapea, no calcula. Ídem `hashtag-group.interface.ts` para chips (volumen ya abreviado).

## Alternativas consideradas

1. **Registrar `ScatterController` (y/o `chartjs-chart-matrix`) en el registry.** NO: RFC-001 D6.3 fija default en contra; el scatter se expresa con `LineController` ya registrado (`showLine: false` + escala linear + `parsing: false`) con resultado visual idéntico y cero bytes nuevos. Si RFC-004 terminara registrando scatter por sus propias razones, esta página podría migrar el `type` — pero no lo necesita.
2. **Sparklines con `<app-chart>` (canvas).** NO: 30 puntos decorativos por card × 6-8 cards = canvases y cost de hidratación gratuitos. SVG inline precomputado es determinista, SSR-safe sin guard, y RFC-004 ya lo necesita para insights — un solo componente compartido del módulo.
3. **Tabs (`p-tabs`) o sub-rutas para las secciones de trends.** NO: sin prior art de tabs en el repo (regla #1); sub-rutas triplican fixtures/baselines (RFC-001 alternativa 2 ya lo descartó para redes); las secciones apiladas muestran ambas capacidades en una captura y mantienen el recomendador siempre visible.
4. **Multi-panel layout para trends.** NO: es master-detail con scrolls independientes (chat/inbox); acá no hay relación maestro-detalle y el colapso <xl escondería secciones enteras (D6).
5. **Re-fetch por cambio de red (un `getCompetitors(network)` por switch).** NO: `forkJoin` de las 3 redes en un fetch + filtro client-side da switch instantáneo, una sola cascada de estados y menos combinaciones para baselines. El costo (traer 3× datos mock) es despreciable; el puerto conserva la firma por-red para el backend real, que sí paginará por red.
6. **Share of voice como doughnut o bar apilado de Chart.js.** NO: `p-metergroup` ya está en el repo (overview), es DOM accesible sin canvas, y expresa exactamente "partes de un 100 %". PrimeNG primero.
7. **`p-autocomplete` para el recomendador.** NO: no es un typeahead de selección — es un input que dispara un panel de resultados agrupados con acciones propias (copy). `p-iconfield` + `debouncedSearch` es el patrón existente de búsqueda del repo; autocomplete forzaría overlay y modelo de selección que no aplican.
8. **Duplicar la lógica de agrupación de hashtags en RFC-006.** NO: util puro compartido en `modules/social/utils/` (D7) — un solo criterio de segmentación para trends y composer.
9. **Menciones como stream "en vivo" (interval que agrega items).** NO: decisión de producto §3 — los streams mock quedan falsos rápido y un interval global es estado module-level (bug SSR que el epoch vino a arreglar). Lista finita determinista.
10. **Crear `BrandMention`/`topRecentPost` como tipos locales de página.** NO: son dominio, no view-model; tipos locales divergentes de `models/` romperían la regla "los componentes dependen de puertos y entidades" de RFC-002 D4. Entidades declaradas en el contrato de RFC-002 (ver D2).

## Consecuencias

**Positivas**

- Cero crecimiento del registry de Chart.js: las cuatro visualizaciones "nuevas" (multi-serie, SoV, scatter, sparkline) cuestan 0 bytes de controllers — todo el costo cae en templates/TS de chunks lazy.
- Switch de red instantáneo y sin re-fetch en ambas páginas; una sola cascada de loading por página → menos estados intermedios para baselines y a11y.
- El recomendador queda desacoplado por construcción: RFC-006 consume puerto + util puro, sin importar nada de `social-trends/`.
- Las entidades de competencia/menciones viven en el contrato congelado de RFC-002 y quedan implementadas por el mismo service/factories existentes — sin nuevos services ni storage.
- Copy honesto en sentiment y menciones ("mock curado", "no es tiempo real") — el demo no promete NLP ni listening que no existe.

**Negativas / deuda aceptada**

- El scatter con 4 puntos es visualmente modesto; su valor es narrativo ("publican más pero enganchan menos"). Si el demo pide más densidad, agregar competidores es solo tocar volúmenes de factory.
- `forkJoin` de 3 redes carga datos de redes que quizá no se miren en la sesión — aceptado (mocks, costo cero real); el backend real paginará por red detrás del mismo puerto.
- La fila propia fija en la tabla mezcla `SocialAccount` y `Competitor` en un view-model común — el mapeo vive en `buildCompetitorRows` y es deuda contenida en un archivo.
- Sin cuenta conectada, trends muestra dos secciones con empty compacto local (gating parcial) — dos "vacíos" simultáneos en pantalla durante onboarding; aceptado porque el discovery visible es el gancho.
- `Competitor.topRecentPost` no linkea a un post real (`permalink` mock) — límite consciente del showcase, documentado en JSDoc.

## Plan de implementación (Wave B — tras cierre de Wave A)

1. **Entidades ya en el contrato (RFC-002 D2/D4, factories en Wave A):** verificar que `CompetitorTopPost`/`topRecentPost`, `BrandMention`, `InsightsPort.getBrandMentions` y `mocks/mentions-mock.ts` llegaron con la capa de Wave A (RFC-002 plan §5); si algo faltó, se agrega en el primer PR de este RFC citando RFC-002 (cambio aditivo). Specs de determinismo (mismo seed → mismas menciones/top posts; mix de sentiments garantizado) si no existen aún.
2. **Utils compartidos:** `utils/hashtag-grouping.ts` + spec (agrupación estable, orden por relevanceScore); `utils/percent-format.ts`. `SocialViewFiltersService` y `app-social-sparkline` tienen shapes CONGELADOS en RFC-004 (D4 y D2): si aún no mergearon, crearlos acá con ESOS shapes exactos — este RFC no negocia nombres.
3. **`social-competitors`:** componente de página (host página-card, header, toolbar, cascada D8), view-model `CompetitorRow` + `buildCompetitorRows`, tabla D4.1 con `<app-sentiment-badge>`, charts D5.1-D5.3 en `@defer (hydrate on viewport)` con placeholders, panel de benchmarks D4.2. Consultar el MCP de PrimeNG antes de `p-metergroup`, `p-selectbutton` y selección de `p-table` (no asumir API de memoria).
4. **`social-trends`:** componente de página + `trend-card`, `brand-mentions-list`, `hashtag-recommender` (D6-D7); toasts de copy (el `MessageService`/`p-toast` global del layout — verificar que exista; si no, `p-toast position="bottom-right"` local a la página).
5. **Reemplazo de shells:** ambas páginas sustituyen el cuerpo del shell de Wave A; rutas, nav, breadcrumbs y fixtures YA existen (RFC-001) — no se tocan.
6. **Gates:** `npm run verify` local; agregar las fixtures `social-competitors-seeded`/`social-trends-seeded` (RFC-001 D7); disparar workflow `Visual baselines` para `/social/competitors` y `/social/trends` — variantes vacía y seeded — (nunca local) y commitear en el mismo PR; `npm run a11y` sobre ambas rutas.

Slicing sugerido: 2 PRs (paso 1-3 = competitors; paso 4-6 = trends), o 1 PR por página con el paso 1 en el primero que lo necesite.

## Criterios de aceptación (verificables)

- [ ] `npm run verify` pasa completo en cada PR (lint 19 reglas, test, build ≤ budgets, `bundle:check` ≤3 % o baseline actualizada con justificación, smoke).
- [ ] **`shared/components/chart/chart-registry.ts` sin diff** en los PRs de este RFC (verificable por `git diff` — el compromiso D5 es auditable).
- [ ] Cero imports de `modules/social/**` o `chart.js` alcanzables desde el initial chunk (output de `bundle:check`).
- [ ] Todos los `<app-chart>` de ambas páginas dentro de `@defer (hydrate on viewport)` con `@placeholder` + `<p-skeleton>` dimensionado + `aria-busy="true"`; sin `<canvas>` inicializado en el HTML SSR antes del scroll.
- [ ] Dos corridas del suite visual sin diff (determinismo: series, menciones, sugerencias y sentiment estables por seed), en AMBAS variantes de fixture (RFC-001 D7): con storage limpio, competitors = empty con CTA a `/social/connections` y trends = secciones de mercado pobladas + empties compactos en menciones/performance; con la fixture `-seeded`, ambas páginas pobladas (tabla, charts, menciones).
- [ ] `npm run a11y` sin violaciones `serious`/`critical` en `/social/competitors` y `/social/trends` (variantes vacía y seeded): chips de copy con `aria-label`, sparklines con `role="img"` + `aria-label` descriptivo (contrato único de RFC-004 D2), iconos decorativos con `aria-hidden`, contraste de badges verificado.
- [ ] Cambio de red vía `p-selectbutton` NO dispara re-fetch (sin skeletons al switchear — verificable en manual QA y por ausencia de nueva suscripción en los resources) y la selección persiste al navegar entre analytics/competitors/trends.
- [ ] `groupHashtagSuggestions` tiene spec vitest y NINGÚN import desde `social-trends/` hacia el composer ni viceversa; RFC-006 puede consumir puerto + util sin tocar esta página (verificable por grafo de imports).
- [ ] El recomendador: mismo término normalizado → mismas chips (determinismo por seed de RFC-002); término `< 3` chars no llama al puerto; copy muestra toast success con el patrón de `ux-patterns.md`.
- [ ] Benchmarks: `position`/`gapPct` se leen de la entidad (grep: sin cálculo de posición en templates/componentes); re-seleccionar el mismo competidor sirve desde cache (sin segunda latencia — cache de instancia de RFC-002).
- [ ] Zoneless: `NETWORK_OPTIONS` y todo objeto bindeado a `[ngModel]` es field `readonly` o `computed` memoizado (revisable por grep de `[ngModel]="` en los templates de ambas páginas).
- [ ] Sin stories nuevas requeridas (ningún componente promovido a `shared/`); si durante la implementación algo se promueve, story en el mismo PR.
