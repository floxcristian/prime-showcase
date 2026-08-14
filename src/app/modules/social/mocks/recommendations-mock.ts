import { minutesBefore, seededRandom, sparklineFrom } from '../../../shared/utils/mock-utils';
import type {
  MetricKind,
  Recommendation,
  RecommendationSeverity,
  RecommendationType,
  SocialAccount,
} from '../models/social.interface';

/**
 * Factory PURA del feed de recomendaciones (RFC-002 D2/D7). Sin Angular ni
 * side effects — importable desde el harness de Playwright
 * (`tests/fixtures/social-seed.ts`, RFC-001 D7).
 *
 * **Volumen (D7):** 3-4 recomendaciones POR CUENTA conectada, seed
 * `${clientSeed}:reco:${accountId}` — dos clientes ven feeds distintos; el
 * mismo cliente ve SIEMPRE el mismo (por epoch de la instancia del
 * service que la memoiza en su Map por accountId, D5).
 *
 * **Mix garantizado por round-robin (D7):** los `type` y `severity` rotan
 * sobre sus tres valores con offsets seeded — con 3-4 items, los tres
 * types y las tres severities aparecen siempre en el feed agregado. El
 * contenido (título/detalle/acción) sale de un pool curado es-CL POR TYPE
 * para que el copy suene a lo que el type promete.
 *
 * **Determinismo:** el orden de extracción del PRNG es parte del contrato:
 * count → typeOffset → sevOffset → por item: template → observed →
 * expected → sparkline(14) → detectedAt. Timestamps SIEMPRE derivados de
 * `epoch` (`minutesBefore`) — cero reloj real.
 */

/** Rutas accionables sancionadas por D2 para `actionRoute`. */
type RecommendationRoute = '/social/planner' | '/social/analytics' | '/social/connections';

interface RecoTemplate {
  readonly title: string;
  readonly detail: string;
  /** es-CL accionable — le dice al usuario QUÉ hacer, no solo qué pasó. */
  readonly suggestedAction: string;
  readonly metric: MetricKind;
  readonly unit: string;
  /** Rango seeded para `evidence.observedValue`. */
  readonly observedRange: readonly [number, number];
  /** Rango seeded para `evidence.expectedValue`. */
  readonly expectedRange: readonly [number, number];
  readonly actionRoute: RecommendationRoute;
}

/**
 * Pool curado POR TYPE (≥3 templates c/u) — el round-robin de types elige
 * el bucket y un índice seeded elige el template adentro. Copy neutro de
 * red: sirve para IG/FB/TikTok sin bifurcar el pool.
 */
const RECO_TEMPLATES: Readonly<Record<RecommendationType, readonly RecoTemplate[]>> = {
  improvement: [
    {
      title: 'Engagement por debajo de tu promedio',
      detail:
        'El engagement de tus últimas publicaciones quedó por debajo del promedio de los últimos 30 días.',
      suggestedAction:
        'Revisá qué formatos rindieron mejor este mes y repetí los dos con más interacción.',
      metric: 'engagement-rate',
      unit: '%',
      observedRange: [1.2, 2.8],
      expectedRange: [3.5, 5.5],
      actionRoute: '/social/analytics',
    },
    {
      title: 'Tus videos retienen menos que antes',
      detail:
        'La tasa de finalización de tus videos viene cayendo hace dos semanas — el gancho de los primeros segundos perdió efecto.',
      suggestedAction:
        'Abrí con el resultado en los primeros 3 segundos y dejá el contexto para el final.',
      metric: 'completion-rate',
      unit: '%',
      observedRange: [18, 32],
      expectedRange: [40, 55],
      actionRoute: '/social/analytics',
    },
    {
      title: 'Los clics al enlace no acompañan el alcance',
      detail:
        'Tu alcance se mantiene, pero los clics al enlace bajaron — el llamado a la acción no está convirtiendo.',
      suggestedAction:
        'Probá un llamado a la acción directo ("Comprá acá") en las próximas 3 publicaciones y comparé el CTR.',
      metric: 'link-clicks',
      unit: '',
      observedRange: [40, 120],
      expectedRange: [180, 320],
      actionRoute: '/social/analytics',
    },
  ],
  fix: [
    {
      title: 'Sincronización de métricas incompleta',
      detail:
        'La última sincronización de esta cuenta no trajo todas las métricas — los datos recientes pueden estar subestimados.',
      suggestedAction:
        'Reconectá la cuenta en Configuración para renovar los permisos de lectura.',
      metric: 'impressions',
      unit: '',
      observedRange: [800, 2400],
      expectedRange: [4500, 9000],
      actionRoute: '/social/connections',
    },
    {
      title: 'Caída brusca de alcance detectada',
      detail:
        'El alcance cayó más de lo esperable para esta época — puede ser un problema del conector, no de tu contenido.',
      suggestedAction:
        'Verificá el estado de la conexión y reconectá la cuenta si figura con error.',
      metric: 'reach',
      unit: '',
      observedRange: [1200, 3500],
      expectedRange: [6000, 12000],
      actionRoute: '/social/connections',
    },
    {
      title: 'Publicaciones programadas sin cuenta activa',
      detail:
        'Tenés publicaciones en cola apuntando a esta cuenta y el token está por vencer — van a fallar al publicarse.',
      suggestedAction:
        'Revisá el calendario y reconectá la cuenta antes del próximo horario programado.',
      metric: 'followers',
      unit: '',
      observedRange: [2, 5],
      expectedRange: [0, 1],
      actionRoute: '/social/planner',
    },
  ],
  opportunity: [
    {
      title: 'Tu audiencia está más activa de noche',
      detail:
        'La franja 18-21 h concentra la actividad de tu audiencia, pero venís publicando cerca del mediodía.',
      suggestedAction: 'Programá tus próximas publicaciones martes y jueves entre 18 y 20 h.',
      metric: 'profile-visits',
      unit: '',
      observedRange: [90, 260],
      expectedRange: [350, 700],
      actionRoute: '/social/planner',
    },
    {
      title: 'Los carruseles te están rindiendo el doble',
      detail:
        'Tus carruseles duplican el engagement de las imágenes sueltas — hay espacio para inclinarte más a ese formato.',
      suggestedAction:
        'Sumá un carrusel semanal al calendario reutilizando tus fotos de producto.',
      metric: 'saves',
      unit: '',
      observedRange: [45, 110],
      expectedRange: [15, 40],
      actionRoute: '/social/planner',
    },
    {
      title: 'Crecimiento de seguidores acelerándose',
      detail:
        'La incorporación neta de seguidores viene acelerando hace 10 días — buen momento para capitalizar con más frecuencia.',
      suggestedAction:
        'Aprovechá la racha: agregá 2 publicaciones extra esta semana en tu mejor horario.',
      metric: 'net-follower-growth',
      unit: '',
      observedRange: [25, 80],
      expectedRange: [8, 20],
      actionRoute: '/social/analytics',
    },
  ],
};

/** Orden canónico de rotación — con offsets seeded garantiza el mix D7. */
const RECO_TYPES: readonly RecommendationType[] = ['improvement', 'fix', 'opportunity'];
const RECO_SEVERITIES: readonly RecommendationSeverity[] = ['critical', 'warn', 'info'];

/** Valor seeded dentro de `[min, max]`, redondeado a 1 decimal (evidencia
 *  legible en cards sin formatearse en template). */
const valueBetween = (rand: () => number, range: readonly [number, number]): number =>
  Math.round((range[0] + rand() * (range[1] - range[0])) * 10) / 10;

/**
 * Construye las recomendaciones deterministas de `account`. La llama
 * `SocialAnalyticsMockService.getRecommendations` (una vez por cuenta
 * conectada, memoizada en Map de instancia — D5) y el seed de fixtures.
 */
export const buildRecommendationsMock = (
  epoch: number,
  clientSeed: string,
  account: SocialAccount,
): readonly Recommendation[] => {
  const rand = seededRandom(`${clientSeed}:reco:${account.id}`);
  const count = 3 + Math.floor(rand() * 2); // 3-4 (D7)
  const typeOffset = Math.floor(rand() * RECO_TYPES.length);
  const sevOffset = Math.floor(rand() * RECO_SEVERITIES.length);

  return Array.from({ length: count }, (_, i) => {
    const type = RECO_TYPES[(typeOffset + i) % RECO_TYPES.length];
    const severity = RECO_SEVERITIES[(sevOffset + i) % RECO_SEVERITIES.length];
    const pool = RECO_TEMPLATES[type];
    const template = pool[Math.floor(rand() * pool.length)];
    const observedValue = valueBetween(rand, template.observedRange);
    const expectedValue = valueBetween(rand, template.expectedRange);
    const sparkline = sparklineFrom(rand, 14);
    // Detectada entre 1 h y 3 días antes del epoch — feed "reciente".
    const detectedAt = minutesBefore(epoch, 60 + Math.floor(rand() * 4260));

    return {
      id: `reco-${account.id}-${i + 1}`,
      type,
      severity,
      network: account.network,
      accountId: account.id,
      title: template.title,
      detail: template.detail,
      evidence: {
        metric: template.metric,
        sparkline,
        observedValue,
        expectedValue,
        unit: template.unit,
      },
      suggestedAction: template.suggestedAction,
      actionRoute: template.actionRoute,
      detectedAt,
    };
  });
};
