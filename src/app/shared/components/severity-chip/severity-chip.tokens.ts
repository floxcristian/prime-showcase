import type { AlertSeverity } from '../../../modules/observability/models/observability.interface';

/**
 * Vocabulario compartido `AlertSeverity` → UI. Mismo criterio que
 * `health-badge.tokens.ts`: `SeverityChipComponent` y los consumers
 * (options del filtro de severidad en obs-alerts) derivan de acá en
 * vez de duplicar el mapping — un cambio de copy se hace en un solo
 * lugar.
 */

/** Orden canónico de presentación (options del filtro en obs-alerts). */
export const ALERT_SEVERITIES: readonly AlertSeverity[] = [
  'critical',
  'warn',
  'info',
];

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Crítico',
  warn: 'Advertencia',
  info: 'Info',
};
