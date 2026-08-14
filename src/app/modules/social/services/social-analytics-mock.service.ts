// Angular
import { inject, Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';

// Core / shared
import { mockLatency } from '../../../shared/utils/mock-latency';
import { now } from '../../../shared/utils/mock-utils';

// Local
import { buildAudienceMock } from '../mocks/audience-mock';
import {
  buildBenchmarksMock,
  buildCompetitorsMock,
} from '../mocks/competitors-mock';
import { buildHashtagPerformanceMock } from '../mocks/hashtag-performance-mock';
import { buildBrandMentionsMock } from '../mocks/mentions-mock';
import { buildPostsMock } from '../mocks/posts-mock';
import { buildRecommendationsMock } from '../mocks/recommendations-mock';
import { dailySeries } from '../mocks/social-mock-utils';
import {
  buildHashtagSuggestionsMock,
  buildTrendsMock,
} from '../mocks/trends-mock';
import type {
  AudienceSnapshot,
  BrandMention,
  Competitor,
  CompetitorBenchmark,
  HashtagPerformance,
  HashtagSuggestion,
  MetricKind,
  MetricSeries,
  PostSummary,
  Recommendation,
  SocialAccount,
  SocialNetwork,
  Trend,
} from '../models/social.interface';
import type {
  CompetitorPort,
  InsightsPort,
  SocialAnalyticsPort,
} from '../models/social.ports';
import { RecommendationDismissalsStore } from './recommendation-dismissals.store';
import { SocialSettingsService } from './social-settings.service';

/**
 * Receta de una `MetricSeries` (D7): parámetros de `dailySeries` en
 * función de los followers de la cuenta — así los volúmenes escalan con
 * el tamaño (seeded) de cada cliente sin hardcodear magnitudes.
 */
interface SeriesRecipe {
  readonly unit: string; // '' | '%' | 'min'
  readonly base: (followers: number) => number;
  readonly trendPerDay: (followers: number) => number;
  readonly noisePct: number;
  /** Kinds de stock (followers) no oscilan el finde — factor 1 fijo. */
  readonly weekendNeutral?: boolean;
}

/**
 * Parámetros por kind — detalle de implementación del mock (NO contrato:
 * las páginas solo dependen del shape `MetricSeries`). Rangos pensados
 * para una pyme chilena, en paridad con `accounts-mock.ts`.
 */
const SERIES_RECIPES: Readonly<Record<MetricKind, SeriesRecipe>> = {
  followers: {
    unit: '',
    base: (f) => f * 0.97,
    trendPerDay: (f) => f * 0.0004,
    noisePct: 0.004,
    weekendNeutral: true,
  },
  'net-follower-growth': {
    unit: '',
    base: (f) => Math.max(3, f * 0.0015),
    trendPerDay: (f) => f * 0.000004,
    noisePct: 0.5,
  },
  reach: { unit: '', base: (f) => f * 0.32, trendPerDay: (f) => f * 0.0012, noisePct: 0.22 },
  impressions: { unit: '', base: (f) => f * 0.55, trendPerDay: (f) => f * 0.0016, noisePct: 0.22 },
  'engagement-rate': { unit: '%', base: () => 3.4, trendPerDay: () => 0.004, noisePct: 0.18 },
  likes: { unit: '', base: (f) => f * 0.045, trendPerDay: (f) => f * 0.00012, noisePct: 0.3 },
  comments: {
    unit: '',
    base: (f) => Math.max(2, f * 0.006),
    trendPerDay: (f) => f * 0.00002,
    noisePct: 0.4,
  },
  shares: {
    unit: '',
    base: (f) => Math.max(1, f * 0.004),
    trendPerDay: (f) => f * 0.00002,
    noisePct: 0.45,
  },
  saves: {
    unit: '',
    base: (f) => Math.max(1, f * 0.008),
    trendPerDay: (f) => f * 0.00003,
    noisePct: 0.4,
  },
  'profile-visits': { unit: '', base: (f) => f * 0.02, trendPerDay: (f) => f * 0.00008, noisePct: 0.3 },
  'video-views': { unit: '', base: (f) => f * 0.6, trendPerDay: (f) => f * 0.002, noisePct: 0.3 },
  'watch-time': { unit: 'min', base: (f) => f * 0.35, trendPerDay: (f) => f * 0.001, noisePct: 0.28 },
  'completion-rate': { unit: '%', base: () => 42, trendPerDay: () => 0.03, noisePct: 0.12 },
  'link-clicks': {
    unit: '',
    base: (f) => Math.max(2, f * 0.012),
    trendPerDay: (f) => f * 0.00004,
    noisePct: 0.35,
  },
  'paid-reach': { unit: '', base: (f) => f * 0.08, trendPerDay: (f) => f * 0.0004, noisePct: 0.3 },
};

/**
 * Fachada read-only del backend de analítica social — implementa
 * `SocialAnalyticsPort`, `CompetitorPort` e `InsightsPort` (RFC-002
 * D4/D5). Devuelve `Observable` con `delay(mockLatency())` (D11) — al
 * migrar a HTTP real los shapes ya están consolidados en
 * `models/social.interface.ts` y el swap es implementar los mismos
 * puertos.
 *
 * **Ancla temporal por instancia (`epoch`):** los mocks se construyen acá
 * (factories puras de `mocks/*`) anclados al instante de creación del
 * service. Con `providedIn: 'root'`:
 *   - **SSR**: cada request crea un `ApplicationRef` nuevo → instancia
 *     fresca del service → timestamps frescos por request.
 *   - **Browser**: una instancia por sesión → epoch estable → series,
 *     posts y recomendaciones idénticos durante toda la sesión (visual
 *     baselines deterministas).
 *
 * **Backfill on-connect lazy (RFC-002 D6):** TODO deriva de las cuentas
 * conectadas del cliente (`SocialSettingsService.accounts()`). Conectar
 * una cuenta "backfillea" su historia la primera vez que una vista la
 * pide (como los conectores reales al autorizar); las caches `Map` de
 * instancia — por accountId/competitorId/topic, prefijadas con el
 * `clientSeed` para que un cambio de sesión jamás sirva datos del cliente
 * anterior — memoizan el resultado: navegar away+back muestra LOS MISMOS
 * datos. Sin cuentas conectadas, todos los puertos devuelven colecciones
 * vacías → las páginas muestran su empty state con CTA a
 * `/social/connections` (gating de RFC-001).
 *
 * **Regla de degradación:** métodos que devuelven COLECCIONES degradan a
 * `[]` ante cuentas/ids desconocidos; los que devuelven un escalar
 * (`getMetricSeries`, `getAudience`) emiten error — la UI gatea por
 * cuentas antes de pedirlos.
 *
 * Pattern showcase: data inmutable + reactividad delegada a signals
 * (`toSignal()`/`rxResource()` en consumers).
 */
@Injectable({ providedIn: 'root' })
export class SocialAnalyticsMockService
  implements SocialAnalyticsPort, CompetitorPort, InsightsPort
{
  private readonly settings = inject(SocialSettingsService);
  private readonly dismissals = inject(RecommendationDismissalsStore);

  /**
   * Ancla temporal de TODOS los timestamps mock de esta instancia.
   * Público a propósito: las vistas que correlacionan timestamps propios
   * con los de los mocks (ej: recortes 7/30/60 de las series, "hace X
   * min" de recomendaciones y menciones) DEBEN usar este epoch como ancla
   * — es el mismo instante con que se construyeron los mocks, coherencia
   * garantizada por construcción. Un `now()` capturado por componente
   * deriva respecto de los mocks durante sesiones largas.
   */
  readonly epoch: number = now();

  // Caches por instancia (D5) — memoizan el backfill lazy por entidad.
  // Keys SIEMPRE prefijadas con el clientSeed (ver JSDoc de la clase).
  private readonly seriesCache = new Map<string, MetricSeries>();
  private readonly postsCache = new Map<string, readonly PostSummary[]>();
  private readonly audienceCache = new Map<string, AudienceSnapshot>();
  private readonly competitorsCache = new Map<string, readonly Competitor[]>();
  private readonly benchmarksCache = new Map<string, readonly CompetitorBenchmark[]>();
  private readonly recommendationsCache = new Map<string, readonly Recommendation[]>();
  private readonly trendsCache = new Map<string, readonly Trend[]>();
  private readonly suggestionsCache = new Map<string, readonly HashtagSuggestion[]>();
  private readonly performanceCache = new Map<string, readonly HashtagPerformance[]>();
  private readonly mentionsCache = new Map<string, readonly BrandMention[]>();

  /**
   * Snapshot sincrónico de las cuentas del cliente — delega en
   * `SocialSettingsService.accounts()` (el signal con `status` EFECTIVO:
   * expiry por TTL y sync-error computados en lectura, RFC-002 D6). Para
   * vistas que componen mocks DERIVADOS de las cuentas sin pasar por el
   * Observable con latencia. No es un canal de datos alternativo: para
   * listar cuentas usar `getAccounts()`.
   */
  get accountsSnapshot(): readonly SocialAccount[] {
    return this.settings.accounts();
  }

  // ── SocialAnalyticsPort ──────────────────────────────────────────────

  getAccounts(): Observable<readonly SocialAccount[]> {
    return of(this.accountsSnapshot).pipe(delay(mockLatency()));
  }

  getMetricSeries(
    accountId: string,
    kind: MetricKind,
  ): Observable<MetricSeries> {
    const account = this.findAccount(accountId);
    if (!account) {
      return throwError(
        () => new Error(`La cuenta ${accountId} no está conectada.`),
      );
    }
    return of(this.seriesFor(account, kind)).pipe(delay(mockLatency()));
  }

  getTopPosts(accountId: string): Observable<readonly PostSummary[]> {
    const account = this.findAccount(accountId);
    if (!account) {
      return of([] as readonly PostSummary[]).pipe(delay(mockLatency()));
    }
    const posts = this.cached(this.postsCache, account.id, () =>
      buildPostsMock(this.epoch, this.seed(), account.id, account.network),
    );
    return of(posts).pipe(delay(mockLatency()));
  }

  getAudience(accountId: string): Observable<AudienceSnapshot> {
    const account = this.findAccount(accountId);
    if (!account) {
      return throwError(
        () => new Error(`La cuenta ${accountId} no está conectada.`),
      );
    }
    const audience = this.cached(this.audienceCache, account.id, () =>
      buildAudienceMock(this.epoch, this.seed(), account.id, account.network),
    );
    return of(audience).pipe(delay(mockLatency()));
  }

  // ── CompetitorPort ───────────────────────────────────────────────────

  getCompetitors(network: SocialNetwork): Observable<readonly Competitor[]> {
    return of(this.competitorsFor(network)).pipe(delay(mockLatency()));
  }

  getBenchmarks(
    accountId: string,
    competitorId: string,
  ): Observable<readonly CompetitorBenchmark[]> {
    const account = this.findAccount(accountId);
    const competitor = account
      ? this.competitorsFor(account.network).find(
          (candidate) => candidate.id === competitorId,
        )
      : undefined;
    if (!account || !competitor) {
      return of([] as readonly CompetitorBenchmark[]).pipe(delay(mockLatency()));
    }
    const benchmarks = this.cached(
      this.benchmarksCache,
      `${account.id}:${competitor.id}`,
      () => buildBenchmarksMock(this.epoch, this.seed(), account, competitor),
    );
    return of(benchmarks).pipe(delay(mockLatency()));
  }

  // ── InsightsPort ─────────────────────────────────────────────────────

  /** Feed completo (una tanda de 3-4 por cuenta conectada, D7). El
   *  filtrado por "dismissed" es del consumer: `computed` contra
   *  `RecommendationDismissalsStore` — la entidad queda inmutable (D2). */
  getRecommendations(): Observable<readonly Recommendation[]> {
    const recommendations = this.accountsSnapshot.flatMap((account) =>
      this.cached(this.recommendationsCache, account.id, () =>
        buildRecommendationsMock(this.epoch, this.seed(), account),
      ),
    );
    return of(recommendations).pipe(delay(mockLatency()));
  }

  /** Delegado a `RecommendationDismissalsStore` — estado de usuario, en
   *  memoria (en producción: POST /dismissals). Efecto inmediato en el
   *  set; la latencia solo simula el roundtrip del ack. */
  dismissRecommendation(id: string): Observable<void> {
    this.dismissals.dismiss(id);
    return of(undefined).pipe(delay(mockLatency()));
  }

  getHashtagSuggestions(
    topic: string,
    network: SocialNetwork,
  ): Observable<readonly HashtagSuggestion[]> {
    if (!this.hasAccount(network)) {
      return of([] as readonly HashtagSuggestion[]).pipe(delay(mockLatency()));
    }
    // Topic normalizado (D7): mismo topic → misma cache key → mismas chips.
    const normalized = topic.trim().toLowerCase();
    const suggestions = this.cached(
      this.suggestionsCache,
      `${network}:${normalized}`,
      () => buildHashtagSuggestionsMock(this.seed(), normalized, network),
    );
    return of(suggestions).pipe(delay(mockLatency()));
  }

  getHashtagPerformance(
    network: SocialNetwork,
  ): Observable<readonly HashtagPerformance[]> {
    if (!this.hasAccount(network)) {
      return of([] as readonly HashtagPerformance[]).pipe(delay(mockLatency()));
    }
    const performance = this.cached(this.performanceCache, network, () =>
      buildHashtagPerformanceMock(this.epoch, this.seed(), network),
    );
    return of(performance).pipe(delay(mockLatency()));
  }

  getTrends(network: SocialNetwork): Observable<readonly Trend[]> {
    if (!this.hasAccount(network)) {
      return of([] as readonly Trend[]).pipe(delay(mockLatency()));
    }
    const trends = this.cached(this.trendsCache, network, () =>
      buildTrendsMock(this.epoch, this.seed(), network),
    );
    return of(trends).pipe(delay(mockLatency()));
  }

  getBrandMentions(): Observable<readonly BrandMention[]> {
    const networks = this.accountsSnapshot.map((account) => account.network);
    const mentions = this.cached(
      this.mentionsCache,
      [...networks].sort().join(','),
      () => buildBrandMentionsMock(this.epoch, this.seed(), networks),
    );
    return of(mentions).pipe(delay(mockLatency()));
  }

  // ── Derivaciones internas ────────────────────────────────────────────

  private seed(): string {
    return this.settings.clientSeed();
  }

  private findAccount(accountId: string): SocialAccount | undefined {
    return this.accountsSnapshot.find((account) => account.id === accountId);
  }

  private hasAccount(network: SocialNetwork): boolean {
    return this.accountsSnapshot.some((account) => account.network === network);
  }

  /** Memoización canónica: key SIEMPRE prefijada con el clientSeed. */
  private cached<T>(cache: Map<string, T>, key: string, build: () => T): T {
    const scoped = `${this.seed()}:${key}`;
    const hit = cache.get(scoped);
    if (hit !== undefined) {
      return hit;
    }
    const value = build();
    cache.set(scoped, value);
    return value;
  }

  private competitorsFor(network: SocialNetwork): readonly Competitor[] {
    const own = this.accountsSnapshot.find(
      (account) => account.network === network,
    );
    if (!own) {
      return [];
    }
    return this.cached(this.competitorsCache, network, () =>
      buildCompetitorsMock(this.epoch, this.seed(), network, own.followers),
    );
  }

  /**
   * `MetricSeries` determinista (D7): seed
   * `${clientSeed}:series:${accountId}:${kind}`, 90 buckets vía
   * `dailySeries` (weekendFactor <1 para FB corporativo, 1 para kinds de
   * stock). `delta` PRECALCULADO acá comparando la suma de los últimos 30
   * días vs los 30 anteriores — nunca en el componente.
   */
  private seriesFor(account: SocialAccount, kind: MetricKind): MetricSeries {
    return this.cached(this.seriesCache, `${account.id}:${kind}`, () => {
      const recipe = SERIES_RECIPES[kind];
      const weekendFactor = recipe.weekendNeutral
        ? 1
        : account.network === 'facebook'
          ? 0.85
          : 1.25;
      const points = dailySeries(
        this.epoch,
        `${this.seed()}:series:${account.id}:${kind}`,
        recipe.base(account.followers),
        recipe.trendPerDay(account.followers),
        recipe.noisePct,
        weekendFactor,
      );
      const last30 = points
        .slice(60)
        .reduce((total, point) => total + point.v, 0);
      const previous30 = points
        .slice(30, 60)
        .reduce((total, point) => total + point.v, 0);
      const delta =
        previous30 === 0
          ? 0
          : Math.round(((last30 - previous30) / previous30) * 1000) / 10;
      return {
        kind,
        network: account.network,
        accountId: account.id,
        unit: recipe.unit,
        points,
        delta,
      };
    });
  }
}
