import { minutesBefore, seededRandom } from '../../../shared/utils/mock-utils';
import type { BrandMention, SocialNetwork } from '../models/social.interface';
import { SOCIAL_NETWORKS } from '../models/social.interface';
import { MENTION_AUTHOR_HANDLES, MENTION_EXCERPTS } from './social-mock-utils';

/**
 * Factory PURA de menciones de marca (RFC-002 D1/D2/D7 — consumida por la
 * sección "trend discovery" de social-trends, RFC-005 D6). Lista FINITA
 * determinista — NO listening en tiempo real. Sin Angular ni side effects,
 * importable desde el harness de Playwright (RFC-001 D7).
 *
 * **Volúmenes D7:** 4-5 menciones por red CONECTADA, máx. 15 total, seed
 * único `${clientSeed}:mentions`. Autores y excerpts salen de los pools
 * es-CL de TERCEROS de `social-mock-utils` (regla de identidad D6).
 *
 * **Mix de sentiments garantizado por round-robin (D7):** el ciclo fijo
 * positive → neutral → negative sobre el índice global asegura los tres
 * sentiments con ≥3 menciones. El excerpt se elige del sub-pool cuyo TONO
 * coincide con el sentiment asignado (clasificación local
 * `EXCERPT_TONES`) — el round-robin sigue mandando el mix; la
 * clasificación solo evita el chiste involuntario de un "Recomendadísimos"
 * etiquetado negative. Con pocos excerpts por tono puede repetirse texto
 * entre redes/autores distintos — aceptado (mock curado).
 *
 * **Determinismo:** timestamps solo desde `epoch` con offsets crecientes
 * (`minutesBefore`) — cero `Date.now()`/`Math.random()`; salida ordenada
 * de la más reciente a la más vieja, intercalando redes. El set de
 * `networks` se normaliza al orden canónico de `SOCIAL_NETWORKS` (y se
 * dedupe) → el resultado no depende del orden del array de entrada.
 * `permalink: '#'` — mock, sin post real detrás.
 */

/** Ciclo fijo del round-robin de sentiments (D7). */
const SENTIMENT_CYCLE: readonly BrandMention['sentiment'][] = [
  'positive',
  'neutral',
  'negative',
];

/**
 * Tono editorial de cada excerpt de `MENTION_EXCERPTS`, por índice.
 * Acoplado por posición al pool (que declara que el sentiment lo asigna
 * la factory) — si el pool crece, los índices nuevos caen a 'neutral'.
 */
const EXCERPT_TONES: readonly BrandMention['sentiment'][] = [
  'positive', // Llegó rapidísimo el pedido…
  'neutral', // ¿Alguien ha comprado acá?…
  'negative', // La atención por DM fue lenta…
  'positive', // Buenos precios comparado con el retail…
  'neutral', // El producto llegó con un detalle… me lo cambiaron sin drama.
  'positive', // Recomendadísimos…
  'negative', // Ojo con los tiempos de despacho en fechas peak…
  'positive', // Me encantó el video del detrás de escena…
  'negative', // El manual venía solo en inglés…
  'positive', // Compré para regalar y llegó impecable…
];

/** Índices de `MENTION_EXCERPTS` agrupados por tono (derivado, module-init). */
const EXCERPT_BUCKETS: Readonly<Record<BrandMention['sentiment'], readonly number[]>> = {
  positive: MENTION_EXCERPTS.map((_, i) => i).filter((i) => (EXCERPT_TONES[i] ?? 'neutral') === 'positive'),
  neutral: MENTION_EXCERPTS.map((_, i) => i).filter((i) => (EXCERPT_TONES[i] ?? 'neutral') === 'neutral'),
  negative: MENTION_EXCERPTS.map((_, i) => i).filter((i) => (EXCERPT_TONES[i] ?? 'neutral') === 'negative'),
};

/** Tope duro de D7 — 3 redes × 5 ya lo respeta por construcción. */
const MAX_MENTIONS = 15;

/**
 * Construye las menciones recientes deterministas del cliente para sus
 * redes conectadas. Sin cuentas conectadas (`networks` vacío) → `[]` —
 * la página muestra su empty state (gating de RFC-001).
 */
export const buildBrandMentionsMock = (
  epoch: number,
  clientSeed: string,
  networks: readonly SocialNetwork[],
): readonly BrandMention[] => {
  // Normalización: orden canónico + dedupe → mismo set, mismo resultado.
  const connected = SOCIAL_NETWORKS.filter((n) => networks.includes(n));
  if (connected.length === 0) {
    return [];
  }

  const rand = seededRandom(`${clientSeed}:mentions`);
  // Draws en orden fijo: 1 count por red conectada (orden canónico) → offset de autores.
  const counts = new Map<SocialNetwork, number>(
    connected.map((n) => [n, 4 + (rand() < 0.5 ? 0 : 1)]),
  );
  const authorOffset = Math.floor(rand() * MENTION_AUTHOR_HANDLES.length);

  const mentions: BrandMention[] = [];
  const bucketCursor: Record<BrandMention['sentiment'], number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  // Intercalado por "vueltas": una mención por red y vuelta → la lista
  // queda cronológicamente mezclada entre redes, no agrupada.
  const maxPerNetwork = Math.max(...counts.values());
  for (let round = 0; round < maxPerNetwork; round++) {
    for (const network of connected) {
      if (round >= (counts.get(network) ?? 0) || mentions.length >= MAX_MENTIONS) {
        continue;
      }
      const g = mentions.length; // índice global — motor del round-robin
      const sentiment = SENTIMENT_CYCLE[g % SENTIMENT_CYCLE.length] ?? 'neutral';
      const bucket = EXCERPT_BUCKETS[sentiment];
      const excerptIdx =
        bucket.length > 0 ? (bucket[bucketCursor[sentiment]++ % bucket.length] ?? 0) : g % MENTION_EXCERPTS.length;

      mentions.push({
        id: `mention-${network}-${round + 1}`,
        network,
        authorHandle:
          MENTION_AUTHOR_HANDLES[(authorOffset + g) % MENTION_AUTHOR_HANDLES.length] ?? '@cliente',
        excerpt: MENTION_EXCERPTS[excerptIdx] ?? '',
        sentiment,
        // Edad creciente con jitter acotado (< paso de 620 min) → orden
        // estrictamente descendente por construcción, ~última semana.
        mentionedAt: minutesBefore(epoch, 90 + g * 620 + Math.floor(rand() * 240)),
        permalink: '#',
      });
    }
  }

  return mentions;
};
