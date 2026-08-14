import type { AlertStatus } from '../../../modules/observability/models/observability.interface';

/**
 * Vocabulario compartido `AlertStatus` → UI. Mismo criterio que
 * `health-badge.tokens.ts`: `StatusChipComponent` y los consumers
 * (options del filtro de estado en obs-alerts) derivan de acá en vez
 * de duplicar el mapping — un cambio de copy se hace en un solo lugar.
 */

/** Orden canónico de presentación (options del filtro en obs-alerts). */
export const ALERT_STATUSES: readonly AlertStatus[] = [
  'firing',
  'acknowledged',
  'resolved',
  'silenced',
];

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  firing: 'Activa',
  acknowledged: 'Acusada',
  resolved: 'Resuelta',
  silenced: 'Silenciada',
};
