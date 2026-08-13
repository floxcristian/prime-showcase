import type {
  ChannelPref,
  DevicePref,
} from '../models/preferences.interface';

/**
 * Estado inicial de canales y dispositivos de `obs-preferences`. En
 * producción vendría de `GET /me/preferences`; acá es el snapshot default
 * que los signals del componente clonan/actualizan.
 */
export const CHANNEL_PREFS_MOCK: readonly ChannelPref[] = [
  {
    key: 'push',
    label: 'Notificaciones push',
    description: 'En el dispositivo registrado, sin abrir la app.',
    icon: 'fa-sharp fa-regular fa-mobile',
    enabled: true,
  },
  {
    key: 'email',
    label: 'Email',
    description: 'A tu correo corporativo.',
    icon: 'fa-sharp fa-regular fa-envelope',
    enabled: true,
  },
  {
    key: 'in-app',
    label: 'In-app',
    description: 'Banner dentro de la app cuando estás conectado.',
    icon: 'fa-sharp fa-regular fa-bell',
    enabled: true,
  },
];

export const DEVICE_PREFS_MOCK: readonly DevicePref[] = [
  {
    id: 'dev-1',
    name: 'iPhone 15 Pro · Brook',
    icon: 'fa-sharp fa-regular fa-mobile-screen',
    linkedAgo: 'hace 12 días',
    primary: true,
  },
  {
    id: 'dev-2',
    name: 'MacBook Pro · Chrome',
    icon: 'fa-sharp fa-regular fa-laptop',
    linkedAgo: 'hace 3 meses',
    primary: false,
  },
];
