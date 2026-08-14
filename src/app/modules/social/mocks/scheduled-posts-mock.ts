import { demoAsset } from '../../../shared/constants/demo-assets';
import { minutesBefore, seededRandom } from '../../../shared/utils/mock-utils';
import type {
  PostFormat,
  ScheduledPost,
  ScheduledPostStatus,
  SocialAccount,
} from '../models/social.interface';
import { CAPTION_POOL, clientHash, HASHTAG_POOL } from './social-mock-utils';

/**
 * Factory PURA del backfill de publicaciones del planner (RFC-002 D2/D7,
 * consumida por `SocialPublishingMockService` al sembrar su signal — D6:
 * solo si el cliente tiene cuentas conectadas — y por el seed de fixtures
 * de Playwright, RFC-001 D7). Sin Angular ni side effects.
 *
 * **Volumen (D7):** 10-12 posts cubriendo los CUATRO estados, con ≥1
 * `failed` con `failureReason` accionable. La cobertura no se sortea: un
 * ciclo fijo de estados garantiza que cualquier count 10-12 incluya
 * draft/scheduled/published/failed (los primeros 4 del ciclo ya cubren
 * los 4). Seed `${clientSeed}:sched`.
 *
 * **Timestamps** SIEMPRE derivados de `epoch`: `scheduledFor` en el futuro
 * para `scheduled` (requerido por D2), en el pasado reciente para `failed`
 * (el intento que falló — el calendario lo muestra en su día); los posts
 * `scheduled` vencidos NO se auto-publican (límite consciente del mock,
 * D10). `sourceJobId` queda sin setear: la trazabilidad Studio → Planner
 * nace de "Usar en planner" (RFC-006 D8), no del backfill.
 *
 * **Determinismo:** orden de extracción del PRNG (contrato): count →
 * capOffset → tagOffset → mediaOffset → por post: primary → cross →
 * format → draws de tiempo del branch de status (+ failureReason si
 * `failed`). El branch lo decide el ciclo fijo por índice, así el consumo
 * variable de draws no rompe la reproducibilidad.
 */

/**
 * Ciclo fijo de estados (12 = count máximo). Los índices 0-3 cubren los 4
 * estados → todo count ≥ 10 garantiza cobertura y ≥1 `failed` (índice 3).
 */
const STATUS_CYCLE: readonly ScheduledPostStatus[] = [
  'published',
  'scheduled',
  'draft',
  'failed',
  'scheduled',
  'published',
  'published',
  'draft',
  'scheduled',
  'published',
  'failed',
  'scheduled',
];

/** Formatos plausibles de programar (sin `story`: efímero, no se agenda
 *  en el planner del showcase). */
const FORMATS: readonly PostFormat[] = ['image', 'carousel', 'reel', 'video', 'text'];

/** `failureReason` accionables es-CL (D7/D10) — le dicen al usuario qué
 *  hacer, no solo qué pasó. La CTA de la UI se deriva del estado real de
 *  settings, nunca parseando estos strings (RFC-006 D6.1). */
const PUBLISH_FAILURE_REASONS: readonly string[] = [
  'El token de la cuenta expiró antes de publicar — reconectá la cuenta en Configuración y reintentá.',
  'La red rechazó el video por exceder la duración permitida — recortalo a menos de 90 segundos y reintentá.',
  'El conector devolvió un error temporal al publicar — reintentá en unos minutos.',
];

/** Assets demo disponibles como media (covers del CDN de PrimeTek). */
const MEDIA_FILE_COUNT = 12;

const mediaUrl = (n: number): string => demoAsset(`movie-cover${(n % MEDIA_FILE_COUNT) + 1}.png`);

/**
 * Construye el backfill determinista del calendario para las cuentas
 * conectadas del cliente. Sin cuentas → `[]` (mismo criterio que el reset
 * por cambio de `clientSeed` de D6: el backfill solo existe si hay dónde
 * publicar).
 */
export const buildScheduledPostsMock = (
  epoch: number,
  clientSeed: string,
  accounts: readonly SocialAccount[],
): readonly ScheduledPost[] => {
  if (accounts.length === 0) {
    return [];
  }

  const rand = seededRandom(`${clientSeed}:sched`);
  const count = 10 + Math.floor(rand() * 3); // 10-12 (D7)
  const capOffset = Math.floor(rand() * CAPTION_POOL.length);
  const tagOffset = Math.floor(rand() * HASHTAG_POOL.length);
  const mediaOffset = Math.floor(rand() * MEDIA_FILE_COUNT);
  const hash = clientHash(clientSeed);

  return Array.from({ length: count }, (_, i) => {
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];

    // Cross-posting multi-red (D2): ~30 % de los posts apuntan a dos
    // cuentas cuando el cliente tiene más de una conectada.
    const primary = Math.floor(rand() * accounts.length);
    const cross = rand() < 0.3 && accounts.length > 1;
    const accountIds = cross
      ? [accounts[primary].id, accounts[(primary + 1) % accounts.length].id]
      : [accounts[primary].id];

    const format = FORMATS[Math.floor(rand() * FORMATS.length)];
    const caption = CAPTION_POOL[(capOffset + i) % CAPTION_POOL.length];
    // 2-3 hashtags consecutivos del pool, materializados CON '#'
    // (convención de social-mock-utils para captions/posts).
    const hashtags = Array.from(
      { length: 2 + (i % 2) },
      (_, k) => `#${HASHTAG_POOL[(tagOffset + i * 2 + k) % HASHTAG_POOL.length]}`,
    );
    const mediaCount = format === 'text' ? 0 : format === 'carousel' ? 2 : 1;
    const mediaUrls = Array.from({ length: mediaCount }, (_, k) =>
      mediaUrl(mediaOffset + i + k),
    );

    const base = {
      id: `sched-${hash}-${i + 1}`,
      accountIds,
      format,
      caption,
      hashtags,
      mediaUrls,
      status,
    };

    if (status === 'draft') {
      // Creado hace 2-16 días, retocado en las últimas ~25 h.
      const createdMin = 2880 + Math.floor(rand() * 20160);
      const updatedMin = 60 + Math.floor(rand() * 1440);
      return {
        ...base,
        createdAt: minutesBefore(epoch, createdMin),
        updatedAt: minutesBefore(epoch, updatedMin),
      };
    }

    if (status === 'scheduled') {
      // Programado 1-14 días hacia adelante, en horario diurno (9-19 h de
      // offset sobre el epoch) — puebla el mes visible del calendario.
      const futureMin =
        (1 + Math.floor(rand() * 14)) * 1440 + (9 + Math.floor(rand() * 11)) * 60;
      const createdMin = 1440 + Math.floor(rand() * 10080);
      return {
        ...base,
        scheduledFor: new Date(epoch + futureMin * 60_000).toISOString(),
        createdAt: minutesBefore(epoch, createdMin),
        updatedAt: minutesBefore(epoch, Math.floor(createdMin / 2)),
      };
    }

    if (status === 'published') {
      // Publicado hace 1-30 días; creado 0.5-2.5 días antes de publicarse.
      const publishedMin = 1440 + Math.floor(rand() * 41760);
      const createdMin = publishedMin + 720 + Math.floor(rand() * 2880);
      const publishedAt = minutesBefore(epoch, publishedMin);
      return {
        ...base,
        publishedAt,
        createdAt: minutesBefore(epoch, createdMin),
        updatedAt: publishedAt,
      };
    }

    // failed: el intento (scheduledFor) quedó en el pasado reciente; el
    // updatedAt es el momento del intento fallido, 5 min después del slot.
    const attemptMin = 360 + Math.floor(rand() * 10080);
    const createdMin = attemptMin + 1440 + Math.floor(rand() * 4320);
    const failureReason =
      PUBLISH_FAILURE_REASONS[Math.floor(rand() * PUBLISH_FAILURE_REASONS.length)];
    return {
      ...base,
      scheduledFor: minutesBefore(epoch, attemptMin),
      failureReason,
      createdAt: minutesBefore(epoch, createdMin),
      updatedAt: minutesBefore(epoch, attemptMin - 5),
    };
  });
};
