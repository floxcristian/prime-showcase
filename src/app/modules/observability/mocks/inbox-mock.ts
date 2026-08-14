import type {
  InboxItem,
  ServiceSummary,
} from '../models/observability.interface';
import { minutesBefore } from './mock-utils';

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

/**
 * Factory pura y determinista del inbox. Mismos datos y offsets relativos
 * siempre — el ancla temporal (`epoch`) parametriza los timestamps y
 * `services` es el catálogo YA construido con ese mismo epoch.
 *
 * Construida una vez por instancia de `ObservabilityMockService` — no
 * exportar consts evaluadas al import (congelarían el "ahora" al boot
 * del server SSR).
 */
export const buildInboxMock = (
  epoch: number,
  services: readonly ServiceSummary[],
): readonly InboxItem[] =>
  Array.from({ length: 38 }, (_, i) => {
    const svc = services[i % services.length];
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
      occurredAt: minutesBefore(epoch, 2 + i * 7),
      ackable: i % 3 !== 0,
      acknowledged: i % 7 === 0,
      sourceUrl:
        i % 2 === 0 ? `https://sentry.empresa.dev/items/${i}` : undefined,
    };
  });
