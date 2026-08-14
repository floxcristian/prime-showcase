import { seededRandom } from '../../../shared/utils/mock-utils';
import type { AudienceSnapshot, SocialNetwork } from '../models/social.interface';
import { CITY_POOL } from './social-mock-utils';

/**
 * Factory PURA del snapshot de audiencia de una cuenta del cliente
 * (RFC-002 D1/D2/D7). Sin Angular ni side effects — importable desde el
 * harness de Playwright (`tests/fixtures/social-seed.ts`, RFC-001 D7).
 *
 * **Volúmenes D7:** exactamente 1 snapshot por cuenta, seed
 * `${clientSeed}:aud:${accountId}`. Ciudades del pool es-CL de
 * `social-mock-utils`.
 *
 * **Contratos D2:** `activeHours` son 24 valores enteros 0-100 (hora local
 * 0-23 → actividad relativa) y `activeDays` son 7 (0=lun … 6=dom) — el
 * heatmap best-time los consume tal cual; todos los breakdowns porcentuales
 * suman EXACTAMENTE 100 (redondeo por resto mayor, determinista);
 * `trafficSources` SOLO en network 'tiktok' (el breakdown FYP).
 *
 * **Determinismo:** `capturedAt` deriva de `epoch`; el resto sale del PRNG
 * seedeado — cero `Date.now()`/`Math.random()`. El orden de extracción del
 * PRNG es parte del contrato: byAge → byGender → byCountry → byCity →
 * activeHours → activeDays → trafficSources (solo tiktok).
 */

/** Rangos etarios (vocabulario de IG Graph audience insights). */
const AGE_RANGES: readonly string[] = ['18-24', '25-34', '35-44', '45-54', '55+'];

/** Pesos etarios por red — TikTok skew joven, FB skew adulto. */
const AGE_WEIGHTS: Readonly<Record<SocialNetwork, readonly number[]>> = {
  instagram: [22, 34, 22, 13, 9],
  facebook: [10, 24, 28, 22, 16],
  tiktok: [30, 34, 18, 10, 8],
};

/** Curva base de actividad por hora local (0-23) — valles de madrugada,
 *  peak de almuerzo y peak mayor de tarde-noche. */
const HOUR_CURVE: readonly number[] = [
  8, 5, 3, 2, 2, 3, 8, 18, 30, 42, 50, 58, 66, 60, 52, 48, 52, 62, 78, 92, 100, 88, 60, 30,
];

/** Curva base de actividad por día (0=lun … 6=dom) — sube hacia el finde. */
const DAY_CURVE: readonly number[] = [66, 74, 82, 88, 95, 100, 78];

/** Clamp a entero 0-100 (contrato de `activeHours`/`activeDays`). */
const clampPct = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

/**
 * Reparte 100 puntos porcentuales enteros según `baseWeights` con jitter
 * seeded (±25 %) y redondeo por resto mayor — la suma es SIEMPRE 100.
 */
const pctSplit = (rand: () => number, baseWeights: readonly number[]): readonly number[] => {
  const jittered = baseWeights.map((w) => w * (0.75 + rand() * 0.5));
  const total = jittered.reduce((a, b) => a + b, 0);
  const exact = jittered.map((w) => (w / total) * 100);
  const floors = exact.map(Math.floor);
  const remainder = 100 - floors.reduce((a, b) => a + b, 0);
  // Resto mayor: los puntos sobrantes van a las fracciones más grandes
  // (sort estable → determinista también en empates).
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
 * Construye el snapshot determinista de audiencia de `accountId`.
 * Lo genera lazy el backfill on-connect (D6) — 1 por cuenta (D7).
 */
export const buildAudienceMock = (
  epoch: number,
  clientSeed: string,
  accountId: string,
  network: SocialNetwork,
): AudienceSnapshot => {
  const rand = seededRandom(`${clientSeed}:aud:${accountId}`);

  const agePcts = pctSplit(rand, AGE_WEIGHTS[network]);
  const byAge = AGE_RANGES.map((range, i) => ({ range, pct: agePcts[i] ?? 0 }));

  const genderPcts = pctSplit(rand, [52, 44, 4]);
  const byGender = (['f', 'm', 'other'] as const).map((gender, i) => ({
    gender,
    pct: genderPcts[i] ?? 0,
  }));

  const countryPcts = pctSplit(rand, [78, 9, 6, 7]);
  const byCountry = ['Chile', 'Argentina', 'Perú', 'Otros'].map((country, i) => ({
    country,
    pct: countryPcts[i] ?? 0,
  }));

  // Santiago siempre presente + 3 ciudades seeded del pool + resto agrupado.
  const restCities = CITY_POOL.filter((c) => c !== 'Santiago');
  const cityOffset = Math.floor(rand() * restCities.length);
  const cities = [
    'Santiago',
    ...Array.from({ length: 3 }, (_, k) => restCities[(cityOffset + k) % restCities.length] ?? ''),
    'Otras',
  ];
  const cityPcts = pctSplit(rand, [38, 14, 11, 9, 28]);
  const byCity = cities.map((city, i) => ({ city, pct: cityPcts[i] ?? 0 }));

  const activeHours = HOUR_CURVE.map((base) => clampPct(base * (0.85 + rand() * 0.3)));
  const activeDays = DAY_CURVE.map((base) => clampPct(base * (0.85 + rand() * 0.3)));

  // Solo TikTok expone procedencia del tráfico — FYP siempre dominante.
  const trafficExtras =
    network === 'tiktok'
      ? {
          trafficSources: (() => {
            const pcts = pctSplit(rand, [62, 17, 11, 10]);
            return (['fyp', 'profile', 'search', 'other'] as const).map((source, i) => ({
              source,
              pct: pcts[i] ?? 0,
            }));
          })(),
        }
      : {};

  return {
    accountId,
    capturedAt: new Date(epoch).toISOString(),
    byAge,
    byGender,
    byCountry,
    byCity,
    activeHours,
    activeDays,
    ...trafficExtras,
  };
};
