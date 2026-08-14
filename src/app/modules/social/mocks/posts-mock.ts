import { demoAsset } from '../../../shared/constants/demo-assets';
import { minutesBefore, seededRandom } from '../../../shared/utils/mock-utils';
import type { PostFormat, PostSummary, SocialNetwork } from '../models/social.interface';
import { CAPTION_POOL, HASHTAG_POOL } from './social-mock-utils';

/**
 * Factory PURA de posts históricos de una cuenta del cliente (RFC-002 D1/
 * D2/D7). Sin Angular ni side effects — importable desde el harness de
 * Playwright (`tests/fixtures/social-seed.ts`, RFC-001 D7).
 *
 * **Volúmenes D7:** 12-18 posts por cuenta, seed
 * `${clientSeed}:posts:${accountId}`. Contenido es-CL de los pools de
 * `social-mock-utils` (`CAPTION_POOL`, `HASHTAG_POOL` — acá se antepone
 * el `#` al materializar), thumbnails vía `demoAsset(...)`.
 *
 * **Contratos precalculados en factory (D2):** `engagementRate` se computa
 * ACÁ ((likes+comments+shares+saves)/reach × 100) — nunca en el template;
 * `videoViews`/`avgWatchTimeSec`/`completionRatePct` SOLO en formats
 * video/reel; `reactions` SOLO en network 'facebook' (la vista FB agrega
 * los top posts client-side para el donut, RFC-004 D6).
 *
 * **Determinismo:** timestamps derivados exclusivamente de `epoch` con
 * offsets (`minutesBefore`) — cero `Date.now()`/`Math.random()`. El orden
 * de extracción del PRNG por post es parte del contrato: format → jitter
 * de fecha → métricas → extras condicionales → hashtags → thumbnail.
 * `permalink: '#'` — mock, sin post real detrás.
 */

/** Formatos plausibles por red — TikTok es solo video por naturaleza. */
const FORMAT_POOLS: Readonly<Record<SocialNetwork, readonly PostFormat[]>> = {
  instagram: ['reel', 'carousel', 'image', 'story'],
  facebook: ['image', 'video', 'text', 'carousel'],
  tiktok: ['video'],
};

/** Rango de reach por post según red (pyme chilena — paridad con los
 *  rangos de followers de `accounts-mock.ts`). */
const REACH_RANGES: Readonly<Record<SocialNetwork, readonly [number, number]>> = {
  instagram: [900, 14000],
  facebook: [600, 9000],
  tiktok: [1500, 45000],
};

/** Assets demo reutilizados como thumbnails (mismo CDN que chat/inbox). */
const THUMBNAIL_FILES: readonly string[] = [
  'chat-image1.png',
  'chat-image2.png',
  'chat-image3.png',
  'chat-image4.png',
  'chat-image5.png',
  'message-image.png',
];

/** Orden fijo de tipos de reacción FB (vocabulario de Graph API). */
const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;

/** Pesos relativos de cada tipo de reacción sobre el total de likes. */
const REACTION_WEIGHTS: readonly number[] = [0.62, 0.18, 0.08, 0.06, 0.04, 0.02];

/** Entero determinista en `[min, max]` desde el PRNG seedeado. */
const intBetween = (rand: () => number, range: readonly [number, number]): number =>
  range[0] + Math.floor(rand() * (range[1] - range[0] + 1));

/** Redondeo a 1 decimal — para porcentajes precalculados. */
const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Construye los 12-18 posts históricos deterministas de `accountId`.
 * El backfill on-connect (D6) los genera lazy la primera vez que la vista
 * de analytics los pide; el orden de salida es del más nuevo al más viejo.
 */
export const buildPostsMock = (
  epoch: number,
  clientSeed: string,
  accountId: string,
  network: SocialNetwork,
): readonly PostSummary[] => {
  const rand = seededRandom(`${clientSeed}:posts:${accountId}`);
  const count = 12 + Math.floor(rand() * 7); // 12-18 (D7)
  const captionOffset = Math.floor(rand() * CAPTION_POOL.length);
  const formats = FORMAT_POOLS[network];

  return Array.from({ length: count }, (_, i) => {
    const format = formats[Math.floor(rand() * formats.length)] ?? 'image';

    // Espaciado ~3 días por post + jitter: el post i vive en los días
    // [3i, 3i+2] hacia atrás → estrictamente descendente por construcción.
    const daysBack = i * 3 + Math.floor(rand() * 3);
    const minutesJitter = Math.floor(rand() * 12 * 60);
    const publishedAt = minutesBefore(epoch, daysBack * 1440 + minutesJitter);

    // Métricas base — reach ≤ impressions siempre.
    const reach = intBetween(rand, REACH_RANGES[network]);
    const impressions = Math.round(reach * (1.1 + rand() * 0.5));
    const likes = Math.round(reach * (0.03 + rand() * 0.07));
    const comments = Math.round(likes * (0.05 + rand() * 0.13));
    const shares = Math.round(likes * (0.03 + rand() * 0.09));
    const saves = Math.round(likes * (0.05 + rand() * 0.2));
    // PRECALCULADO en factory (D2) — el template solo formatea.
    const engagementRate = round1(((likes + comments + shares + saves) / reach) * 100);

    const isVideo = format === 'video' || format === 'reel';
    const videoExtras = isVideo
      ? {
          videoViews: Math.round(impressions * (0.7 + rand() * 0.25)),
          avgWatchTimeSec: intBetween(rand, [6, 42]),
          completionRatePct: round1(18 + rand() * 57),
        }
      : {};

    // Solo Graph de FB expone reactions por post (RFC-004 D6 las agrega
    // client-side para el donut) — los 6 tipos siempre presentes, en orden.
    const reactionExtras =
      network === 'facebook'
        ? {
            reactions: REACTION_TYPES.map((type, k) => ({
              type,
              count: Math.round(likes * (REACTION_WEIGHTS[k] ?? 0) * (0.8 + rand() * 0.4)),
            })),
          }
        : {};

    // Ventana consecutiva del pool → 2-4 hashtags distintos por post.
    const hashtagStart = Math.floor(rand() * HASHTAG_POOL.length);
    const hashtagCount = 2 + Math.floor(rand() * 3);
    const hashtags = Array.from(
      { length: hashtagCount },
      (_, k) => `#${HASHTAG_POOL[(hashtagStart + k) % HASHTAG_POOL.length]}`,
    );

    const thumbnailExtras =
      format === 'text'
        ? {}
        : { thumbnailUrl: demoAsset(THUMBNAIL_FILES[Math.floor(rand() * THUMBNAIL_FILES.length)] ?? 'chat-image1.png') };

    return {
      id: `${accountId}-post-${String(i + 1).padStart(2, '0')}`,
      accountId,
      network,
      format,
      caption: CAPTION_POOL[(captionOffset + i) % CAPTION_POOL.length] ?? '',
      permalink: '#',
      publishedAt,
      hashtags,
      metrics: {
        likes,
        comments,
        shares,
        saves,
        reach,
        impressions,
        engagementRate,
        ...videoExtras,
        ...reactionExtras,
      },
      ...thumbnailExtras,
    };
  });
};
