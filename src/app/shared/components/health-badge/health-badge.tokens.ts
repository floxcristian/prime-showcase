import type { HealthState } from '../../../modules/observability/models/observability.interface';

/**
 * Vocabulario compartido `HealthState` → UI. Source of truth único del
 * mapping semántico: `HealthBadgeComponent` y los consumers (options de
 * filtros, tooltips de segmentos, aria labels) derivan de acá en vez de
 * duplicar los ternarios en cada archivo — un cambio de copy o de
 * severity se hace en un solo lugar.
 */

/**
 * Orden canónico de presentación (mismo orden que las options de los
 * filtros de salud en `obs-services` / `obs-uptime`).
 */
export const HEALTH_STATES: readonly HealthState[] = [
  'ok',
  'warn',
  'critical',
  'unknown',
];

export const HEALTH_LABELS: Record<HealthState, string> = {
  ok: 'Saludable',
  warn: 'Degradado',
  critical: 'Crítico',
  unknown: 'Sin datos',
};

export type HealthSeverity = 'success' | 'warn' | 'danger' | 'secondary';

/**
 * Mapping a severity de PrimeNG `<p-tag>`. `unknown` → `secondary`
 * (neutral, sin connotación positiva ni negativa): el user necesita saber
 * que el row existe, solo que está sin datos.
 */
export const HEALTH_SEVERITIES: Record<HealthState, HealthSeverity> = {
  ok: 'success',
  warn: 'warn',
  critical: 'danger',
  unknown: 'secondary',
};
