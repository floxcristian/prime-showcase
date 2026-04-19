export interface LoginFeature {
  icon: string;
  title: string;
  description: string;
}

export interface LoginStat {
  value: string;
  label: string;
}

export interface LoginTestimonial {
  quote: string;
  initials: string;
  name: string;
  role: string;
  company: string;
  city: string;
}

export const LOGIN_FEATURES: readonly LoginFeature[] = [
  {
    icon: 'fa-sharp fa-regular fa-users',
    title: 'Clientes 360°',
    description: 'Talleres y clientes finales en un solo perfil.',
  },
  {
    icon: 'fa-sharp fa-regular fa-boxes-stacked',
    title: 'Catálogo maestro',
    description: 'SKUs con compatibilidad por marca y modelo.',
  },
  {
    icon: 'fa-sharp fa-regular fa-cart-shopping',
    title: 'Pedidos y despacho',
    description: 'Reservas, rutas y entregas sincronizadas.',
  },
  {
    icon: 'fa-sharp fa-regular fa-bullseye-arrow',
    title: 'Campañas dirigidas',
    description: 'Segmenta por vehículo, zona y historial.',
  },
];

export const LOGIN_STATS: readonly LoginStat[] = [
  { value: '+120', label: 'distribuidores activos' },
  { value: '38.000', label: 'SKUs gestionados' },
  { value: '99,2%', label: 'DTE aceptados al primer intento' },
];

export const LOGIN_TESTIMONIAL: LoginTestimonial = {
  quote:
    'Pasamos de tres sistemas a uno. Un mecánico en Pucón pide un filtro y lo despachamos el mismo día con factura electrónica lista.',
  initials: 'CM',
  name: 'Carlos Morales',
  role: 'Gerente de Operaciones',
  company: 'Repuestos Araucanía',
  city: 'Temuco',
};
