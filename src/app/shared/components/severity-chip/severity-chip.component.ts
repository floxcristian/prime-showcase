import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

import type { AlertSeverity } from '../../../modules/observability/models/observability.interface';

/**
 * Chip de severidad para alertas — wrappea `<p-tag>` con severity mapping
 * fijo. Mismo decoupling que HealthBadge: el consumer sabe sobre dominio
 * (`'critical' | 'warn' | 'info'`), no sobre tags de PrimeNG.
 */
@Component({
  selector: 'app-severity-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <p-tag [severity]="severity()" [value]="label()" [icon]="icon()" class="font-medium" /> `,
})
export class SeverityChipComponent {
  readonly value = input.required<AlertSeverity>();

  protected readonly severity = computed<'danger' | 'warn' | 'info'>(() => {
    const v = this.value();
    if (v === 'critical') return 'danger';
    if (v === 'warn') return 'warn';
    return 'info';
  });

  protected readonly label = computed<string>(() => {
    const v = this.value();
    if (v === 'critical') return 'Crítico';
    if (v === 'warn') return 'Advertencia';
    return 'Info';
  });

  protected readonly icon = computed<string>(() => {
    const v = this.value();
    if (v === 'critical') return 'fa-sharp fa-solid fa-circle-exclamation';
    if (v === 'warn') return 'fa-sharp fa-regular fa-triangle-exclamation';
    return 'fa-sharp fa-regular fa-circle-info';
  });
}
