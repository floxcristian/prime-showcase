import { minutesBefore, seededRandom } from '../../../shared/utils/mock-utils';
import type { HashtagPerformance, SocialNetwork } from '../models/social.interface';
import { HASHTAG_POOL } from './social-mock-utils';

/**
 * Factory PURA de la performance histórica de hashtags del cliente
 * (RFC-002 D2/D7 — tabla "¿cuáles me rinden?" de social-trends, RFC-005
 * D6). Sin Angular ni side effects — importable desde el harness de
 * Playwright (RFC-001 D7).
 *
 * Archivo propio (un-export-por-archivo, AGENTS.md): RFC-002 D1 no lista
 * `hashtag-performance-mock.ts` pero D7 sí fija su volumen y seed
 * (`${clientSeed}:hperf:${network}`) — micro-desviación documentada en el
 * reporte de implementación.
 *
 * **Determinismo:** los tags salen de `HASHTAG_POOL` (rubro pyme es-CL)
 * rotado desde un offset seeded — cada cliente/red "usó" un subconjunto
 * distinto pero estable. Orden de extracción del PRNG (contrato): count →
 * poolStart → por tag: timesUsed → avgReach → avgEngagementRate →
 * lastUsedAt. Timestamps derivados de `epoch` — cero reloj real.
 */

/** Reach promedio plausible por red para una pyme chilena (misma escala
 *  relativa que `ACCOUNT_RANGES` de accounts-mock: TikTok > IG > FB). */
const REACH_RANGES: Readonly<Record<SocialNetwork, readonly [number, number]>> = {
  instagram: [1500, 20000],
  facebook: [800, 12000],
  tiktok: [2000, 40000],
};

const intBetween = (rand: () => number, range: readonly [number, number]): number =>
  range[0] + Math.floor(rand() * (range[1] - range[0] + 1));

/**
 * Construye las 8-10 filas deterministas de performance de hashtags para
 * `network` (D7). Tags en forma canónica SIN '#' (D2) — la UI antepone el
 * '#' al render. La UI ordena por `avgEngagementRate` (RFC-005 D6), la
 * factory no pre-ordena.
 */
export const buildHashtagPerformanceMock = (
  epoch: number,
  clientSeed: string,
  network: SocialNetwork,
): readonly HashtagPerformance[] => {
  const rand = seededRandom(`${clientSeed}:hperf:${network}`);
  const count = 8 + Math.floor(rand() * 3); // 8-10 (D7)
  const poolStart = Math.floor(rand() * HASHTAG_POOL.length);

  return Array.from({ length: count }, (_, i) => {
    // count ≤ 10 < HASHTAG_POOL.length → tags únicos por construcción.
    const tag = HASHTAG_POOL[(poolStart + i) % HASHTAG_POOL.length];
    const timesUsed = 2 + Math.floor(rand() * 23); // 2-24 usos
    const avgReach = intBetween(rand, REACH_RANGES[network]);
    // 0.8 % - 9.5 %, 1 decimal — precalculado, no se formatea en template.
    const avgEngagementRate = Math.round((0.8 + rand() * 8.7) * 10) / 10;
    // Último uso entre 12 h y 28 días antes del epoch.
    const lastUsedAt = minutesBefore(epoch, 720 + Math.floor(rand() * 39600));

    return { tag, network, timesUsed, avgReach, avgEngagementRate, lastUsedAt };
  });
};
