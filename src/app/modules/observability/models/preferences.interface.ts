/**
 * Shapes del estado de preferencias de notificaciones — pensados para
 * mapear 1:1 a `PUT /me/preferences` cuando exista el backend real.
 */

export interface ChannelPref {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly enabled: boolean;
}

export interface DevicePref {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly linkedAgo: string;
  readonly primary: boolean;
}
