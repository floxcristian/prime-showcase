import type { AnalyticsConnectorId, ProviderId } from './provider.interface';

/**
 * Modelos de la suite social. Fachada SHOWCASE — el shape replica el
 * vocabulario de las APIs reales (IG/FB Graph, TikTok Business API) para
 * que el adaptador HTTP futuro sea un mapeo 1:1. Tipos inmutables
 * (mismo criterio que observability.interface.ts).
 *
 * Contrato congelado: RFC-002 D2 (docs/rfcs/rfc-002-modelo-de-dominio-
 * puertos-y-mocks.md). Las referencias `Dn` en los comentarios apuntan a
 * secciones de ese RFC (y de los RFC-003/004/005/006 donde se indica).
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
