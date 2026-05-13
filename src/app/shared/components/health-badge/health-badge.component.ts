import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

import type { HealthState } from '../../../modules/observability/models/observability.interface';

/**
 * Indicador visual del estado de salud de un servicio. Wrappea `<p-tag>`
 * con severity mapping fija — separa la decisión semántica (qué tag usar
 * para "warn") del consumer, que solo conoce el estado de dominio.
 *
 * Tres tamaños: `sm` (filas de tabla), `md` (cards), `lg` (header de
 * service detail). El `lg` agrega un dot animado (pulse) cuando el estado
 * es `critical` para llamar atención sin gritar visualmente.
 */
@Component({
  selector: 'app-health-badge',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tag [severity]="severity()" [value]="label()" [icon]="icon()" [class]="size() === 'lg' ? 'text-base' : ''" />
  `,
})
export class HealthBadgeComponent {
  readonly state = input.required<HealthState>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected readonly severity = computed<'success' | 'warn' | 'danger' | 'secondary'>(() => {
    const s = this.state();
    if (s === 'ok') return 'success';
    if (s === 'warn') return 'warn';
    if (s === 'critical') return 'danger';
    return 'secondary';
  });

  protected readonly label = computed<string>(() => {
    const s = this.state();
    if (s === 'ok') return 'Saludable';
    if (s === 'warn') return 'Degradado';
    if (s === 'critical') return 'Crítico';
    return 'Sin datos';
  });

  protected readonly icon = computed<string>(() => {
    const s = this.state();
    if (s === 'ok') return 'fa-sharp fa-regular fa-circle-check';
    if (s === 'warn') return 'fa-sharp fa-regular fa-triangle-exclamation';
    if (s === 'critical') return 'fa-sharp fa-regular fa-circle-exclamation';
    return 'fa-sharp fa-regular fa-circle-question';
  });
}
