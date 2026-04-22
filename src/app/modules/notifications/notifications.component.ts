import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';

import { NotificationsService } from './services/notifications.service';

/**
 * Vista full de notificaciones (route `/notifications`). Lista cronológica
 * agrupada por día ("Hoy", "Ayer", fechas absolutas). Cada item muestra icon
 * por categoría, title, description, hora y dot indicator para no leídas.
 *
 * Los datos, grouping y formatters vienen de `NotificationsService` — compartidos
 * con el popover del toolbar desktop para que ambas superficies sean consistentes.
 *
 * Decisiones de scope (showcase):
 *   - Sin delete per-item (spec del producto lo excluye)
 *   - Sin tabs / filtros por categoría
 *   - Sin paginación (11 items mock; pagination se agregaría con backend)
 *   - Navegación sobre tap (via routerLink del recurso relacionado)
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
  protected notifications = inject(NotificationsService);
}
