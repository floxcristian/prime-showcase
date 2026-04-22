import { computed, Injectable, signal } from '@angular/core';

import { NOTIFICATIONS } from '../mocks/notifications';
import {
  Notification,
  NotificationGroup,
} from '../models/notification.interface';

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
   * "Hoy" si es la fecha actual del showcase (2026-04-22), "Ayer" si es un
   * día antes, sino formato "Dom 19 abr".
   */
  private formatGroupLabel(dateKey: string): string {
    const today = new Date('2026-04-22');
    const date = new Date(dateKey);
    const diffDays = Math.round(
      (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
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
