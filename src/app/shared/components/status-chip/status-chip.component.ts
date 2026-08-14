import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

import type { AlertStatus } from '../../../modules/observability/models/observability.interface';
import { ALERT_STATUS_LABELS } from './status-chip.tokens';

/**
 * Chip semántico para status de alerta. Mismo contrato que SeverityChip:
 * el consumer pasa el status del dominio, el componente decide severity y
 * label. Antes existía un `statusClass()` inline con `bg-orange-100`
 * hardcoded, que fragmentaba el sistema vs SeverityChip y duplicaba el
 * mapping en cada lista de alertas.
 *
 * Mapping a severity de PrimeNG:
 *   firing       → warn       (theme orange)
 *   acknowledged → secondary  (neutral, ya está siendo trabajada)
 *   resolved     → success    (theme green)
 *   silenced     → secondary  (neutral, sin atención requerida)
 */
@Component({
  selector: 'app-status-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tag
      [severity]="severity()"
      [value]="label()"
      [icon]="icon()"
      class="font-medium"
    />
  `,
})
export class StatusChipComponent {
  readonly value = input.required<AlertStatus>();

  protected readonly severity = computed<'warn' | 'success' | 'secondary'>(() => {
    const s = this.value();
    if (s === 'firing') return 'warn';
    if (s === 'resolved') return 'success';
    return 'secondary';
  });

  // Labels desde el vocabulario compartido (`status-chip.tokens.ts`) —
  // mismo record que consume el filtro de estado de obs-alerts.
  protected readonly label = computed<string>(
    () => ALERT_STATUS_LABELS[this.value()],
  );

  protected readonly icon = computed<string>(() => {
    const s = this.value();
    if (s === 'firing') return 'fa-sharp fa-regular fa-bell-on';
    if (s === 'acknowledged') return 'fa-sharp fa-regular fa-circle-check';
    if (s === 'resolved') return 'fa-sharp fa-regular fa-check-double';
    return 'fa-sharp fa-regular fa-bell-slash';
  });
}
