/**
 * Niveles de acceso por módulo. Modelo jerárquico inclusivo:
 *   - none  → no aparece el módulo en la nav del usuario.
 *   - read  → ver listados/detalles, sin poder modificar.
 *   - write → crear/editar registros (incluye read).
 *   - admin → write + configuración del módulo (settings, parámetros).
 *
 * Patrón AWS IAM / GitHub orgs: niveles ordenados, cada uno incluye los
 * inferiores. Simplifica el UI (un solo selector por módulo) frente a
 * matrices de permisos por acción individual.
 */
export type AccessLevel = 'none' | 'read' | 'write' | 'admin';

/**
 * Permiso por módulo del dashboard. `moduleId` matchea los IDs de
 * `NAV_MODULES` (crm, oms, ecommerce, etc.) — single source of truth
 * de los módulos visibles en la app.
 */
export interface ModulePermission {
  moduleId: string;
  level: AccessLevel;
}

/**
 * Sistema  → role built-in del producto (Admin, Auditor, etc.). No se
 *            puede eliminar; los permisos pueden modificarse pero la
 *            entry siempre existe.
 * Personalizado → creado por el cliente. Se puede eliminar / duplicar /
 *                 modificar libremente.
 *
 * El distintivo afecta la UI (badge + acciones disponibles) y la lógica
 * de soft-delete/archive.
 */
export type RoleType = 'Sistema' | 'Personalizado';

export type RoleStatus = 'Activo' | 'Inactivo';

export interface Role {
  id: number;
  name: string;
  description: string;
  type: RoleType;
  /** Cantidad de usuarios actualmente asignados a este role. */
  userCount: number;
  status: RoleStatus;
  /** ISO 8601 — última modificación de permisos o metadata. */
  updatedAt: string;
  permissions: ModulePermission[];
}
