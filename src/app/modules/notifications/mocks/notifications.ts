import { Notification } from '../models/notification.interface';

/**
 * Mock data del showcase — notificaciones ERP típicas de operación diaria.
 * Mix de categorías (finance / inventory / customer / logistics / system),
 * estados (read/unread) y longitudes (título 1 línea hasta 2 líneas,
 * description corta/mediana/larga) para exhibir los distintos layouts del
 * componente sin truncate/line-clamp.
 *
 * Timestamps relativos a 2026-04-22 (fecha del showcase). Distribuidos en
 * varios días para ejercitar el grouping por fecha.
 *
 * URLs apuntan a rutas existentes del showcase — en producción cada una iría
 * al detalle real del recurso (factura, OC, cliente, etc). Los eventos puros
 * del sistema (ej: backup) no tienen url → read-only.
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
    url: '/inbox',
  },
  {
    id: 'n2',
    title:
      'Solicitud de aprobación de orden de compra con múltiples proveedores internacionales',
    description:
      'La orden de compra #895 agrupa 6 proveedores (Chile, Perú, Argentina, Brasil) por un total de $24.800.000 USD. Requiere aprobación conjunta del área de finanzas y logística antes del cierre del día. Los tiempos de despacho varían entre 15 y 45 días dependiendo del origen, por lo que se recomienda revisar las fechas comprometidas con los clientes finales antes de aprobar.',
    timestamp: '2026-04-22T09:50:00',
    read: false,
    category: 'logistics',
    icon: 'fa-sharp-duotone fa-regular fa-clipboard-list',
    url: '/inbox',
  },
  {
    id: 'n3',
    title: 'Stock crítico',
    description:
      'Neumáticos P195/65R15 bajo el umbral mínimo en Bodega Norte (quedan 8 unidades).',
    timestamp: '2026-04-22T09:20:00',
    read: true,
    category: 'inventory',
    icon: 'fa-sharp-duotone fa-regular fa-triangle-exclamation',
    url: '/cards',
  },
  {
    id: 'n4',
    title: 'Nuevo ticket de soporte',
    description:
      'Ticket #891 abierto por María González: problema con exportación de reportes.',
    timestamp: '2026-04-22T08:15:00',
    read: true,
    category: 'system',
    icon: 'fa-sharp-duotone fa-regular fa-circle-question',
    url: '/inbox',
  },
  {
    id: 'n5',
    title: 'OC #892 pendiente de revisión',
    description:
      'Orden de compra por $8.920.000 requiere aprobación del área logística.',
    timestamp: '2026-04-21T17:30:00',
    read: true,
    category: 'logistics',
    icon: 'fa-sharp-duotone fa-regular fa-clipboard-list',
    url: '/inbox',
  },
  {
    id: 'n6',
    title:
      'Reporte mensual de conciliación bancaria disponible para revisión y descarga',
    description:
      'Se completó la conciliación de movimientos entre el ERP y los bancos principales (Banco de Chile, Santander, BCI). Diferencias encontradas: 3 movimientos menores totalizando $45.230 — requieren revisión manual dentro de los próximos 5 días hábiles para no impactar el cierre contable del mes.',
    timestamp: '2026-04-21T15:10:00',
    read: true,
    category: 'finance',
    icon: 'fa-sharp-duotone fa-regular fa-file-invoice-dollar',
    url: '/',
  },
  {
    id: 'n7',
    title: 'Cliente actualizó datos',
    description:
      'Juan Pérez actualizó su dirección y teléfono de contacto en el portal.',
    timestamp: '2026-04-21T14:05:00',
    read: true,
    category: 'customer',
    icon: 'fa-sharp-duotone fa-regular fa-user-pen',
    url: '/customers',
  },
  {
    id: 'n8',
    title: 'Pago recibido',
    description:
      'Transferencia Transbank por $1.850.000 abonada en cuenta corriente.',
    timestamp: '2026-04-21T11:42:00',
    read: true,
    category: 'finance',
    icon: 'fa-sharp-duotone fa-regular fa-credit-card',
    url: '/inbox',
  },
  {
    id: 'n9',
    title: 'Backup del sistema completado',
    description: 'Respaldo nocturno finalizado correctamente. 47 GB procesados.',
    timestamp: '2026-04-21T03:12:00',
    read: true,
    category: 'system',
    icon: 'fa-sharp-duotone fa-regular fa-database',
  },
  {
    id: 'n10',
    title: 'Cotización 4521 enviada a aprobación',
    description:
      'Cotización para cliente Ferretería Andes por $5.680.000 en revisión.',
    timestamp: '2026-04-20T16:20:00',
    read: true,
    category: 'finance',
    icon: 'fa-sharp-duotone fa-regular fa-file-lines',
    url: '/inbox',
  },
  {
    id: 'n11',
    title: 'Recepción de mercadería',
    description:
      'Ingreso confirmado de OC #889 (324 items) en Bodega Central.',
    timestamp: '2026-04-20T10:05:00',
    read: true,
    category: 'logistics',
    icon: 'fa-sharp-duotone fa-regular fa-truck-ramp-box',
    url: '/inbox',
  },
  {
    id: 'n12',
    title: 'Actualización de precios',
    description:
      'Lista "Mayorista otoño 2026" publicada con 183 productos modificados.',
    timestamp: '2026-04-19T15:45:00',
    read: true,
    category: 'inventory',
    icon: 'fa-sharp-duotone fa-regular fa-tag',
    url: '/cards',
  },
  {
    id: 'n13',
    title: 'Nuevo cliente registrado',
    description:
      'Repuestos del Sur SpA completó su registro y está pendiente de activación.',
    timestamp: '2026-04-19T12:10:00',
    read: true,
    category: 'customer',
    icon: 'fa-sharp-duotone fa-regular fa-user-plus',
    url: '/customers',
  },
];
