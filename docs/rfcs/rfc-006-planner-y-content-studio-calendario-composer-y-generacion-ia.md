# RFC-006 — Planner y Content Studio: calendario, composer y generación IA

- **Estado:** Propuesto
- **Fecha:** 2026-08-14
- **Autores:** equipo
- **Relacionados:** RFC-001 (esqueleto/rutas/host class/defer policy — acá solo se aplican), RFC-002 (contratos congelados: `ScheduledPost`, `GenerationJob`, `GenerationRequest`, `PublishingPort`, `GenerationPort`, D9 progreso simulado, D10 `publishNow` con fallo determinista), RFC-003 (gating de onboarding y `SocialSettingsService` — se consumen, no se rediseñan), RFC-004 (heatmap best-time y cómputo de mejor franja — se consume su lógica, ver D4), RFC-005 (tendencias/hashtags — este RFC solo consume `InsightsPort.getHashtagSuggestions`)

## Resumen

Diseña las dos páginas de Wave C. **`social-planner`**: calendario mensual como **grid custom Tailwind + tokens** (decisión tomada tras consultar el MCP de PrimeNG — `p-datepicker` existe con modo `inline` y `dateTemplate`, pero es un input de *selección* de fecha, no un contenedor de contenido por día; el detalle en D2) más vista lista, chips de red (`app-network-chip`) y de estado (`p-tag` con el mapping congelado en RFC-002: `draft→secondary`, `scheduled→info`, `published→success`, `failed→danger`), días con franja best-time marcados (datos de `AudienceSnapshot` vía `topSlots` de `modules/social/utils/best-time.ts`, util que RFC-004 crea en Wave B y al que este RFC solo AGREGA `nextBestSlot`), y un **composer en `p-drawer` lateral** (no dialog — D5): multi-cuenta solo-conectadas, caption con contador por red, hashtag chips alimentados por `getHashtagSuggestions`, preview por red, media desde `demoAsset()`, y las tres salidas `guardar draft / programar / publicar ahora` contra `SocialPublishingMockService`, con `failed` accionable cuya CTA se deriva del estado real de settings (nunca parseando `failureReason`). **`social-studio`**: un único formulario adaptativo por `kind` (caption/imagen/video) cuyas opciones se auto-configuran leyendo `capabilities` del provider seleccionado; selector de provider poblado desde `SocialSettingsService` con opciones deshabilitadas + tooltip cuando el provider no está listo y empty state con CTA a `/social/providers` cuando no hay ninguno (el momento demo del pitch); jobs con progreso vía `watchJob`, historial en `@defer`, y "Usar en planner" que persiste un draft con `sourceJobId` y navega a `/social/planner?draft=<id>`. Cierra además el riesgo crítico zoneless: **receta única de binding `[ngModel]` sobre signals** para arrays de cuentas, fechas y opciones (D9). Cero Chart.js en ambas páginas, cero dependencias nuevas, cero tipos nuevos de dominio.

## Contexto y problema

Wave C es la última: consume todo lo que A y B dejaron listo. Lo que ya está decidido y NO se rediscute:

- **RFC-001 D5:** `social-planner` = contenedor de página `flex-1 h-full overflow-y-auto pb-0.5` con cards internas de padding responsivo `p-4 lg:py-5 lg:px-7`; `social-studio` = página-card `border border-surface rounded-2xl p-6`. `@defer (hydrate on viewport)` obligatorio en el grid mensual (35-42 celdas con chips) y en el historial de jobs con thumbnails. Sin detail views `:id`: composer y detalle de job se resuelven in-page con overlay.
- **RFC-002:** entidades y puertos congelados. `savePost` es upsert de `draft|scheduled`; `publishNow` falla determinista (seguro si la cuenta destino está `expired`/`error`, re-seed por intento si no); `watchJob` emite `queued → running(pct…) → succeeded|failed` con ticks de 450 ms y actualiza también el signal del historial; `createJob` valida provider habilitado + key `valid` como última línea. Los posts `scheduled` vencidos **no** se auto-publican.
- **RFC-003:** gating con copy es-CL fijo — planner sin cuentas: "Todavía no hay dónde publicar"; studio sin provider de generación listo: "Configurá un proveedor de IA" → `/social/providers`. Computeds sincrónicos `hasConnectedAccounts` / `hasReadyProvider(kind)` en `SocialSettingsService`.
- **RFC-004:** el best-time día×hora se deriva de `activeDays × activeHours` de `AudienceSnapshot`, con top-3 franjas resumidas ("Tu mejor franja: martes y jueves 18:00–20:00").
- **Riesgo A (fit §6):** zoneless + `[ngModel]` con identidad inestable = loop de CD que en prod no pinta la página. Este RFC concentra la mayor superficie de forms de la suite (composer + studio) → la receta de binding es una decisión de primera clase, no una nota al pie.

Lo que este RFC cierra: cómo se dibuja el calendario y con qué componente, drawer vs dialog, la anatomía exacta del composer y del formulario del studio, cómo se conectan los flujos cross-página (hashtags → composer, studio → planner, failed → connections), y las decisiones de a11y (aria-live) y defer.

## Decisión

### D1. Estructura de archivos

```
src/app/modules/social/
  utils/
    best-time.ts                    ← YA EXISTE (RFC-004 D1, Wave B: topSlots());
                                      este RFC solo le AGREGA nextBestSlot() (D4)
  social-planner/
    social-planner.component.{ts,html,scss}         ← .scss vacío
    constants/
      scheduled-post-status.tokens.ts  ← SCHEDULED_POST_STATUS_TAG (D3)
      composer-media-catalog.ts        ← COMPOSER_MEDIA: demoAsset() curados (D6)
      caption-limits.ts                ← CAPTION_LIMITS por red (D6)
    utils/
      calendar-grid.ts                 ← buildMonthCells() pura + CalendarCell VM (D2)
    components/
      planner-month-grid/              ← grid custom mes (D2)
      planner-list/                    ← vista lista agrupada por día (D2)
      post-composer/                   ← drawer con el form completo (D5, D6)
      composer-preview/                ← preview por red dentro del composer (D6)
  social-studio/
    social-studio.component.{ts,html,scss}
    constants/
      generation-options.ts            ← tonos/largos/idiomas + GENERATION_STATUS_TAG (D7)
    components/
      studio-request-form/             ← form adaptativo por kind (D7)
      studio-job-card/                 ← card de job con progreso/resultados (D8)
```

Todos: OnPush, standalone, selector `app-social-*`, imports agrupados `NG_MODULES`/`PRIME_MODULES`/`LOCAL_COMPONENTS`, `inject()`, `.scss` vacíos. Ninguno se promueve a `shared/` → **cero stories nuevas** (RFC-001 D8; `app-network-chip` llega hecho de Wave A). Cero imports de `chart.js`/`chart-registry` en ambas páginas.

### D2. Calendario: grid custom Tailwind + tokens (MCP consultado)

**Consulta MCP realizada** (`get_component('DatePicker')`, PrimeNG 21): `p-datepicker` existe, con 77 props, modo `[inline]="true"` y slot `dateTemplate` para customizar la celda. Se descarta como calendario de contenido por tres razones verificadas:

1. Es un **form control de selección de fecha**: su modelo es `Date | Date[]`, su interacción es "elegir un día", y toda su a11y (roles `grid`/`gridcell`, navegación por flechas) está construida alrededor de seleccionar. Un calendario de contenido necesita celdas que contengan N chips clickeables con overflow "+3 más" — anidar botones interactivos dentro de `gridcell`s seleccionables rompe el contrato ARIA del componente.
2. Las celdas del datepicker tienen alto fijo de tema (tokens `--p-datepicker-date-*`): forzar celdas de ~7 rem con chips exigiría override masivo vía `[dt]`/`::ng-deep` — ambos anti-patrones del repo.
3. El precedente ya existe: RFC-004 resolvió el heatmap como grid CSS por los mismos motivos (cero deps, SSR renderiza contenido real, dark mode gratis por tokens).

**Decisión: `planner-month-grid` es un grid custom.** `p-datepicker` **sí** se usa donde es lo correcto: el campo *Programar para* del composer (D6), como input con `showTime` — su rol nativo. No se agrega ninguna librería de calendario (FullCalendar, angular-calendar): prohibido por AGENTS ("no dependencias nuevas sin justificación") y letal para el budget.

**Anatomía del grid** (`utils/calendar-grid.ts` + `planner-month-grid`):

```typescript
// utils/calendar-grid.ts — pura, testeable, sin Angular
export interface CalendarCell {
  readonly iso: string;              // 'YYYY-MM-DD' — key de agrupación y track
  readonly dayOfMonth: number;
  readonly inCurrentMonth: boolean;  // celdas de relleno → text-muted-color + bg-surface-50
  readonly isToday: boolean;
  readonly isBestTimeDay: boolean;   // weekday ∈ top franjas (D4)
  readonly posts: readonly ScheduledPost[];  // ordenados por scheduledFor/updatedAt
}

/** 35 o 42 celdas, semana lunes-primero (es-CL). Determinista: solo depende
 *  de (year, month, todayIso, posts, bestTimeWeekdays) — sin new Date() interno. */
export function buildMonthCells(
  year: number, month: number, todayIso: string,
  posts: readonly ScheduledPost[], bestTimeWeekdays: ReadonlySet<number>,
): readonly CalendarCell[] { /* … */ }
```

Template del grid: card `border border-surface rounded-2xl p-4 lg:py-5 lg:px-7` conteniendo un `grid grid-cols-7 gap-1`; fila de cabecera con iniciales de día (`text-xs font-medium text-muted-color`); celdas `min-h-28 rounded-lg p-1 flex flex-col gap-1 border border-surface-200 dark:border-surface-800` (borde sutil interno, no `border-surface` — jerarquía DESIGN.md); **hoy se marca con el número del día en `bg-primary text-primary-contrast rounded-full w-6 h-6 flex items-center justify-center`** (mismo vocabulario que el datepicker Aura, sin inventar fondos de celda). Cada celda muestra hasta 3 chips de post + botón "+N más" que abre el composer en modo lista del día. Celda `isBestTimeDay`: icono `fa-sharp fa-regular fa-bolt text-primary` esquinado con `pTooltip` "Franja sugerida: {resumen de D4}" y `aria-hidden` en el icono (el tooltip vive en un botón con `aria-label`).

**Chip de post en celda** (list item clickeable, sin `pButton` — DESIGN.md receta 3): `flex items-center gap-1 px-1.5 py-0.5 rounded-lg cursor-pointer hover:bg-emphasis transition-colors text-xs font-medium` con dot de estado (color del token de D3), icono de red y hora `Intl`. Click → abre el composer en modo edición.

**Vistas:** `viewMode = signal<'month' | 'list'>('month')` con `p-selectbutton` en la toolbar (junto a `<app-refresh-toolbar>` y el navegador de mes ‹ hoy ›, botones icon-only con `ariaLabel` + `pTooltip`). `planner-list`: agrupación por día (`@for` sobre días con posts, header sticky `sticky top-0 z-10 bg-surface-0 dark:bg-surface-950`), cada post como list item con chips de red/estado, caption `line-clamp-1` y menú `···` (`p-menu` popup: Editar / Publicar ahora / Eliminar con `p-confirmdialog`). La vista semana se descarta (Alternativas §3). En mobile (`< xl`) el grid mensual colapsa los chips a dots contados; la lista es la vista recomendada (default en `< lg` no — el default es `month` siempre; los dots bastan).

El grid completo va en `@defer (hydrate on viewport)` con `@placeholder` `<p-skeleton width="100%" height="34rem" />` y `aria-busy="true"` (mandato RFC-001 D5).

### D3. Tokens de estado — `scheduled-post-status.tokens.ts`

Patrón `.tokens.ts` sibling del repo (`status-chip.tokens.ts`), mapping congelado por RFC-002:

```typescript
import { ScheduledPostStatus } from '../../models/social.interface';

export const SCHEDULED_POST_STATUS_TAG: Record<
  ScheduledPostStatus,
  { readonly severity: 'secondary' | 'info' | 'success' | 'danger'; readonly label: string; readonly icon: string }
> = {
  draft:     { severity: 'secondary', label: 'Borrador',   icon: 'fa-sharp fa-regular fa-pen' },
  scheduled: { severity: 'info',      label: 'Programado',  icon: 'fa-sharp fa-regular fa-clock' },
  published: { severity: 'success',   label: 'Publicado',   icon: 'fa-sharp fa-regular fa-circle-check' },
  failed:    { severity: 'danger',    label: 'Falló',       icon: 'fa-sharp fa-regular fa-triangle-exclamation' },
};
```

Se consume con `<p-tag [severity]="…" [value]="…" />` en lista y composer; en celdas de calendario el chip usa un dot de color en vez de `p-tag` (muy grande para la celda). Los colores del dot se precomputan en el VM de la celda, nunca se resuelven en template (patrón obs-uptime de colores precomputados), con DOS mecanismos según la allow-list de `showcase/no-hardcoded-colors`: `dotClass` para los estados expresables con tokens (`bg-surface-400 dark:bg-surface-500` draft, `bg-primary` scheduled) y `dotColor` vía `[style.backgroundColor]` con CSS vars primitivas del tema para verde/rojo, que como `bg-*` NO están en la allow-list: `var(--p-green-500)` (published) y `var(--p-red-500)` (failed) — prior art exacto en `obs-uptime.component.ts:482-497` ("verde/rojo no están en la whitelist → CSS vars") y `customers-format.util.ts:154-161`. El dot va siempre acompañado del label/tooltip textual (WCAG 1.4.1, no color-only — D10).

### D4. Best-time: consumo de RFC-004 vía `utils/best-time.ts`

RFC-004 D1/D6.8 crea `modules/social/utils/best-time.ts` con `topSlots()` **desde el primer PR del heatmap** (Wave B), precisamente porque el planner necesita la MISMA lógica (marcar días y sugerir horario) sin importar un componente de otra página — no hay refactor cross-wave ni "enmienda a coordinar": este RFC CONSUME `topSlots` y solo AGREGA `nextBestSlot` al mismo archivo (extensión aditiva en PR-C1, con su spec):

```typescript
/** Franja = (weekday 0-6 lunes-primero, hora 0-23) con score activeDays[d]×activeHours[h] normalizado. */
export interface BestTimeSlot { readonly weekday: number; readonly hour: number; readonly score: number; }

/** YA EXISTE — RFC-004 D1 (el heatmap lo consume desde Wave B). */
export function topSlots(audience: AudienceSnapshot, count: number): readonly BestTimeSlot[];

/** SE AGREGA en PR-C1: próxima ocurrencia futura (desde `fromIso`) de la mejor franja — "Usar mejor horario" (D6). */
export function nextBestSlot(audience: AudienceSnapshot, fromIso: string): Date;
```

El planner obtiene `AudienceSnapshot` de la **primera cuenta seleccionada en el composer** (o la primera conectada para el marcado del grid) vía `SocialAnalyticsPort.getAudience(accountId)` — read-only, cache por instancia ya resuelto en RFC-002. `bestTimeWeekdays` para `buildMonthCells` = weekdays de `topSlots(aud, 3)`.

### D5. Composer: `p-drawer` lateral, no `p-dialog`

**Decisión: `<p-drawer position="right">`** con `styleClass="!w-full xl:!w-128"` (ancho fijo 32 rem en desktop, full-screen en mobile — `w-128` es escala válida de Tailwind 4, no arbitrario).

Rationale contra `p-dialog`:

1. **El calendario es el contexto de la acción.** Programar es elegir *cuándo*: con drawer el usuario ve el mes detrás mientras completa el form (patrón Later/Metricool); un dialog modal centrado lo tapa.
2. **El form es largo** (cuentas, caption, hashtags con sugerencias, media, preview por red, fecha): en drawer scrollea natural a altura completa; en dialog obliga a `maximizable` o scroll interno torpe.
3. **Prior art directo:** `customers-filter-sheet` ya estableció `p-drawer` como raíz de overlay-form del repo (sin host class, mismo esqueleto de imports). Se replica su contrato: `visible` como `model<boolean>()` two-way con el container.

El drawer maneja focus trap y `Esc` nativamente (verificado vía MCP en Wave A para filter-sheet). El contenido del drawer vive tras `@if (visible())` implícito del propio `p-drawer` — no necesita `@defer` (la página ya es lazy y el drawer no renderiza cerrado).

**Modos:** `composerMode = signal<'create' | 'edit'>` + `editingPostId = signal<string | null>`. Crear desde: botón primario de la toolbar (`<p-button label="Nueva publicación" icon="fa-sharp fa-regular fa-plus" />`), click en celda vacía (pre-llena `scheduledFor` a la fecha + hora de `nextBestSlot`), o query param `?draft=<id>` (D8: llegada desde studio — se lee UNA vez en `ngOnInit` vía `ActivatedRoute.snapshot.queryParamMap`, se abre en modo edit y se limpia con `router.navigate([], { queryParams: {} , replaceUrl: true })`).

### D6. Anatomía del composer (`post-composer`)

Form card interna sin borde (el drawer es la superficie): `flex flex-col gap-6 p-6`. Labels de input con `font-semibold leading-6` (enforced). Campos, en orden:

1. **Cuentas destino** — `<p-multiselect>` con `options` = **solo cuentas `connected` o `expired`** (gating RFC-003; `expired` aparece deshabilitada por item con hint "Reconectá para publicar" — `optionDisabled` sobre un VM precomputado). Item template: `app-network-chip` + @handle. Binding con la receta D9.
2. **Caption** — `<textarea pTextarea rows="5">` + contador `{{ captionLength() }}/{{ activeLimit() }}` donde `activeLimit` = mínimo de `CAPTION_LIMITS[network]` de las redes seleccionadas (`instagram: 2200, tiktok: 2200, facebook: 5000` — constante local; 5000 es el techo práctico demo, documentado). Contador en `text-xs text-muted-color`; al exceder gana `font-semibold` + `role="alert"` y color de error vía `[style.color]="captionExceeded() ? 'var(--p-red-500)' : null"` (rojo no está en la allow-list de `no-hardcoded-colors` como clase — prior art `customers-row-actions.component.html:88`), y bloquea submit.
3. **Hashtags** — misma mecánica que el recomendador de trends (RFC-005 D7): `debouncedSearch(300)` + `rxResource({ params, stream })` + el util puro `groupHashtagSuggestions` de `modules/social/utils/hashtag-grouping.ts` — que RFC-005 creó EXPLÍCITAMENTE para que este composer no reimplemente la segmentación (un solo criterio de agrupación y un solo debounce para la misma feature):

```typescript
import { groupHashtagSuggestions } from '../../utils/hashtag-grouping';

private readonly insights = inject(SocialAnalyticsMockService);   // implements InsightsPort
protected readonly topicSearch = debouncedSearch(300);            // paridad RFC-005 D7

/** Red "primaria" = red de la primera cuenta seleccionada (computed estable). */
private readonly suggestionsResource = rxResource({
  params: () => ({
    topic: this.topicSearch.term().trim().toLowerCase(),
    network: this.primaryNetwork(),
  }),
  stream: ({ params }) =>
    params.topic.length < 3
      ? of([] as readonly HashtagSuggestion[])
      : this.insights.getHashtagSuggestions(params.topic, params.network),
});

protected readonly groups = computed(() =>
  groupHashtagSuggestions(this.suggestionsResource.value() ?? []),
);
```

Chips agrupados por los buckets del util con los MISMOS headers de RFC-005 D7 ("Volumen alto / Volumen medio / Nicho" — segmentación Later, §2.8 de producto); click agrega a `hashtags` (signal `update` inmutable); los ya agregados se renderizan arriba como chips removibles (`hover:bg-emphasis cursor-pointer transition-colors`). Mientras `getHashtagSuggestions` está en vuelo: 3 `<p-skeleton width="5rem" height="1.75rem" borderRadius="0.5rem" />`.

4. **Media** — grid 4×N de thumbnails de `COMPOSER_MEDIA` (constante de `demoAsset()` curados, ~12 assets; **no** `p-fileupload`: no hay backend que reciba nada y el catálogo curado mantiene los previews deterministas). Selección multi con ring `border-2 border-primary` en seleccionadas, `aspect-square rounded-lg overflow-hidden`, `hover:opacity-70 transition-opacity`.
5. **Programar para** — `<p-datepicker [showTime]="true" hourFormat="24" [minDate]="minDate" appendTo="body" />` (rol nativo del componente; locale es ya global). Al lado, botón `outlined` "Usar mejor horario" con icono `fa-bolt` → `scheduledFor.set(nextBestSlot(audience, todayIso))` y hint `text-xs text-muted-color` con el resumen de franja.
6. **Preview por red** (`composer-preview`) — un tab por red seleccionada (`p-selectbutton` de redes); card `border border-surface rounded-lg p-3` simulando el post: avatar + @handle, caption con `line-clamp-4` truncada al límite de esa red, hashtags `text-primary`, thumbnail `aspect-square`. Puro, sin llamadas — recibe el draft por inputs.
7. **Acciones** (fila final, `flex items-center gap-2`): **tres `p-button`** — `Guardar borrador` (outlined, `flex-1`), `Publicar ahora` (outlined `severity="secondary"`) y `Programar` (primario, `flex-1`, disabled sin `scheduledFor` o sin cuentas). Sin `p-splitbutton`: tres botones visibles cuentan mejor las tres salidas en la demo y evitan API nueva.

**Flujos de salida** (todas con `[loading]="saving()"` en el botón y toasts según `ux-patterns.md`):

```typescript
protected schedule(): void {
  this.saving.set(true);
  this.publishing.savePost(this.buildPost('scheduled')).subscribe({
    next: (saved) => {
      this.saving.set(false);
      this.visible.set(false);
      this.announce(`Publicación programada para ${this.formatDateTime(saved.scheduledFor!)}`);
      this.messages.add({ severity: 'success', summary: 'Publicación programada',
        detail: `Se programó para ${this.formatDateTime(saved.scheduledFor!)}.`, life: 3000 });
    },
    error: () => { /* saving false + toast error accionable */ },
  });
}
```

`buildPost(status)` arma el `ScheduledPost` inmutable desde los signals del form (id nuevo o `editingPostId`). `publishNow` encadena `savePost` → `publishNow(id)`; si el resultado vuelve `failed`, el drawer NO se cierra: muestra el bloque inline de error (receta ux-patterns) con `failureReason` y las acciones de D6.1.

**D6.1 `failed` accionable.** La CTA se deriva del **estado real de settings, nunca parseando el string** `failureReason`:

```typescript
/** Cuenta destino que impide publicar (expired/error) — o null si el fallo fue transitorio. */
protected readonly blockingAccount = computed(() => {
  const ids = new Set(this.editingPost()?.accountIds ?? []);
  return this.settings.accounts().find(
    (a) => ids.has(a.id) && (a.status === 'expired' || a.status === 'error'),
  ) ?? null;
});
```

- `blockingAccount() !== null` → botón primario **"Reconectar cuenta"** → `router.navigate(['/social/connections'])` (el retry pasará después de reconectar — determinismo D10 de RFC-002).
- Si no → botón **"Reintentar"** → `publishNow(id)` de nuevo (el re-seed por intento de RFC-002 hace que el segundo intento casi siempre pase — flujo demo error → retry → ok).

El mismo par de acciones aparece en el chip/fila de un post `failed` en calendario y lista (menú `···`).

### D7. Studio: formulario adaptativo por capabilities

Página-card. Layout `flex flex-col xl:flex-row gap-6`: form a la izquierda (`xl:w-5/12`), resultado del job activo a la derecha (`flex-1`); historial debajo a lo ancho.

**Selector de kind:** `p-selectbutton` con `Caption | Imagen | Video` (`kind = signal<GenerationKind>('caption')`).

**Selector de provider** — el momento demo del pitch:

```typescript
interface ProviderOption {
  readonly id: ProviderId;
  readonly name: string;
  readonly icon: string;
  readonly disabled: boolean;        // !enabled || key activa !== 'valid'
  readonly disabledReason: string;   // 'Sin API key válida — configurala en Proveedores IA'
}

/** Options del p-select por kind, derivadas de catálogo + estado del cliente.
 *  computed → identidad estable entre pasadas de CD (regla D9). */
protected readonly providerOptions = computed<readonly ProviderOption[]>(() => {
  const kindMap: Record<GenerationKind, ProviderKind> = {
    caption: 'text-gen', image: 'image-gen', video: 'video-gen',
  };
  return PROVIDER_CATALOG
    .filter((p) => p.kind === kindMap[this.kind()])
    .map((p) => this.toOption(p, this.settings.state()));
});

protected readonly hasAnyReady = computed(() => this.providerOptions().some((o) => !o.disabled));
```

`<p-select optionLabel="name" optionValue="id" optionDisabled="disabled">` con item template que muestra icono + nombre y, si `disabled`, hint `text-xs text-muted-color`; el item deshabilitado lleva `pTooltip` con `disabledReason`. Si `!settings.hasReadyProvider(kindMap[kind()])` para **todos** los kinds → gating de página completo (empty state RFC-003, CTA "Configurar proveedores"). Si solo el kind activo no tiene provider listo → empty state **de sección** con el mismo copy y CTA (la página sigue navegable entre kinds).

**Opciones por kind** (todas leídas de `capabilities` del provider seleccionado — cero `if (providerId === 'veo')`):

| Kind | Controles | Fuente |
|---|---|---|
| `caption` | Tono (`p-selectbutton`: Profesional/Cercano/Vendedor), Largo (`p-selectbutton`: Corto 80 / Medio 150 / Largo 280), Idioma (ES/EN) | `CaptionTone` de RFC-002; constantes en `generation-options.ts` |
| `image` | Aspect ratio (`p-selectbutton` sobre `capabilities.aspectRatios`), resolución mostrada como hint (`capabilities.maxResolution`) | `computed` sobre el descriptor |
| `video` | Aspect ratio ídem; Duración: `<p-inputnumber [min]="5" [max]="maxSeconds()" suffix=" s" />` con hint "Máx. {maxSeconds}s en {provider}" | `capabilities.maxVideoSeconds` — el clamp duro lo hace la factory (RFC-002 D9) |

Prompt: `<textarea pTextarea rows="4">` con placeholder por kind. Botón **Generar** primario, `[loading]="creating()"`, disabled sin prompt/provider.

**Ciclo del job activo:**

```typescript
protected generate(): void {
  this.creating.set(true);
  this.generation.createJob(this.buildRequest()).pipe(
    switchMap((job) => this.generation.watchJob(job.id)),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe({
    next: (job) => {
      this.creating.set(false);
      this.activeJob.set(job);
      if (job.status === 'succeeded') this.announce(`Generación de ${KIND_LABELS[job.kind]} completada`);
      if (job.status === 'failed') this.announce(`La generación falló: ${job.failureReason}`);
    },
    error: (err) => { /* provider no listo (última línea RFC-002 D9): toast error + CTA a /social/providers */ },
  });
}
```

Panel derecho por estado de `activeJob()`: `queued/running` → `<p-progressbar [value]="activeJob()!.progressPct ?? 0" />` + skeletons con la forma del resultado (3 líneas para caption; grid 2×2 `aspect-square` para imagen; 16:9 para video — zero CLS); `succeeded` → caption: 3 cards de variante, cada una con botones `Copiar` (Clipboard API tras guard `isBrowser`) y `Usar en planner`; imagen: 4 thumbnails `demoAsset()` con selección; video: thumbnail + duración + `Usar en planner`; `failed` → bloque inline de error con `failureReason` y **Reintentar** (= `createJob` de nuevo con el mismo request: id nuevo → outcome re-sorteado, coherente con D9 de RFC-002). `costEstimateUsd` como metadata `text-xs text-muted-color` — refuerza el pitch "las keys son tuyas, el costo es tuyo".

### D8. Historial de jobs y "Usar en planner"

**Historial:** grid `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-6` de `studio-job-card`, alimentado por el signal de `SocialGenerationMockService` (las emisiones de `watchJob` ya lo actualizan — RFC-002 D9: el historial refleja progreso sin re-suscripción). Card: icono de kind, provider, prompt `line-clamp-2`, `p-tag` con `GENERATION_STATUS_TAG` (`queued→secondary, running→info, succeeded→success, failed→danger` — congelado RFC-002), progreso si `running`, thumbnails si `succeeded`, `| relativeTime` en `createdAt`. Todo el bloque en `@defer (hydrate on viewport)` con placeholder de 3 skeletons de card (mandato RFC-001 D5). Vacío (cliente sin jobs) → `<app-empty-state size="compact" bordered>` "Todavía no generaste contenido".

**"Usar en planner"** (en variante/resultado y en cards `succeeded` del historial):

```typescript
protected useInPlanner(job: GenerationJob, variantIndex?: number): void {
  const draft: ScheduledPost = {
    id: `post-${job.id}`,                         // determinista, idempotente
    accountIds: [], format: job.kind === 'video' ? 'video' : job.kind === 'image' ? 'image' : 'text',
    caption: variantIndex !== undefined ? job.resultVariants![variantIndex] : '',
    hashtags: [], mediaUrls: job.resultUrls ?? [],
    status: 'draft', createdAt: this.nowIso(), updatedAt: this.nowIso(),
    sourceJobId: job.id,
  };
  this.publishing.savePost(draft).subscribe((saved) => {
    void this.router.navigate(['/social/planner'], { queryParams: { draft: saved.id } });
  });
}
```

El planner (D5) abre el composer en modo edición sobre ese draft — el usuario completa cuentas/fecha y programa. `sourceJobId` se muestra en el composer como chip informativo "Generado con {provider}" (trazabilidad studio → planner, contrato RFC-002).

### D9. Receta zoneless de `[ngModel]` — obligatoria en ambas páginas

Regla única, verificable en review, que resuelve el riesgo A (documentado en `customers.component.ts:816-826`): **todo `[ngModel]` de valor no primitivo se bindea a la lectura de un `signal`/`computed` — nunca a un literal, un método, ni una expresión que aloque**. El signal memoiza → misma referencia entre pasadas de CD → `Object.is` pasa → sin write-back loop.

```typescript
// ✅ Correcto — el patrón de TODO el composer y el studio
protected readonly selectedAccountIds = signal<readonly string[]>([]);
protected readonly scheduledFor = signal<Date | null>(null);
protected readonly aspectRatio = signal<string>('1:1');
```

```html
<p-multiselect
  [options]="accountOptions()"
  [ngModel]="selectedAccountIds()"
  (ngModelChange)="selectedAccountIds.set($event)"
/>
<p-datepicker [ngModel]="scheduledFor()" (ngModelChange)="scheduledFor.set($event)" … />
```

```typescript
// ❌ Prohibido — loop de CD, en prod la página no pinta (sin guard NG0103)
// [ngModel]="post().accountIds.slice()"     ← aloca en cada pasada
// [ngModel]="defaultRange()"                ← método (no computed) que retorna literal
// [options]="buildOptions()"                ← ídem para options de multiselect/select
```

Notas de detalle: (a) `p-multiselect` emite un array **nuevo** en cada cambio — `set($event)` lo adopta como referencia canónica, exactamente el espejo síncrono que `customers-filter-sheet` documenta; (b) los `options` de todos los selects salen de `computed` (`accountOptions`, `providerOptions`, `aspectRatioOptions`) — mismas garantías que el model; (c) el reset del form al abrir el composer hace `set()` explícito campo por campo (función `resetForm(post?)`), nunca re-crea signals. Este bloque se copia como comentario JSDoc en `post-composer` y `studio-request-form`, apuntando a los tres prior arts del repo.

### D10. Accesibilidad y aria-live

- **Live region única por página** (`announce(msg)` escribe en un `signal<string>`): `<div class="sr-only" aria-live="polite" aria-atomic="true">{{ liveMessage() }}</div>`. Anuncia: transiciones de post (programado/publicado/borrador guardado), transición terminal de jobs, y "N sugerencias de hashtags disponibles" al llegar sugerencias. `polite` siempre — los errores ya llegan por `p-toast` (`role="alert"`) y por los bloques inline con `role="alert"` heredado de la receta ux-patterns. **No** se anuncia cada tick de progreso (spam de SR); `p-progressbar` ya expone `role="progressbar"` + `aria-valuenow`.
- Grid mensual: contenedor `role="grid"` NO se simula — es un layout de contenido, no un date-grid interactivo de selección; cada celda es un `<div>` con heading `sr-only` de fecha y sus chips son botones reales (`<button type="button">`) — Tab atraviesa solo contenido interactivo real. Navegador de mes y toggles de vista: icon-only con `ariaLabel` + `pTooltip` (enforced).
- Drawer: focus trap y `Esc` nativos de `p-drawer`; al cerrar tras guardar, el foco vuelve al botón "Nueva publicación" (comportamiento default del drawer al restaurar foco al trigger).
- Todos los `@defer` con `@placeholder` `<p-skeleton>` dimensionado + `aria-busy="true"`.
- Contraste: nada nuevo fuera de tokens; dots de estado acompañados SIEMPRE de label/tooltip textual (WCAG 1.4.1, no color-only).

## Alternativas consideradas

1. **`p-datepicker [inline]` + `dateTemplate` como calendario de contenido.** Consultado el MCP: existe y templatea la celda, pero su modelo/ARIA es de selección de fecha, sus celdas tienen métrica fija de tema y anidar chips interactivos rompe el contrato `gridcell`. Override masivo vía `[dt]`/`::ng-deep` = anti-patrón del repo. **No.** El datepicker queda donde es nativo: el campo de fecha del composer.
2. **Dependencia de calendario (FullCalendar / angular-calendar).** Decenas de kB en un repo con 15 kB de headroom y prohibición explícita de deps sin justificación; el grid custom son ~150 líneas de template + una función pura testeable. **No.**
3. **Vista semana además de mes y lista.** Tercer layout con costo de mantenimiento (baselines, a11y, responsive) para contar lo mismo que ya cuentan mes (distribución) y lista (densidad + acciones). Los referentes la tienen porque tienen drag & drop horario; nosotros no (alt. 4). **No en v1** — si se agrega después, es un `viewMode` más sobre el mismo VM.
4. **Drag & drop de posts entre celdas.** Exige CDK DragDrop (dep nueva) o pointer-events custom frágiles en zoneless, y el reagendado se resuelve igual editando la fecha en el composer (dos clicks). Valor demo marginal frente al riesgo. **No.**
5. **`p-dialog` para el composer.** Tapa el calendario (el contexto de la decisión), obliga a scroll interno en un form largo, y el prior art de overlay-form del repo ya es drawer. **No** (D5).
6. **Deshabilitar el botón Generar cuando el provider no está listo, sin empty state.** Esconde el pitch: el empty state con CTA a `/social/providers` ES la narrativa "configurá TU key" del cliente. **No** — opción disabled con tooltip para providers individuales, empty state cuando no hay ninguno.
7. **Parsear `failureReason` para decidir la CTA del post `failed`.** Acopla la UI a strings de un mock (y de un backend futuro). La causa real vive tipada en settings (`ConnectionStatus`) — `blockingAccount` computed. **No** (D6.1).
8. **Wizard multi-step en el studio** (kind → provider → opciones → prompt). Ceremonia para un form de 4 controles; el form adaptativo por capabilities muestra el poder del registry en una sola pantalla. **No.**
9. **`p-fileupload` para media del composer.** No hay backend receptor; un upload que "funciona" pero no persiste es una promesa falsa en la demo, y rompe el determinismo de previews. Catálogo curado de `demoAsset()`. **No.**
10. **Abrir el composer desde studio pasando el draft por estado en memoria** (service compartido) en vez de `?draft=<id>`. Se pierde con F5 y no es deep-linkeable; el draft persistido vía `savePost` + query param sobrevive y reutiliza el flujo de edición ya existente. **No.**

## Consecuencias

**Positivas**

- Cero dependencias nuevas, cero bytes de Chart.js, cero tipos de dominio nuevos: las dos páginas se construyen solo con contratos RFC-002 + componentes PrimeNG ya usados en el repo (drawer, multiselect, datepicker, selectbutton, progressbar, tag, skeleton) — bajo riesgo de sorpresas de bundle.
- El grid custom es SSR-friendly (contenido real en el HTML servido), determinista para baselines y de a11y controlada por nosotros.
- La receta D9 convierte el riesgo zoneless más peligroso del repo en un patrón mecánico verificable en review (todo `[ngModel]`/`[options]` → lectura de signal/computed).
- Los tres flujos cross-página del pedido quedan cerrados: hashtags → composer (D6.3), studio → planner (`sourceJobId`, D8), `failed` → connections (D6.1) — con el estado real de settings como única fuente de verdad.
- El empty state del studio y las opciones disabled con tooltip materializan el pitch white-label/multi-tenant exactamente donde el cliente lo quiere demostrar.

**Negativas / deuda aceptada**

- El grid mensual custom no tiene navegación por flechas tipo date-grid ARIA (es contenido, no un picker); Tab por chips es suficiente pero menos denso que un roving tabindex. Se acepta; si un audit lo pide, el upgrade es local al componente.
- `CAPTION_LIMITS.facebook = 5000` es un techo práctico (el real es ~63k, absurdo para demo) — documentado en la constante.
- `nextBestSlot` (D4) es una extensión aditiva a un archivo creado por Wave B (`utils/best-time.ts`) — cero refactor del heatmap; único caso borde: si PR-C1 llegara a mergearse antes que PR-B3 (orden anómalo), el archivo nace acá con AMBAS funciones y el shape de RFC-004 D1, y B lo consume tal cual.
- "Copiar" caption usa Clipboard API solo en browser (guard `isBrowser`); en SSR el botón simplemente no opera — aceptable, el studio no tiene interacción en server.
- El draft creado por "Usar en planner" queda huérfano si el usuario abandona el composer sin completar — visible como borrador en la lista (comportamiento honesto: los referentes hacen lo mismo).

## Plan de implementación (Wave C — 2 PRs, tras cierre de A y B)

**PR-C1 — `social-planner`** (reemplaza el shell de Wave A):

1. `nextBestSlot()` agregado a `utils/best-time.ts` (que Wave B creó con `topSlots` — D4) + su spec, y `utils/calendar-grid.ts` (`buildMonthCells` + spec: 35/42 celdas, lunes-primero, celdas de relleno, agrupación de posts, `isBestTimeDay`). El composer consume `groupHashtagSuggestions` de `utils/hashtag-grouping.ts` (creado por RFC-005 D7 en Wave B) — no se reimplementa agrupación.
2. `constants/` (status tokens, caption limits, media catalog) y componentes `planner-month-grid`, `planner-list`.
3. `post-composer` + `composer-preview` (drawer, form D6 completo con receta D9, flujos save/schedule/publishNow, `failed` accionable D6.1, query param `?draft=`).
4. Página: toolbar (mes ‹hoy›, selectbutton de vista, "Nueva publicación"), cascada `loadError → gating sin cuentas → datos`, `@defer` del grid, live region D10.
5. Specs de componente: `blockingAccount` (expired → CTA reconectar), `buildPost` inmutable, apertura por query param.
6. Fixture vacía ya existe desde Wave A (`social-planner`, `waitForData: true`) — captura el gating de onboarding; este PR agrega `social-planner-seeded` (RFC-001 D7) que captura el calendario POBLADO (posts del backfill `${clientSeed}:sched`); correr workflow `Visual baselines` por el cambio de shell → página real, ambas variantes.

**PR-C2 — `social-studio`:**

1. `constants/generation-options.ts` (tonos, largos, idiomas, `GENERATION_STATUS_TAG`, `KIND_LABELS`).
2. `studio-request-form` (kind selector, provider select desde `providerOptions` computed, opciones por capabilities, receta D9) y `studio-job-card`.
3. Página: gating por `hasReadyProvider`, panel de job activo (progreso/skeletons/resultados/failed+retry), historial en `@defer`, `useInPlanner` D8, live region D10.
4. Specs: `providerOptions` (disabled cuando `!enabled` o key ≠ `valid`; vacío → `hasAnyReady=false`), `useInPlanner` (id determinista `post-${jobId}`, `sourceJobId` seteado), request de video clampeado por `maxVideoSeconds` en el `p-inputnumber`.
5. Baselines de AMBOS estados vía workflow manual: el gating vacío (el momento demo del pitch, fixture `social-studio`) y el studio configurado con historial (fixture `social-studio-seeded`, RFC-001 D7); smoke del flujo studio→planner manualmente en review.

Ambos PRs corren `npm run verify` completo; MCP de PrimeNG consultado por API exacta de `Drawer`, `MultiSelect`, `DatePicker`, `InputNumber`, `ProgressBar` antes de escribir cada template (mandato CLAUDE.md — este RFC ya validó DatePicker).

## Criterios de aceptación verificables

- [ ] `npm run verify` verde en cada PR (lint + rules + design-tokens + build + bundle:check + smoke). `bundle:check` sin superar el delta de 3 % — y **cero** imports de `chart.js`/`chart-registry` en `social-planner/**` y `social-studio/**` (verificable con grep en review).
- [ ] ESLint local sin excepciones nuevas: spacing dentro de la allow-list, todo `bg-surface-*` con par `dark:`, iconos con familia sharp explícita (duotone solo en empty states ≥`text-2xl`), icon-only buttons con `ariaLabel`+`pTooltip`, `cursor-pointer`⇄`hover:*`, sin `transition-all`, `type="button"` en todos los `<button>` nativos de celdas/chips.
- [ ] **Receta D9 auditada:** ningún `[ngModel]`/`[options]` bindeado a literal, método o expresión que aloque — solo lecturas de `signal`/`computed`. Las dos páginas navegan y pintan en build de **producción** (el loop zoneless no se manifiesta en dev).
- [ ] Planner: crear → aparece en grid y lista; programar setea chip `info`; `publishNow` sobre post con cuenta `expired` → `failed` con CTA "Reconectar cuenta" que navega a `/social/connections`; tras reconectar, retry publica (`success`). Sin cuentas conectadas → empty state RFC-003 con CTA funcional.
- [ ] Studio: sin provider listo → empty state con CTA a `/social/providers` (la baseline VACÍA captura este momento demo; la `-seeded` captura el studio configurado); provider deshabilitado → opción disabled con tooltip; generar caption → progreso → 3 variantes; video limitado por `maxVideoSeconds` del provider; "Usar en planner" → navega con `?draft=` y el composer abre el borrador con chip "Generado con {provider}".
- [ ] `@defer (hydrate on viewport)` presente en grid mensual e historial de jobs, con `@placeholder` `<p-skeleton>` dimensionado + `aria-busy="true"`.
- [ ] `npm run a11y` sin violaciones `serious/critical` en `/social/planner` y `/social/studio`, en AMBAS variantes de fixture (vacía y `-seeded` — el grid poblado y el historial de jobs también pasan por axe); live region `polite` anuncia transiciones de post y de job (verificación manual con SR en review).
- [ ] Fixtures vacías intactas desde Wave A (`waitForData: true`) + entries `-seeded` agregadas en estos PRs (RFC-001 D7); baselines regeneradas SOLO vía workflow `Visual baselines`; capturas estables en dos runs consecutivos (mocks deterministas por `clientSeed`; vacía = gating, seeded = calendario/historial poblados).
- [ ] Cero stories nuevas (ningún componente promovido a `shared/`); si durante la implementación algo se promueve, story en el mismo PR.
- [ ] Specs vitest de PR-C1/C2 pasan: `buildMonthCells`, `topSlots`/`nextBestSlot`, `blockingAccount`, `providerOptions`, `useInPlanner`.
