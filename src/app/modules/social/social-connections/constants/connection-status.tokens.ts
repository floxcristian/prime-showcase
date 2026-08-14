import type { ConnectionStatus } from '../../models/social.interface';

/**
 * Vocabulario `ConnectionStatus` → UI de la card de conector (RFC-003 D4.1).
 * Mismo patrón que `health-badge.tokens.ts` / `network-chip.tokens.ts`: el
 * mapping vive en un solo lugar y el template deriva de acá en vez de
 * repartir ternarios por el HTML.
 *
 * **Por qué NO `<app-health-badge>`** (decisión cerrada en RFC-003 D4.1 y
 * su alternativa 5): sus labels ("Saludable", "Degradado", "Sin datos") son
 * del dominio observability y quedarían mal en una card de red social;
 * parametrizarlos le rompería el contrato de source-of-truth. `p-tag` +
 * estos tokens cuestan 20 líneas y no tocan `shared/`.
 *
 * Tokens LOCALES a `social-connections/` a propósito: no hay segundo
 * consumidor (RFC-001 D8 — la promoción a `shared/` exige ≥2 módulos no
 * sociales o primitiva de catálogo). Si RFC-004 los necesita, se promueven
 * con `.tokens.ts` + story en ese PR.
 */

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Conectada',
  expired: 'Token expirado',
  error: 'Error',
  disconnected: 'Sin conectar',
};

export type ConnectionSeverity = 'success' | 'warn' | 'danger' | 'secondary';

/**
 * Mapping a severity de `<p-tag>`. `disconnected` → `secondary` (neutral,
 * sin connotación negativa): para un cliente recién registrado TODAS las
 * redes arrancan así — es el estado normal de partida, no una falla.
 */
export const CONNECTION_STATUS_SEVERITIES: Record<
  ConnectionStatus,
  ConnectionSeverity
> = {
  connected: 'success',
  expired: 'warn',
  error: 'danger',
  disconnected: 'secondary',
};
