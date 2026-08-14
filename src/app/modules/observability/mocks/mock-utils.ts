/**
 * Helpers compartidos para mock data — mantienen los archivos de mocks
 * concentrados en SHAPE, no en utilities.
 *
 * **Determinismo:** los mocks son FACTORIES puras (`buildServicesMock`,
 * `buildAlertsMock`, `buildInboxMock`) parametrizadas por un ancla
 * temporal (`epoch`). Quién decide el "ahora" es
 * `ObservabilityMockService`: captura `epoch` una vez por instancia, así
 * en SSR cada request construye timestamps frescos (instancia nueva por
 * request — cada request crea un `ApplicationRef` propio) y en browser la
 * sesión mantiene datos estables. En producción real esto vendría del
 * backend con timestamps absolutos.
 *
 * **No-randomness in detail mocks:** `buildServiceDetailMock` y
 * `buildAlertDetailMock` son puros y deterministas por id (seeded PRNG).
 * La memoización por id (navegar away+back muestra los MISMOS deploys/
 * errors) vive como Map de instancia en `ObservabilityMockService` — un
 * Map a nivel módulo sería estado compartido entre requests SSR.
 */

/**
 * "Ahora" como función — cada invocación lee el reloj real. Usada por
 * `ObservabilityMockService` para capturar su `epoch` por instancia.
 * Función (y no `const NOW = Date.now()`) para que en SSR cada request
 * genere un ancla fresca en lugar de heredar el instante del boot del
 * server.
 */
export const now = (): number => Date.now();

/**
 * ISO string de `n` minutos antes del ancla `epoch`. Las factories de
 * mocks derivan TODOS sus timestamps de acá — mismo epoch en toda la
 * instancia del service → los "hace X min" de servicios, alertas, inbox
 * y details son coherentes entre sí por construcción.
 */
export const minutesBefore = (epoch: number, n: number): string =>
  new Date(epoch - n * 60 * 1000).toISOString();

/**
 * PRNG seedeado con string — produce números deterministas para un id dado.
 * Usado en mocks de detail para que `commitSha`/`sparkline` sean estables
 * por servicio aunque el build por id vuelva a correr.
 *
 * Algoritmo: Mulberry32 (estado simple, distribución uniforme suficiente
 * para mock data). No criptográfico — perfectamente OK para datos de UI.
 */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Genera N puntos pseudo-aleatorios determinísticos a partir de un PRNG. */
export const sparklineFrom = (
  rand: () => number,
  n: number,
  max = 100,
): number[] => Array.from({ length: n }, () => Math.floor(rand() * max));
