import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  Notification,
  NotificationGroup,
} from './models/notification.interface';
import { NOTIFICATIONS } from './mocks/notifications';

/**
 * Vista de notificaciones del usuario. Lista cronológica agrupada por día:
 * "Hoy", "Ayer" y fechas absolutas hacia atrás. Cada item muestra icon por
 * categoría (finance / inventory / customer / logistics / system), title,
 * description y hora; unread items con dot indicator + title más pesado.
 *
 * Decisiones de scope (showcase):
 *   - Sin delete per-item (la spec del producto lo excluye)
 *   - Sin tabs / filtros por categoría (lista simple y directa)
 *   - Sin paginación (11 items mock alcanzan; pagination se agregaría con backend)
 *   - Agrupamiento calcula relative date labels en `formatGroupLabel()` usando
 *     la fecha del showcase (2026-04-22) como "hoy" para que los mocks se
 *     distribuyan entre "Hoy / Ayer / Dom 19 abr" de forma consistente.
 */
@Component({
  selector: 'app-notifications',
  imports: [NgClass, RouterModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col',
  },
})
export class NotificationsComponent {
  private readonly notifications = signal<Notification[]>(NOTIFICATIONS);

  /**
   * Agrupa las notificaciones por día y genera labels relativos.
   * Orden dentro de cada grupo: más reciente primero (consistencia con el
   * orden ya-sorted del mock).
   */
  protected readonly groups = computed<NotificationGroup[]>(() => {
    const items = this.notifications();
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

  protected readonly unreadCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  formatTime(timestamp: string): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * "Hoy" si es la fecha actual del showcase, "Ayer" si es un día antes,
   * sino formato "Dom 19 abr" (día abreviado + día + mes abreviado).
   * Anclado a 2026-04-22 como "hoy" del showcase.
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
