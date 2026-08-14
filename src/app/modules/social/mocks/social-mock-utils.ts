import { seededRandom } from '../../../shared/utils/mock-utils';
import type { MetricPoint } from '../models/social.interface';

/**
 * Helpers y pools propios del DOMINIO social (RFC-002 D6/D7) — vocabulario
 * que no se promueve a shared porque solo tiene sentido acá. Los helpers
 * genéricos (`seededRandom`, `now`, `minutesBefore`, `sparklineFrom`)
 * viven en `shared/utils/mock-utils` (RFC-002 D8).
 *
 * **Regla dura de identidad (D6):** los pools de este archivo describen
 * SOLO a TERCEROS — competidores, autores de menciones, contenido de
 * mercado. Las cuentas DEL cliente jamás salen de un pool: se derivan del
 * email autenticado en `accounts-mock.ts` (`buildAccountMock`).
 *
 * **Determinismo:** todo es puro y parametrizado por `epoch`/seed — cero
 * reloj real ni aleatoriedad sin seed. Importable desde el harness de
 * Playwright (sin Angular) — requisito de RFC-002 criterios.
 */

/**
 * Serie diaria determinista: base + tendencia lineal + ruido seeded +
 * estacionalidad semanal (weekendFactor multiplica sáb/dom — >1 para
 * redes de consumo como IG/TikTok, <1 para FB corporativo).
 * Siempre 90 buckets — la UI recorta a 7/30/60 sin re-fetch.
 */
export const dailySeries = (
  epoch: number,
  seed: string,
  base: number,
  trendPerDay: number,
  noisePct: number,
  weekendFactor = 1.25,
): readonly MetricPoint[] => {
  const rand = seededRandom(seed);
  return Array.from({ length: 90 }, (_, i) => {
    const d = new Date(epoch - (89 - i) * 86_400_000);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const noise = (rand() * 2 - 1) * noisePct;
    const v = (base + trendPerDay * i) * (isWeekend ? weekendFactor : 1) * (1 + noise);
    return { t: d.toISOString(), v: Math.round(v) };
  });
};

/**
 * Hash estable del `clientSeed` (email autenticado, D6) para ids de
 * entidades ('acc-instagram-<clientHash>') y para namespacing de las keys
 * de storage por cliente (RFC-002 D6 / RFC-003 D6.1). Mismo mixing FNV-1a
 * que la fase de seed de `seededRandom` — determinista entre sesiones,
 * SSR y browser. Salida base36 (`[0-9a-z]+`), segura para ids y keys.
 * NO criptográfico: es aislamiento de demo, no de seguridad (JSDoc
 * requerido por RFC-002 consecuencias).
 */
export const clientHash = (clientSeed: string): string => {
  let h = 2166136261;
  for (let i = 0; i < clientSeed.length; i++) {
    h ^= clientSeed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

// ── Pools es-CL curados — SOLO TERCEROS (D6/D7) ──────────────────────

/** Identidad curada de un competidor (tercero) — handle + nombre fantasía. */
export interface CompetitorSeed {
  readonly handle: string;
  readonly name: string;
}

/**
 * Pool fijo de competidores POR RED (D7: 3 por red; el pool ofrece 4 para
 * variedad seeded). Pymes chilenas inventadas — jamás cuentas del cliente.
 */
export const COMPETITOR_POOLS: Readonly<
  Record<'instagram' | 'facebook' | 'tiktok', readonly CompetitorSeed[]>
> = {
  instagram: [
    { handle: '@ferreteria-austral', name: 'Ferretería Austral' },
    { handle: '@donremolque.cl', name: 'Don Remolque' },
    { handle: '@maderas.delbiobio', name: 'Maderas del Biobío' },
    { handle: '@electrohogar.valpo', name: 'ElectroHogar Valpo' },
  ],
  facebook: [
    { handle: '@distribuidora.nortegrande', name: 'Distribuidora Norte Grande' },
    { handle: '@comercial-lacolina', name: 'Comercial La Colina' },
    { handle: '@serviteca.elmaestro', name: 'Serviteca El Maestro' },
    { handle: '@pinturas.temuco', name: 'Pinturas Temuco' },
  ],
  tiktok: [
    { handle: '@bodega.mayorista', name: 'Bodega Mayorista CL' },
    { handle: '@ferreconce', name: 'FerreConce' },
    { handle: '@tienda.elvolcan', name: 'Tienda El Volcán' },
    { handle: '@insumos.laaraucania', name: 'Insumos La Araucanía' },
  ],
};

/** Autores (terceros) de menciones de marca — RFC-005 D6. */
export const MENTION_AUTHOR_HANDLES: readonly string[] = [
  '@cliente.feliz',
  '@vale.compras',
  '@el.tato.stgo',
  '@caro_encasa',
  '@marce.hogar',
  '@seba.constructor',
  '@fran.valpo',
  '@pame.conce',
  '@nacho.temuko',
  '@dani.emprende',
];

/** Excerpts de menciones (1-2 líneas es-CL) — el sentiment lo asigna la
 *  factory por round-robin (D7), no este pool. */
export const MENTION_EXCERPTS: readonly string[] = [
  'Llegó rapidísimo el pedido, quedé muy conforme con el despacho a regiones.',
  '¿Alguien ha comprado acá? Me tinca, pero quiero referencias antes de encargar.',
  'La atención por DM fue lenta — tuve que escribir dos veces para que respondieran.',
  'Buenos precios comparado con el retail, y el retiro en tienda fue al tiro.',
  'El producto llegó con un detalle en la caja, aunque me lo cambiaron sin drama.',
  'Recomendadísimos: los uso para mi emprendimiento hace meses y nunca fallan.',
  'Ojo con los tiempos de despacho en fechas peak — a mí se me atrasó una semana.',
  'Me encantó el video del detrás de escena, se nota el cariño que le ponen.',
  'El manual venía solo en inglés, echo de menos instrucciones en español.',
  'Compré para regalar y llegó impecable, con boleta y todo ordenadito.',
];

/** Captions es-CL realistas para posts (propios y de terceros — texto de
 *  mercado, sin identidad del cliente embebida). */
export const CAPTION_POOL: readonly string[] = [
  'Llegó stock de la línea eléctrica 🛠️ — despacho a todo Chile',
  'Nueva colección de temporada ya disponible en tienda y online 🎉',
  'Tips para elegir el producto correcto — guardá este post para tu próxima compra',
  'Detrás de escena: así preparamos tus pedidos cada mañana 📦',
  'Solo por esta semana: 2x1 en productos seleccionados ⚡',
  'Gracias por acompañarnos un año más — ustedes hacen crecer esta pyme 💙',
  'Del taller a tu casa en 48 horas: así funciona nuestro despacho',
  'Pregunta frecuente: ¿hacen envíos a regiones? ¡Sí, a todo Chile!',
  'Antes y después: lo que se logra con las herramientas correctas',
  'Conocé al equipo: la gente que responde tus mensajes todos los días 👋',
  'Retiro en tienda sin costo — comprá online y pasá a buscar el mismo día',
  'Lanzamos nuestra guía gratuita para emprendedores — link en la bio',
];

/**
 * Hashtags del rubro pyme chilena. SIN `#` — forma canónica de
 * `HashtagSuggestion.tag` (D2); las factories que componen captions o
 * `PostSummary.hashtags` anteponen `#` al materializar.
 */
export const HASHTAG_POOL: readonly string[] = [
  'pymechile',
  'emprendedoreschile',
  'despachoatodochile',
  'hechoenchile',
  'compralocal',
  'apoyapyme',
  'santiagochile',
  'valparaiso',
  'concepcion',
  'temuco',
  'ofertachile',
  'tiendaonline',
];

/** Ciudades para breakdowns de audiencia (`AudienceSnapshot.byCity`). */
export const CITY_POOL: readonly string[] = [
  'Santiago',
  'Valparaíso',
  'Concepción',
  'Temuco',
  'Antofagasta',
  'La Serena',
  'Rancagua',
  'Puerto Montt',
];

/** `failureReason` accionables para la cuenta marcada con `status: 'error'`
 *  por la regla determinista de sync (D6) — siempre apuntan a reconectar. */
export const SYNC_FAILURE_REASONS: readonly string[] = [
  'La credencial del conector fue revocada. Reconectá la cuenta para reanudar la sincronización.',
  'El token perdió los permisos de lectura de métricas. Reconectá la cuenta para renovarlos.',
  'La API del conector rechazó la última sincronización. Reconectá la cuenta para renovar el acceso.',
];
