import type { Observable } from 'rxjs';

import type {
  ApiKeyEntry,
  ApiKeyWithPlaintext,
  ProviderId,
  ProviderKind,
  TenantProviderState,
} from './provider.interface';
import type {
  AudienceSnapshot,
  BrandMention,
  Competitor,
  CompetitorBenchmark,
  GenerationJob,
  GenerationRequest,
  HashtagPerformance,
  HashtagSuggestion,
  MetricKind,
  MetricSeries,
  PostSummary,
  Recommendation,
  ScheduledPost,
  SocialAccount,
  SocialNetwork,
  Trend,
} from './social.interface';

/**
 * Los seis puertos de la suite social — el contrato compilado de dónde
 * entra el backend real. Cada mock service declara `implements XxxPort`
 * y los componentes inyectan la clase concreta (patrón del repo, sin
 * `InjectionToken`). El swap futuro es mecánico: nuevo
 * `SocialAnalyticsHttpService implements SocialAnalyticsPort` + cambiar
 * el import en los componentes.
 *
 * Regla dura: los componentes de páginas solo dependen de los puertos y
 * las entidades — nunca de detalles internos de los mocks (factories,
 * seeds). Los mocks son detalle de implementación reemplazable.
 *
 * Contrato congelado: RFC-002 D4 (docs/rfcs/rfc-002-modelo-de-dominio-
 * puertos-y-mocks.md). Las referencias `Dn` en los comentarios apuntan a
 * secciones de ese RFC (y de los RFC-003/005 donde se indica).
 */

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
