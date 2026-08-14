/**
 * Vocabulario compartido red social → UI del chip. Mismo criterio que
 * `status-chip.tokens.ts` / `health-badge.tokens.ts`: `NetworkChipComponent`
 * y los consumers (tabs, leyendas, filtros por red) derivan de acá en vez
 * de duplicar el mapping — un cambio de copy o de icono se hace en un solo
 * lugar.
 */

/**
 * Espejo DESACOPLADO de `SocialNetwork` (RFC-002 D2,
 * `modules/social/models/social.interface.ts`). La capa `shared/` no puede
 * importar de `modules/social/**` (restricción de capas, RFC-001 D8), así
 * que este union local replica el contrato estructuralmente idéntico —
 * TypeScript los hace intercambiables en los bindings del consumer sin
 * cast alguno. Si el dominio agrega una red, este espejo se actualiza en
 * el mismo PR.
 */
export type ChipNetwork = 'instagram' | 'facebook' | 'tiktok';

/** Orden canónico de presentación (mismo orden que `SOCIAL_NETWORKS` del dominio). */
export const CHIP_NETWORKS: readonly ChipNetwork[] = [
  'instagram',
  'facebook',
  'tiktok',
];

/** Nombre canónico de marca — no se traduce ni se abrevia. */
export const CHIP_NETWORK_LABELS: Record<ChipNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

/**
 * Logos de marca reales — único caso donde DESIGN.md permite `fa-brands`
 * (nunca para iconos de UI generales).
 */
export const CHIP_NETWORK_ICONS: Record<ChipNetwork, string> = {
  instagram: 'fa-brands fa-instagram',
  facebook: 'fa-brands fa-facebook',
  tiktok: 'fa-brands fa-tiktok',
};
