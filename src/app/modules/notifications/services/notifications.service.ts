import { computed, inject, InjectionToken, Injectable, signal } from '@angular/core';

import { NOTIFICATIONS } from '../mocks/notifications';
import {
  Notification,
  NotificationGroup,
} from '../models/notification.interface';

/**
 * Reference date del showcase — los mocks en `mocks/notifications.ts` tienen
 * timestamps fijados al 2026-04-22; este token hace que el grouping
 * ("Hoy"/"Ayer"/fecha) se calcule relativo a esa fecha y no a `new Date()`,
 * evitando que el demo degrade con el paso del tiempo ("todas hace 300 días").
 *
 * Expuesto como `InjectionToken` (no constante hardcoded en el service) por 2
 * razones bigtech:
 *   1. Override en tests: `TestBed.configureTestingModule({ providers: [
 *      { provide: NOTIFICATIONS_REFERENCE_DATE, useValue: new Date('YYYY-MM-DD') } ] })`
 *      sin necesidad de `vi.setSystemTime()` o spying.
 *   2. Override runtime: producción inyectará `{ useFactory: () => new Date() }`
 *      para leer `now` real; el showcase mantiene la fecha del mock para
 *      estabilidad visual sin tocar el service.
 *
 * Ref: Angular DI tokens — https://angular.dev/guide/di/dependency-injection-providers
 */
export const NOTIFICATIONS_REFERENCE_DATE = new InjectionToken<Date>(
  'NotificationsReferenceDate',
  {
    providedIn: 'root',
    factory: () => new Date('2026-04-22'),
  },
);

/**
 * Single source of truth de notificaciones. Compartido entre la vista full
 * (`/notifications` route) y el popover del toolbar desktop — ambos leen el
 * mismo signal para que unread count, grouping y formatting sean consistentes.
 *
 * En producción la fuente sería un stream del backend (polling / websocket /
 * server-sent events). Para el showcase es data estática del mock con signal.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly referenceDate = inject(NOTIFICATIONS_REFERENCE_DATE);
  private readonly _notifications = signal<Notification[]>(NOTIFICATIONS);

  readonly notifications = this._notifications.asReadonly();

  readonly unreadCount = computed(
    () => this._notifications().filter((n) => !n.read).length,
  );

  /**
   * Agrupa por día y genera labels relativos ("Hoy", "Ayer", "Dom 19 abr").
   * Orden descendente por fecha (más reciente primero).
   */
  readonly groups = computed<NotificationGroup[]>(() => {
    const items = this._notifications();
    const buckets = new Map<string, Notification[]>();
    for (const n of items) {
      const key = n.timestamp.split('T')[0];
      const arr = buckets.get(key) ?? [];
      arr.push(n);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([key, arr]) => ({
        label: this.formatGroupLabel(key),
        notifications: arr,
      }));
  });

  formatTime(timestamp: string): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * "Hoy" si es la fecha de referencia, "Ayer" si es un día antes, sino
   * formato "Dom 19 abr". La fecha de referencia se inyecta vía el token
   * `NOTIFICATIONS_REFERENCE_DATE` — ver JSDoc del token para contexto.
   */
  private formatGroupLabel(dateKey: string): string {
    const date = new Date(dateKey);
    const diffDays = Math.round(
      (this.referenceDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return date
      .toLocaleDateString('es-CL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      .replace('.', '');
  }
}
