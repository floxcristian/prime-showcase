# RFC-002 — Modelo de dominio, puertos y estrategia de mocks de la Suite Social

- **Estado:** Propuesto
- **Fecha:** 2026-08-14
- **Autores:** equipo
- **Relacionados:** mapa de módulos del arquitecto (fuente de verdad de páginas/waves), RFC-003 (mecánica de persistencia y UX de keys), ADR-001 (SSR/hydration), `docs/adr/README.md`

## Resumen

Este RFC congela los **contratos TypeScript** de toda la suite social (`src/app/modules/social/models/`), los **seis puertos** que un backend real implementará mañana (`social.ports.ts`), la **división en cuatro services mock** que los implementan hoy, y la **estrategia de factories deterministas** (seeds, volúmenes, scoping al cliente autenticado, simulación de progreso y de fallos). No define UI de ninguna página, ni la mecánica de storage (RFC-003), ni navegación. Todo lo decidido acá es implementable con las convenciones vigentes del repo: fachadas `Observable + delay(mockLatency())`, epoch por instancia, caches en `Map` de instancia, signals mutables estilo `ApiKeysMockService`, inyección por clase concreta sin DI tokens.

## Contexto y problema

La suite social (9 páginas, waves A-C) necesita una capa compartida que cinco implementadores puedan consumir en paralelo sin renegociar shapes. El repo ya tiene tres patrones probados que cubren el 90 % del problema:

1. **Fachada read-only con epoch por instancia** — `observability-mock.service.ts:22-56`: factories puras parametrizadas por `epoch`, SSR obtiene instancia fresca por request, browser mantiene datos estables por sesión, details memoizados en `Map` de instancia.
2. **Fachada mutable con signal** — `api-keys-mock.service.ts:27-53`: `signal` de estado, mutaciones con efecto inmediato, plaintext de secrets mostrado una única vez y descartado.
3. **PRNG seeded + helpers de tiempo** — `observability/mocks/mock-utils.ts` (`seededRandom` Mulberry32, `now()`, `minutesBefore`).

Lo que NO existe y este RFC decide: (a) los tipos del dominio social, (b) puertos explícitos como interfaces compiladas (hoy el "puerto" es implícito en la firma del service), (c) el scoping de datos al cliente autenticado (requisito v2: plataforma multi-tenant, cero cuentas hardcodeadas, el usuario logueado ES el cliente), (d) simulación de procesos con progreso (jobs de generación) y de fallos ocasionales (publicación), ambos deterministas para no romper visual baselines.

## Decisión

### D1. Ubicación y archivos

```
src/app/modules/social/
  models/
    social.interface.ts      ← entidades de dominio (D2)
    provider.interface.ts    ← catálogo de providers + config por cliente (D3)
    social.ports.ts          ← los 6 puertos (D4)
  mocks/
    provider-catalog.ts      ← PROVIDER_CATALOG (const tipada, plataforma-global)
    social-mock-utils.ts     ← dailySeries + helpers propios del dominio
    accounts-mock.ts         ← buildAccountMock (por red, on-connect)
    posts-mock.ts            ← buildPostsMock
    audience-mock.ts         ← buildAudienceMock
    competitors-mock.ts      ← buildCompetitorsMock + buildBenchmarksMock
    mentions-mock.ts         ← buildBrandMentionsMock (menciones de marca, RFC-005)
    recommendations-mock.ts  ← buildRecommendationsMock
    trends-mock.ts           ← buildTrendsMock + buildHashtagSuggestionsMock
    scheduled-posts-mock.ts  ← buildScheduledPostsMock
    generation-jobs-mock.ts  ← buildGenerationJobsMock
  services/
    social-analytics-mock.service.ts   ← implements SocialAnalyticsPort, CompetitorPort, InsightsPort
    social-publishing-mock.service.ts  ← implements PublishingPort
    social-generation-mock.service.ts  ← implements GenerationPort
    social-settings.service.ts         ← implements ProviderConfigPort (único dueño de storage)
    recommendation-dismissals.store.ts ← patrón acknowledgements.store
```

Interfaces `readonly` en su totalidad (mismo criterio que `observability.interface.ts`: inmutabilidad favorece `signal`/`computed`). Un export por archivo de constante/mock (`AGENTS.md`). Nada de esto entra al initial bundle: los services son `providedIn: 'root'` pero solo se inyectan desde componentes lazy (`loadComponent`), por lo que viven en los chunks lazy.

### D2. Contratos de dominio — `models/social.interface.ts`

Se cierra el draft de la investigación de dominio con estos ajustes: `MetricKind` gana `completion-rate` y `net-follower-growth` (métricas "wow" de TikTok/IG con nombre real en sus APIs); `PostSummary.metrics` gana campos opcionales de video; `AudienceSnapshot` gana `trafficSources` (breakdown FYP de TikTok); `SocialAccount` pierde `connectorId` implícito hardcodeado — la cuenta nace de `connectAccount()` (D6). Los nombres siguen el vocabulario real de IG/FB Graph y TikTok API para que el swap a backend sea mecánico.

```typescript
/**
 * Modelos de la suite social. Fachada SHOWCASE — el shape replica el
 * vocabulario de las APIs reales (IG/FB Graph, TikTok Business API) para
 * que el adaptador HTTP futuro sea un mapeo 1:1. Tipos inmutables
 * (mismo criterio que observability.interface.ts).
 */

export type SocialNetwork = 'instagram' | 'facebook' | 'tiktok';

/** Orden canónico de iteración en UI (tabs, leyendas, grids). */
export const SOCIAL_NETWORKS: readonly SocialNetwork[] = [
  'instagram',
  'facebook',
  'tiktok',
];

export type ConnectionStatus = 'connected' | 'expired' | 'error' | 'disconnected';

export interface SocialAccount {
  readonly id: string;                  // 'acc-instagram-<clientHash>'
  readonly network: SocialNetwork;
  readonly handle: string;              // '@colegiosnorte' — derivado del email del cliente (D6), jamás literal
  readonly displayName: string;         // brandName del signup (RFC-003 D2)
  readonly avatarUrl?: string;
  readonly status: ConnectionStatus;
  /** Solo status 'error': mensaje accionable que la card de connections
   *  muestra (p.ej. 'La credencial del conector fue revocada.'). */
  readonly failureReason?: string;
  readonly followers: number;
  readonly following: number;
  readonly postsCount: number;
  readonly connectedAt: string;         // ISO — se persiste (RFC-003); base del expiry mock
  readonly lastSyncAt: string;
  readonly connectorId: AnalyticsConnectorId;   // provider del catálogo que la alimenta
}

// ── Métricas y series temporales ─────────────────────────────────────

/**
 * Nombres alineados a las APIs reales:
 * IG Graph: reach, impressions, profile_views → 'profile-visits',
 *   follower_count → 'followers'; TikTok: video_views, average_watch_time
 *   → 'watch-time', completion rate → 'completion-rate';
 * FB Graph: link_clicks → 'link-clicks' (habilita CTR = link-clicks /
 *   impressions), paid reach → 'paid-reach' (habilita organic = reach −
 *   paid-reach). Estos dos existen por requerimiento de RFC-004 D7 y son
 *   parte del contrato congelado desde Wave A.
 */
export type MetricKind =
  | 'followers'
  | 'net-follower-growth'
  | 'reach'
  | 'impressions'
  | 'engagement-rate'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'profile-visits'
  | 'video-views'
  | 'watch-time'
  | 'completion-rate'
  | 'link-clicks'
  | 'paid-reach';

export interface MetricPoint {
  readonly t: string;                   // ISO date — bucket diario
  readonly v: number;
}

export interface MetricSeries {
  readonly kind: MetricKind;
  readonly network: SocialNetwork;
  readonly accountId: string;
  readonly unit: string;                // '' | '%' | 'min'
  readonly points: readonly MetricPoint[];   // siempre 90 buckets; la UI recorta a 7/30/60
  /** Variación % vs período anterior (signo = dirección) — para app-metric-card [delta]. */
  readonly delta: number;
}

export type PostFormat = 'image' | 'carousel' | 'video' | 'reel' | 'story' | 'text';

export interface PostSummary {
  readonly id: string;
  readonly accountId: string;
  readonly network: SocialNetwork;
  readonly format: PostFormat;
  readonly caption: string;             // es-CL realista
  readonly thumbnailUrl?: string;       // demoAsset(...) — shared/constants/demo-assets.ts
  readonly permalink: string;
  readonly publishedAt: string;
  readonly hashtags: readonly string[];
  readonly metrics: {
    readonly likes: number;
    readonly comments: number;
    readonly shares: number;
    readonly saves: number;
    readonly reach: number;
    readonly impressions: number;
    readonly engagementRate: number;    // % — precalculado en factory, no en template
    /** Solo formats video/reel — undefined en el resto. */
    readonly videoViews?: number;
    readonly avgWatchTimeSec?: number;
    readonly completionRatePct?: number;
    /** Solo network 'facebook' (Graph expone reactions por post) — la vista
     *  FB agrega los top posts client-side para el donut (RFC-004 D6). */
    readonly reactions?: readonly {
      readonly type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
      readonly count: number;
    }[];
  };
}

export interface AudienceSnapshot {
  readonly accountId: string;
  readonly capturedAt: string;
  readonly byAge: readonly { readonly range: string; readonly pct: number }[];
  readonly byGender: readonly { readonly gender: 'f' | 'm' | 'other'; readonly pct: number }[];
  readonly byCountry: readonly { readonly country: string; readonly pct: number }[];
  readonly byCity: readonly { readonly city: string; readonly pct: number }[];
  /** Hora local 0-23 → actividad relativa 0-100. Heatmap best-time (día × hora). */
  readonly activeHours: readonly number[];
  readonly activeDays: readonly number[];       // 0=lun … 6=dom
  /** Solo TikTok: procedencia del tráfico (el breakdown FYP). */
  readonly trafficSources?: readonly {
    readonly source: 'fyp' | 'profile' | 'search' | 'other';
    readonly pct: number;
  }[];
}

// ── Competencia ──────────────────────────────────────────────────────

/** Mejor post reciente del competidor — columna de la tabla comparativa (RFC-005 D4.1). */
export interface CompetitorTopPost {
  readonly caption: string;             // recortada en factory a ~80 chars, es-CL
  readonly format: PostFormat;
  readonly engagementRate: number;      // % — precalculado en factory
  readonly publishedAt: string;         // ISO, relativo a epoch
}

export interface Competitor {
  readonly id: string;
  readonly name: string;
  readonly network: SocialNetwork;
  readonly handle: string;
  readonly avatarUrl?: string;
  readonly followers: number;
  readonly followersSeries: readonly MetricPoint[];   // 90 días
  readonly avgEngagementRate: number;
  readonly postsPerWeek: number;
  readonly topFormats: readonly PostFormat[];
  /** Sentiment mock estático — la UI lo muestra como badge, sin pretender NLP. */
  readonly sentiment: { readonly positivePct: number; readonly neutralPct: number; readonly negativePct: number };
  /** Share of voice % dentro del set trackeado de su red (suma 100 con la cuenta propia). */
  readonly shareOfVoicePct: number;
  /** Mejor post de los últimos 30 días — mock curado, sin permalink real. */
  readonly topRecentPost: CompetitorTopPost;
}

/** Mención de marca — sección "trend discovery" de social-trends (RFC-005 D6).
 *  Lista finita determinista, NO listening en tiempo real. */
export interface BrandMention {
  readonly id: string;
  readonly network: SocialNetwork;
  readonly authorHandle: string;        // '@cliente.feliz'
  readonly excerpt: string;             // 1-2 líneas es-CL
  readonly sentiment: 'positive' | 'neutral' | 'negative';   // mock estático, sin NLP
  readonly mentionedAt: string;         // ISO relativo a epoch
  readonly permalink: string;           // '#' — mock
}

export interface CompetitorBenchmark {
  readonly metric: MetricKind;
  readonly unit: string;
  readonly own: number;
  readonly competitor: number;
  readonly competitorId: string;
  /** Precomputado en factory — nunca calcular posición en el template. */
  readonly position: 'ahead' | 'behind' | 'even';
  readonly gapPct: number;
}

// ── Recomendaciones (mejoras / correcciones / oportunidades) ─────────

export type RecommendationType = 'improvement' | 'fix' | 'opportunity';
/** Mismo vocabulario que AlertSeverity de observability → se reusan los mappings de p-tag. */
export type RecommendationSeverity = 'critical' | 'warn' | 'info';

export interface Recommendation {
  readonly id: string;
  readonly type: RecommendationType;
  readonly severity: RecommendationSeverity;
  readonly network: SocialNetwork;
  readonly accountId: string;
  readonly title: string;               // 'Caída de engagement en Reels'
  readonly detail: string;
  readonly evidence: {
    readonly metric: MetricKind;
    readonly sparkline: readonly number[];      // 14 puntos — sparklineFrom(rand, 14)
    readonly observedValue: number;
    readonly expectedValue: number;
    readonly unit: string;
  };
  readonly suggestedAction: string;     // 'Programá Reels martes/jueves 18-20h'
  /** Deep-link a la vista accionable: '/social/planner' | '/social/analytics' | '/social/connections'. */
  readonly actionRoute?: string;
  readonly detectedAt: string;
}
// El estado "dismissed" NO vive en la entidad: es estado de usuario en
// RecommendationDismissalsStore (patrón acknowledgements.store) — la
// entidad queda inmutable y el feed filtra con computed.

// ── Hashtags y tendencias ────────────────────────────────────────────

export interface HashtagSuggestion {
  readonly tag: string;                 // sin '#'
  readonly network: SocialNetwork;
  readonly volume: number;              // posts/día estimados
  /** Segmentación Later-style: alto/medio/nicho se deriva de volume en la UI vía difficulty. */
  readonly difficulty: 'low' | 'medium' | 'high';
  readonly relevanceScore: number;      // 0-100
  readonly trendDelta: number;          // % 7d
  readonly relatedTags: readonly string[];
}

/** Performance histórica de hashtags ya usados por el cliente (tabla de social-trends). */
export interface HashtagPerformance {
  readonly tag: string;
  readonly network: SocialNetwork;
  readonly timesUsed: number;
  readonly avgReach: number;
  readonly avgEngagementRate: number;
  readonly lastUsedAt: string;
}

export interface Trend {
  readonly id: string;
  readonly network: SocialNetwork;
  readonly title: string;               // 'Audio: corrido tumbado remix' | 'Formato: POV bodega'
  readonly kind: 'audio' | 'format' | 'topic' | 'challenge';
  readonly momentum: 'rising' | 'peaking' | 'declining';
  readonly volumeSeries: readonly MetricPoint[];      // 30 días
  readonly exampleUrl?: string;
  readonly windowDays: number;          // ventana estimada de vigencia
}

// ── Calendario / publicación ─────────────────────────────────────────

export type ScheduledPostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
// Mapping p-tag acordado: draft→secondary, scheduled→info, published→success, failed→danger.

export interface ScheduledPost {
  readonly id: string;
  readonly accountIds: readonly string[];       // cross-posting multi-red
  readonly format: PostFormat;
  readonly caption: string;
  readonly hashtags: readonly string[];
  readonly mediaUrls: readonly string[];
  readonly status: ScheduledPostStatus;
  readonly scheduledFor?: string;               // requerido si status='scheduled'
  readonly publishedAt?: string;                // solo 'published'
  readonly failureReason?: string;              // solo 'failed' — accionable (D10)
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Trazabilidad Studio → Planner. */
  readonly sourceJobId?: string;
}

// ── Generación de contenido ──────────────────────────────────────────

export type GenerationKind = 'caption' | 'image' | 'video';
export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
// Mapping p-tag: queued→secondary, running→info, succeeded→success, failed→danger.

export type CaptionTone = 'profesional' | 'cercano' | 'vendedor';

/** Request tipado — evita el "bag of params" en createJob y fija el contrato del composer. */
export interface GenerationRequest {
  readonly kind: GenerationKind;
  readonly providerId: ProviderId;
  readonly prompt: string;
  readonly options: {
    readonly tone?: CaptionTone;                // caption
    readonly maxLength?: number;                // caption
    readonly language?: 'es' | 'en';            // caption
    readonly aspectRatio?: string;              // image/video — validado vs capabilities
    readonly durationSeconds?: number;          // video — ≤ capabilities.maxVideoSeconds
  };
}

export interface GenerationJob {
  readonly id: string;
  readonly kind: GenerationKind;
  readonly providerId: ProviderId;
  readonly prompt: string;
  readonly request: GenerationRequest;
  readonly status: GenerationJobStatus;
  readonly progressPct?: number;                // solo 'running'
  readonly resultUrls?: readonly string[];      // image/video succeeded — demoAsset(...)
  /** caption succeeded: SIEMPRE 3 variantes. */
  readonly resultVariants?: readonly string[];
  readonly failureReason?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly costEstimateUsd?: number;
}
```

### D3. Catálogo de providers y configuración por cliente — `models/provider.interface.ts`

Separación estricta **catálogo (plataforma-global, estático, tipado)** vs **configuración (por cliente, mutable, persistida — mecánica en RFC-003)**. Los IDs de provider son union types cerrados: agregar un provider es un cambio de compilación, no de datos.

```typescript
export type ProviderKind = 'analytics-connector' | 'image-gen' | 'video-gen' | 'text-gen';

export type AnalyticsConnectorId = 'instagram-graph' | 'facebook-graph' | 'tiktok-api';
export type ImageGenProviderId = 'openai-images' | 'gemini-imagen';
export type VideoGenProviderId = 'veo' | 'heygen' | 'higgsfield';
export type TextGenProviderId = 'gpt' | 'gemini';
export type ProviderId =
  | AnalyticsConnectorId
  | ImageGenProviderId
  | VideoGenProviderId
  | TextGenProviderId;

/** Capabilities declarativas — la UI se auto-configura leyéndolas (cero if-por-provider). */
export interface ProviderCapabilities {
  readonly networks?: readonly SocialNetwork[];        // analytics-connector
  readonly supportedMetrics?: readonly MetricKind[];   // analytics-connector
  readonly maxVideoSeconds?: number;                   // video-gen
  readonly supportsAvatars?: boolean;                  // heygen
  readonly aspectRatios?: readonly string[];           // '1:1' | '9:16' | '16:9'
  readonly maxResolution?: string;                     // '1024x1024' | '4k'
  readonly captionVariants?: number;                   // text-gen: 3
}

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly kind: ProviderKind;
  readonly name: string;                // 'Google Veo'
  readonly vendor: string;              // 'Google DeepMind'
  /** fa-brands solo para logos reales (Instagram, Facebook, TikTok); resto fa-sharp fa-regular. */
  readonly icon: string;
  readonly docsUrl: string;
  /** Hint de formato + regex de shape-check client-side (D5: verifyKey). */
  readonly keyFormatHint: string;       // 'sk-…' | 'AIza…' | 'EAAG…'
  readonly keyPattern: string;          // '^sk-[A-Za-z0-9]{20,}$' — RegExp source, serializable
  readonly capabilities: ProviderCapabilities;
}

/** Catálogo estático — mocks/provider-catalog.ts. 10 entries: 3 connectors,
 *  2 image-gen, 3 video-gen, 2 text-gen. Const tipada UPPER_SNAKE. */
export declare const PROVIDER_CATALOG: readonly ProviderDescriptor[];

// ── Configuración por cliente (persistida — mecánica en RFC-003) ─────

export type ApiKeyStatus = 'unverified' | 'valid' | 'invalid' | 'expired';

export interface ApiKeyEntry {
  readonly id: string;
  readonly providerId: ProviderId;
  /** SOLO la versión enmascarada se persiste/muestra: 'sk-…a4f9' (patrón maskPrefix de api-keys-mock). */
  readonly maskedKey: string;
  readonly status: ApiKeyStatus;
  readonly lastVerifiedAt?: string;
  readonly createdAt: string;
  readonly label?: string;              // 'Producción', 'Cuenta agencia'
}

/** El plaintext existe únicamente en el retorno de addKey — se muestra una vez y se descarta. */
export interface ApiKeyWithPlaintext {
  readonly entry: ApiKeyEntry;
  readonly plaintext: string;
}

export interface ConnectorConfig {
  readonly providerId: ProviderId;
  readonly enabled: boolean;
  readonly activeKeyId?: string;
  /** Opciones específicas validadas contra capabilities (ej: aspectRatio default). */
  readonly options: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Estado completo de configuración DEL CLIENTE AUTENTICADO — lo que
 * SocialSettingsService expone como signal y persiste (RFC-003).
 * Incluye las cuentas sociales conectadas: conectar una cuenta ES
 * configuración del cliente, no dato de analytics.
 */
export interface TenantProviderState {
  readonly configs: readonly ConnectorConfig[];
  readonly keys: readonly ApiKeyEntry[];
  readonly accounts: readonly SocialAccount[];
  /**
   * Provider ACTIVO por categoría de generación (text-gen/image-gen/video-gen):
   * el que el studio preselecciona (RFC-006 D7). Se setea con
   * `setActiveProvider` (UX en RFC-003 D5.4: al habilitar el primero de una
   * categoría se vuelve activo automáticamente). `analytics-connector` no
   * aplica (cada red usa su propio conector) — nunca aparece como key.
   */
  readonly activeByKind: Partial<Record<ProviderKind, ProviderId>>;
}

/** Estado inicial de un cliente recién registrado: TODO vacío/deshabilitado
 *  (`activeByKind: {}` incluido). Cero hardcodeo. */
export declare const EMPTY_TENANT_STATE: TenantProviderState;
```

### D4. Puertos — `models/social.ports.ts`

Seis interfaces. Son **el contrato compilado** de dónde entra el backend real: cada mock declara `implements XxxPort`, los componentes inyectan la clase concreta (patrón del repo — sin `InjectionToken`, ver Alternativas). El swap futuro es: nuevo `SocialAnalyticsHttpService implements SocialAnalyticsPort` + cambiar el import en los componentes.

```typescript
import type { Observable } from 'rxjs';
// + imports de tipos de social.interface.ts / provider.interface.ts

export interface SocialAnalyticsPort {
  /** Las cuentas del cliente autenticado (las conectadas en settings). */
  getAccounts(): Observable<readonly SocialAccount[]>;
  getMetricSeries(accountId: string, kind: MetricKind): Observable<MetricSeries>;
  getTopPosts(accountId: string): Observable<readonly PostSummary[]>;
  getAudience(accountId: string): Observable<AudienceSnapshot>;
}

export interface CompetitorPort {
  getCompetitors(network: SocialNetwork): Observable<readonly Competitor[]>;
  getBenchmarks(accountId: string, competitorId: string): Observable<readonly CompetitorBenchmark[]>;
}

export interface InsightsPort {
  getRecommendations(): Observable<readonly Recommendation[]>;
  /** Delegado a RecommendationDismissalsStore — estado de usuario, en memoria. */
  dismissRecommendation(id: string): Observable<void>;
  getHashtagSuggestions(topic: string, network: SocialNetwork): Observable<readonly HashtagSuggestion[]>;
  getHashtagPerformance(network: SocialNetwork): Observable<readonly HashtagPerformance[]>;
  getTrends(network: SocialNetwork): Observable<readonly Trend[]>;
  /** Lista FINITA (10-15) de menciones recientes — trend discovery, NO listening (RFC-005 D6). */
  getBrandMentions(): Observable<readonly BrandMention[]>;
}

export interface PublishingPort {
  getScheduledPosts(): Observable<readonly ScheduledPost[]>;
  savePost(post: ScheduledPost): Observable<ScheduledPost>;   // upsert: draft o scheduled
  deletePost(id: string): Observable<void>;
  /** Transición scheduled/draft → published, con fallo determinista ocasional (D10). */
  publishNow(id: string): Observable<ScheduledPost>;
}

export interface GenerationPort {
  createJob(request: GenerationRequest): Observable<GenerationJob>;   // emite el job en 'queued'
  getJobs(): Observable<readonly GenerationJob[]>;
  /** Stream de progreso: queued → running(pct…) → succeeded|failed. Determinista por id (D9). */
  watchJob(id: string): Observable<GenerationJob>;
}

export interface ProviderConfigPort {
  getState(): Observable<TenantProviderState>;
  setEnabled(providerId: ProviderId, enabled: boolean): Observable<void>;
  setActiveKey(providerId: ProviderId, keyId: string): Observable<void>;
  /** Provider activo por categoría de generación (TenantProviderState.activeByKind — UX en RFC-003 D5.4). */
  setActiveProvider(kind: ProviderKind, providerId: ProviderId): Observable<void>;
  /** Enmascara al vuelo; el plaintext se retorna UNA vez y se descarta (patrón api-keys). */
  addKey(providerId: ProviderId, plaintext: string, label?: string): Observable<ApiKeyWithPlaintext>;
  verifyKey(keyId: string): Observable<ApiKeyEntry>;          // D5: shape-check + seed
  revokeKey(keyId: string): Observable<void>;
  /** "OAuth" simulado: genera la cuenta determinista del cliente para esa red. */
  connectAccount(network: SocialNetwork): Observable<SocialAccount>;
  reconnectAccount(accountId: string): Observable<SocialAccount>;   // expired/error → connected
  disconnectAccount(accountId: string): Observable<void>;
}
```

Regla dura: **los componentes de páginas solo dependen de los puertos y las entidades** — nunca de detalles internos de los mocks (factories, seeds). Los mocks son detalle de implementación reemplazable.

### D5. División en cuatro services

| Service | Puertos | Patrón de estado | Latencia |
|---|---|---|---|
| `SocialAnalyticsMockService` | `SocialAnalyticsPort`, `CompetitorPort`, `InsightsPort` | Read-only: `epoch` por instancia + caches `Map` por `accountId`/`competitorId`/`topic` (clon de `observability-mock.service.ts`) | `mockLatency()` default 800-1800 ms |
| `SocialPublishingMockService` | `PublishingPort` | `signal<readonly ScheduledPost[]>` mutable (clon de `api-keys-mock.service.ts`) | `mockLatency(400, 400)` |
| `SocialGenerationMockService` | `GenerationPort` | `signal<readonly GenerationJob[]>` + streams de progreso (D9) | create: `mockLatency(200, 300)`; progreso: ticks (D9) |
| `SocialSettingsService` | `ProviderConfigPort` | `signal<TenantProviderState>` + persistencia (mecánica RFC-003); **único service que toca storage** | `mockLatency(200, 300)`; `verifyKey`: `mockLatency(800, 700)` (una verificación "llama a la API externa"); `connectAccount`/`reconnectAccount`: `mockLatency(1200, 800)` (roundtrip OAuth simulado, RFC-003 D4.3) |

Notas de implementación fijadas:

- `SocialAnalyticsMockService` expone `readonly epoch: number = now()` **público** (mismo rationale documentado en `observability-mock.service.ts:47-56`) y un getter sincrónico `accountsSnapshot` que delega en `SocialSettingsService.accounts()` (el signal con `status` efectivo — expiry computado en lectura, D6) — los mocks derivados (posts, recommendations) referencian ids/handles reales y el estado que la UI ve.
- Dependencia entre services: `Analytics → Settings` (lee cuentas), `Generation → Settings` (valida provider habilitado + key `valid` antes de crear job; si no, el Observable emite error con mensaje accionable — la UI lo convierte en CTA a `/social/providers`), `Publishing → Settings` (valida `accountIds` conectados). `Settings` no depende de nadie. Sin ciclos.
- `verifyKey` es determinista en dos fases: (1) shape-check sincrónico contra `keyPattern` del descriptor → `invalid` inmediato si no matchea; (2) si matchea, `seededRandom(keyId)()` decide: `< 0.75` → `valid`, `< 0.92` → `invalid`, resto → `expired`. Re-verificar la misma key da siempre el mismo resultado (estable para baselines); una key nueva (id nuevo) puede dar distinto — exactamente la variedad de estados que la página de providers necesita mostrar.
- `RecommendationDismissalsStore`: `signal<ReadonlySet<string>>` + `asReadonly()`, JSDoc "en producción POST /dismissals" — clon de `acknowledgements.store.ts`. `InsightsPort.dismissRecommendation` delega acá; el feed filtra con `computed`.
- Todo método muta/lee con la receta `of(x).pipe(delay(...))`; para mutaciones que deben reflejarse al instante en signals, la receta `concat(first$.pipe(take(1), delay(...)), live$)` de `customers-mock.service.ts:60-62` cuando aplique.

### D6. Scoping al cliente autenticado (multi-tenant sin backend)

**Decisión: todos los seeds de factories se prefijan con un `clientSeed` derivado del email autenticado.**

```typescript
// services/social-settings.service.ts (extracto)
private readonly auth = inject(AuthService);

/**
 * Semilla del cliente autenticado. TODO dato mock de la suite social se
 * genera con seeds `${clientSeed()}:<scope>` → dos clientes registrados
 * distintos ven cuentas, métricas y recomendaciones distintas; el mismo
 * cliente ve SIEMPRE lo mismo (dentro de la sesión, por epoch; y entre
 * sesiones para todo lo derivado puramente del seed, como handles).
 * En producción el scoping lo hace el backend por token — este seed es
 * la representación frontend de ese aislamiento.
 */
readonly clientSeed = computed(
  () => this.auth.email()?.trim().toLowerCase() ?? 'demo@showcase',
);
```

- `AuthService.email` está disponible **también en SSR** (cookie vía `REQUEST`, `auth.service.ts:92-98`) → el server y el browser generan el mismo dato para el mismo cliente → cero hydration mismatch.
- **Cero cuentas hardcodeadas — identidad derivada del cliente:** `EMPTY_TENANT_STATE` es el estado de un cliente nuevo. `connectAccount('instagram')` genera la cuenta con `buildAccountMock(epoch, clientSeed, brandName, 'instagram')`: `handle = '@' + localPart(clientSeed)` saneado (`colegios.norte@…` → `@colegiosnorte`), `displayName = brandName` persistido en el signup (fallback: localPart capitalizado — RFC-003 D4.3), followers/following/postsCount vía `seededRandom(`${clientSeed}:acct:instagram`)` en rangos realistas por red, `id = 'acc-instagram-' + hash(clientSeed)`. **Ningún pool de handles para cuentas propias** — los pools es-CL curados (D7) existen solo para terceros (competidores, autores de menciones). Reconectar tras desconectar reproduce la MISMA cuenta (id estable) — coherente con "reconectaste tu cuenta", no "apareció otra".
- **Backfill on-connect:** conectar una cuenta dispara la generación lazy (cached en `Map` de instancia del analytics service) de su historia: 90 días de series, 12-18 posts, audiencia, 3-4 recommendations. Narrativa realista: los conectores reales backfillean histórico al autorizar. Sin cuentas conectadas, todos los puertos read-only devuelven colecciones vacías → las páginas muestran el empty state con CTA a `/social/connections` (gating del mapa de módulos).
- **Expiración simulada de tokens — computada en lectura, no almacenada:** el `status` efectivo que expone `SocialSettingsService.accounts()` es `expired` cuando `now − connectedAt > TOKEN_TTL_MS` (**7 días** — compresión demo de los 60 reales de Meta, documentada en JSDoc; un cliente demo que vuelve a la semana ve el flujo real de reconexión — mecánica en RFC-003 D4.4). Además, determinista por seed: `seededRandom(`${clientSeed}:sync-err:${network}`)() < 0.2` marca UNA cuenta con `status: 'error'` + `failureReason` del pool accionable y `lastSyncAt` viejo — variedad de estados sin aleatoriedad real. `reconnectAccount` limpia ambos casos (refresca `connectedAt`, borra `failureReason`).
- El logout/login con otro email cambia `clientSeed` → los services derivan todo de nuevo. Los signals de settings se re-inicializan leyendo el storage namespaced por cliente (mecánica exacta en RFC-003; este RFC solo fija que la KEY de storage incluye el hash del clientSeed).
- **Aislamiento también en los services mutables NO persistidos.** `SocialPublishingMockService`, `SocialGenerationMockService` y `RecommendationDismissalsStore` son singletons root con signals mutables: sin reset, el contenido del cliente A (drafts, jobs, dismissals) sobreviviría a un logout/login del cliente B. Cada uno declara un único `effect()` que observa `SocialSettingsService.clientSeed()` y, ante un cambio, **resetea su signal al estado derivado del NUEVO cliente**: publishing re-siembra el backfill `${clientSeed}:sched` solo si el nuevo cliente tiene cuentas conectadas (si no, `[]`); generation re-siembra `${clientSeed}:jobs` solo si su `TenantProviderState` ya rehidratado tiene una key `valid` de un provider de generación (si no, `[]`); dismissals vuelve a `Set` vacío. Límite documentado en JSDoc: lo NO persistido de un cliente se descarta al logout (coherente con la alternativa 6 — solo `TenantProviderState` se persiste); el criterio de aislamiento es que el cliente B jamás vea contenido de A.

### D7. Factories deterministas, `dailySeries` y volúmenes

Helper central en `mocks/social-mock-utils.ts`:

```typescript
/**
 * Serie diaria determinista: base + tendencia lineal + ruido seeded +
 * estacionalidad semanal (weekendFactor multiplica sáb/dom — >1 para
 * redes de consumo como IG/TikTok, <1 para FB corporativo).
 * Siempre 90 buckets — la UI recorta a 7/30/60 sin re-fetch.
 */
export const dailySeries = (
  epoch: number,
  seed: string,
  base: number,
  trendPerDay: number,
  noisePct: number,
  weekendFactor = 1.25,
): readonly MetricPoint[] => {
  const rand = seededRandom(seed);
  return Array.from({ length: 90 }, (_, i) => {
    const d = new Date(epoch - (89 - i) * 86_400_000);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const noise = (rand() * 2 - 1) * noisePct;
    const v = (base + trendPerDay * i) * (isWeekend ? weekendFactor : 1) * (1 + noise);
    return { t: d.toISOString(), v: Math.round(v) };
  });
};
```

`delta` de cada `MetricSeries` se precalcula en la factory comparando la suma de los últimos 30 días vs los 30 anteriores — nunca en el componente.

**Volúmenes congelados** (por cliente, con las 3 redes conectadas):

| Dato | Volumen | Seed |
|---|---|---|
| Cuentas | máx. 1 por red (3 total) | `${clientSeed}:acct:${network}` |
| Series por cuenta | 90 buckets diarios × ~6 kinds relevantes por red | `${clientSeed}:series:${accountId}:${kind}` |
| Posts | 12-18 por cuenta | `${clientSeed}:posts:${accountId}` |
| Audiencia | 1 snapshot por cuenta | `${clientSeed}:aud:${accountId}` |
| Competidores | 3 por red — handles/nombres de un pool curado es-CL fijo por red (terceros — no son cuentas del cliente); números seeded; `topRecentPost` incluido | `${clientSeed}:comp:${network}` |
| Benchmarks | 5-6 métricas por par cuenta/competidor | `${clientSeed}:bench:${accountId}:${competitorId}` |
| Brand mentions | 4-5 por red conectada (máx. 15 total), mix de sentiments garantizado por round-robin | `${clientSeed}:mentions` |
| Recommendations | 3-4 por cuenta conectada (8-10 con 3 redes), mix de types/severities garantizado por round-robin en la factory | `${clientSeed}:reco:${accountId}` |
| Trends | 6-8 por red (contenido curado es-CL fijo; series/momentum seeded) | `${clientSeed}:trend:${network}` |
| Hashtag suggestions | 9-12 por topic (topic normalizado `trim().toLowerCase()` → mismo topic, mismas chips) | `${clientSeed}:hashtag:${network}:${topic}` |
| Hashtag performance | 8-10 por red | `${clientSeed}:hperf:${network}` |
| Scheduled posts (backfill) | 10-12 cubriendo los 4 estados (≥1 `failed` con `failureReason`) | `${clientSeed}:sched` |
| Generation jobs (backfill) | 4-6 históricos, se siembran cuando el cliente configura su primera key `valid` de un provider de generación | `${clientSeed}:jobs` |

Contenido es-CL realista y fijo en pools: captions ("Llegó stock de la línea eléctrica 🛠️ — despacho a todo Chile"), handles de TERCEROS — competidores y autores de menciones — (`@ferreteria-austral`, `@donremolque.cl`; las cuentas DEL cliente jamás salen de un pool: se derivan del email, D6), hashtags del rubro (`#pymechile`, `#emprendedoreschile`, `#despachoatodochile`), ciudades (Santiago, Valparaíso, Concepción, Temuco). Thumbnails vía `demoAsset(...)`. Timestamps SIEMPRE derivados de `epoch` con `minutesBefore`/offsets de día — nunca `Date.now()` suelto en factories (requisito de determinismo de `tests/fixtures/routes.ts:66-70`).

### D8. Reutilización de `seededRandom`/`now`: promoción a shared

**Decisión: mover, no duplicar ni importar cross-módulo.** `now`, `minutesBefore`, `seededRandom`, `sparklineFrom` se mueven a `src/app/shared/utils/mock-utils.ts` (mismo contenido y JSDoc), y `src/app/modules/observability/mocks/mock-utils.ts` queda como re-export de una línea:

```typescript
export { now, minutesBefore, seededRandom, sparklineFrom } from '../../../shared/utils/mock-utils';
```

Rationale: un import `modules/social → modules/observability` acopla dos features hermanas (nadie esperaría que borrar observability rompa social); duplicar viola la regla #1 del repo. El re-export mantiene los ~15 imports existentes de observability intactos (cero churn en Wave A) y deja el helper donde `shared/utils/mock-latency.ts` ya sentó el precedente. `dailySeries` NO se promueve: es vocabulario del dominio social y vive en `mocks/social-mock-utils.ts`.

### D9. Simulación de progreso de `GenerationJob`

Determinista por id, sin `Math.random()` en el stream:

```typescript
/**
 * watchJob: timer(0, 450) → el job avanza en T ticks donde
 * T = 6 + floor(seededRandom(jobId)() * 5)   (6-10 ticks ≈ 2.7-4.5 s).
 * Curva de progreso NO lineal (rápido al inicio, lento al final —
 * percepción realista): progressPct = round(100 * (1 - (1 - i/T)^2)).
 * Tick 0 emite 'running' con 0 %; el tick T emite el estado terminal.
 * Terminal: seededRandom(`${jobId}:outcome`)() < 0.12 → 'failed' con
 * failureReason del pool (p.ej. 'Cuota del provider excedida — reintentá
 * en unos minutos' | 'El prompt infringe la política de contenido del
 * provider'); si no → 'succeeded' con resultVariants (caption, siempre 3)
 * o resultUrls (image: 4 assets; video: 1 thumbnail + duración).
 * Cada emisión ACTUALIZA también el signal de jobs (la lista del
 * historial refleja el progreso sin re-suscripción). El stream completa
 * tras el estado terminal. takeUntilDestroyed en el consumer.
 */
watchJob(id: string): Observable<GenerationJob> { /* … */ }
```

- `createJob` valida contra `SocialSettingsService`: provider `enabled` + key activa `valid`; falla el Observable con error tipado si no (la UI del Studio deshabilita la opción antes, pero el service es la última línea — el puerto real hará lo mismo con un 403).
- `costEstimateUsd` determinista: tabla fija por `providerId` × `kind` (± jitter seeded) — da realismo de "esto cuesta plata" al pitch de keys por cliente.
- Video: `durationSeconds` se clampa a `capabilities.maxVideoSeconds` en la factory, no en la UI.
- SSR: `watchJob` usa `timer` de rxjs (no `setInterval` crudo); los jobs solo se crean por interacción del usuario → nunca corre en server. No requiere guard adicional.

### D10. Transición `publishNow` → `failed` ocasional

```typescript
/**
 * publishNow: delay(mockLatency(400, 400)) y después transición
 * determinista por post: seededRandom(`${clientSeed}:publish:${postId}`)()
 * < 0.15 → 'failed'; si no → 'published' con publishedAt = ahora.
 * failureReason SIEMPRE accionable y correlacionado con el estado real
 * de settings: si la cuenta destino está 'expired' o 'error' el fallo es
 * seguro (probabilidad 1) con reason 'Token de {red} expirado — reconectá
 * la cuenta en Configuración' (la UI lo deep-linkea a /social/connections).
 * Reintentar el MISMO post falla igual (determinista) hasta que el
 * usuario "arregla" la causa: reconectar la cuenta cambia el estado en
 * settings y el retry pasa — un flujo demo completo de error → fix → ok.
 * Para posts sin causa real, el retry re-seedea con un contador de
 * intento (`:retry:${n}`) → el segundo intento casi siempre pasa.
 */
publishNow(id: string): Observable<ScheduledPost> { /* … */ }
```

Los posts `scheduled` cuyo `scheduledFor` quedó en el pasado NO se auto-publican (no hay backend ni cron): el calendario los muestra como "pendiente de publicar" y `publishNow` es la acción. Documentado en JSDoc como límite consciente del mock.

### D11. Latencias

- Lecturas de analytics/competitors/insights/trends: `mockLatency()` default (skeletons visibles, paridad con el resto del showcase).
- Config (settings, keys, toggles): `mockLatency(200, 300)` — el JSDoc de `mock-latency.ts:11-13` ya sanciona ranges menores para operaciones livianas.
- `verifyKey`: `mockLatency(800, 700)` — verificar una key "sale" a la API externa; la espera vende la validación.
- `connectAccount`/`reconnectAccount`: `mockLatency(1200, 800)` — emula el roundtrip de consentimiento OAuth (RFC-003 D4.3 exige loading ≥1 s en su criterio E2E).
- Mutaciones de publishing: `mockLatency(400, 400)` (paridad con api-keys).

## Alternativas consideradas

1. **DI tokens (`InjectionToken<SocialAnalyticsPort>`) + `provide` en rutas.** Más "hexagonal", pero el repo no usa DI tokens en ningún feature y la regla #1 es consistencia con lo existente. El `implements Port` en la clase concreta da el mismo contrato compilado con cero ceremonia; el swap futuro toca un import por página. **No.**
2. **Un solo `SocialMockService` monolítico.** Observability lo hace con uno para 6 vistas, pero ahí todo es read-only. Acá conviven tres patrones de estado (read-only+epoch, signal mutable, signal+storage) — mezclarlos en una clase rompe la legibilidad del patrón y el precedente users (`users-mock` vs `api-keys-mock` separados justamente por mutabilidad). **No.**
3. **Import cross-módulo `social → observability/mocks/mock-utils`.** Funciona, pero crea acoplamiento entre features hermanas sin relación de dominio. **No** — promoción a shared con re-export (D8).
4. **Duplicar `seededRandom` en social.** Viola "consistencia con lo existente" y bifurca un algoritmo que debe producir resultados idénticos. **No.**
5. **Mocks con `Math.random()` sin seed** (como partes viejas del repo). Rompería `tests/visual/golden-paths.spec.ts` y la reproducibilidad de estados de keys/fallos. **No** — todo seeded, `Math.random()` solo permitido dentro de `mockLatency` (latencia no afecta pixels tras `waitForData`).
6. **Persistir cuentas y datos derivados completos (posts, series) en storage.** Innecesario y frágil (quota, versionado): con seed + epoch los derivados se regeneran idénticos. Solo se persiste `TenantProviderState` (configs, keys enmascaradas, cuentas con `connectedAt`) — RFC-003. **No** al resto.
7. **`dismissed` como campo mutable de `Recommendation`.** Rompe la inmutabilidad de entidades y el patrón del repo (ack de inbox vive en store aparte). **No** — `RecommendationDismissalsStore`.
8. **Progreso de jobs con WebSocket-like fake (`interval` global compartido).** Un scheduler global es estado a nivel módulo (compartido entre requests SSR — el mismo bug que el epoch vino a arreglar). **No** — stream por suscripción, frío, determinista.

## Consecuencias

**Positivas**
- Cinco implementadores de páginas (waves B/C) trabajan contra contratos congelados; los puertos compilados hacen que cualquier drift sea error de build, no de review.
- Multi-tenant real a nivel demo: dos registros distintos ven datos distintos, con cero infraestructura y cero cuentas hardcodeadas; el aislamiento es por construcción (seed).
- Determinismo end-to-end: baselines visuales estables, estados de keys/fallos reproducibles, SSR/CSR coherentes (mismo seed + cookie auth disponible en server).
- El swap a backend es mecánico y está señalizado en el código (`implements Port` + JSDoc "en producción…" en cada service).

**Negativas / deuda aceptada**
- Los puertos devuelven `Observable` (paridad con el repo); si el proyecto migra a `httpResource`, las firmas cambiarán — deuda consciente, igual que en observability.
- `connectAccount` simula OAuth con un click: no demuestra el flujo de redirect real (fuera de alcance por decisión de producto §3 de la investigación).
- Posts `scheduled` vencidos no se auto-publican (sin cron) — límite documentado del mock.
- El estado de settings por cliente convive en un solo browser vía claves namespaced por hash del email — suficiente para demo, no es aislamiento de seguridad (y así se documenta en JSDoc).
- Mover `mock-utils` a shared toca un archivo de observability (re-export) — churn mínimo, pero existe.

## Plan de implementación (todo Wave A, en este orden)

1. **Promoción de helpers:** crear `src/app/shared/utils/mock-utils.ts` (contenido movido) + re-export en `observability/mocks/mock-utils.ts`. Correr `npm test` y `npm run lint` (nada más debe cambiar).
2. **Modelos:** `models/social.interface.ts`, `models/provider.interface.ts`, `models/social.ports.ts` tal como se especifican en D2-D4. Sin lógica, solo tipos + JSDoc en español.
3. **Catálogo:** `mocks/provider-catalog.ts` con los 10 `ProviderDescriptor` (3 connectors, 2 image, 3 video, 2 text), `keyPattern` y `capabilities` completos; `EMPTY_TENANT_STATE`. Los `keyPattern` son la fuente ÚNICA del shape-check (los valores concretos por provider están fijados en RFC-003 D5.2 — la UI valida con `new RegExp(descriptor.keyPattern)`, sin archivo de regex paralelo).
4. **Helpers de dominio:** `mocks/social-mock-utils.ts` (`dailySeries`, pools es-CL, helper `clientHash`). Spec vitest `social-mock-utils.spec.ts`: mismo seed → misma serie; estacionalidad de fin de semana presente; 90 buckets.
5. **Factories:** los nueve archivos de `mocks/` de D1 (incluye `mentions-mock.ts`), cada uno una factory pura `build*Mock(epoch, clientSeed, …)` con los volúmenes de D7 — series de `link-clicks`/`paid-reach` y `reactions` para FB (RFC-004), `topRecentPost` en competidores y menciones (RFC-005) incluidos. Spec de determinismo (dos invocaciones idénticas → deep-equal) y de scoping (dos clientSeeds → handles distintos; handle SIEMPRE derivado del email, cero literales).
6. **Services:** `SocialSettingsService` primero (los otros dependen de él; la mecánica de storage llega de RFC-003 — mientras tanto, estado en memoria detrás de la misma API pública), luego `SocialAnalyticsMockService`, `SocialPublishingMockService`, `SocialGenerationMockService`, `RecommendationDismissalsStore`. Cada uno con el JSDoc de epoch/SSR copiado-adaptado de `observability-mock.service.ts:22-44`.
7. **Specs de services:** `verifyKey` determinista por keyId (umbrales 0.75/0.92); `publishNow` falla seguro con cuenta expired y pasa tras `reconnectAccount`; `watchJob` emite secuencia terminal estable por jobId; `connectAccount` idempotente (mismo id al reconectar); reset por cambio de `clientSeed` en publishing/generation/dismissals (contenido de A invisible para B tras logout/login).
8. **Gate final de la capa:** `npm run verify` completo. Las páginas de Wave A (`social-connections`, `social-providers`) consumen esta capa; sus fixtures/rutas/nav son parte de sus propios entregables, no de este RFC.

## Criterios de aceptación (verificables)

- [ ] `npm run verify` pasa (lint + test + build + bundle:check + smoke) con la capa completa mergeada.
- [ ] **Bundle:** `npm run bundle:check` sin delta sobre el initial chunk (los services solo se referencian desde componentes `loadComponent` lazy; ningún import de `modules/social/**` aparece en `main-*.js` — verificable en el output de build).
- [ ] Cada mock service compila con `implements <Port>` explícito; `tsc` estricto sin `any` ni asserts no justificados.
- [ ] Specs vitest nuevos pasan y cubren: determinismo de `dailySeries` y factories, scoping por `clientSeed` (dos emails → datos distintos; mismo email → idénticos), `verifyKey`/`publishNow`/`watchJob` deterministas, cuenta `expired` a los 7 días (`TOKEN_TTL_MS`, computado en lectura), reset de publishing/generation/dismissals ante cambio de `clientSeed`, estado inicial `EMPTY_TENANT_STATE` sin cuentas ni keys.
- [ ] Grep-gates: cero `Math.random()` en `modules/social/**` fuera de comentarios (la latencia usa `mockLatency`); cero `Date.now()` en factories (`now()` solo en services para capturar epoch); cero acceso a `localStorage`/`document` fuera de `SocialSettingsService` (y ahí con guard `isPlatformBrowser`, mecánica RFC-003).
- [ ] El plaintext de una key existe solo en el retorno de `addKey` — no se persiste ni queda en ningún signal (revisable por búsqueda de usos de `ApiKeyWithPlaintext`).
- [ ] SSR: `npm run test:ssr:smoke` sigue pasando; ninguna factory ni service accede a APIs de browser sin guard.
- [ ] Sin componentes UI nuevos en este RFC → no aplica Storybook ni `tests/fixtures/routes.ts` (los agregan las páginas de Wave A). El pre-seed de `TenantProviderState` para los fixtures con datos está DECIDIDO en RFC-001 D7 (`seedSocialStorage` + `tests/fixtures/social-seed.ts`, entregable de RFC-003): las factories de este RFC deben permanecer puras e importables desde el harness de Playwright (sin Angular) — es un requisito de diseño, no una nota abierta.
- [ ] `docs/adr/README.md` intacto; este RFC referenciado desde los PRs de Wave A.
