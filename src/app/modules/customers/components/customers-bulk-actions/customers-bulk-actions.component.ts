// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
// Local
import { TooltipDismissOnClickDirective } from '../../../../shared/directives/tooltip-dismiss-on-click.directive';
import type { Customer } from '../../models/customer.interface';

const NG_MODULES = [FormsModule];
const PRIME_MODULES = [ButtonModule, Dialog, Select, TooltipModule];
const LOCAL_COMPONENTS = [TooltipDismissOnClickDirective];

/**
 * Bulk actions de la selección — barra tonal (count + Asignar/Exportar/
 * Eliminar/Cancelar) + los 2 diálogos scoped a la selección (assign
 * vendedor y confirm delete). Patrón Salesforce/HubSpot/Zoho.
 *
 * **Un componente, no tres**: barra y diálogos comparten exactamente un
 * concern (operaciones sobre la selección) y un solo dato (`count`).
 *
 * **Qué vive acá y qué no**: el hijo es dueño solo del micro-estado del
 * assign dialog (`bulkAssignSeller`). La selección (`selectedRows`),
 * las mutaciones optimistas (`applyBulkAssign`/`applyBulkDelete`), el
 * undo buffer + toast "Deshacer", el export CSV y TODOS los toasts
 * quedan en el container. `assignVisible`/`deleteVisible` son `model()`
 * porque el popover de fila también los abre desde el container
 * (`onActionAssign`/`onActionDelete` → single-row-via-bulk), y el
 * container los cierra al confirmar (fluye de vuelta por el binding).
 *
 * `host: contents` — el host no genera caja; la barra conserva su
 * `mb-4` y los `<p-dialog>` (overlays) viven como hermanos FUERA del
 * `@if` de la barra, así siguen montados aunque la selección sea 0.
 */
@Component({
  selector: 'app-customers-bulk-actions',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './customers-bulk-actions.component.html',
  styleUrl: './customers-bulk-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class CustomersBulkActionsComponent {
  /** Filas seleccionadas. Dueño: container (las escriben la tabla, las
   * cards mobile y el popover de fila). */
  readonly selection = input<readonly Customer[]>([]);

  /** Catálogo de vendedores para el select del assign dialog. */
  readonly sellers = input<readonly string[]>([]);

  /** Two-way — también los abre el popover de fila (via container) y
   * los cierra el container al confirmar la acción. */
  readonly assignVisible = model<boolean>(false);
  readonly deleteVisible = model<boolean>(false);

  /** Vendedor elegido y confirmado — el container muta el dataset. */
  readonly assignConfirmed = output<string>();
  /** Confirm del delete — el container ejecuta el soft-delete + undo. */
  readonly deleteConfirmed = output<void>();
  /** "Exportar" — CSV client-side, vive en el container. */
  readonly exportRequested = output<void>();
  /** "Cancelar" — limpiar selección. */
  readonly clearRequested = output<void>();

  protected readonly count = computed(() => this.selection().length);

  /** Copia mutable para `<p-select [options]>` — tipa `any[]` y un
   * readonly array no es asignable bajo strictTemplates (mismo criterio
   * que `columnDefs` en el container). */
  protected readonly sellerOptions = computed<string[]>(() => [
    ...this.sellers(),
  ]);

  /** Seller elegido en el dialog — estado 100% interno del dialog. */
  protected readonly bulkAssignSeller = signal<string | null>(null);

  constructor() {
    // Reset del seller al cerrar — equivale exactamente al reset-al-
    // abrir del viejo `openBulkAssign` (el valor al abrir siempre es
    // null por ambos caminos, incluido el del popover de fila).
    effect(() => {
      if (!this.assignVisible()) {
        this.bulkAssignSeller.set(null);
      }
    });
  }

  /** Botón "Asignar" del dialog — guard no-null + emit. El container
   * cierra seteando `bulkAssignVisible=false` en `applyBulkAssign`
   * (fluye de vuelta por el model binding). */
  protected confirmAssign(): void {
    const seller = this.bulkAssignSeller();
    if (!seller) return;
    this.assignConfirmed.emit(seller);
  }
}
