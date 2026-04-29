import type {
  ServiceDetail,
  ServiceSummary,
} from '../models/observability.interface';
import { minutesAgo, seededRandom, sparklineFrom } from './mock-utils';

const summarySeed = seededRandom('services-summary');
const summarySparkline = (n: number, max = 100): readonly number[] =>
  sparklineFrom(summarySeed, n, max);

export const SERVICES_MOCK: readonly ServiceSummary[] = [
  {
    id: 'svc-checkout',
    slug: 'checkout-service',
    name: 'Checkout',
    description: 'Servicio de checkout y carrito persistente',
    team: 'E-commerce',
    health: 'critical',
    errorRate24h: { value: 4.2, unit: '%', delta: 2.8, sparkline: summarySparkline(30) },
    p99Latency: { value: 1240, unit: 'ms', delta: 38, sparkline: summarySparkline(30, 1500) },
    uptime30d: { value: 99.62, unit: '%', delta: -0.18 },
    activeAlertsCount: 3,
    lastDeployAt: minutesAgo(45),
    lastAlertAt: minutesAgo(8),
    tags: ['public-api', 'critical-path'],
  },
  {
    id: 'svc-payments',
    slug: 'payments-service',
    name: 'Payments',
    description: 'Procesamiento de pagos y reconciliación',
    team: 'Pagos',
    health: 'warn',
    errorRate24h: { value: 1.4, unit: '%', delta: 0.6, sparkline: summarySparkline(30, 50) },
    p99Latency: { value: 820, unit: 'ms', delta: 12, sparkline: summarySparkline(30, 1000) },
    uptime30d: { value: 99.91, unit: '%', delta: 0.0 },
    activeAlertsCount: 1,
    lastDeployAt: minutesAgo(220),
    lastAlertAt: minutesAgo(32),
    tags: ['public-api', 'pci-scope', 'critical-path'],
  },
  {
    id: 'svc-catalog',
    slug: 'catalog-service',
    name: 'Catálogo',
    description: 'API de productos, precios y stock',
    team: 'E-commerce',
    health: 'ok',
    errorRate24h: { value: 0.08, unit: '%', delta: -0.02, sparkline: summarySparkline(30, 5) },
    p99Latency: { value: 180, unit: 'ms', delta: -8, sparkline: summarySparkline(30, 250) },
    uptime30d: { value: 99.99, unit: '%', delta: 0.01 },
    activeAlertsCount: 0,
    lastDeployAt: minutesAgo(60 * 6),
    tags: ['public-api', 'high-traffic'],
  },
  {
    id: 'svc-auth',
    slug: 'auth-service',
    name: 'Auth',
    description: 'Autenticación, sesiones y roles',
    team: 'Plataforma',
    health: 'ok',
    errorRate24h: { value: 0.12, unit: '%', delta: 0.01, sparkline: summarySparkline(30, 5) },
    p99Latency: { value: 95, unit: 'ms', delta: 2, sparkline: summarySparkline(30, 150) },
    uptime30d: { value: 99.98, unit: '%', delta: 0.0 },
    activeAlertsCount: 0,
    lastDeployAt: minutesAgo(60 * 24),
    tags: ['public-api', 'critical-path'],
  },
  {
    id: 'svc-search',
    slug: 'search-service',
    name: 'Search',
    description: 'Búsqueda full-text y autocomplete',
    team: 'Búsqueda',
    health: 'warn',
    errorRate24h: { value: 0.6, unit: '%', delta: 0.4, sparkline: summarySparkline(30, 20) },
    p99Latency: { value: 320, unit: 'ms', delta: 25, sparkline: summarySparkline(30, 500) },
    uptime30d: { value: 99.84, unit: '%', delta: -0.05 },
    activeAlertsCount: 1,
    lastDeployAt: minutesAgo(60 * 12),
    lastAlertAt: minutesAgo(110),
    tags: ['public-api', 'high-traffic'],
  },
  {
    id: 'svc-notifications',
    slug: 'notifications-service',
    name: 'Notificaciones',
    description: 'Push, email, in-app — fanout y entrega',
    team: 'Plataforma',
    health: 'ok',
    errorRate24h: { value: 0.21, unit: '%', delta: -0.05, sparkline: summarySparkline(30, 10) },
    p99Latency: { value: 410, unit: 'ms', delta: -2, sparkline: summarySparkline(30, 600) },
    uptime30d: { value: 99.95, unit: '%', delta: 0.02 },
    activeAlertsCount: 0,
    lastDeployAt: minutesAgo(60 * 4),
    tags: ['async', 'fanout'],
  },
  {
    id: 'svc-analytics',
    slug: 'analytics-pipeline',
    name: 'Analytics Pipeline',
    description: 'Streaming + batch para métricas y reporting',
    team: 'Datos',
    health: 'unknown',
    errorRate24h: { value: 0, unit: '%', sparkline: [] },
    p99Latency: { value: 0, unit: 'ms', sparkline: [] },
    uptime30d: { value: 0, unit: '%' },
    activeAlertsCount: 0,
    lastDeployAt: minutesAgo(60 * 72),
    tags: ['batch', 'no-sla'],
  },
  {
    id: 'svc-recommendations',
    slug: 'recommendations-engine',
    name: 'Recomendaciones',
    description: 'Engine de recomendaciones personalizadas',
    team: 'Datos',
    health: 'ok',
    errorRate24h: { value: 0.3, unit: '%', delta: 0.05, sparkline: summarySparkline(30, 10) },
    p99Latency: { value: 540, unit: 'ms', delta: -10, sparkline: summarySparkline(30, 800) },
    uptime30d: { value: 99.88, unit: '%', delta: 0.0 },
    activeAlertsCount: 0,
    lastDeployAt: minutesAgo(60 * 8),
    tags: ['ml', 'cache-heavy'],
  },
];

const detailCache = new Map<string, ServiceDetail>();

/**
 * Build determinístico + memoizado por id. El cache evita que navegar
 * away+back muestre datos distintos para el mismo servicio. La seed por
 * id garantiza que en distintos boots de la app, los mismos commits/
 * sparklines aparezcan (útil para reproducir bugs visuales en QA).
 */
export const SERVICE_DETAIL_MOCK = (id: string): ServiceDetail | undefined => {
  const cached = detailCache.get(id);
  if (cached) return cached;
  const summary = SERVICES_MOCK.find((s) => s.id === id);
  if (!summary) return undefined;

  const rand = seededRandom(`detail-${id}`);
  const detail: ServiceDetail = {
    ...summary,
    repoUrl: `https://github.com/empresa/${summary.slug}`,
    runbookUrl: `https://wiki.empresa.dev/runbooks/${summary.slug}`,
    externalDashboardUrl: `https://grafana.empresa.dev/d/${summary.slug}`,
    endpoints: [
      `https://api.empresa.dev/${summary.slug}/health`,
      `https://api.empresa.dev/${summary.slug}/v1`,
    ],
    owners: [
      { id: 'u-amaya', name: 'Amaya Ortiz', role: 'primary', avatarUrl: 'profile.jpg' },
      { id: 'u-brook', name: 'Brook Hayes', role: 'secondary', avatarUrl: 'profile.jpg' },
      { id: 'u-jose', name: 'José Domínguez', role: 'secondary', avatarUrl: 'profile.jpg' },
    ],
    dependencies: SERVICES_MOCK.filter((s) => s.id !== summary.id)
      .slice(0, 3)
      .map((s) => ({ id: s.id, name: s.name, health: s.health })),
    deploys: Array.from({ length: 6 }, (_, i) => ({
      id: `dep-${summary.id}-${i}`,
      version: `v2025.${(40 - i).toString().padStart(2, '0')}.${i + 1}`,
      author: ['Amaya Ortiz', 'Brook Hayes', 'José Domínguez'][i % 3],
      commitSha: Math.floor(rand() * 0xffffff).toString(16).padStart(7, '0'),
      commitMessage:
        i === 0
          ? 'fix: retry policy on payment gateway timeout'
          : i === 1
            ? 'feat: cart promo evaluation cache'
            : i === 2
              ? 'chore: bump deps + jest config'
              : 'feat: shadow traffic to new ranker',
      status: i === 5 ? 'rolled-back' : 'success',
      deployedAt: minutesAgo(45 + i * 60 * 8),
      durationSeconds: 90 + i * 25,
    })),
    errors: Array.from({ length: 5 }, (_, i) => ({
      id: `err-${summary.id}-${i}`,
      title:
        i === 0
          ? 'TimeoutError: gateway upstream'
          : i === 1
            ? 'ValidationError: cart line missing sku'
            : i === 2
              ? 'TypeError: Cannot read property "price" of undefined'
              : i === 3
                ? 'NetworkError: ETIMEDOUT'
                : 'AssertionError: invariant failed',
      type: i === 0 ? 'TimeoutError' : 'RuntimeError',
      count: 320 - i * 40,
      affectedUsers: 80 - i * 12,
      firstSeen: minutesAgo(60 * (24 + i * 8)),
      lastSeen: minutesAgo(5 + i * 12),
      sparkline: sparklineFrom(rand, 20, 50),
      externalUrl: `https://sentry.empresa.dev/issues/${summary.slug}-${i}`,
    })),
    slos: {
      errorRateTarget: 1.0,
      latencyP99TargetMs: 800,
      uptimeTarget: 99.9,
    },
  };

  detailCache.set(id, detail);
  return detail;
};
