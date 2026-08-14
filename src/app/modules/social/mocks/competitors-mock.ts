import { demoAsset } from '../../../shared/constants/demo-assets';
import { minutesBefore, seededRandom } from '../../../shared/utils/mock-utils';
import type {
  Competitor,
  CompetitorBenchmark,
  MetricKind,
  PostFormat,
  SocialAccount,
  SocialNetwork,
} from '../models/social.interface';
import { CAPTION_POOL, COMPETITOR_POOLS, dailySeries } from './social-mock-utils';

/**
 * Factories PURAS de competencia (RFC-002 D1/D2/D7 — D1 asigna AMBAS a
 * este archivo): `buildCompetitorsMock` (3 perfiles por red) y
 * `buildBenchmarksMock` (panel own-vs-competitor). Sin Angular ni side
 * effects — importables desde el harness de Playwright (RFC-001 D7).
 *
 * **Identidad (D6/D7):** los competidores son TERCEROS — handles/nombres
 * salen del pool curado es-CL `COMPETITOR_POOLS`; jamás se derivan del
 * email del cliente. Los números sí son por-cliente (seed
 * `${clientSeed}:comp:${network}`) — dos clientes ven cifras distintas del
 * mismo tercero, coherente con "cada cliente trackea su propio mercado".
 *
 * **Contratos precomputados (D2):** `shareOfVoicePct` de los 3 competidores
 * suma 100 CON la cuenta propia (reparto proporcional a followers, resto
 * mayor) — la UI deriva el share propio como `100 − Σ competidores`;
 * `topRecentPost` viene incluido (RFC-005 D4.1, caption recortada a ~80
 * chars, sin permalink real); sentiment es mock estático (badge, sin NLP).
 * En benchmarks, `position`/`gapPct` se PRECOMPUTAN acá — nunca calcular
 * posición en el template (grep-gate de RFC-005).
 *
 * **Determinismo:** timestamps solo desde `epoch` (`minutesBefore`,
 * `dailySeries`) — cero `Date.now()`/`Math.random()`. El orden de
 * extracción de cada PRNG es parte del contrato.
 */

/** Formatos plausibles por red para `topFormats`/`topRecentPost`. */
const FORMAT_POOLS: Readonly<Record<SocialNetwork, readonly PostFormat[]>> = {
  instagram: ['reel', 'carousel', 'image'],
  facebook: ['image', 'video', 'text'],
  tiktok: ['video'],
};

/** Avatares demo por red — offsets fijos → los 9 competidores (3 redes ×
 *  3 perfiles) usan avatares globalmente distintos. */
const AVATAR_FILES: readonly string[] = [
  'avatar2.png',
  'avatar5.png',
  'avatar6.png',
  'avatar7.png',
  'avatar8.png',
  'avatar9.jpg',
  'avatar10.jpg',
  'avatar12.jpg',
  'avatar13.jpg',
];
const AVATAR_OFFSETS: Readonly<Record<SocialNetwork, number>> = {
  instagram: 0,
  facebook: 3,
  tiktok: 6,
};

/** Métricas del panel own-vs-competitor por red (5-6 por par, D7) —
 *  vocabulario real de cada API (RFC-002 D2). */
const BENCHMARK_METRICS: Readonly<Record<SocialNetwork, readonly MetricKind[]>> = {
  instagram: ['followers', 'engagement-rate', 'reach', 'impressions', 'saves', 'profile-visits'],
  facebook: ['followers', 'engagement-rate', 'reach', 'impressions', 'link-clicks', 'paid-reach'],
  tiktok: ['followers', 'engagement-rate', 'video-views', 'watch-time', 'completion-rate', 'shares'],
};

/** Unidad por métrica (contrato `unit` de D2: '' | '%' | 's'). */
const METRIC_UNITS: Readonly<Record<MetricKind, string>> = {
  followers: '',
  'net-follower-growth': '',
  reach: '',
  impressions: '',
  'engagement-rate': '%',
  likes: '',
  comments: '',
  shares: '',
  saves: '',
  'profile-visits': '',
  'video-views': '',
  'watch-time': 's',
  'completion-rate': '%',
  'link-clicks': '',
  'paid-reach': '',
};

/** Umbral de empate: |gapPct| ≤ 2 → 'even' (evita "ahead" por decimales). */
const EVEN_THRESHOLD_PCT = 2;

/** Redondeo a 1 decimal — porcentajes y segundos precalculados. */
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** `@handle` → slug seguro para ids (`@donremolque.cl` → `donremolque-cl`). */
const slug = (handle: string): string =>
  handle.replace(/^@/, '').replace(/[^a-z0-9]+/g, '-');

/** Caption recortada a ~80 chars con elipsis (contrato de `CompetitorTopPost`). */
const truncate = (s: string, max = 80): string =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

/**
 * Reparte 100 puntos enteros proporcionales a `weights` (resto mayor,
 * sort estable → determinista). Reusado para share of voice y sentiment.
 */
const pctSplit = (weights: readonly number[]): readonly number[] => {
  const total = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (w / total) * 100);
  const floors = exact.map(Math.floor);
  const remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => [v - (floors[i] ?? 0), i] as const)
    .sort((a, b) => b[0] - a[0]);
  const out = [...floors];
  for (let k = 0; k < remainder; k++) {
    const idx = order[k]?.[1] ?? 0;
    out[idx] = (out[idx] ?? 0) + 1;
  }
  return out;
};

/**
 * Valores de TODAS las métricas (ventana ~30 días) para un perfil, en el
 * ORDEN de declaración de `MetricKind` — el orden de draws es contrato.
 * `engagementRate` se respeta si viene dado (perfil competidor: su
 * `avgEngagementRate` — coherencia tabla ↔ panel, RFC-005 D4).
 */
const buildMetricValues = (
  rand: () => number,
  followers: number,
  engagementRate?: number,
): Readonly<Record<MetricKind, number>> => {
  const netGrowth = Math.round(followers * (0.005 + rand() * 0.03));
  const reach = Math.round(followers * (1.5 + rand() * 3));
  const impressions = Math.round(reach * (1.2 + rand() * 0.5));
  const er = engagementRate ?? round1(1.5 + rand() * 6);
  const likes = Math.round(reach * (0.04 + rand() * 0.05));
  return {
    followers,
    'net-follower-growth': netGrowth,
    reach,
    impressions,
    'engagement-rate': er,
    likes,
    comments: Math.round(likes * (0.06 + rand() * 0.1)),
    shares: Math.round(likes * (0.05 + rand() * 0.1)),
    saves: Math.round(likes * (0.08 + rand() * 0.15)),
    'profile-visits': Math.round(followers * (0.2 + rand() * 0.4)),
    'video-views': Math.round(followers * (2 + rand() * 8)),
    'watch-time': round1(8 + rand() * 27),
    'completion-rate': round1(20 + rand() * 50),
    'link-clicks': Math.round(impressions * (0.008 + rand() * 0.02)),
    'paid-reach': Math.round(reach * (0.15 + rand() * 0.25)),
  };
};

/**
 * Construye los 3 competidores deterministas de `network` para el cliente.
 * `ownFollowers` (los followers de la cuenta propia en esa red) ancla dos
 * cosas: los tamaños de los terceros (0.6×-2.5× → siempre hay mezcla de
 * "más grande/más chico que yo") y el reparto de share of voice.
 */
export const buildCompetitorsMock = (
  epoch: number,
  clientSeed: string,
  network: SocialNetwork,
  ownFollowers: number,
): readonly Competitor[] => {
  const rand = seededRandom(`${clientSeed}:comp:${network}`);
  const pool = COMPETITOR_POOLS[network];
  const poolOffset = Math.floor(rand() * pool.length);
  const formats = FORMAT_POOLS[network];

  // Fase 1 — perfiles sin SoV (el reparto necesita los 3 followers listos).
  const drafts = Array.from({ length: 3 }, (_, k) => {
    const seed = pool[(poolOffset + k) % pool.length] ?? { handle: '@competidor', name: 'Competidor' };
    const followers = Math.max(200, Math.round(ownFollowers * (0.6 + rand() * 1.9)));
    const avgEngagementRate = round1(1.5 + rand() * 6);
    const postsPerWeek = 2 + Math.floor(rand() * 8);

    const formatOffset = Math.floor(rand() * formats.length);
    const topFormats: readonly PostFormat[] =
      formats.length === 1
        ? formats
        : [formats[formatOffset], formats[(formatOffset + 1) % formats.length]].filter(
            (f): f is PostFormat => f !== undefined,
          );

    const id = `comp-${network}-${slug(seed.handle)}`;

    // Serie de followers 90d anclada al valor actual: base + trend·89 ≈
    // followers de hoy. weekendFactor 1 (los followers no oscilan el finde).
    const trendPerDay = followers * (rand() * 0.003 - 0.0005);
    const followersSeries = dailySeries(
      epoch,
      `${clientSeed}:comp:${network}:${id}:followers`,
      followers - trendPerDay * 89,
      trendPerDay,
      0.01,
      1,
    );

    const sentimentPcts = pctSplit([40 + rand() * 30, 20 + rand() * 15, 5 + rand() * 15]);

    const topRecentPost = {
      caption: truncate(CAPTION_POOL[Math.floor(rand() * CAPTION_POOL.length)] ?? ''),
      format: topFormats[0] ?? 'image',
      engagementRate: round1(avgEngagementRate * (1.3 + rand() * 1.2)),
      publishedAt: minutesBefore(epoch, (1 + Math.floor(rand() * 27)) * 1440 + Math.floor(rand() * 720)),
    };

    return {
      id,
      name: seed.name,
      network,
      handle: seed.handle,
      avatarUrl: demoAsset(AVATAR_FILES[AVATAR_OFFSETS[network] + k] ?? 'avatar2.png'),
      followers,
      followersSeries,
      avgEngagementRate,
      postsPerWeek,
      topFormats,
      sentiment: {
        positivePct: sentimentPcts[0] ?? 0,
        neutralPct: sentimentPcts[1] ?? 0,
        negativePct: sentimentPcts[2] ?? 0,
      },
      topRecentPost,
    };
  });

  // Fase 2 — share of voice proporcional a followers, la cuenta propia
  // incluida en el reparto: Σ(3 competidores) + share propio = 100.
  const sovShares = pctSplit([ownFollowers, ...drafts.map((d) => d.followers)]);

  return drafts.map((draft, k) => ({
    ...draft,
    shareOfVoicePct: sovShares[k + 1] ?? 0,
  }));
};

/**
 * Construye los 6 benchmarks own-vs-competitor del par (D7: 5-6 por par,
 * seed `${clientSeed}:bench:${accountId}:${competitorId}`).
 *
 * Recibe las ENTIDADES (no ids) para que el panel sea coherente con lo que
 * la tabla ya muestra: `followers` propios = `account.followers`,
 * `followers`/`engagement-rate` del competidor = los del `Competitor`.
 * Los valores PROPIOS seeded usan el sub-seed `${clientSeed}:bench:${accountId}`
 * (sin competitorId): al cambiar de competidor seleccionado, la columna
 * "own" NO cambia — mismo rationale que el precompute de `position`.
 *
 * `epoch` se acepta por uniformidad de firma (`build*Mock(epoch,
 * clientSeed, …)`) pero no se consume: los benchmarks no llevan timestamps.
 */
export const buildBenchmarksMock = (
  epoch: number,
  clientSeed: string,
  account: SocialAccount,
  competitor: Competitor,
): readonly CompetitorBenchmark[] => {
  const ownRand = seededRandom(`${clientSeed}:bench:${account.id}`);
  const pairRand = seededRandom(`${clientSeed}:bench:${account.id}:${competitor.id}`);

  const ownValues = buildMetricValues(ownRand, account.followers);
  const competitorValues = buildMetricValues(
    pairRand,
    competitor.followers,
    competitor.avgEngagementRate,
  );

  return BENCHMARK_METRICS[account.network].map((metric) => {
    const own = ownValues[metric];
    const comp = competitorValues[metric];
    // gapPct con signo: >0 = el cliente adelante. PRECOMPUTADO (D2).
    const gapPct = comp === 0 ? 0 : round1(((own - comp) / comp) * 100);
    const position: CompetitorBenchmark['position'] =
      gapPct > EVEN_THRESHOLD_PCT ? 'ahead' : gapPct < -EVEN_THRESHOLD_PCT ? 'behind' : 'even';
    return {
      metric,
      unit: METRIC_UNITS[metric],
      own,
      competitor: comp,
      competitorId: competitor.id,
      position,
      gapPct,
    };
  });
};
