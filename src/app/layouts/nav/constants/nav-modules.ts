import { NavModule } from '../models/nav-module.interface';

export const NAV_MODULES: NavModule[] = [
  {
    id: 'crm',
    title: 'CRM',
    icon: 'fa-sharp-duotone fa-regular fa-address-book',
    sections: [
      {
        id: 'crm.adm-clientes',
        title: 'Adm. Clientes',
        icon: 'fa-sharp-duotone fa-regular fa-users',
        children: [
          { title: 'Clientes', url: '/customers' },
          { title: 'Búsqueda de Cliente', url: '/customers' },
          { title: 'Créditos Preaprobados', url: '/cards' },
          { title: 'NPS', url: '/' },
          { title: 'Holding Clientes', url: '/customers' },
          { title: 'Contactabilidad Cliente', url: '/chat' },
        ],
      },
      {
        id: 'crm.adm-vendedores',
        title: 'Adm. Vendedores',
        icon: 'fa-sharp-duotone fa-regular fa-user-tie',
        children: [
          { title: 'Vendedores', url: '/customers' },
          { title: 'Cartera Asignada', url: '/customers' },
          { title: 'Metas & KPIs', url: '/' },
        ],
      },
      {
        id: 'crm.campana',
        title: 'Campaña',
        icon: 'fa-sharp-duotone fa-regular fa-bullseye',
        children: [
          { title: 'Campañas activas', url: '/' },
          { title: 'Crear campaña', url: '/cards' },
          { title: 'Segmentación', url: '/customers' },
        ],
      },
      {
        id: 'crm.app-llamados',
        title: 'App de Llamados',
        icon: 'fa-sharp-duotone fa-regular fa-phone',
        children: [
          { title: 'Bandeja de llamados', url: '/inbox' },
          { title: 'Historial', url: '/inbox' },
        ],
      },
      {
        id: 'crm.auditoria',
        title: 'Auditoría',
        icon: 'fa-sharp-duotone fa-regular fa-shield-halved',
        children: [
          { title: 'Logs de acceso', url: '/' },
          { title: 'Cambios de cliente', url: '/customers' },
        ],
      },
    ],
  },
  {
    id: 'oms',
    title: 'OMS',
    icon: 'fa-sharp-duotone fa-regular fa-truck',
    sections: [
      {
        id: 'oms.pedidos',
        title: 'Pedidos',
        icon: 'fa-sharp-duotone fa-regular fa-clipboard-list',
        children: [
          { title: 'Bandeja de pedidos', url: '/inbox' },
          { title: 'En preparación', url: '/inbox' },
          { title: 'Despachados', url: '/inbox' },
        ],
      },
      {
        id: 'oms.devoluciones',
        title: 'Devoluciones',
        icon: 'fa-sharp-duotone fa-regular fa-rotate-left',
        children: [
          { title: 'Solicitudes', url: '/inbox' },
          { title: 'Histórico', url: '/' },
        ],
      },
      {
        id: 'oms.ruteo',
        title: 'Ruteo & Despacho',
        icon: 'fa-sharp-duotone fa-regular fa-route',
        children: [
          { title: 'Planificación', url: '/' },
          { title: 'En tránsito', url: '/inbox' },
        ],
      },
    ],
  },
  {
    id: 'ecommerce',
    title: 'Ecommerce',
    icon: 'fa-sharp-duotone fa-regular fa-cart-shopping',
    sections: [
      {
        id: 'ecommerce.catalogo',
        title: 'Catálogo',
        icon: 'fa-sharp-duotone fa-regular fa-boxes-stacked',
        children: [
          { title: 'Productos publicados', url: '/cards' },
          { title: 'Productos pausados', url: '/cards' },
        ],
      },
      {
        id: 'ecommerce.promociones',
        title: 'Promociones',
        icon: 'fa-sharp-duotone fa-regular fa-tag',
        children: [
          { title: 'Cupones', url: '/cards' },
          { title: 'Descuentos por volumen', url: '/' },
        ],
      },
      {
        id: 'ecommerce.checkout',
        title: 'Checkout',
        icon: 'fa-sharp-duotone fa-regular fa-credit-card',
        children: [
          { title: 'Carros abandonados', url: '/inbox' },
          { title: 'Pasarelas de pago', url: '/cards' },
        ],
      },
    ],
  },
  {
    id: 'inventarios',
    title: 'Inventarios',
    icon: 'fa-sharp-duotone fa-regular fa-warehouse',
    sections: [
      {
        id: 'inventarios.stock',
        title: 'Stock',
        icon: 'fa-sharp-duotone fa-regular fa-boxes-stacked',
        children: [
          { title: 'Por bodega', url: '/' },
          { title: 'Movimientos', url: '/inbox' },
        ],
      },
      {
        id: 'inventarios.bodegas',
        title: 'Bodegas',
        icon: 'fa-sharp-duotone fa-regular fa-building',
        children: [
          { title: 'Maestro de bodegas', url: '/customers' },
          { title: 'Ubicaciones', url: '/' },
        ],
      },
      {
        id: 'inventarios.inventariado',
        title: 'Toma de Inventario',
        icon: 'fa-sharp-duotone fa-regular fa-clipboard-check',
        children: [
          { title: 'Programar toma', url: '/' },
          { title: 'Resultados', url: '/inbox' },
        ],
      },
    ],
  },
  {
    id: 'pim',
    title: 'PIM',
    icon: 'fa-sharp-duotone fa-regular fa-lightbulb',
    sections: [
      {
        id: 'pim.maestro',
        title: 'Maestro de Productos',
        icon: 'fa-sharp-duotone fa-regular fa-cube',
        children: [
          { title: 'Productos', url: '/cards' },
          { title: 'Atributos', url: '/' },
          { title: 'Jerarquías', url: '/' },
        ],
      },
      {
        id: 'pim.catalogos',
        title: 'Catálogos',
        icon: 'fa-sharp-duotone fa-regular fa-book',
        children: [
          { title: 'Catálogos publicados', url: '/cards' },
          { title: 'Borradores', url: '/cards' },
        ],
      },
      {
        id: 'pim.propaganda',
        title: 'Propaganda',
        icon: 'fa-sharp-duotone fa-regular fa-display',
        children: [
          { title: 'Crear propaganda', url: '/cards' },
          { title: 'Cronograma', url: '/' },
        ],
      },
      {
        id: 'pim.precios',
        title: 'Precios',
        icon: 'fa-sharp-duotone fa-regular fa-dollar-sign',
        children: [
          { title: 'Listas de precios', url: '/' },
          { title: 'Reglas', url: '/cards' },
        ],
      },
    ],
  },
  {
    id: 'ventas',
    title: 'Ventas',
    icon: 'fa-sharp-duotone fa-regular fa-hand-holding-dollar',
    sections: [
      {
        id: 'ventas.resumen',
        title: 'Resumen Comercial',
        icon: 'fa-sharp-duotone fa-regular fa-chart-line',
        children: [
          { title: 'Dashboard', url: '/' },
          { title: 'Por vendedor', url: '/customers' },
        ],
      },
      {
        id: 'ventas.cotizaciones',
        title: 'Cotizaciones',
        icon: 'fa-sharp-duotone fa-regular fa-file-invoice-dollar',
        children: [
          { title: 'Pendientes', url: '/inbox' },
          { title: 'Aprobadas', url: '/inbox' },
        ],
      },
      {
        id: 'ventas.ordenes',
        title: 'Órdenes',
        icon: 'fa-sharp-duotone fa-regular fa-receipt',
        children: [{ title: 'Todas las órdenes', url: '/inbox' }],
      },
    ],
  },
  {
    id: 'postventa',
    title: 'Postventa',
    icon: 'fa-sharp-duotone fa-regular fa-user-headset',
    sections: [
      {
        id: 'postventa.tickets',
        title: 'Tickets',
        icon: 'fa-sharp-duotone fa-regular fa-ticket',
        children: [
          { title: 'Abiertos', url: '/inbox' },
          { title: 'En proceso', url: '/inbox' },
          { title: 'Resueltos', url: '/inbox' },
        ],
      },
      {
        id: 'postventa.garantias',
        title: 'Garantías',
        icon: 'fa-sharp-duotone fa-regular fa-shield-check',
        children: [
          { title: 'Vigentes', url: '/customers' },
          { title: 'Reclamos', url: '/inbox' },
        ],
      },
    ],
  },
  {
    id: 'cobranza',
    title: 'Cobranza',
    icon: 'fa-sharp-duotone fa-regular fa-money-bill-wave',
    sections: [
      {
        id: 'cobranza.cartera',
        title: 'Cartera',
        icon: 'fa-sharp-duotone fa-regular fa-folder-open',
        children: [
          { title: 'Deudores', url: '/customers' },
          { title: 'Por antigüedad', url: '/' },
        ],
      },
      {
        id: 'cobranza.gestion',
        title: 'Gestión de Cobro',
        icon: 'fa-sharp-duotone fa-regular fa-gavel',
        children: [
          { title: 'Bandeja', url: '/inbox' },
          { title: 'Convenios', url: '/cards' },
        ],
      },
    ],
  },
  {
    id: 'tesoreria',
    title: 'Tesorería',
    icon: 'fa-sharp-duotone fa-regular fa-sack-dollar',
    sections: [
      {
        id: 'tesoreria.bancos',
        title: 'Bancos',
        icon: 'fa-sharp-duotone fa-regular fa-building-columns',
        children: [
          { title: 'Cuentas', url: '/cards' },
          { title: 'Conciliación', url: '/' },
        ],
      },
      {
        id: 'tesoreria.flujo',
        title: 'Flujo de Caja',
        icon: 'fa-sharp-duotone fa-regular fa-chart-area',
        children: [
          { title: 'Proyectado', url: '/' },
          { title: 'Real', url: '/' },
        ],
      },
    ],
  },
  {
    id: 'cms',
    title: 'CMS',
    icon: 'fa-sharp-duotone fa-regular fa-file-lines',
    sections: [
      {
        id: 'cms.contenido',
        title: 'Contenido',
        icon: 'fa-sharp-duotone fa-regular fa-newspaper',
        children: [
          { title: 'Páginas', url: '/cards' },
          { title: 'Blog', url: '/movies' },
          { title: 'Banners', url: '/cards' },
        ],
      },
      {
        id: 'cms.media',
        title: 'Media',
        icon: 'fa-sharp-duotone fa-regular fa-photo-film',
        children: [
          { title: 'Biblioteca', url: '/movies' },
          { title: 'Subir archivo', url: '/cards' },
        ],
      },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    icon: 'fa-sharp-duotone fa-regular fa-store',
    sections: [
      {
        id: 'marketplace.vendedores',
        title: 'Vendedores',
        icon: 'fa-sharp-duotone fa-regular fa-users',
        children: [
          { title: 'Activos', url: '/customers' },
          { title: 'Solicitudes', url: '/inbox' },
        ],
      },
      {
        id: 'marketplace.comisiones',
        title: 'Comisiones',
        icon: 'fa-sharp-duotone fa-regular fa-percent',
        children: [
          { title: 'Reglas', url: '/cards' },
          { title: 'Liquidaciones', url: '/' },
        ],
      },
    ],
  },
  {
    id: 'logistica',
    title: 'Logística',
    icon: 'fa-sharp-duotone fa-regular fa-boxes-packing',
    sections: [
      {
        id: 'logistica.abastecimiento',
        title: 'Abastecimiento',
        icon: 'fa-sharp-duotone fa-regular fa-truck-ramp-box',
        children: [
          { title: 'Órdenes de compra', url: '/inbox' },
          { title: 'Proveedores', url: '/customers' },
        ],
      },
      {
        id: 'logistica.distribucion',
        title: 'Distribución',
        icon: 'fa-sharp-duotone fa-regular fa-truck-fast',
        children: [
          { title: 'Rutas', url: '/' },
          { title: 'Flota', url: '/customers' },
        ],
      },
    ],
  },
  {
    id: 'ia',
    title: 'IA',
    icon: 'fa-sharp-duotone fa-regular fa-sparkles',
    sections: [
      {
        id: 'ia.asistente',
        title: 'Asistente',
        icon: 'fa-sharp-duotone fa-regular fa-message-bot',
        children: [
          { title: 'Chat', url: '/chat' },
          { title: 'Historial', url: '/chat' },
        ],
      },
      {
        id: 'ia.insights',
        title: 'Insights',
        icon: 'fa-sharp-duotone fa-regular fa-chart-pie',
        children: [
          { title: 'Predicciones', url: '/' },
          { title: 'Alertas', url: '/inbox' },
        ],
      },
    ],
  },
  {
    id: 'administracion',
    title: 'Administración',
    icon: 'fa-sharp-duotone fa-regular fa-users-gear',
    sections: [
      {
        id: 'administracion.usuarios',
        title: 'Usuarios & Roles',
        icon: 'fa-sharp-duotone fa-regular fa-user-shield',
        children: [
          { title: 'Usuarios', url: '/customers' },
          { title: 'Roles', url: '/cards' },
          { title: 'Permisos', url: '/cards' },
        ],
      },
      {
        id: 'administracion.parametros',
        title: 'Parámetros',
        icon: 'fa-sharp-duotone fa-regular fa-sliders',
        children: [
          { title: 'Generales', url: '/' },
          { title: 'Por módulo', url: '/cards' },
        ],
      },
    ],
  },
  {
    id: 'ayuda',
    title: 'Ayuda',
    icon: 'fa-sharp-duotone fa-regular fa-circle-question',
    sections: [
      {
        id: 'ayuda.docs',
        title: 'Documentación',
        icon: 'fa-sharp-duotone fa-regular fa-book-open',
        children: [
          { title: 'Guías de uso', url: '/movies' },
          { title: 'Preguntas frecuentes', url: '/' },
        ],
      },
      {
        id: 'ayuda.soporte',
        title: 'Soporte',
        icon: 'fa-sharp-duotone fa-regular fa-life-ring',
        children: [
          { title: 'Contactar soporte', url: '/chat' },
          { title: 'Mis tickets', url: '/inbox' },
        ],
      },
    ],
  },
  {
    id: 'canal-denuncias',
    title: 'Canal de Denuncias',
    icon: 'fa-sharp-duotone fa-regular fa-bullhorn',
    sections: [
      {
        id: 'canal.denuncias',
        title: 'Denuncias',
        icon: 'fa-sharp-duotone fa-regular fa-triangle-exclamation',
        children: [
          { title: 'Nueva denuncia', url: '/cards' },
          { title: 'Mis denuncias', url: '/inbox' },
        ],
      },
    ],
  },
];
