import { NAV_MODULES } from '../../../layouts/nav/constants/nav-modules';

/**
 * Catálogo de módulos del dashboard sobre los que se asignan permisos.
 * Derivado de `NAV_MODULES` (los top-level del sidebar) — single source
 * of truth: añadir un módulo nuevo al nav lo hace permissionable
 * automáticamente sin editar este archivo.
 *
 * Forma reducida (`id`, `title`, `icon`) — el role permissions UI no
 * necesita las sections/children del nav, sólo el nivel raíz para el
 * row del editor.
 */
export interface PermissionModule {
  id: string;
  title: string;
  icon: string;
}

export const PERMISSION_MODULES: readonly PermissionModule[] = NAV_MODULES.map(
  (m) => ({
    id: m.id,
    title: m.title,
    icon: m.icon,
  }),
);
