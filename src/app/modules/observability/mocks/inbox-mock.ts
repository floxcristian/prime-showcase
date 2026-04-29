import type { InboxItem } from '../models/observability.interface';
import { minutesAgo } from './mock-utils';
import { SERVICES_MOCK } from './services-mock';

const INBOX_TITLES = [
  'Error rate cruzó 4% en el último 5m',
  'Nuevo error: TimeoutError en gateway',
  'Uptime check fallando hace 8 min',
  'Deploy v2025.40.3 completado',
  'p99 latency degradándose últimas 30m',
  'Alerta resuelta: queue lag normalizado',
  'Memory pressure recuperada',
  'Nuevo deploy en producción',
  'Pico de 5xx en último minuto',
  'Trend: throughput cayó 15% últimas 2h',
];

export const INBOX_MOCK: readonly InboxItem[] = Array.from(
  { length: 38 },
  (_, i) => {
    const svc = SERVICES_MOCK[i % SERVICES_MOCK.length];
    const buckets = ['now', 'now', 'today', 'today', 'today', 'info'] as const;
    const types = ['error', 'alert', 'uptime', 'deploy', 'trend'] as const;
    const sevs = ['critical', 'warn', 'info'] as const;
    return {
      id: `inbox-${i.toString().padStart(3, '0')}`,
      bucket: buckets[i % buckets.length],
      type: types[i % types.length],
      severity: sevs[i % 3],
      serviceId: svc.id,
      serviceName: svc.name,
      title: INBOX_TITLES[i % INBOX_TITLES.length],
      detail:
        i % 4 === 0
          ? 'Threshold 1.0% — actual 4.2%. Spike comenzó hace 12 minutos.'
          : undefined,
      occurredAt: minutesAgo(2 + i * 7),
      ackable: i % 3 !== 0,
      acknowledged: i % 7 === 0,
      sourceUrl:
        i % 2 === 0 ? `https://sentry.empresa.dev/items/${i}` : undefined,
    };
  },
);
