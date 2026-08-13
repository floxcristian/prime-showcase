import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

import type { HealthState } from '../../../modules/observability/models/observability.interface';
import {
  HEALTH_LABELS,
  HEALTH_SEVERITIES,
  type HealthSeverity,
} from './health-badge.tokens';

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
    <p-tag
      [severity]="severity()"
      [value]="label()"
      [icon]="icon()"
      [class]="size() === 'lg' ? 'text-base' : ''"
    />
  `,
})
export class HealthBadgeComponent {
  readonly state = input.required<HealthState>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  // Label y severity derivan del vocabulario compartido en
  // `health-badge.tokens.ts` — mismo mapping que consumen los filtros y
  // tooltips del módulo observability.
  protected readonly severity = computed<HealthSeverity>(
    () => HEALTH_SEVERITIES[this.state()],
  );

  protected readonly label = computed<string>(
    () => HEALTH_LABELS[this.state()],
  );

  protected readonly icon = computed<string>(() => {
    const s = this.state();
    if (s === 'ok') return 'fa-sharp fa-regular fa-circle-check';
    if (s === 'warn') return 'fa-sharp fa-regular fa-triangle-exclamation';
    if (s === 'critical') return 'fa-sharp fa-regular fa-circle-exclamation';
    return 'fa-sharp fa-regular fa-circle-question';
  });
}
