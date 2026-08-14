import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { RelativeTimePipe } from '../../pipes/relative-time.pipe';

/**
 * Cluster derecho de toolbar: freshness ("Actualizado hace X") +
 * botón refresh. Antes vivía copy-pasteado en users / roles /
 * customers / obs-uptime, con drift de variante en el botón.
 *
 * **Variante del botón — decisión de unificación**: `p-button-tonal`
 * (antes users/roles/obs-uptime usaban `outlined severity="secondary"`
 * y customers `styleClass="p-button-tonal"`). Tonal es la canónica
 * porque: (1) la jerarquía documentada en customers reserva
 * tonal-primary para utility actions del toolbar ("Actualizar",
 * "Limpiar") — el user aprende "azul = puedo hacer algo"; (2) los
 * clear buttons de `COLUMN_FILTER_PT` ya son tonal en las 4 vistas;
 * (3) los commits recientes (`fix(tonal)`, `fix(a11y) tonal-variant
 * WCAG AA`) invirtieron en robustecer esa variante como estándar.
 *
 * **Refresh feedback — por qué `animate-spin` y no `[loading]`**:
 * PrimeNG con `[loading]` swap-ea el icon por un SVG spinner casi
 * idéntico al fa-arrows-rotate (ambos círculos con flechas) → durante
 * 1-2 frames de transición se ven los dos overlapped, apariencia de
 * "2 iconos" reportada en QA. En su lugar, durante loading rotamos el
 * MISMO icon via `animate-spin` (Tailwind keyframe linear infinite):
 * fa-arrows-rotate ya semántica "girar/refrescar" → rotarlo comunica
 * "trabajando" sin swap (sin flicker). Patrón Linear / Stripe
 * Dashboard / Vercel para refresh buttons. `prefers-reduced-motion`
 * neutraliza la animación globalmente (styles.scss).
 *
 * `[disabled]` bloquea tap-spam DURANTE el fetch. El tradeoff conocido
 * — disabled aplica `pointer-events:none` → el tooltip "Actualizar" no
 * aparece en hover durante loading — es aceptable porque el spin icon
 * ya es el feedback visual del estado. El consumer además debe guardear
 * `retry()` contra reentry como defense-in-depth (`trackedResource()`
 * ya lo hace).
 *
 * El slot `<ng-content>` va después del botón: controles extra del
 * cluster (density toggle, filtros mobile, CTA crear en customers)
 * quedan como hijos del mismo flex.
 */
@Component({
  selector: 'app-refresh-toolbar',
  imports: [ButtonModule, TooltipModule, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lastFetchedAt(); as ts) {
      <span
        class="text-sm text-muted-color leading-5 hidden lg:inline"
        aria-live="polite"
      >
        Actualizado {{ ts | relativeTime }}
      </span>
    }
    <p-button
      [icon]="
        'fa-sharp fa-regular fa-arrows-rotate' +
        (loading() ? ' animate-spin' : '')
      "
      [disabled]="loading()"
      styleClass="p-button-tonal"
      ariaLabel="Actualizar"
      pTooltip="Actualizar"
      tooltipPosition="bottom"
      (onClick)="refresh.emit()"
    />
    <ng-content />
  `,
  host: {
    class: 'ml-auto flex items-center gap-2 lg:gap-3 shrink-0',
  },
})
export class RefreshToolbarComponent {
  /** Timestamp ISO del último fetch exitoso — `null` oculta el label. */
  readonly lastFetchedAt = input<string | null>(null);
  /** Fetch en curso — spin del icon + disabled del botón. */
  readonly loading = input<boolean>(false);
  readonly refresh = output<void>();
}
