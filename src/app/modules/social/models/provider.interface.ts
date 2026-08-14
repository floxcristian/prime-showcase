import type { MetricKind, SocialAccount, SocialNetwork } from './social.interface';

/**
 * Catálogo de providers y configuración por cliente de la suite social.
 * Separación estricta: catálogo (plataforma-global, estático, tipado) vs
 * configuración (por cliente, mutable, persistida — mecánica en RFC-003).
 * Los IDs de provider son union types cerrados: agregar un provider es un
 * cambio de compilación, no de datos.
 *
 * Contrato congelado: RFC-002 D3 (docs/rfcs/rfc-002-modelo-de-dominio-
 * puertos-y-mocks.md). Las constantes `PROVIDER_CATALOG` y
 * `EMPTY_TENANT_STATE` NO viven acá: se materializan en `mocks/`
 * (RFC-002 D1 + plan §3) — este archivo contiene solo tipos.
 */

export type ProviderKind = 'analytics-connector' | 'image-gen' | 'video-gen' | 'text-gen';

export type AnalyticsConnectorId = 'instagram-graph' | 'facebook-graph' | 'tiktok-api';
export type ImageGenProviderId = 'openai-images' | 'gemini-imagen';
export type VideoGenProviderId = 'veo' | 'heygen' | 'higgsfield';
export type TextGenProviderId = 'gpt' | 'gemini';
export type ProviderId =
  | AnalyticsConnectorId
  | ImageGenProviderId
  | VideoGenProviderId
  | TextGenProviderId;

/** Capabilities declarativas — la UI se auto-configura leyéndolas (cero if-por-provider). */
export interface ProviderCapabilities {
  readonly networks?: readonly SocialNetwork[];        // analytics-connector
  readonly supportedMetrics?: readonly MetricKind[];   // analytics-connector
  readonly maxVideoSeconds?: number;                   // video-gen
  readonly supportsAvatars?: boolean;                  // heygen
  readonly aspectRatios?: readonly string[];           // '1:1' | '9:16' | '16:9'
  readonly maxResolution?: string;                     // '1024x1024' | '4k'
  readonly captionVariants?: number;                   // text-gen: 3
}

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly kind: ProviderKind;
  readonly name: string;                // 'Google Veo'
  readonly vendor: string;              // 'Google DeepMind'
  /** fa-brands solo para logos reales (Instagram, Facebook, TikTok); resto fa-sharp fa-regular. */
  readonly icon: string;
  readonly docsUrl: string;
  /** Hint de formato + regex de shape-check client-side (D5: verifyKey). */
  readonly keyFormatHint: string;       // 'sk-…' | 'AIza…' | 'EAAG…'
  readonly keyPattern: string;          // '^sk-[A-Za-z0-9]{20,}$' — RegExp source, serializable
  readonly capabilities: ProviderCapabilities;
}

// PROVIDER_CATALOG (catálogo estático — 10 entries: 3 connectors, 2 image-gen,
// 3 video-gen, 2 text-gen; const tipada UPPER_SNAKE) se materializa en
// `mocks/provider-catalog.ts` (RFC-002 D1, etapa 2).

// ── Configuración por cliente (persistida — mecánica en RFC-003) ─────

export type ApiKeyStatus = 'unverified' | 'valid' | 'invalid' | 'expired';

export interface ApiKeyEntry {
  readonly id: string;
  readonly providerId: ProviderId;
  /** SOLO la versión enmascarada se persiste/muestra: 'sk-…a4f9' (patrón maskPrefix de api-keys-mock). */
  readonly maskedKey: string;
  readonly status: ApiKeyStatus;
  readonly lastVerifiedAt?: string;
  readonly createdAt: string;
  readonly label?: string;              // 'Producción', 'Cuenta agencia'
}

/** El plaintext existe únicamente en el retorno de addKey — se muestra una vez y se descarta. */
export interface ApiKeyWithPlaintext {
  readonly entry: ApiKeyEntry;
  readonly plaintext: string;
}

export interface ConnectorConfig {
  readonly providerId: ProviderId;
  readonly enabled: boolean;
  readonly activeKeyId?: string;
  /** Opciones específicas validadas contra capabilities (ej: aspectRatio default). */
  readonly options: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Estado completo de configuración DEL CLIENTE AUTENTICADO — lo que
 * SocialSettingsService expone como signal y persiste (RFC-003).
 * Incluye las cuentas sociales conectadas: conectar una cuenta ES
 * configuración del cliente, no dato de analytics.
 */
export interface TenantProviderState {
  readonly configs: readonly ConnectorConfig[];
  readonly keys: readonly ApiKeyEntry[];
  readonly accounts: readonly SocialAccount[];
  /**
   * Provider ACTIVO por categoría de generación (text-gen/image-gen/video-gen):
   * el que el studio preselecciona (RFC-006 D7). Se setea con
   * `setActiveProvider` (UX en RFC-003 D5.4: al habilitar el primero de una
   * categoría se vuelve activo automáticamente). `analytics-connector` no
   * aplica (cada red usa su propio conector) — nunca aparece como key.
   */
  readonly activeByKind: Partial<Record<ProviderKind, ProviderId>>;
}

// EMPTY_TENANT_STATE (estado inicial de un cliente recién registrado: TODO
// vacío/deshabilitado, `activeByKind: {}` incluido — cero hardcodeo) se
// materializa en `mocks/` junto al catálogo (RFC-002 D1 + plan §3, etapa 2).
