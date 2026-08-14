import { seededRandom } from '../../../shared/utils/mock-utils';
import type {
  HashtagSuggestion,
  SocialNetwork,
  Trend,
} from '../models/social.interface';
import { dailySeries, HASHTAG_POOL } from './social-mock-utils';

/**
 * Factories PURAS de tendencias y sugerencias de hashtags (RFC-002 D2/D7,
 * consumidas por social-trends y por el composer del planner — RFC-005 D6/D7
 * y RFC-006 D6.3). Sin Angular ni side effects — importables desde el
 * harness de Playwright (RFC-001 D7).
 *
 * Este archivo exporta DOS factories porque así lo fija RFC-002 D1
 * (`trends-mock.ts ← buildTrendsMock + buildHashtagSuggestionsMock`) —
 * excepción sancionada a "un export por archivo" de AGENTS.md.
 *
 * **Contenido curado es-CL fijo (D7):** los títulos/kinds de tendencias son
 * datos de MERCADO, iguales para todos los clientes — lo que varía por
 * cliente (seed `${clientSeed}:trend:${network}`) es cuántas ve, el
 * momentum y las series de volumen. En TikTok los `kind: 'audio'` van
 * primero en el pool: RFC-005 D6 los agrupa bajo "Sonidos en tendencia" y
 * deben sobrevivir al recorte de count.
 */

interface TrendSeed {
  readonly title: string;
  readonly kind: Trend['kind'];
  /** '#' mock (mismo criterio que BrandMention.permalink) — solo donde
   *  "ver el ejemplo" tiene sentido (audios, challenges). */
  readonly exampleUrl?: string;
}

/** Pool curado por red — ≥8 entries c/u (count 6-8 recorta del inicio). */
const TREND_POOLS: Readonly<Record<SocialNetwork, readonly TrendSeed[]>> = {
  instagram: [
    { title: 'Formato: carrusel "antes y después"', kind: 'format' },
    { title: 'Audio: cumbia chilena speed-up', kind: 'audio', exampleUrl: '#' },
    { title: 'Tema: compras con sentido local', kind: 'topic' },
    { title: 'Formato: Reel de proceso en 15 s', kind: 'format' },
    { title: 'Challenge: #MiPymeEn30Segundos', kind: 'challenge', exampleUrl: '#' },
    { title: 'Tema: precios transparentes sin DM', kind: 'topic' },
    { title: 'Audio: voz en off "lo que nadie te dice"', kind: 'audio', exampleUrl: '#' },
    { title: 'Formato: fotos con texto grande tipo cartel', kind: 'format' },
  ],
  facebook: [
    { title: 'Tema: despacho a regiones en 48 horas', kind: 'topic' },
    { title: 'Formato: publicaciones con lista de precios', kind: 'format' },
    { title: 'Tema: historias de clientes reales', kind: 'topic' },
    { title: 'Formato: video en vivo de liquidación', kind: 'format' },
    { title: 'Tema: comparativas retail vs pyme', kind: 'topic' },
    { title: 'Challenge: recomendá una pyme de tu comuna', kind: 'challenge', exampleUrl: '#' },
    { title: 'Formato: álbum de catálogo por temporada', kind: 'format' },
    { title: 'Tema: retiro en tienda el mismo día', kind: 'topic' },
  ],
  tiktok: [
    { title: 'Audio: corrido tumbado remix', kind: 'audio', exampleUrl: '#' },
    { title: 'Audio: "no era penal" viral CL', kind: 'audio', exampleUrl: '#' },
    { title: 'Audio: trend de transición con chasquido', kind: 'audio', exampleUrl: '#' },
    { title: 'Formato: POV bodega', kind: 'format' },
    { title: 'Challenge: #EmprendedorEnUnDia', kind: 'challenge', exampleUrl: '#' },
    { title: 'Formato: empaquetado de pedidos ASMR', kind: 'format' },
    { title: 'Tema: cuánto cuesta armar tu negocio', kind: 'topic' },
    { title: 'Formato: responder comentarios con video', kind: 'format' },
  ],
};

/** Orden canónico de rotación de momentum — offset seeded garantiza
 *  variedad de badges (rising/peaking/declining) en el grid. */
const MOMENTUMS: readonly Trend['momentum'][] = ['rising', 'peaking', 'declining'];

/** Pendiente diaria coherente con el momentum — el sparkline debe contar la
 *  misma historia que el badge (rising sube, declining baja). */
const trendPerDay = (momentum: Trend['momentum'], base: number): number => {
  if (momentum === 'rising') {
    return base * 0.012;
  }
  if (momentum === 'declining') {
    return -base * 0.008;
  }
  return base * 0.001; // peaking: meseta
};

/**
 * Construye las tendencias deterministas de `network` para el cliente.
 * Volumen D7: 6-8 por red. Las series de volumen son SIEMPRE 30 buckets
 * diarios anclados al epoch (contrato D2) — se derivan de `dailySeries`
 * (90 buckets) recortando los últimos 30, reutilizando su estacionalidad
 * (finde deprimido en FB corporativo, amplificado en IG/TikTok).
 */
export const buildTrendsMock = (
  epoch: number,
  clientSeed: string,
  network: SocialNetwork,
): readonly Trend[] => {
  // Orden de extracción del PRNG (contrato de determinismo): count →
  // momentumOffset → por trend: base → windowDays.
  const rand = seededRandom(`${clientSeed}:trend:${network}`);
  const count = 6 + Math.floor(rand() * 3); // 6-8 (D7)
  const momentumOffset = Math.floor(rand() * MOMENTUMS.length);
  const pool = TREND_POOLS[network];
  const weekendFactor = network === 'facebook' ? 0.85 : 1.3;

  return Array.from({ length: count }, (_, i) => {
    const seed = pool[i % pool.length];
    const momentum = MOMENTUMS[(momentumOffset + i) % MOMENTUMS.length];
    const base = 500 + Math.floor(rand() * 7500); // posts/día estimados
    const windowDays = 7 + Math.floor(rand() * 22); // 1-4 semanas de vigencia

    const volumeSeries = dailySeries(
      epoch,
      `${clientSeed}:trend:${network}:vol:${i}`,
      base,
      trendPerDay(momentum, base),
      0.15,
      weekendFactor,
    ).slice(60); // últimos 30 días (D2: volumeSeries = 30 buckets)

    return {
      id: `trend-${network}-${i + 1}`,
      network,
      title: seed.title,
      kind: seed.kind,
      momentum,
      volumeSeries,
      ...(seed.exampleUrl !== undefined ? { exampleUrl: seed.exampleUrl } : {}),
      windowDays,
    };
  });
};

// ── Sugerencias de hashtags ──────────────────────────────────────────

/** Rotación de difficulty — garantiza que los tres grupos Later-style
 *  (alto/medio/nicho, RFC-005 D7) siempre tengan chips. */
const DIFFICULTIES: readonly HashtagSuggestion['difficulty'][] = ['high', 'medium', 'low'];

/** Volumen (posts/día) coherente con la difficulty — la segmentación de la
 *  UI se deriva de esta correlación (D2: difficulty ↔ volume). */
const VOLUME_RANGES: Readonly<
  Record<HashtagSuggestion['difficulty'], readonly [number, number]>
> = {
  high: [50_000, 180_000],
  medium: [8_000, 48_000],
  low: [500, 7_500],
};

/** Topic normalizado → tag base `[a-z0-9]` (sin '#', forma canónica D2):
 *  quita tildes vía NFD y descarta el resto. Fallback si queda vacío. */
const slugTag = (normalizedTopic: string): string => {
  const sane = normalizedTopic
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return sane.length > 0 ? sane : 'contenido';
};

const intBetween = (rand: () => number, range: readonly [number, number]): number =>
  range[0] + Math.floor(rand() * (range[1] - range[0] + 1));

/**
 * Construye las sugerencias deterministas para `topic` en `network`
 * (9-12, D7). El topic se NORMALIZA `trim().toLowerCase()` ANTES de armar
 * el seed `${clientSeed}:hashtag:${network}:${topic}` → "  Ferretería " y
 * "ferretería" producen exactamente las mismas chips (requisito D7; el
 * service memoiza por el mismo topic normalizado).
 *
 * Sin parámetro `epoch` — desviación consciente de la firma genérica
 * `build*Mock(epoch, clientSeed, …)` del plan §5: `HashtagSuggestion` no
 * tiene timestamps ni series, todo se deriva del seed puro.
 */
export const buildHashtagSuggestionsMock = (
  clientSeed: string,
  topic: string,
  network: SocialNetwork,
): readonly HashtagSuggestion[] => {
  const normalized = topic.trim().toLowerCase();
  // Orden de extracción del PRNG (contrato): count → diffOffset →
  // poolStart → por item: volume → relevance → delta.
  const rand = seededRandom(`${clientSeed}:hashtag:${network}:${normalized}`);
  const count = 9 + Math.floor(rand() * 4); // 9-12 (D7)
  const diffOffset = Math.floor(rand() * DIFFICULTIES.length);
  const poolStart = Math.floor(rand() * HASHTAG_POOL.length);

  // Candidatos: variantes derivadas del topic primero (más relevantes),
  // después el pool del rubro rotado desde un offset seeded. Dedupe por si
  // el topic coincide con un tag del pool.
  const base = slugTag(normalized);
  const variants = [
    base,
    `${base}chile`,
    `${base}cl`,
    `tips${base}`,
    `${base}online`,
    `oferta${base}`,
  ];
  const rotatedPool = HASHTAG_POOL.map(
    (_, i) => HASHTAG_POOL[(poolStart + i) % HASHTAG_POOL.length],
  );
  const candidates = [...new Set([...variants, ...rotatedPool])];
  const tags = candidates.slice(0, count);
  const variantCount = variants.filter((v) => tags.includes(v)).length;

  return tags.map((tag, i) => {
    const difficulty = DIFFICULTIES[(diffOffset + i) % DIFFICULTIES.length];
    const volume = intBetween(rand, VOLUME_RANGES[difficulty]);
    // Las variantes del topic puntúan más alto que los tags genéricos del
    // rubro — el recomendador ordena por relevanceScore.
    const relevanceScore =
      i < variantCount ? 70 + Math.floor(rand() * 29) : 40 + Math.floor(rand() * 45);
    const trendDelta = Math.round(rand() * 85 - 25); // % 7d, −25..+60
    // Relacionados: los 3 candidatos siguientes en la lista (sin sí mismo)
    // — determinista sin consumir PRNG.
    const relatedTags = Array.from(
      { length: 3 },
      (_, k) => candidates[(i + k + 1) % candidates.length],
    );

    return {
      tag,
      network,
      volume,
      difficulty,
      relevanceScore,
      trendDelta,
      relatedTags,
    };
  });
};
