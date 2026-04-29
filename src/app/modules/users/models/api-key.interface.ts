/**
 * Permisos granulares — verbo + recurso. Convención REST estándar
 * (Stripe, GitHub, Twilio): el frontend muestra los scopes asignados
 * al crear/rotar; el gateway valida cada request contra ellos.
 */
export type ApiKeyScope =
  | 'read:customers'
  | 'write:customers'
  | 'read:orders'
  | 'write:orders'
  | 'read:reports'
  | 'webhooks:manage';

/**
 * Activa: en uso, válida.
 * Expirada: pasó `expiresAt` — el gateway la rechaza pero la entrada
 *   permanece visible para auditoría.
 * Revocada: deshabilitada manualmente (por rotación o decisión de
 *   admin). Mismo tratamiento que Expirada en el gateway, distinto
 *   semántico para reporting.
 */
export type ApiKeyStatus = 'Activa' | 'Expirada' | 'Revocada';

export interface ApiKey {
  id: string;
  /** Label legible asignado por el admin (ej: "Producción", "CI sandbox"). */
  name: string;
  /**
   * Prefix público — nunca el secret completo. Pattern Stripe:
   * `sk_live_<env>_<id>...<last4>`. La parte central es opaca; los
   * últimos 4 chars permiten al admin identificar visualmente cuál
   * key está usando un sistema sin revelar el secret entero.
   */
  prefix: string;
  scopes: ApiKeyScope[];
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 o null (nunca usada). */
  lastUsedAt: string | null;
  /** ISO 8601 o null (sin expiración). */
  expiresAt: string | null;
  status: ApiKeyStatus;
}

/**
 * Resultado de operaciones que generan un nuevo secret (create / rotate).
 * `plaintext` se retorna UNA SOLA VEZ — patrón industria estándar:
 * el backend hashea inmediatamente y nunca puede recuperarlo. El
 * frontend lo muestra una vez al admin con copy-to-clipboard, después
 * lo descarta del state.
 */
export interface ApiKeyWithSecret {
  key: ApiKey;
  plaintext: string;
}
