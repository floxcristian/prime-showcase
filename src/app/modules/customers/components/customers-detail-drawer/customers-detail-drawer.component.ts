// Angular
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Tag } from 'primeng/tag';
// Local
import type { Customer } from '../../models/customer.interface';
import {
  carteraLabel,
  carteraSeverity,
  classificationSeverity,
  formatCredit,
  lifecycleSeverity,
  typeSeverity,
} from '../../utils/customers-format.util';

const PRIME_MODULES = [ButtonModule, Drawer, Tag];

/**
 * Detail drawer del cliente (universal mobile + desktop) — right-side
 * drawer con la info COMPLETA del modelo, no sólo las columnas visibles
 * en la tabla. Patrón Linear/HubSpot/Stripe/Salesforce: detail panel
 * single-source, mismo componente cross-viewport.
 *
 * **Por qué `input` y no `model`**: el estado `detailedCustomer` vive
 * en el container porque abrir/cerrar escribe la URL (`?detail=<id>`)
 * bajo el guard `isApplyingFromUrl`. Los 4 productores (cards mobile,
 * popover de fila, cmdk, hidratación desde URL) y el cierre deben pasar
 * por `openDetail`/`closeDetail` del container — un two-way binding acá
 * permitiría cierres que bypasean la escritura de URL. Por eso el
 * binding interno es one-way + guard (`[visible]="!!customer()"` +
 * `(visibleChange)` que sólo emite `closed` al cerrar), NUNCA
 * `[(visible)]`.
 *
 * Cero estado propio: puro render de `customer()` con los formatters
 * del util re-expuestos como campos (el template movido no cambia).
 */
@Component({
  selector: 'app-customers-detail-drawer',
  imports: [PRIME_MODULES],
  templateUrl: './customers-detail-drawer.component.html',
  styleUrl: './customers-detail-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersDetailDrawerComponent {
  /** Cliente mostrado. `null` = drawer cerrado. */
  readonly customer = input<Customer | null>(null);

  /** Emitido cuando el user cierra el drawer (X, mask, swipe). El
   * container responde con `closeDetail()` — que además limpia el
   * `?detail` de la URL. */
  readonly closed = output<void>();

  // Formatters/severities puros del util — re-expuestos como campos
  // para que el template movido no cambie ni un carácter.
  protected readonly typeSeverity = typeSeverity;
  protected readonly formatCredit = formatCredit;
  protected readonly classificationSeverity = classificationSeverity;
  protected readonly carteraSeverity = carteraSeverity;
  protected readonly carteraLabel = carteraLabel;
  protected readonly lifecycleSeverity = lifecycleSeverity;
}
