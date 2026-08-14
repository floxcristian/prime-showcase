import type { ApiKeyStatus } from '../../models/provider.interface';

/**
 * Vocabulario local del estado de una API key → UI (RFC-003 D5.1). Mismo
 * patrón que `health-badge.tokens.ts` / `connection-status.tokens.ts`: el
 * mapping vive en UN solo lugar y la card lo consume, en vez de repartir
 * ternarios por el template.
 *
 * No se promueve a `shared/`: lo consume una sola página (RFC-001 D8 — la
 * promoción exige ≥2 módulos NO sociales o primitiva de catálogo). Si una
 * segunda vista social necesita el mismo badge, se mueve a
 * `modules/social/components/` con su `.tokens.ts` en ese PR.
 */
export const API_KEY_STATUS_LABELS: Record<ApiKeyStatus, string> = {
  valid: 'Válida',
  invalid: 'Inválida',
  expired: 'Expirada',
  unverified: 'Sin verificar',
};

/** Severities de `<p-tag>` — subset cerrado para que el template no acepte
 *  un string arbitrario (strictTemplates lo verifica en el binding). */
export type ApiKeySeverity = 'success' | 'danger' | 'warn' | 'secondary';

export const API_KEY_STATUS_SEVERITIES: Record<ApiKeyStatus, ApiKeySeverity> = {
  valid: 'success',
  invalid: 'danger',
  expired: 'warn',
  unverified: 'secondary',
};
