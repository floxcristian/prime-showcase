import { PERMISSION_MODULES } from './permission-modules';
import type { AccessLevel, ModulePermission, Role } from '../models/role.interface';

/**
 * Helper para generar permissions array para un role. Recibe un map
 * parcial `{ moduleId → level }` y un `defaultLevel` para módulos no
 * mencionados explícitamente. Reduce el boilerplate del mock — cada
 * role solo declara los módulos donde difiere del default.
 *
 * Iteramos `PERMISSION_MODULES` para garantizar que cada role tenga
 * exactamente un permission por cada módulo del dashboard. Sin gaps,
 * sin extras.
 */
function buildPermissions(
  overrides: Partial<Record<string, AccessLevel>>,
  defaultLevel: AccessLevel = 'none',
): ModulePermission[] {
  return PERMISSION_MODULES.map((m) => ({
    moduleId: m.id,
    level: overrides[m.id] ?? defaultLevel,
  }));
}

export const ROLES_DATA: Role[] = [
  {
    id: 1,
    name: 'Admin',
    description:
      'Acceso administrativo completo a todos los módulos del sistema',
    type: 'Sistema',
    userCount: 3,
    status: 'Activo',
    updatedAt: '2026-04-22T10:00:00Z',
    permissions: buildPermissions({}, 'admin'),
  },
  {
    id: 2,
    name: 'Auditor',
    description:
      'Acceso de solo lectura a todos los módulos para tareas de auditoría y compliance',
    type: 'Sistema',
    userCount: 5,
    status: 'Activo',
    updatedAt: '2026-04-15T14:20:00Z',
    permissions: buildPermissions({}, 'read'),
  },
  {
    id: 3,
    name: 'Developer',
    description:
      'Acceso técnico — admin en observabilidad y administración, write en módulos operativos',
    type: 'Sistema',
    userCount: 7,
    status: 'Activo',
    updatedAt: '2026-04-26T09:45:00Z',
    permissions: buildPermissions({
      observabilidad: 'admin',
      administracion: 'admin',
      crm: 'write',
      oms: 'write',
      ecommerce: 'write',
      inventarios: 'write',
      pim: 'write',
      cms: 'write',
      ia: 'admin',
      ayuda: 'read',
      'canal-denuncias': 'read',
    }, 'read'),
  },
  {
    id: 4,
    name: 'Soporte',
    description:
      'Atención al cliente — modificar tickets de postventa, consultar clientes y pedidos',
    type: 'Sistema',
    userCount: 12,
    status: 'Activo',
    updatedAt: '2026-04-20T11:30:00Z',
    permissions: buildPermissions({
      postventa: 'admin',
      crm: 'read',
      oms: 'read',
      ecommerce: 'read',
      cobranza: 'read',
      ayuda: 'admin',
      'canal-denuncias': 'read',
    }, 'none'),
  },
  {
    id: 5,
    name: 'Operaciones',
    description:
      'Gestión de pedidos, inventarios, logística y bodegas',
    type: 'Sistema',
    userCount: 8,
    status: 'Activo',
    updatedAt: '2026-04-25T16:00:00Z',
    permissions: buildPermissions({
      oms: 'admin',
      inventarios: 'admin',
      logistica: 'admin',
      pim: 'write',
      ecommerce: 'read',
      crm: 'read',
    }, 'none'),
  },
  {
    id: 6,
    name: 'Comercial',
    description:
      'Ventas, gestión de clientes y campañas de marketing',
    type: 'Sistema',
    userCount: 14,
    status: 'Activo',
    updatedAt: '2026-04-26T13:15:00Z',
    permissions: buildPermissions({
      crm: 'admin',
      ventas: 'admin',
      cobranza: 'write',
      marketplace: 'write',
      pim: 'read',
      ecommerce: 'read',
      cms: 'read',
    }, 'none'),
  },
  {
    id: 7,
    name: 'Integrador',
    description:
      'Acceso programático para integraciones externas — APIs, webhooks, observabilidad',
    type: 'Sistema',
    userCount: 4,
    status: 'Activo',
    updatedAt: '2026-04-23T08:00:00Z',
    permissions: buildPermissions({
      observabilidad: 'admin',
      crm: 'write',
      oms: 'write',
      ecommerce: 'write',
      pim: 'read',
      administracion: 'read',
    }, 'none'),
  },
  {
    id: 8,
    name: 'Consultor',
    description:
      'Acceso de lectura a módulos comerciales y operativos para análisis y reportes',
    type: 'Sistema',
    userCount: 2,
    status: 'Activo',
    updatedAt: '2026-04-18T17:30:00Z',
    permissions: buildPermissions({
      crm: 'read',
      oms: 'read',
      ecommerce: 'read',
      ventas: 'read',
      cobranza: 'read',
      tesoreria: 'read',
      pim: 'read',
    }, 'none'),
  },
  {
    id: 9,
    name: 'Demo solo lectura',
    description:
      'Role personalizado para demostraciones — solo lectura en CRM y catálogo',
    type: 'Personalizado',
    userCount: 0,
    status: 'Inactivo',
    updatedAt: '2026-03-30T12:00:00Z',
    permissions: buildPermissions({
      crm: 'read',
      pim: 'read',
      ecommerce: 'read',
    }, 'none'),
  },
];
