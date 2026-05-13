import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * KPI card con valor + label + delta opcional vs período anterior.
 *
 * Usado en headers de dashboards (uptime 24h, error rate, p99, alertas
 * activas). El delta colorea según `direction`:
 *   - `up-good`: subir es bueno (uptime, throughput).
 *   - `up-bad`:  subir es malo (error rate, latency).
 * El consumer pasa la dirección semántica; el componente decide el color
 * y la flecha. Sin delta, el bloque inferior se omite.
 *
 * Color del delta:
 *   - direction "buena" (mejora) → `text-green-500` (token DS exento).
 *   - direction "mala" (empeora) → `text-color-emphasis` (neutral fuerte;
 *     red/rose Tailwind no está en la paleta permitida — la flecha + el
 *     contexto de "vs período anterior" comunican negatividad sin ese hue).
 *   - sin cambio → `text-muted-color`.
 */
@Component({
  selector: 'app-metric-card',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block border border-surface rounded-2xl p-4 lg:p-5 flex flex-col gap-2',
  },
  template: `
    <div class="flex items-center gap-2">
      @if (icon()) {
        <i [class]="icon()" class="text-base text-muted-color" aria-hidden="true"></i>
      }
      <span class="text-sm font-medium text-muted-color leading-5">
        {{ label() }}
      </span>
    </div>

    <div class="flex items-baseline gap-1">
      <span class="text-3xl font-bold text-color leading-normal">{{ value() }}</span>
      @if (unit()) {
        <span class="text-sm font-medium text-muted-color leading-5">{{ unit() }}</span>
      }
    </div>

    @if (delta() !== null && delta() !== undefined) {
      <div class="flex items-center gap-1">
        <i [class]="deltaIcon()" [ngClass]="deltaColorClass()" class="text-xs" aria-hidden="true"></i>
        <span [ngClass]="deltaColorClass()" class="text-xs font-medium">
          {{ deltaFormatted() }}
        </span>
        <span class="text-xs text-muted-color">vs período anterior</span>
      </div>
    }
  `,
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string>('');
  readonly icon = input<string>('');
  readonly delta = input<number | null | undefined>(null);
  readonly direction = input<'up-good' | 'up-bad'>('up-good');

  protected readonly deltaSign = computed<1 | -1 | 0>(() => {
    const d = this.delta();
    if (d === null || d === undefined || d === 0) return 0;
    return d > 0 ? 1 : -1;
  });

  protected readonly deltaIcon = computed<string>(() => {
    const sign = this.deltaSign();
    if (sign === 0) return 'fa-sharp fa-regular fa-minus';
    return sign === 1 ? 'fa-sharp fa-regular fa-arrow-trend-up' : 'fa-sharp fa-regular fa-arrow-trend-down';
  });

  protected readonly deltaColorClass = computed<string>(() => {
    const sign = this.deltaSign();
    if (sign === 0) return 'text-muted-color';
    const upIsGood = this.direction() === 'up-good';
    const isGood = (sign === 1 && upIsGood) || (sign === -1 && !upIsGood);
    return isGood ? 'text-green-500' : 'text-color-emphasis';
  });

  protected readonly deltaFormatted = computed<string>(() => {
    const d = this.delta();
    if (d === null || d === undefined) return '';
    const abs = Math.abs(d);
    const formatted = abs < 10 ? abs.toFixed(2) : abs.toFixed(1);
    const sign = d > 0 ? '+' : d < 0 ? '−' : '';
    return `${sign}${formatted}%`;
  });
}
