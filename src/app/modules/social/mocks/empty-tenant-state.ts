import type { TenantProviderState } from '../models/provider.interface';
import { PROVIDER_CATALOG } from './provider-catalog';

/**
 * Estado inicial de un cliente recién registrado: TODO vacío/deshabilitado,
 * cero hardcodeo (RFC-002 D3/D6 + RFC-003 D6.2). Es también el default que
 * `SocialSettingsService` devuelve en server (`!isBrowser`) y el fallback
 * cuando el storage del cliente no existe todavía.
 *
 * Los `configs` se derivan del catálogo (un config por provider, `enabled:
 * false`, sin `activeKeyId`, `options` vacías) — así el estado nunca
 * driftea si el catálogo suma un provider. Sin keys, sin cuentas
 * conectadas y `activeByKind: {}` (ningún provider activo por categoría):
 * las páginas read-only muestran empty state con CTA a
 * `/social/connections` (gating de RFC-001).
 */
export const EMPTY_TENANT_STATE: TenantProviderState = {
  configs: PROVIDER_CATALOG.map((descriptor) => ({
    providerId: descriptor.id,
    enabled: false,
    options: {},
  })),
  keys: [],
  accounts: [],
  activeByKind: {},
};
