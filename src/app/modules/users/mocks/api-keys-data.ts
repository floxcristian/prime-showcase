import type { ApiKey } from '../models/api-key.interface';

/**
 * Mock de API keys por userId. Sólo los externos tienen entries — los
 * internos usan SSO/OAuth corporativo, no API keys. Mix realista:
 *   - Integradores: 2-3 keys (prod + staging típicos).
 *   - Partners: 1-2 keys (marketplace sync).
 *   - Consultores: 1 read-only key para data exports.
 *   - Auditores: 0-1 keys (algunos prefieren UI; otros automatizan).
 *
 * Estados mezclados: la mayoría Activa, algunas Expiradas (pasaron
 * `expiresAt`), una Revocada (rotación previa). Permite showcasear los
 * 3 severities del tag de estado en la dialog.
 */
export const USER_API_KEYS: Record<number, ApiKey[]> = {
  // Tomás Fernández — Integrador @ Acme Integrations
  7: [
    {
      id: 'k_7_1',
      name: 'Producción',
      prefix: 'sk_live_AcmeIntg…4f2a',
      scopes: ['read:customers', 'write:customers', 'read:orders', 'webhooks:manage'],
      createdAt: '2025-11-12T14:00:00Z',
      lastUsedAt: '2026-04-26T09:15:00Z',
      expiresAt: '2026-11-12T14:00:00Z',
      status: 'Activa',
    },
    {
      id: 'k_7_2',
      name: 'Staging',
      prefix: 'sk_test_AcmeIntg…8c9b',
      scopes: ['read:customers', 'read:orders'],
      createdAt: '2026-02-03T10:30:00Z',
      lastUsedAt: '2026-04-25T18:42:00Z',
      expiresAt: null,
      status: 'Activa',
    },
    {
      id: 'k_7_3',
      name: 'Legacy webhook',
      prefix: 'sk_live_AcmeIntg…1a2b',
      scopes: ['webhooks:manage'],
      createdAt: '2025-04-20T08:00:00Z',
      lastUsedAt: '2025-12-01T12:00:00Z',
      expiresAt: '2026-04-20T08:00:00Z',
      status: 'Expirada',
    },
  ],
  // Rodrigo Castro — Integrador @ NordStack (Inactivo)
  11: [
    {
      id: 'k_11_1',
      name: 'Sync diario',
      prefix: 'sk_live_NordStk…7e3d',
      scopes: ['read:customers', 'write:customers'],
      createdAt: '2025-08-15T11:00:00Z',
      lastUsedAt: '2026-03-29T22:00:00Z',
      expiresAt: null,
      status: 'Revocada',
    },
  ],
  // Marcos Cárdenas — Partner @ Partner Network
  15: [
    {
      id: 'k_15_1',
      name: 'Marketplace sync',
      prefix: 'sk_live_PartnerN…d5f1',
      scopes: ['read:orders', 'write:orders', 'read:reports'],
      createdAt: '2025-09-01T09:00:00Z',
      lastUsedAt: '2026-04-26T07:30:00Z',
      expiresAt: '2026-09-01T09:00:00Z',
      status: 'Activa',
    },
  ],
  // Isabel Soto — Consultor @ Global Consulting (Pendiente)
  9: [
    {
      id: 'k_9_1',
      name: 'Audit reports',
      prefix: 'sk_live_GlblCns…b8e7',
      scopes: ['read:reports'],
      createdAt: '2026-04-20T16:00:00Z',
      lastUsedAt: null,
      expiresAt: '2026-07-20T16:00:00Z',
      status: 'Activa',
    },
  ],
  // Andrés Morales — Auditor @ Deloitte (no tiene keys aún)
  // Patricia Vargas — Auditor @ KPMG (no tiene keys aún)
  // Joaquín León — Auditor @ PwC (no tiene keys aún)
};
