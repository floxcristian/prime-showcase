import type { AlertDetail, AlertSummary } from '../models/observability.interface';
import { minutesAgo, seededRandom } from './mock-utils';
import { SERVICES_MOCK } from './services-mock';

const ALERT_TITLES = [
  'Error rate por encima del SLO',
  'p99 latency > 1s sostenido 5min',
  'Uptime check fallando',
  'Saturación de pool de conexiones',
  'Disk usage > 85%',
  'Memory pressure crítica',
  'Queue lag > 60s',
  'Tasa de timeouts en upstream gateway',
  'Throughput cayó 40% vs baseline',
  'Errores 5xx pico',
];

export const ALERTS_MOCK: readonly AlertSummary[] = Array.from({ length: 32 }, (_, i) => {
  const svc = SERVICES_MOCK[i % SERVICES_MOCK.length];
  const sevs = ['critical', 'warn', 'info'] as const;
  const statuses = ['firing', 'firing', 'acknowledged', 'resolved', 'silenced'] as const;
  return {
    id: `alert-${i.toString().padStart(3, '0')}`,
    title: ALERT_TITLES[i % ALERT_TITLES.length],
    description: `Regla ${i % 5 === 0 ? 'crítica' : 'estándar'} detectó condición en ${svc.name}`,
    severity: sevs[i % 3],
    status: statuses[i % 5],
    serviceId: svc.id,
    serviceName: svc.name,
    firedAt: minutesAgo(5 + i * 18),
    acknowledgedBy:
      statuses[i % 5] === 'acknowledged'
        ? {
            id: 'u-brook',
            name: 'Brook Hayes',
            role: 'primary' as const,
            avatarUrl: 'profile.jpg',
          }
        : undefined,
    acknowledgedAt: statuses[i % 5] === 'acknowledged' ? minutesAgo(2 + i * 4) : undefined,
    currentValue: 1.4 + i * 0.3,
    threshold: 1.0,
    unit: i % 3 === 0 ? '%' : 'ms',
  };
});

const detailCache = new Map<string, AlertDetail>();

/**
 * Build determinístico + memoizado por id. Mismo patrón que
 * `SERVICE_DETAIL_MOCK` — el `metricSeries` usaba `Math.random()` y cambiaba
 * cada navegación, rompiendo la continuidad visual del chart al volver.
 */
export const ALERT_DETAIL_MOCK = (id: string): AlertDetail | undefined => {
  const cached = detailCache.get(id);
  if (cached) return cached;
  const summary = ALERTS_MOCK.find((a) => a.id === id);
  if (!summary) return undefined;

  const rand = seededRandom(`alert-detail-${id}`);
  const detail: AlertDetail = {
    ...summary,
    rule: `error_rate{service="${summary.serviceId}"} > ${summary.threshold}${summary.unit ?? ''} for 5m`,
    runbookMarkdown: `## Pasos\n\n1. Revisar dashboard del servicio.\n2. Verificar dependencias upstream.\n3. Si confirmado: rollback al último deploy verde.\n4. Notificar al canal #incidents.`,
    externalUrl: `https://sentry.empresa.dev/alerts/${summary.id}`,
    metricSeries: Array.from({ length: 30 }, (_, i) => ({
      t: minutesAgo(30 - i),
      v: 0.5 + rand() * 2.5,
    })),
    history: [
      { id: 'h-1', at: summary.firedAt, actor: 'Sistema', action: 'fired' },
      ...(summary.acknowledgedAt && summary.acknowledgedBy
        ? [
            {
              id: 'h-2',
              at: summary.acknowledgedAt,
              actor: summary.acknowledgedBy.name,
              action: 'acknowledged' as const,
              note: 'Investigando: parece relacionado al deploy reciente.',
            },
          ]
        : []),
    ],
    relatedLogs: Array.from({ length: 8 }, (_, i) => ({
      at: minutesAgo(i * 2),
      level: i < 3 ? 'error' : i < 6 ? 'warn' : 'info',
      message: `[${summary.serviceId}] event ${i}: ${i < 3 ? 'TimeoutError on upstream' : 'retry succeeded after backoff'}`,
    })),
  };

  detailCache.set(id, detail);
  return detail;
};
