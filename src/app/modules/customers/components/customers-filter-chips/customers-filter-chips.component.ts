// Angular
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
// PrimeNG
import { TooltipModule } from 'primeng/tooltip';
// Local
import { TooltipDismissOnClickDirective } from '../../../../shared/directives/tooltip-dismiss-on-click.directive';
import type { ActiveFilter } from '../../services/customers-filter.facade';

const PRIME_MODULES = [TooltipModule];
const LOCAL_COMPONENTS = [TooltipDismissOnClickDirective];

/**
 * Chip bar de filtros activos (Linear/Notion/Stripe/Datadog
 * convergente) — un pill removible por filtro + "Limpiar" (2+ filtros)
 * + "Compartir" (copy URL de la vista).
 *
 * **Presentacional puro**: recibe el espejo push-based del facade
 * (`filters.active()`) ya formateado (`label` + `display` pre-
 * computados) y emite intenciones. El removal (`Table.filter(null,
 * field, matchMode)`) y el clear van directo al facade desde el
 * binding del container; `copyShareUrl` (window + clipboard + toasts)
 * queda en el container.
 *
 * `host: contents` — el host no genera caja; el `<div role="region">`
 * conserva su `mb-4` y el pixel no cambia respecto de cuando el markup
 * era hijo directo del template del container.
 */
@Component({
  selector: 'app-customers-filter-chips',
  imports: [PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './customers-filter-chips.component.html',
  styleUrl: './customers-filter-chips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class CustomersFilterChipsComponent {
  /** Filtros activos ya formateados — espejo `filters.active()` del
   * facade. Dueño: container (única escritura via `refresh()`). */
  readonly filters = input<readonly ActiveFilter[]>([]);

  /** Click en un chip — el container remueve via facade
   * (`Table.filter(null, field, matchMode)`). */
  readonly filterRemoved = output<ActiveFilter>();

  /** "Limpiar" — clear bulk de filtros + sort + eco mobile (container). */
  readonly clearAllRequested = output<void>();

  /** "Compartir" — copiar la URL de la vista al clipboard (container). */
  readonly shareRequested = output<void>();
}
