import { Notification } from '../models/notification.interface';

/**
 * Mock data del showcase — notificaciones ERP típicas de operación diaria.
 * Mix de categorías (finance / inventory / customer / logistics / system) y
 * estados (read/unread) para exhibir los distintos visual states del componente.
 *
 * Timestamps relativos a 2026-04-22 (fecha del showcase). Distribuidos en
 * varios días para ejercitar el grouping por fecha.
 */
export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'Factura #4521 aprobada',
    description:
      'Finanzas aprobó la factura por $2.450.000 del cliente Distribuidora Sur.',
    timestamp: '2026-04-22T10:45:00',
    read: false,
    category: 'finance',
    icon: 'fa-sharp-duotone fa-regular fa-file-invoice-dollar',
  },
  {
    id: 'n2',
    title: 'Stock crítico',
    description:
      'Neumáticos P195/65R15 bajo el umbral mínimo en Bodega Norte (quedan 8 unidades).',
    timestamp: '2026-04-22T09:20:00',
    read: false,
    category: 'inventory',
    icon: 'fa-sharp-duotone fa-regular fa-triangle-exclamation',
  },
  {
    id: 'n3',
    title: 'Nuevo ticket de soporte',
    description:
      'Ticket #891 abierto por María González: problema con exportación de reportes.',
    timestamp: '2026-04-22T08:15:00',
    read: true,
    category: 'system',
    icon: 'fa-sharp-duotone fa-regular fa-circle-question',
  },
  {
    id: 'n4',
    title: 'OC #892 pendiente de revisión',
    description:
      'Orden de compra por $8.920.000 requiere aprobación del área logística.',
    timestamp: '2026-04-21T17:30:00',
    read: false,
    category: 'logistics',
    icon: 'fa-sharp-duotone fa-regular fa-clipboard-list',
  },
  {
    id: 'n5',
    title: 'Cliente actualizó datos',
    description:
      'Juan Pérez actualizó su dirección y teléfono de contacto en el portal.',
    timestamp: '2026-04-21T14:05:00',
    read: true,
    category: 'customer',
    icon: 'fa-sharp-duotone fa-regular fa-user-pen',
  },
  {
    id: 'n6',
    title: 'Pago recibido',
    description:
      'Transferencia Transbank por $1.850.000 abonada en cuenta corriente.',
    timestamp: '2026-04-21T11:42:00',
    read: true,
    category: 'finance',
    icon: 'fa-sharp-duotone fa-regular fa-credit-card',
  },
  {
    id: 'n7',
    title: 'Backup del sistema completado',
    description: 'Respaldo nocturno finalizado correctamente. 47 GB procesados.',
    timestamp: '2026-04-21T03:12:00',
    read: true,
    category: 'system',
    icon: 'fa-sharp-duotone fa-regular fa-database',
  },
  {
    id: 'n8',
    title: 'Cotización 4521 enviada a aprobación',
    description:
      'Cotización para cliente Ferretería Andes por $5.680.000 en revisión.',
    timestamp: '2026-04-20T16:20:00',
    read: true,
    category: 'finance',
    icon: 'fa-sharp-duotone fa-regular fa-file-lines',
  },
  {
    id: 'n9',
    title: 'Recepción de mercadería',
    description:
      'Ingreso confirmado de OC #889 (324 items) en Bodega Central.',
    timestamp: '2026-04-20T10:05:00',
    read: true,
    category: 'logistics',
    icon: 'fa-sharp-duotone fa-regular fa-truck-ramp-box',
  },
  {
    id: 'n10',
    title: 'Actualización de precios',
    description:
      'Lista "Mayorista otoño 2026" publicada con 183 productos modificados.',
    timestamp: '2026-04-19T15:45:00',
    read: true,
    category: 'inventory',
    icon: 'fa-sharp-duotone fa-regular fa-tag',
  },
  {
    id: 'n11',
    title: 'Nuevo cliente registrado',
    description:
      'Repuestos del Sur SpA completó su registro y está pendiente de activación.',
    timestamp: '2026-04-19T12:10:00',
    read: true,
    category: 'customer',
    icon: 'fa-sharp-duotone fa-regular fa-user-plus',
  },
];
