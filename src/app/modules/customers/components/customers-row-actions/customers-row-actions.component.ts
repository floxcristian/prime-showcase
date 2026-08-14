// Angular
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
// PrimeNG
import type { Popover } from 'primeng/popover';
import { PopoverModule } from 'primeng/popover';
// Local
import { reopenPopover } from '../../../../shared/utils/popover';
import type { Customer } from '../../models/customer.interface';

const PRIME_MODULES = [PopoverModule];

/** Acción del menú ··· de fila. El container la despacha en
 * `onRowAction` al handler correspondiente (drawer, bulk dialogs,
 * mailto, duplicado, delete). */
export type CustomerRowAction =
  | 'detail'
  | 'edit'
  | 'assign'
  | 'email'
  | 'duplicate'
  | 'delete';

/**
 * Menú ··· de acciones de fila — single popover instance reusable per
 * row (patrón Linear/Notion/Stripe para popovers contextuales). Lo
 * comparten la celda de acciones desktop y la card mobile.
 *
 * **Qué vive acá**: el `<p-popover #op>` (el `#op` pasó de template-ref
 * cruzado del container a ref local resuelto vía `viewChild`), el
 * customer "scoped" sobre el que actúa el menú, y el timer del reopen
 * diferido (`reopenPopover`, hide + show a 150ms) con su teardown.
 *
 * **Qué NO vive acá**: los 6 handlers de acción quedan en el container
 * (tocan drawer + URL, selección + bulk dialogs, mock API). Este
 * componente solo emite `{ action, customer }` — mismo orden
 * `op.hide()` → handler que antes del split.
 *
 * Sin host class: `p-popover` es overlay (renderiza fuera del flujo),
 * el host no participa del layout — patrón de los otros overlays del
 * módulo (drawer, cmdk, sheet).
 */
@Component({
  selector: 'app-customers-row-actions',
  imports: [PRIME_MODULES],
  templateUrl: './customers-row-actions.component.html',
  styleUrl: './customers-row-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersRowActionsComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Acción elegida (post `op.hide()`) — el container la despacha en
   * `onRowAction` con el customer scoped al momento del click. */
  readonly actionSelected = output<{
    action: CustomerRowAction;
    customer: Customer;
  }>();

  /** Ref local al `<p-popover #op>` — `required` porque el popover
   * está en el root del template del hijo, fuera de todo `@if`. */
  private readonly op = viewChild.required<Popover>('op');

  /**
   * Customer "scoped" en el popover de acciones — `emit()` lo lee para
   * saber sobre cuál fila actuar. Patrón canónico para popovers
   * contextuales (Linear, Notion, Stripe): single popover instance
   * reusable per row.
   */
  protected readonly popoverCustomer = signal<Customer | null>(null);

  /** Handle del reopen diferido del popover — cancelado en el
   * `destroyRef.onDestroy` del constructor (ver shared/utils/popover). */
  private popoverReopenTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Teardown del timer de reopen. Sin esto, navegar fuera de la ruta
    // en la ventana de 150ms dispararía `show()` sobre un popover ya
    // destruido.
    this.destroyRef.onDestroy(() => {
      if (this.popoverReopenTimer !== null) {
        clearTimeout(this.popoverReopenTimer);
        this.popoverReopenTimer = null;
      }
    });
  }

  /** API imperativa mínima — el container la invoca vía `viewChild`
   * desde sus 2 call sites (card mobile + celda desktop). Ex
   * `displayPopover` del container. */
  open(event: MouseEvent, customer: Customer): void {
    this.popoverCustomer.set(customer);
    this.popoverReopenTimer = reopenPopover(event, this.op());
  }

  /** Emite la acción con el customer scoped — cada menuitem hace
   * `op.hide(); emit('<action>')`, mismo orden hide → handler que
   * cuando los handlers vivían inline en el container. */
  protected emit(action: CustomerRowAction): void {
    const c = this.popoverCustomer();
    if (c) this.actionSelected.emit({ action, customer: c });
  }
}
