// Angular
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
// Local
import { TooltipDismissOnClickDirective } from '../../../../shared/directives/tooltip-dismiss-on-click.directive';
import {
  CustomersSavedViewsService,
  type SavedView,
} from '../../services/customers-saved-views.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [ButtonModule, Dialog, InputTextModule, TooltipModule];
const LOCAL_COMPONENTS = [TooltipDismissOnClickDirective];

/**
 * Saved views tab bar (desktop, lg+) + dialog "Guardar vista".
 * Patrón HubSpot/Salesforce: tabs horizontales con system + custom
 * views, dot `●` de cambios sin guardar, Descartar/Guardar cambios
 * inline y "Guardar vista" para snapshotear el state actual.
 *
 * **Qué vive acá y qué no**: el hijo es presentacional + dueño del
 * micro-estado del dialog (`saveViewVisible`/`saveViewName`). Todo lo
 * que toca el triángulo `currentSnapshot`/`_autoSelectSystemView`/
 * `hasUnsavedChanges` queda en el container: `activeSavedViewId`
 * (llega como `activeViewId` input), `applySavedView`, `resetActiveView`,
 * `updateActiveView`, `saveCurrentAsView` y `deleteSavedView` (escribe
 * `activeSavedViewId` al borrar la view activa — por eso el hijo solo
 * emite `deleteRequested`). El listado (`views()`/`busy()`/`get()`) se
 * lee del service root inyectado directo — misma instancia que usa el
 * container, sin duplicar inputs.
 *
 * `host: contents` — el host no genera caja; el `<div role="tablist">`
 * conserva su `mb-4` y el `<p-dialog>` (overlay) vive como hermano,
 * así el pixel no cambia respecto de cuando el markup era hijo directo
 * del template del container.
 */
@Component({
  selector: 'app-customers-saved-views-bar',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './customers-saved-views-bar.component.html',
  styleUrl: './customers-saved-views-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class CustomersSavedViewsBarComponent {
  /** Protected (no private): el template lee `views()`/`busy()`/`get()`
   * directo del service root — misma instancia que el container. */
  protected readonly savedViews = inject(CustomersSavedViewsService);

  /** ID de la saved view activa. Dueño: container (el active state
   * interactúa con el auto-select de system views y la invalidación
   * por cambio de filtros). */
  readonly activeViewId = input<string | null>(null);

  /** True cuando el state actual diverge del snapshot de la view
   * activa — muestra el dot `●` + botones Descartar/Guardar cambios. */
  readonly hasUnsavedChanges = input<boolean>(false);

  /** True cuando tiene sentido "Guardar vista" — hay filtros activos
   * y el state no matchea ninguna saved view (el container lo computa:
   * `activeFilters().length > 0 && activeSavedViewId() === null`). */
  readonly canSaveCurrent = input<boolean>(false);

  /** Click en una tab — el container aplica el snapshot completo. */
  readonly viewSelected = output<SavedView>();
  /** "Descartar" — restaurar el snapshot de la view activa. */
  readonly resetRequested = output<void>();
  /** "Guardar cambios" — overwrite de la custom view activa. */
  readonly updateRequested = output<void>();
  /** X en la tab activa custom — el container borra y deselecciona. */
  readonly deleteRequested = output<SavedView>();
  /** Nombre YA trimmeado y no-vacío — el container persiste via
   * `saveCurrentAsView` (create + activeSavedViewId) y, SOLO si la
   * persistencia async tuvo éxito, cierra el dialog llamando
   * `closeSaveViewDialog()` (viewChild). El hijo NO cierra al emitir:
   * el modal queda abierto durante el busy (spinner en Guardar,
   * Cancelar disabled) y, si `create()` falla (rollback + toast),
   * sigue abierto con el nombre tipeado para reintentar — paridad
   * exacta con el `await` pre-partición. */
  readonly saveRequested = output<string>();

  /** Dialog "Guardar vista" — estado 100% interno del hijo (nadie más
   * lo abre: único trigger es el botón de la barra). */
  protected readonly saveViewVisible = signal(false);
  protected readonly saveViewName = signal('');

  constructor() {
    // Reset del nombre al cerrar (X, mask, Cancelar o submit) — abrir
    // el dialog dos veces no muestra residual. Equivale al reset-al-
    // abrir del viejo `openSaveViewDialog`. Patrón prior art
    // `user-api-keys-dialog`.
    effect(() => {
      if (!this.saveViewVisible()) {
        this.saveViewName.set('');
      }
    });
  }

  protected openSaveViewDialog(): void {
    this.saveViewVisible.set(true);
  }

  /**
   * Cierre programático del dialog — público: lo invoca el container
   * (via `viewChild`) cuando `savedViews.create()` resolvió OK. El
   * effect del constructor limpia el nombre al cerrar. En el path de
   * error el container nunca llama acá → el dialog queda abierto con
   * el nombre intacto (retry sobre el mismo modal, como pre-partición).
   */
  closeSaveViewDialog(): void {
    this.saveViewVisible.set(false);
  }

  /** Enter en el input o botón Guardar: valida no-vacío y emite el
   * nombre trimmeado SIN cerrar — el cierre llega del container tras
   * el éxito de la persistencia (ver `saveRequested`). Durante el
   * busy el dialog muestra `[loading]`/`[disabled]` via
   * `savedViews.busy()` (misma instancia root que usa el service). */
  protected submitSaveView(): void {
    const trimmed = this.saveViewName().trim();
    if (!trimmed) return;
    this.saveRequested.emit(trimmed);
  }
}
