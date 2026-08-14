/**
 * Helpers compartidos para mock data — mantienen los archivos de mocks
 * concentrados en SHAPE, no en utilities.
 *
 * **Determinismo:** los mocks usan timestamps relativos a `now()` (leído
 * al momento del build, NO capturado al import del módulo — en SSR el
 * módulo se evalúa una sola vez al boot del server y una constante
 * congelaría el "ahora" para todos los requests siguientes). En producción
 * real esto vendría del backend con timestamps absolutos. Para el
 * showcase, "fresh on reload" es aceptable.
 *
 * **No-randomness in detail mocks:** `SERVICE_DETAIL_MOCK` y
 * `ALERT_DETAIL_MOCK` se memoizan por id (`buildOnce` pattern abajo) para
 * que navegar away+back muestre los MISMOS deploys/errors. Sin esto, cada
 * llamada generaba commitSha + sparklines distintos → UX inconsistente.
 */

/**
 * "Ahora" como función — cada invocación lee el reloj real. Función (y no
 * `const NOW = Date.now()`) para que en SSR cada request/build genere
 * timestamps frescos en lugar de heredar el instante del boot del server.
 */
export const now = (): number => Date.now();

export const minutesAgo = (n: number): string =>
  new Date(now() - n * 60 * 1000).toISOString();

/**
 * Instante de referencia capturado al import de este módulo — el mismo
 * instante (± microsegundos: los mocks importan este archivo y evalúan
 * sus consts inmediatamente después) en que `SERVICES_MOCK` /
 * `ALERTS_MOCK` congelan sus timestamps vía `minutesAgo()`.
 *
 * Usar como ancla temporal en vistas que correlacionan timestamps
 * propios con los de esos mocks (ej: el segment grid de obs-uptime).
 * Un `now()` capturado por instancia deriva respecto de los mocks
 * congelados durante sesiones largas — los incidentes "migran" frente a
 * la columna "Última alerta".
 *
 * Deuda documentada: en SSR los mocks top-level se congelan igual al
 * boot del server; frescura per-request requeriría mocks factory (no
 * consts). Mientras los mocks sean consts, la ancla coherente es esta.
 */
export const MOCK_EPOCH: number = now();

/**
 * PRNG seedeado con string — produce números deterministas para un id dado.
 * Usado en mocks de detail para que `commitSha`/`sparkline` sean estables
 * por servicio aunque la llamada a `getServiceDetail(id)` vuelva a correr.
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
