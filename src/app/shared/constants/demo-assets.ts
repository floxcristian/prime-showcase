/**
 * Assets demo del showcase (avatares, covers e imágenes de chat) servidos
 * desde el CDN público de PrimeTek. Centralizado acá para que la base no se
 * repita en cada mock/constant — si el CDN cambia (o se decide self-hostear
 * los assets), se actualiza en un solo lugar.
 */
export const DEMO_ASSETS_BASE =
  'https://www.primefaces.org/cdn/primevue/images/landing/apps/';

/**
 * Construye la URL absoluta de un asset demo a partir de su filename.
 *
 * @example demoAsset('avatar11.jpg') // → 'https://www.primefaces.org/cdn/.../apps/avatar11.jpg'
 */
export function demoAsset(file: string): string {
  return `${DEMO_ASSETS_BASE}${file}`;
}
