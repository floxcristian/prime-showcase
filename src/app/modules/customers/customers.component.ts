// Angular
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
// PrimeNG
import { FilterService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { Table, TableModule, type TableFilterEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
// Local
import { ColumnHelpComponent } from '../../shared/components/column-help/column-help.component';
import { CustomersBulkActionsComponent } from './components/customers-bulk-actions/customers-bulk-actions.component';
import { CustomersCmdkComponent } from './components/customers-cmdk/customers-cmdk.component';
import { CustomersDetailDrawerComponent } from './components/customers-detail-drawer/customers-detail-drawer.component';
import { CustomersFabComponent } from './components/customers-fab/customers-fab.component';
import { CustomersFilterChipsComponent } from './components/customers-filter-chips/customers-filter-chips.component';
import { CustomersFilterSheetComponent } from './components/customers-filter-sheet/customers-filter-sheet.component';
import {
  CustomersRowActionsComponent,
  type CustomerRowAction,
} from './components/customers-row-actions/customers-row-actions.component';
import { CustomersSavedViewsBarComponent } from './components/customers-saved-views-bar/customers-saved-views-bar.component';
import { CustomersShortcutsHelpComponent } from './components/customers-shortcuts-help/customers-shortcuts-help.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadErrorStateComponent } from '../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RefreshToolbarComponent } from '../../shared/components/refresh-toolbar/refresh-toolbar.component';
import { StaleDataBannerComponent } from '../../shared/components/stale-data-banner/stale-data-banner.component';
import { TableFilterShellComponent } from '../../shared/components/table-filter-shell/table-filter-shell.component';
import { TooltipDismissOnClickDirective } from '../../shared/directives/tooltip-dismiss-on-click.directive';
import { COLUMN_FILTER_PT } from '../../shared/tokens/table-tokens';
import { trackedResource } from '../../shared/utils/tracked-resource';
import {
  COLUMN_DEFS,
  type CustomerColumnDef,
} from './constants/customers-columns';
import {
  CARTERA_LEGEND,
  CLASSIFICATION_LEGEND,
  DISCOUNT_GROUP_LEGEND,
  LIFECYCLE_LEGEND,
  POTENCIAL_LEGEND,
} from './constants/customers-legends';
import {
  CARTERA_OPTIONS,
  CLASSIFICATION_OPTIONS,
  LIFECYCLE_OPTIONS,
  POTENCIAL_OPTIONS,
  SEGMENTO_OPTIONS,
  TYPE_OPTIONS,
} from './constants/customers-options';
import type { Customer, CustomerType } from './models/customer.interface';
import {
  ARRAY_INTERSECT_MATCHMODE,
  CustomersFilterFacade,
} from './services/customers-filter.facade';
import { CustomersKeyboardService } from './services/customers-keyboard.service';
import { CustomersMockService } from './services/customers-mock.service';
import {
  CustomersPreferencesService,
  type TableDensity,
} from './services/customers-preferences.service';
import {
  CustomersSavedViewsService,
  type SavedView,
} from './services/customers-saved-views.service';
import {
  CustomersUrlStateService,
  type CustomersViewSnapshot,
} from './services/customers-url-state.service';
import {
  additionalSellersTooltip,
  carteraLabel,
  carteraSeverity,
  classificationSeverity,
  codeTooltip,
  creditUtilizationColor,
  creditUtilizationPct,
  formatCredit,
  lifecycleSeverity,
  typeSeverity,
} from './utils/customers-format.util';
import { snapshotEqual } from './utils/customers-snapshot.util';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  InputTextModule,
  Toast,
  MultiSelect,
  Paginator,
  Select,
  Skeleton,
  Slider,
  TableModule,
  Tag,
  TooltipModule,
];
const LOCAL_COMPONENTS = [
  ColumnHelpComponent,
  CustomersBulkActionsComponent,
  CustomersCmdkComponent,
  CustomersDetailDrawerComponent,
  CustomersFabComponent,
  CustomersFilterChipsComponent,
  CustomersFilterSheetComponent,
  CustomersRowActionsComponent,
  CustomersSavedViewsBarComponent,
  CustomersShortcutsHelpComponent,
  EmptyStateComponent,
  LoadErrorStateComponent,
  PageHeaderComponent,
  RefreshToolbarComponent,
  StaleDataBannerComponent,
  TableFilterShellComponent,
  TooltipDismissOnClickDirective,
];

// ── Named constants ────────────────────────────────────────────────
// Single source of truth para magic numbers que antes vivían inline.
// Cambio en uno propaga a todos los call sites; documenta el "por qué"
// del número una sola vez.

/** Toast life para confirmaciones breves (success de bulk action,
 * undo aplicado). 2s = enough to be read sin bloquear el flujo. */
const TOAST_BRIEF_MS = 2000;
/** Toast life para errores/info que requieren más lectura. */
const TOAST_LONG_MS = 4000;
/** Latency del mock API call. 200ms simula round-trip rápido pero
 * perceptible (skeleton brief, refresh button spin breve). */
const OPTIMISTIC_COMMIT_DELAY_MS = 200;
/** Probabilidad de fallo simulado para mostrar el rollback path.
 * 5% es low-enough para no molestar en demos, high-enough para que
 * un user que toggle `?chaos=on` y haga 4-5 acciones vea al menos 1
 * rollback. OFF por default (ver `chaosEnabled`). */
const CHAOS_FAILURE_RATE = 0.05;
/** Ventana de undo después de bulk delete (toast life). Linear y
 * Gmail usan 8s — suficiente para Ctrl-Z reflexivo, no tan largo
 * que el user crea que no se commitó. */
const UNDO_WINDOW_MS = 8000;
/** Margin grace entre toast expiry y el hard-commit cleanup del
 * buffer de undo. Evita race "user clickeó undo al milisegundo
 * 7999". */
const UNDO_GRACE_MS = 100;

@Component({
  selector: 'app-customers',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  providers: [MessageService],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Chrome del host responsive — patrón bigtech mobile (Stripe /
    // Linear / Notion / HubSpot / Salesforce convergente):
    //   Mobile (<lg): edge-to-edge sin border, sin rounded, sin
    //     padding propio. El parent (`<app-main>` con `[class.p-2]`)
    //     ya aplica 8px; el header interno usa `p-1` para que el
    //     título tenga otros 4px de breathing — mismo idiom que
    //     overview/home. Las cards individuales son los contenedores.
    //   Desktop (lg+): outer card completo (`p-6 border rounded-2xl`)
    //     porque la tabla es el contenido principal y necesita
    //     containment visual + radius para integrarse al layout.
    class:
      'flex-1 h-full flex flex-col overflow-hidden lg:p-6 lg:border lg:border-surface lg:rounded-2xl',
  },
})
export class CustomersComponent {
  private api = inject(CustomersMockService);
  private filterService = inject(FilterService);
  private readonly messageService = inject(MessageService);
  private readonly urlState = inject(CustomersUrlStateService);
  /** Private desde el split: los consumos de template (`views()`,
   * `busy()`, `get()` del tab bar + save dialog) viven ahora en
   * `CustomersSavedViewsBarComponent`, que inyecta el service root
   * directo. Acá quedan el CRUD, el snapshot triangle y el rollback. */
  private readonly savedViews = inject(CustomersSavedViewsService);
  /** Private desde el split: el único consumo de template
   * (`formatCombo` del help overlay) vive ahora en
   * `CustomersShortcutsHelpComponent`, que inyecta el service root
   * directo. Acá solo queda el registro de shortcuts. */
  private readonly keyboardService = inject(CustomersKeyboardService);
  /** Preferencias persistidas (densidad + recents del cmdk). Único
   * touchpoint de localStorage del módulo — ver el service. */
  protected readonly prefs = inject(CustomersPreferencesService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  /** Declarado junto al resto de los `inject()` (no al final de la
   * clase): el constructor lo usa para registrar teardowns y los field
   * initializers corren en orden de declaración — moverlo después de
   * cualquier código que lo lea rompería en runtime. */
  private readonly destroyRef = inject(DestroyRef);
  /** Guard SSR canónico del repo (ver .claude/rules/ssr-and-runtime.md)
   * — reemplaza los checks ad-hoc `typeof window/localStorage`. Debe
   * declararse ANTES de cualquier field initializer que lo lea. */
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Loop guard — true mientras `applyFromUrl()` está aplicando state
   * a la tabla. Los event handlers (onTableFilter, onTableSort, etc.)
   * skipean `urlState.updateUrl()` durante esta fase para evitar
   * feedback loop: URL → apply → table fires onFilter → updateUrl → URL.
   *
   * Patrón bigtech canonical (Linear, Stripe): boolean en service o
   * componente que se setea ANTES de aplicar y se resetea DESPUÉS.
   */
  private isApplyingFromUrl = signal(false);

  /**
   * Chaos mode — opt-in via `?chaos=on` queryparam. Cuando activo, las
   * mutaciones tienen probabilidad `CHAOS_FAILURE_RATE` de simular un
   * fallo de backend y disparar rollback. Útil para demos del happy-
   * path-vs-error-path durante presentaciones; OFF por default para
   * que el showcase normal no se sienta flaky.
   *
   * Read-once al construir el componente. No reactivo a cambios
   * runtime — el user tiene que recargar la página con el query para
   * entrar en chaos. Linear/Stripe usan flags similares (`?devtools=on`,
   * `?slow=1`) para escenarios de prueba.
   */
  private readonly chaosEnabled = ((flag: string | null) =>
    flag === 'on' || flag === '1' || flag === 'true')(
    inject(ActivatedRoute).snapshot.queryParamMap.get('chaos'),
  );

  /** ID de la vista guardada actualmente "cargada". El active state
   * persiste aunque los filtros diverjan — usamos `hasUnsavedChanges`
   * computed para detectar el drift y mostrar indicator visual.
   *
   * Patrón Linear/HubSpot/Notion: tab queda "active" + dot indicator
   * `●` cuando filtros divergen del snapshot guardado, permitiendo
   * "Reset" (vuelve al snapshot) o "Guardar cambios" (overwrite). */
  protected readonly activeSavedViewId = signal<string | null>(null);

  /**
   * Auto-select del system view que matchea el state actual. Patrón
   * HubSpot/Linear: las tabs de saved views reflejan dónde está el
   * usuario — si los filters coinciden con "Cartera activa", esa tab
   * queda activa sin necesidad de click explícito.
   *
   * **Comportamiento**:
   *   - Custom view explícitamente cargada → respeta la elección del
   *     user (no override). hasUnsavedChanges seguirá fire-ing si los
   *     campos persistidos divergen, mostrando el `●`.
   *   - System view actualmente activa que dejó de matchear → buscar
   *     otra system view que sí matchee, switch automático. Ej: estoy
   *     en "Cartera activa" (cartera=CA), cambio a cartera=CM → tab
   *     "Morosos" se ilumina sola.
   *   - Sin match → clear (activeSavedViewId=null). Mantiene la UI
   *     consistente con "estoy en un estado custom no guardado".
   *
   * Reemplaza la UX donde ninguna tab estaba activa al cargar la vista
   * con filtros vacíos — antes el usuario veía un toolbar sin feedback
   * de en qué vista estaba ("Todos los clientes" no se iluminaba aunque
   * fuera literalmente lo que estaba viendo).
   */
  private readonly _autoSelectSystemView = effect(() => {
    // Track: cualquier cambio de filtros/cols/rows revalúa.
    this.activeFilters();
    this.selectedColumnKeys();
    this.mobileRows();
    const views = this.savedViews.views();
    // El table viewChild puede no estar listo en el primer tick.
    if (!this.clientsTable()) return;

    const explicit = this.activeSavedViewId();

    // Custom view explícita: respetar la elección del user (la dirt va
    // por hasUnsavedChanges, no por re-seleccionar otra tab).
    if (explicit) {
      const view = views.find((v) => v.id === explicit);
      if (view && !view.system) return;
    }

    // Buscar system view que matchee el state actual.
    const current = this.currentSnapshot();
    for (const view of views) {
      if (view.system && snapshotEqual(view, current)) {
        if (explicit !== view.id) {
          untracked(() => this.activeSavedViewId.set(view.id));
        }
        return;
      }
    }

    // No match — limpiar si la activa era una system view (drift libre).
    if (explicit?.startsWith('sys-')) {
      untracked(() => this.activeSavedViewId.set(null));
    }
  });

  /**
   * Detecta si el state actual diverge del snapshot de la saved view
   * activa. Patrón Linear/HubSpot:
   *
   *   - **System views** (sys-all, sys-active, sys-morosos…): preset
   *     definido por filters únicamente. Cambios de columnas, sort y
   *     rows-per-page son preferencias del usuario sobre el preset y
   *     NO se consideran "modificados". Patrón Linear "All issues" y
   *     HubSpot "Default view" — la definición del system view es el
   *     filtro, no la pantalla.
   *
   *   - **Custom views** (creadas por el user): el snapshot persistido
   *     refleja TODO lo que el user decidió incluir (filtros + sort
   *     elegido + columnas visibles en su orden + rows-per-page).
   *     Cualquier divergencia = "Modificado". Si el user creó
   *     "Morosos Q4 by credit DESC" con columnas específicas, alterar
   *     cualquier dimensión rompe el intent y debe surfacear el `●`.
   *
   * Esto evita falsos positivos en system views (donde el snapshot
   * persistido tiene `columns: []` como sentinel "use defaults") y
   * captura drift real en custom views. Ver `snapshotEqual` en
   * `utils/customers-snapshot.util.ts`.
   */
  protected readonly hasUnsavedChanges = computed<boolean>(() => {
    const activeId = this.activeSavedViewId();
    if (!activeId) return false;
    const view = this.savedViews.get(activeId);
    if (!view) return false;
    return !snapshotEqual(view, this.currentSnapshot());
  });

  /**
   * Reset a la saved view activa — re-aplica el snapshot original
   * descartando los cambios locales. Patrón Linear/HubSpot.
   */
  protected resetActiveView(): void {
    const id = this.activeSavedViewId();
    if (!id) return;
    const view = this.savedViews.get(id);
    if (!view) return;
    this.applySavedView(view);
    this.messageService.add({
      key: 'customers-toast',
      severity: 'info',
      summary: 'Vista restaurada',
      detail: `Filtros revertidos a "${view.name}"`,
      life: 2000,
    });
  }

  /**
   * Update la saved view activa con el snapshot actual — overwrite.
   * Sólo aplica a custom views (no system, que son read-only).
   */
  protected async updateActiveView(): Promise<void> {
    const id = this.activeSavedViewId();
    if (!id) return;
    const view = this.savedViews.get(id);
    if (!view || view.system) return;
    await this.savedViews.update(id, { snapshot: this.currentSnapshot() });
    this.messageService.add({
      key: 'customers-toast',
      severity: 'success',
      summary: 'Vista actualizada',
      detail: `Cambios guardados en "${view.name}"`,
      life: 2000,
    });
  }

  // ── Inline editing (Vendedor, Tipo) ────────────────────────────────
  //
  // Patrón Salesforce/Airtable/Notion: click cell editable → input
  // aparece in-place → Enter commit / Escape cancel. PrimeNG provee
  // `pEditableColumn` directive + `<p-cellEditor>` template para esta
  // mecánica out-of-the-box (tab nav cross-cells, click-to-edit, blur
  // commit). Inline edit es desktop-only — mobile usa detail drawer.
  //
  // **Optimistic UI**: el commit muta el dataset via
  // `CustomersMockService.replaceAll()` INMEDIATAMENTE (en producción
  // real sería POST + rollback on error). Patrón estándar bigtech.

  /**
   * Commit inline edit del Vendedor primary del customer. Reemplaza
   * `assignedSellers[0]` con el nuevo seller, manteniendo los demás
   * como soporte. Si el nuevo seller ya estaba como secundario, lo
   * deduplicamos. Mock: muta el dataset via service.
   *
   * **Optimistic UI con rollback prep**: mutamos primero, snapshot del
   * estado previo persiste hasta confirmar. En mock backend siempre
   * succeede; el método `simulateApiCall` queda preparado para que el
   * production real (con HTTP) tenga `catch → rollback + toast error`.
   */
  protected onVendedorEdit(customer: Customer, newSeller: string | null): void {
    if (!newSeller || newSeller === customer.assignedSellers[0]) return;
    const previous = this.tableData();
    const others = customer.assignedSellers.filter((s) => s !== newSeller);
    const updated = previous.map((c) =>
      c.id === customer.id
        ? { ...c, assignedSellers: [newSeller, ...others] }
        : c,
    );
    this.api.replaceAll(updated);
    this.simulateApiCall(previous, `Vendedor actualizado a ${newSeller}`);
  }

  /**
   * Commit inline edit del Tipo. Cambia Empresa↔Persona del customer.
   * Mock: muta dataset, tag severity re-renderiza automáticamente
   * porque bind a `data.type` reactivo.
   */
  protected onTipoEdit(customer: Customer, newType: CustomerType | null): void {
    if (!newType || newType === customer.type) return;
    const previous = this.tableData();
    const updated = previous.map((c) =>
      c.id === customer.id ? { ...c, type: newType } : c,
    );
    this.api.replaceAll(updated);
    this.simulateApiCall(previous, `Tipo actualizado a ${newType}`);
  }

  /**
   * Mock backend roundtrip — simula latency 200ms + 5% failure rate
   * para mostrar el rollback toast en acción. En producción esto sería
   * un HTTP PATCH/PUT con catch → rollback.
   *
   * Patrón Linear sync engine: optimistic-first, rollback on error
   * con toast retry. Sin esto, silent failure = data loss invisible.
   */
  private simulateApiCall(
    previousState: readonly Customer[],
    successMessage: string,
  ): void {
    // Equivalente al patrón real con backend:
    //   this.http.patch(url, payload).subscribe({
    //     next: () => toast success,
    //     error: () => { this.api.replaceAll(previousState); toast error }
    //   })
    //
    // Chaos failure (5% rollback aleatorio) está GATED detrás del
    // queryParam `?chaos=on`. Activado manualmente cuando se quiere
    // demostrar el rollback path durante demos/dev. OFF por default —
    // antes era 5% always-on y los showcases se sentían flaky sin
    // razón obvia para el viewer.
    //
    // Handles tracked en `simulateApiCallTimers` (Set) para poder
    // cancelarlos en el onDestroy del componente — sin teardown, el
    // callback dispara sobre una instancia destruida (escribe signals +
    // toast muerto). A diferencia de `pendingUndoTimer` (last-write-wins
    // por diseño: solo importa el último undo), acá CADA commit es un
    // roundtrip independiente: cancelar el anterior descartaría su toast
    // y — con `?chaos=on` — su ROLLBACK, persistiendo estado erróneo.
    // Por eso cada timeout vive hasta dispararse; solo el onDestroy los
    // limpia en bloque.
    const timer = setTimeout(() => {
      this.simulateApiCallTimers.delete(timer);
      const failed = this.chaosEnabled && Math.random() < CHAOS_FAILURE_RATE;
      if (failed) {
        this.api.replaceAll(previousState);
        this.messageService.add({
          key: 'customers-toast',
          severity: 'error',
          summary: 'Error al guardar',
          detail: 'Los cambios se revirtieron. Inténtalo nuevamente.',
          life: TOAST_LONG_MS,
        });
      } else {
        this.messageService.add({
          key: 'customers-toast',
          severity: 'success',
          summary: successMessage,
          life: TOAST_BRIEF_MS,
        });
      }
    }, OPTIMISTIC_COMMIT_DELAY_MS);
    this.simulateApiCallTimers.add(timer);
  }

  /** Handles de los setTimeout de `simulateApiCall` — cada commit tiene
   * su propio roundtrip pendiente (NO last-write-wins: cancelar uno
   * perdería su toast/rollback). Se limpian todos juntos únicamente en
   * el `destroyRef.onDestroy` (ver teardown en constructor). */
  private readonly simulateApiCallTimers = new Set<
    ReturnType<typeof setTimeout>
  >();

  // ── Density toggle (Compact/Comfortable) ───────────────────────────
  //
  // La densidad completa (signal persistido + derivados densityDt/
  // toggleIcon/toggleTooltip + toggle) vive en
  // `CustomersPreferencesService` — el template bindea `prefs.*`
  // directo. Acá solo queda el catálogo de opciones.

  /** Density opciones — 2 modos siguiendo bigtech (Linear/GitHub Primer
   * usan Compact/Comfortable, no 3 niveles). Tres opciones aumentaba
   * decision-cost sin payoff perceptible: la diferencia "Normal vs
   * Comfortable" eran 4px de padding, imperceptible para mayoría. */
  protected readonly densityOptions: { label: string; value: TableDensity; icon: string }[] = [
    { label: 'Compacto', value: 'compact', icon: 'fa-sharp fa-regular fa-bars' },
    { label: 'Cómodo', value: 'comfortable', icon: 'fa-sharp fa-regular fa-table-rows' },
  ];

  // ── Row selection + bulk actions ──────────────────────────────────
  //
  // Selección de filas para bulk operations. Patrón Salesforce/HubSpot
  // /Zoho: checkbox por row → toolbar de bulk actions aparece cuando
  // selection > 0, con count badge + acciones (Mass update, Export,
  // Delete). Crítico para data entry / cleanup workflows.

  /** Filas seleccionadas. Tipado mutable (`Customer[]`) porque
   * `<p-table [selection]>` espera arrays mutables — evita el `$any()`
   * que antes casteaba el `readonly` en el template. */
  protected readonly selectedRows = signal<Customer[]>([]);

  /** Private desde el split: los consumos de template (barra bulk +
   * counts de los dialogs) viven ahora en `CustomersBulkActionsComponent`
   * (su `count` computed). Acá solo lo lee la cascada de `escape`. */
  private readonly selectionCount = computed(
    () => this.selectedRows().length,
  );

  /**
   * Set de IDs seleccionados para lookup O(1) en template (hover-reveal
   * persistente sobre filas seleccionadas — patrón Linear/Gmail/Notion:
   * la acción row-level debe permanecer visible cuando la fila está
   * "armed" para bulk operations, no solo bajo hover).
   */
  protected readonly selectedIdSet = computed(
    () => new Set(this.selectedRows().map((c) => c.id)),
  );

  /** Dialog state para bulk assign vendedor. Two-way con el hijo
   * `CustomersBulkActionsComponent` (que aloja el `<p-dialog>` y el
   * seller elegido); queda acá porque también lo abre el popover de
   * fila (`onActionAssign`, single-row-via-bulk). */
  protected readonly bulkAssignVisible = signal(false);

  /** Confirm dialog para bulk delete. Mismo criterio que
   * `bulkAssignVisible` — lo abre también `onActionDelete`. */
  protected readonly bulkDeleteVisible = signal(false);

  /**
   * Limpia selección. Útil tras completar bulk action o al cancel.
   */
  protected clearSelection(): void {
    this.selectedRows.set([]);
  }

  /**
   * Bulk assign vendedor — actualiza el primary seller (índice 0) de
   * todos los seleccionados al vendedor elegido. Mock backend: mutate
   * in-memory + reload signal. Bigtech (Salesforce mass owner change)
   * haría POST /api/customers/bulk-update con `{ ids, patch }`.
   *
   * El seller llega como argumento (`assignConfirmed` del hijo, que
   * guardea no-null antes de emitir) — el estado del select vive en
   * `CustomersBulkActionsComponent`.
   */
  protected applyBulkAssign(seller: string): void {
    const ids = new Set(this.selectedRows().map((c) => c.id));
    // Optimistic UI: mutate signal directamente. En producción, POST
    // primero, on success refresh. Patrón optimistic común en bigtech.
    const updated = this.tableData().map((c) =>
      ids.has(c.id)
        ? {
            ...c,
            assignedSellers: [
              seller,
              ...c.assignedSellers.filter((s) => s !== seller),
            ],
          }
        : c,
    );
    this.api.replaceAll(updated);
    this.clearSelection();
    this.bulkAssignVisible.set(false);
  }

  /**
   * Bulk delete con UNDO toast pattern. Patrón canónico bigtech
   * (Gmail / Stripe / Linear / Notion):
   *   1. Optimistic remove del view (instant feedback).
   *   2. Toast con "Deshacer" button, 8s timeout.
   *   3. Si user clickea Undo → restore. Si timeout expira → commit
   *      (mock backend lo deja persistido vía replaceAll).
   *
   * Esto reemplaza el confirm dialog destructive como única safety
   * net por un soft-delete con undo window — más forgiving y user-
   * friendly. Gmail / Linear lo prefieren porque confirm-modal-only
   * crea fatigue para acciones frecuentes.
   */
  protected applyBulkDelete(): void {
    const ids = new Set(this.selectedRows().map((c) => c.id));
    const toDelete = this.tableData().filter((c) => ids.has(c.id));
    const remaining = this.tableData().filter((c) => !ids.has(c.id));

    // Cancel any in-flight cleanup from a previous batch. Without esto,
    // un segundo bulk-delete sobreescribe `lastDeletedCustomers` con su
    // propio snapshot Y, pero el setTimeout(8100) del batch X anterior
    // sigue programado y dispara prematuramente, limpiando Y antes de
    // que termine su propia ventana de 8s.
    // Verificado empíricamente (round 3 audit): t=0 borrar X, t=3s
    // borrar Y, t=8.1s → setTimeout1 fires → Y.snapshot cleared → undo
    // de Y dentro de su ventana esperada se vuelve no-op (data loss
    // perceived). Patrón Linear sync engine: cada operación cancela
    // su predecesora cuando sobreescribe el mismo buffer.
    if (this.pendingUndoTimer !== null) {
      clearTimeout(this.pendingUndoTimer);
      this.pendingUndoTimer = null;
    }

    // Optimistic: remove inmediato
    this.api.replaceAll(remaining);
    this.lastDeletedCustomers.set(toDelete);
    this.clearSelection();
    this.bulkDeleteVisible.set(false);

    // Toast con UNDO action — el toast auto-cierra después de
    // UNDO_WINDOW_MS, momento en el cual el delete se vuelve
    // definitivo. El custom template renderiza el button Deshacer.
    this.messageService.add({
      key: 'customers-toast',
      severity: 'success',
      summary: `${toDelete.length} ${toDelete.length === 1 ? 'cliente eliminado' : 'clientes eliminados'}`,
      detail: `Acción reversible por ${UNDO_WINDOW_MS / 1000} segundos`,
      life: UNDO_WINDOW_MS,
      data: { action: 'undo-delete' },
    });

    // Hard-commit cleanup tras UNDO_WINDOW_MS + grace. Liberamos el
    // rollback buffer; el timer-id se cancela cross-operación (ver
    // guard al inicio del método) para evitar el race "X borra el
    // buffer de Y antes de su ventana".
    this.pendingUndoTimer = setTimeout(() => {
      this.pendingUndoTimer = null;
      if (this.lastDeletedCustomers().length > 0) {
        this.lastDeletedCustomers.set([]);
      }
    }, UNDO_WINDOW_MS + UNDO_GRACE_MS);
  }

  /** Snapshot de los customers borrados en la última bulk-delete.
   * Persiste hasta que: (a) el user clickea Deshacer, (b) timeout 8s
   * expira (limpiado en `applyBulkDelete`), o (c) otro bulk-delete los
   * reemplaza (en cuyo caso el timer del primero se cancela). */
  private readonly lastDeletedCustomers = signal<readonly Customer[]>([]);

  /** Handle del setTimeout que limpia el undo buffer 8.1s post-delete.
   * Tracked acá para poder cancelarlo cuando un nuevo bulk-delete entra
   * antes de que el anterior cumpla su ventana de undo. Sin tracking,
   * timers stale clearean snapshots frescos (data loss invisible al
   * user). Ver guard en `applyBulkDelete` y `undoLastDelete`. */
  private pendingUndoTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Deshacer último bulk-delete — restaura los customers al dataset
   * conservando su posición ID. Toast confirma la acción.
   */
  protected undoLastDelete(): void {
    const restored = this.lastDeletedCustomers();
    if (restored.length === 0) return;
    // Cancel pending hard-commit timer: el user ya consumió la ventana
    // de undo explícitamente, así que el cleanup automático no debe
    // dispararse y potencialmente re-limpiar tras un nuevo delete.
    if (this.pendingUndoTimer !== null) {
      clearTimeout(this.pendingUndoTimer);
      this.pendingUndoTimer = null;
    }
    // Restaurar al top — UX preferido (Gmail/Linear: restored items
    // surface arriba para que el user confirme que se restauraron).
    this.api.replaceAll([...restored, ...this.tableData()]);
    this.lastDeletedCustomers.set([]);
    this.messageService.clear('customers-toast');
    this.messageService.add({
      key: 'customers-toast',
      severity: 'info',
      summary: 'Eliminación deshecha',
      detail: `${restored.length} ${restored.length === 1 ? 'cliente restaurado' : 'clientes restaurados'}`,
      life: 2000,
    });
  }

  /**
   * Bulk export — CSV download de los clientes seleccionados.
   * Generación client-side via Blob + URL.createObjectURL. Patrón
   * Notion / Airtable export. En producción podría delegar a backend
   * para datasets grandes con streaming.
   */
  protected applyBulkExport(): void {
    const selected = this.selectedRows();
    if (selected.length === 0) return;
    const headers = [
      'ID',
      'Nombre',
      'RUT',
      'Tipo',
      'Email',
      'Vendedores',
      'Crédito disponible',
      'Crédito utilizado',
      'Crédito asignado',
      'Segmento',
      'Clasif. crédito',
      'Potencial',
      'Cartera',
      'Ciclo',
      'Región',
      'Ciudad',
    ];
    const rows = selected.map((c) => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.rut,
      c.type,
      c.email,
      `"${c.assignedSellers.join(', ')}"`,
      c.availableCredit,
      c.usedCredit,
      c.assignedCredit,
      c.segmento,
      c.creditClassification,
      c.potencial,
      c.cartera,
      c.lifecycle,
      `"${c.region}"`,
      c.city,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n',
    );
    const bom = '﻿'; // UTF-8 BOM para Excel reconocer encoding
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    // DOM access via DI'd `DOCUMENT` token (convención del proyecto)
    // en vez del global `document`.
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `clientes-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Resource principal — `trackedResource()` empaqueta el pattern
   * compartido con users / roles / obs-uptime: rxResource +
   * loading/loadError + copia mutable para p-table (`rows`, expuesta
   * como `tableData`) + freshness (`lastFetchedAt` + bump del
   * TimeService) + retry con guard.
   */
  private readonly customersData = trackedResource<Customer>(() =>
    this.api.getCustomers(),
  );
  protected readonly loading = this.customersData.loading;
  protected readonly loadError = this.customersData.loadError;
  protected readonly tableData = this.customersData.rows;
  protected readonly lastFetchedAt = this.customersData.lastFetchedAt;

  /**
   * Conteos derivados para el count pill del header — formato "X de Y
   * activos". "Activo" en este contexto = `cartera === 'CA'` (cuenta
   * corriente operativa, paga al día). Las demás carteras (CP/CN/CI/CM)
   * son lifecycle states distintos.
   */
  protected readonly activeCount = computed(
    () => this.tableData().filter((c) => c.cartera === 'CA').length,
  );
  protected readonly totalCount = computed(() => this.tableData().length);

  /**
   * Set deduplicado de vendedores presentes en la sesión — para el
   * `<p-columnFilter>` multiselect de la columna "Vendedores asignados".
   * Como cada cliente tiene un array de sellers, hacemos flatMap +
   * Set para obtener la lista plana única.
   */
  protected readonly availableSellers = computed<string[]>(() =>
    Array.from(
      new Set(this.tableData().flatMap((c) => c.assignedSellers)),
    ).sort(),
  );

  /**
   * Set deduplicado de regiones presentes — feed del multiselect filter.
   * Mismo patrón que `availableSellers`. Sort alfabético para escaneo
   * predecible en el dropdown.
   */
  protected readonly availableRegions = computed<string[]>(() =>
    Array.from(new Set(this.tableData().map((c) => c.region))).sort(),
  );

  /**
   * Cota superior del rango de crédito — usado por el slider del
   * filter de "Crédito disponible". Redondeado al millón superior para
   * que el slider tenga un máximo "limpio" (evita tope tipo
   * $47.500.000 que se ve raro como granularity de slider).
   *
   * `Math.max(...empty)` retorna `-Infinity` durante el initial load
   * (cuando `tableData()` es []) — caemos a $50M como default razonable
   * para que el slider exista incluso antes de hidratar la data.
   */
  protected readonly maxCredit = computed<number>(() => {
    const amounts = this.tableData().map((c) => c.availableCredit);
    if (amounts.length === 0) return 50000000;
    return Math.ceil(Math.max(...amounts) / 1000000) * 1000000;
  });

  /** Fallback del slider de crédito del `p-columnFilter` cuando no hay
   * filtro aplicado (`value` null). `computed` y no literal inline en
   * el template: en zoneless, `[ngModel]` exige identidad estable entre
   * pasadas de CD — un `[0, maxCredit()]` inline aloca un array nuevo
   * por pasada y el write-back async de NgModel re-agenda ticks sin fin
   * (loop infinito de CD, sin guard NG0103 en prod). */
  protected readonly defaultCreditRange = computed<[number, number]>(() => [
    0,
    this.maxCredit(),
  ]);

  // Sets cerrados de opciones para filtros — catálogos estáticos
  // movidos a `constants/customers-options.ts` (convención del módulo,
  // mismo criterio que `customers-data.ts`). Expuestos como fields para
  // el template.
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly segmentoOptions = SEGMENTO_OPTIONS;
  protected readonly classificationOptions = CLASSIFICATION_OPTIONS;
  protected readonly potencialOptions = POTENCIAL_OPTIONS;
  protected readonly lifecycleOptions = LIFECYCLE_OPTIONS;
  protected readonly carteraOptions = CARTERA_OPTIONS;

  /**
   * Legends de columnas codificadas — single source of truth de qué
   * significa cada código del legacy. Los `<app-column-help>` del
   * header las renderizan en un popover; los tooltips per-cell
   * (`codeTooltip`) hacen lookup en estas mismas listas.
   */
  // Legends de columnas codificadas — movidas a
  // `constants/customers-legends.ts` (single source of truth de qué
  // significa cada código del legacy). Expuestas como fields para el
  // template; `codeTooltip` hace lookup sobre estas mismas listas.
  protected readonly classificationLegend = CLASSIFICATION_LEGEND;
  protected readonly potencialLegend = POTENCIAL_LEGEND;
  protected readonly lifecycleLegend = LIFECYCLE_LEGEND;
  protected readonly carteraLegend = CARTERA_LEGEND;
  protected readonly discountGroupLegend = DISCOUNT_GROUP_LEGEND;

  // Formatters/severities puros — extraídos a
  // `utils/customers-format.util.ts` (funciones puras, sin estado).
  // Re-expuestos como campos para que el template no cambie ni un
  // carácter respecto de cuando eran métodos.
  protected readonly codeTooltip = codeTooltip;
  protected readonly typeSeverity = typeSeverity;
  protected readonly classificationSeverity = classificationSeverity;
  protected readonly lifecycleSeverity = lifecycleSeverity;
  protected readonly carteraSeverity = carteraSeverity;
  protected readonly carteraLabel = carteraLabel;

  /**
   * Passthrough config compartida para `<p-columnFilter>` — ver JSDoc
   * en `shared/tokens/table-tokens.ts`.
   */
  protected readonly columnFilterPt = COLUMN_FILTER_PT;

  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4];

  /**
   * Catálogo de columnas hideables — movido a
   * `constants/customers-columns.ts` (convención del módulo, mismo
   * criterio que `customers-data.ts`). Copia mutable porque
   * `<p-multiselect [options]>` tipa `any[]` y un readonly array no
   * es asignable bajo strictTemplates.
   */
  protected readonly columnDefs: CustomerColumnDef[] = [...COLUMN_DEFS];

  /**
   * Keys de columnas visibles — modelo positivo. Default = columnas
   * sin `defaultHidden`. `email` y `lifecycle` quedan ocultas por
   * default — son campos de uso secundario que el admin opta-in via
   * el multiselect de columnas.
   */
  protected readonly selectedColumnKeys = signal<string[]>(
    this.columnDefs.filter((c) => !c.defaultHidden).map((c) => c.key),
  );

  /**
   * `maxSelectedLabels` dinámico — decide entre render chip vs texto
   * según si el contenido fits en el container `w-72` (288px).
   *
   * **Truco PrimeNG**: el source dispara `selectedItemsLabel` cuando
   * `chipSelectedItems().length === maxSelectedLabels` (ver
   * primeng-multiselect.mjs:1875). Para forzar chips → max = count+1.
   * Para forzar texto → max = count.
   *
   * **Cap explícito a 2 chips**: con 3+ seleccionadas siempre texto
   * (matchea comportamiento del demo). Con 1-2 seleccionadas, evalúa
   * si el estimated width cabe.
   *
   * **Estimación de width**: heurística, no medición DOM (sería caro
   * y requeriría effect post-render). Char width 8px (Inter @ 16px
   * avg) + 40px overhead por chip (padding + remove icon + gap) vs
   * 248px disponibles (w-72 menos padding interno + chevron).
   * Conservadora: cae a texto antes de overflow visible.
   */
  protected readonly chipsMaxLabels = computed<number>(() => {
    const selected = this.selectedColumnKeys();
    if (selected.length === 0) return 3;
    if (selected.length >= 3) return 3;

    const totalChars = selected.reduce((sum, key) => {
      const def = this.columnDefs.find((c) => c.key === key);
      return sum + (def?.label.length ?? 0);
    }, 0);

    const PER_CHIP_OVERHEAD = 40;
    const CHAR_WIDTH = 8;
    const AVAILABLE_WIDTH = 248;
    const estimated =
      selected.length * PER_CHIP_OVERHEAD + totalChars * CHAR_WIDTH;

    return estimated <= AVAILABLE_WIDTH
      ? selected.length + 1
      : selected.length;
  });

  protected isColumnVisible(key: string): boolean {
    return this.selectedColumnKeys().includes(key);
  }

  /**
   * Colspan dinámico para el `<td>` del emptymessage. 3 = checkbox +
   * Nombre + Acciones (siempre visibles) + N columnas de datos visibles.
   */
  protected readonly visibleColumnCount = computed(
    () => 3 + this.selectedColumnKeys().length,
  );

  /**
   * matchMode constant exposed al template — usar string literal en
   * el template requeriría escapar comillas. Esta property es read-only
   * y typed.
   */
  protected readonly arrayIntersectMatchMode = ARRAY_INTERSECT_MATCHMODE;

  // ── Active filters chip bar ────────────────────────────────────────
  //
  // Surface bigtech estándar (Linear/Notion/Airtable/Stripe/Datadog
  // convergente): chip bar arriba de la tabla con un pill por cada
  // filter activo, removible con click. Resuelve el problema de
  // discoverability/recoverability del state — sin el bar, el user
  // tiene que abrir cada column header para saber qué está filtrado.
  //
  // Implementación enterprise-grade:
  //   1. ViewChild signal-based (`viewChild(Table)`) sobre la instancia
  //      de PrimeNG Table — evita @ViewChild legacy + null-checking
  //      manual; el signal expone undefined cuando aún no rendereó.
  //   2. Hook (onFilter) emitido por PrimeNG después de cada apply →
  //      `filters.refresh()` re-deriva `active`/`values` desde
  //      `table.filters` (state oficial, single source of truth).
  //   3. Removal / clear all / format del display viven en
  //      `CustomersFilterFacade` — ver JSDoc del facade.

  protected readonly clientsTable = viewChild(Table);

  /**
   * Puerto de filtros — único acceso a `Table.filters` para chip bar,
   * bottom-sheet y saved views. Clase plain instanciada acá (no DI)
   * porque depende del `viewChild(Table)` del container. Declarado
   * DESPUÉS de `clientsTable` y `maxCredit` — los field initializers
   * corren en orden de declaración.
   */
  protected readonly filters = new CustomersFilterFacade(
    this.clientsTable,
    this.maxCredit,
  );

  /** Alias del espejo push-based de filtros activos — el template
   * (chip bar, badge del sheet, saved views) sigue leyendo
   * `activeFilters()` sin cambios. */
  protected readonly activeFilters = this.filters.active;

  /**
   * Espejo reactivo del sort activo de la tabla. `Table.sortField` /
   * `Table.sortOrder` son propiedades planas (no signals) — leerlas
   * directo en `currentSnapshot()` dejaba a `hasUnsavedChanges` ciego
   * a cambios de orden. Actualizado en `(onSort)` y al aplicar
   * snapshots (saved view / URL); `null` = sin orden.
   */
  private readonly tableSort = signal<{ field: string; dir: 1 | -1 } | null>(
    null,
  );

  /**
   * Handler de `(onSort)` del p-table. Sincroniza el espejo reactivo
   * `tableSort` y propaga el sort al URL (skip durante hidratación,
   * mismo guard que filters). El sort NO invalida la saved view activa:
   * en system views es preferencia sobre el preset; en custom views el
   * drift surfacea vía `hasUnsavedChanges` (indicator ●).
   */
  protected onTableSort(event: { field?: string; order?: number }): void {
    const field = event.field;
    this.tableSort.set(
      field ? { field, dir: event.order === -1 ? -1 : 1 } : null,
    );
    this.syncFiltersToUrl();
  }

  /**
   * Filtered data eco para el card-list view mobile. PrimeNG Table emite
   * `event.filteredValue` en `(onFilter)` con el resultado post-filter
   * (NO post-paginate). Mobile cards leen de aquí cuando hay filtros
   * activos; cuando no hay filtros este signal es `null` y mobile cae
   * a `tableData()` (data completa). Asegura que un filter aplicado
   * en una sesión desktop persiste correctamente al rotar a mobile.
   */
  private readonly _mobileFilteredData = signal<readonly Customer[] | null>(
    null,
  );

  /**
   * Source data del card-list mobile, con sort aplicado encima de
   * filtered. Pipeline: tableData → filter → sort → paginate.
   * Sort independiente del desktop (mobile tiene su propio dropdown
   * de sort en el bottom-sheet) — patrón Stripe / Linear / Notion
   * mobile: sort UI mobile ≠ column-header sort desktop.
   */
  protected readonly mobileSourceData = computed<readonly Customer[]>(() => {
    const base = this._mobileFilteredData() ?? this.tableData();
    const opt = this.mobileSortOption();
    if (!opt || opt === '') return base;
    const [field, dirStr] = opt.split(':') as [keyof Customer, '1' | '-1'];
    const dir = dirStr === '-1' ? -1 : 1;
    return [...base].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return 0;
    });
  });

  /**
   * Slice paginado del card-list. Pagination state independiente del
   * `<p-table>` desktop (que tiene su propio paginador interno).
   * Reset a página 0 cuando cambia filter o sort (computed dependency
   * a `mobileSourceData` produce nuevo array → reset via effect).
   */
  protected readonly mobilePagedData = computed<readonly Customer[]>(() => {
    const data = this.mobileSourceData();
    const first = this.mobileFirst();
    const rows = this.mobileRows();
    return data.slice(first, first + rows);
  });

  protected readonly mobileFirst = signal(0);
  protected readonly mobileRows = signal(10);

  protected onMobilePageChange(event: PaginatorState): void {
    this.mobileFirst.set(event.first ?? 0);
    this.mobileRows.set(event.rows ?? 10);
  }

  // ── Mobile filter & sort bottom-sheet ──────────────────────────────
  //
  // En mobile los `<p-columnFilter>` por header son inaccesibles (la
  // tabla está oculta, el card-list no tiene headers). El sheet
  // (`<app-customers-filter-sheet>`, drawer bottom + controls + sort
  // presets) vive en su propio componente; acá quedan la visibilidad
  // (la comparten el atajo `f`, el botón del toolbar y la cascada de
  // `escape`), el sort two-way (lo lee `mobileSourceData`) y el apply
  // (facade + reset de paginación mobile) — ver JSDoc del hijo para el
  // rationale del realtime apply sin buffer.

  protected readonly filterSheetVisible = signal(false);

  /** Sort preset `field:dir` del card-list mobile — two-way con el
   * `<app-customers-filter-sheet>` (que es dueño del catálogo de
   * options); lo lee `mobileSourceData` en el pipeline filter → sort
   * → paginate. */
  protected readonly mobileSortOption = signal<string>('');

  protected openFilterSheet(): void {
    this.filterSheetVisible.set(true);
  }

  protected closeFilterSheet(): void {
    this.filterSheetVisible.set(false);
  }

  /** Handler del `(filterApplied)` del sheet — cualquier filter del
   * drawer pasa por acá. La normalización (`null` | `[]` | `''` →
   * clear) vive en el facade; acá solo queda el reset de paginación
   * mobile. */
  protected applySheetFilter(
    value: unknown,
    field: string,
    matchMode: string,
  ): void {
    this.filters.apply(value, field, matchMode);
    this.mobileFirst.set(0);
  }

  // ── Detail drawer (universal mobile + desktop) ─────────────────────
  //
  // Tap card body (mobile) o click "Detalles" en el ··· menu (desktop)
  // abre un drawer right-side con info COMPLETA del cliente — todas
  // las columnas, no sólo las visibles en la tabla. Patrón Linear /
  // HubSpot / Stripe / Salesforce: detail panel es UNIVERSAL, mismo
  // surface para mobile y desktop, mismo único componente.

  protected readonly detailedCustomer = signal<Customer | null>(null);

  protected openDetail(customer: Customer): void {
    this.detailedCustomer.set(customer);
    // Deeplink: ?detail=15 — URL refleja el cliente abierto. Refresh
    // o share preserva el detalle visible. Patrón Linear/Stripe.
    if (!this.isApplyingFromUrl()) {
      this.urlState.updateUrl({ detailId: customer.id });
    }
  }

  protected closeDetail(): void {
    this.detailedCustomer.set(null);
    if (!this.isApplyingFromUrl()) {
      this.urlState.updateUrl({ detailId: null });
    }
  }

  /** Click en card body → abre detail. Excluye click en el ··· button
   * (chequeado via stopPropagation en el button mismo). */
  protected onCardClick(customer: Customer, event: Event): void {
    const target = event.target as HTMLElement | null;
    // Si el click viene del ··· button o un descendiente, no abrir
    // detail (el button maneja su propia acción via popover).
    if (target?.closest('p-button')) return;
    this.openDetail(customer);
  }

  protected onTableFilter(event: TableFilterEvent): void {
    this.filters.refresh();
    // Sync filtered data para mobile card-list. Si filteredValue es
    // undefined o el array completo, dejamos null — mobile cae a
    // tableData() (más eficiente, evita doble referencia al mismo array).
    const filtered = event.filteredValue as Customer[] | undefined;
    if (filtered && filtered.length !== this.tableData().length) {
      this._mobileFilteredData.set(filtered);
    } else {
      this._mobileFilteredData.set(null);
    }
    // Reset mobile pagination al cambiar filters — caso típico:
    // user en página 3 filtra y deja sólo 4 resultados; sin reset
    // sigue intentando renderizar slice [20,30) sobre [0,4) → cards vacías.
    this.mobileFirst.set(0);
    // Sync state al URL (skip si estamos en plena hidratación desde URL)
    this.syncFiltersToUrl();
    // El cambio de filtros invalida la "view activa" — el snapshot ya
    // no matchea ninguna saved view exacta. Patrón HubSpot/Salesforce:
    // selector vuelve a "Unsaved" tras tocar filters.
    this.activeSavedViewId.set(null);
  }

  /**
   * Serializa el estado actual de filtros + sort hacia URL queryParams.
   * La parte de filtros la arma `filters.snapshotFilters()` (el único
   * puerto de lectura de `Table.filters` — mismo serializado que usan
   * las saved views, un solo lugar para la regla de descarte de
   * vacíos). Skipea si estamos en fase de hidratación inicial para
   * evitar feedback loop; el guard de tabla no-montada se conserva
   * (sin tabla NO se emite updateUrl, igual que pre-partición).
   */
  private syncFiltersToUrl(): void {
    if (this.isApplyingFromUrl()) return;
    if (!this.clientsTable()) return;
    this.urlState.updateUrl({
      filters: this.filters.snapshotFilters(),
      sort: this.tableSort(),
    });
  }

  protected clearAllFilters(): void {
    // `Table.clear()` resetea también el sort (sin emitir onSort) —
    // el facade limpia filtros + refresh; el espejo reactivo del sort
    // y el eco mobile se sincronizan acá manualmente.
    this.filters.clear();
    this.tableSort.set(null);
    this._mobileFilteredData.set(null);
  }

  // Formatters de crédito — extraídos a
  // `utils/customers-format.util.ts` (el `clpFormatter` vive ahí como
  // const module-level, instanciado una sola vez). Re-expuestos como
  // campos; `creditUtilizationSeverity` no se re-expone porque ningún
  // template del container la llama directo (solo la usa
  // `creditUtilizationColor` dentro del util).
  protected readonly formatCredit = formatCredit;
  protected readonly creditUtilizationPct = creditUtilizationPct;
  protected readonly creditUtilizationColor = creditUtilizationColor;
  protected readonly additionalSellersTooltip = additionalSellersTooltip;


  constructor() {
    // Registrar el custom matcher al construir el componente. La
    // operación es idempotente — re-registrar la misma key con la misma
    // función no rompe nada. PrimeNG mantiene la registry global.
    this.filterService.register(
      ARRAY_INTERSECT_MATCHMODE,
      (value: unknown, filter: unknown): boolean => {
        if (!Array.isArray(filter) || filter.length === 0) return true;
        if (!Array.isArray(value) || value.length === 0) return false;
        return filter.some((f) => value.includes(f));
      },
    );

    // Wire rollback notifications del saved-views service. Si una
    // mutación optimista (create/update/delete) falla durante la
    // persistencia simulada, el service hace rollback del signal y
    // dispara este handler con un mensaje. Inversion-of-control: el
    // service no acopla con PrimeNG `MessageService`; el componente
    // provee la integración. El unregister se ejecuta al destruir el
    // componente — el service es root-scoped y sin desregistro el
    // callback apuntaría a una instancia muerta (toast sobre
    // MessageService destruido).
    const unregisterRollback = this.savedViews.setRollbackHandler(
      (detail) => {
        this.messageService.add({
          key: 'customers-toast',
          severity: 'error',
          summary: 'Error',
          detail,
          life: TOAST_LONG_MS,
        });
      },
    );
    this.destroyRef.onDestroy(unregisterRollback);

    // Teardown de timers pendientes. Sin esto, un setTimeout vivo al
    // destruir el componente escribe signals y dispara toasts sobre la
    // instancia muerta. (El scroll listener del FAB y el reopen timer
    // del popover de fila tienen su propio teardown en sus hijos —
    // CustomersFabComponent / CustomersRowActionsComponent.)
    this.destroyRef.onDestroy(() => {
      if (this.pendingUndoTimer !== null) {
        clearTimeout(this.pendingUndoTimer);
        this.pendingUndoTimer = null;
      }
      for (const timer of this.simulateApiCallTimers) {
        clearTimeout(timer);
      }
      this.simulateApiCallTimers.clear();
    });

    // Hidratación URL → state. El effect espera a que `clientsTable()`
    // esté disponible (post-render) y a que `tableData()` tenga datos
    // (para resolver detailId → Customer). Self-destruct con `.destroy()`
    // tras el primer run exitoso — patrón canónico Angular 19+ vs el
    // flag-en-closure que era frágil (race-prone, no testable, depende
    // de cierre de scope para idempotencia).
    const hydrationEffect = effect(() => {
      const t = this.clientsTable();
      const data = this.tableData();
      if (!t || data.length === 0) return;
      this.applyFromUrl();
      hydrationEffect.destroy();
    });

    this.registerKeyboardShortcuts();
  }

  /**
   * Lee el snapshot desde URL queryParams y lo aplica al state del
   * componente. Wrap en `isApplyingFromUrl=true` para que los event
   * handlers (onTableFilter, openDetail) no re-escriban URL durante
   * la hidratación → feedback loop avoidance.
   */
  private applyFromUrl(): void {
    const snapshot = this.urlState.readFromUrl();
    if (Object.keys(snapshot).length === 0) return;

    this.isApplyingFromUrl.set(true);
    try {
      // Filters — el facade resuelve el matchMode canónico por field
      // y aplica cada entrada via `Table.filter()`.
      if (snapshot.filters) {
        this.filters.applyFilters(snapshot.filters);
      }
      // Sort (?sort=field:asc|desc → aplica a la tabla + espejo reactivo)
      if (snapshot.sort) {
        const t = this.clientsTable();
        if (t) {
          t.sortField = snapshot.sort.field;
          t.sortOrder = snapshot.sort.dir;
          t.sortSingle();
        }
        this.tableSort.set({ ...snapshot.sort });
      }
      // Detail (resuelve id → Customer del dataset hidratado)
      if (snapshot.detailId != null) {
        const found = this.tableData().find(
          (c) => c.id === snapshot.detailId,
        );
        if (found) this.detailedCustomer.set(found);
      }
    } finally {
      this.isApplyingFromUrl.set(false);
    }
  }

  // ── Saved views integration ────────────────────────────────────────

  /**
   * Handle del hijo saved-views-bar — el cierre del dialog "Guardar
   * vista" es async-aware: el hijo emite `saveRequested` SIN cerrar y
   * el container cierra recién cuando `savedViews.create()` resolvió
   * (mismo orden que el `await` pre-partición). Mientras persiste, el
   * modal queda abierto mostrando busy; si falla, queda abierto con el
   * nombre para reintentar.
   */
  private readonly savedViewsBar = viewChild(CustomersSavedViewsBarComponent);

  /**
   * Aplica una saved view: limpia state actual, lee el snapshot y
   * dispara el mismo flow que applyFromUrl() (reutiliza el guard +
   * mecanismo de loop avoidance).
   *
   * Patrón Salesforce/HubSpot: al clickear una view, sólo cambian los
   * filters+columns+sort, no la URL base ni el browsing history (single
   * navigation entry).
   */
  protected applySavedView(view: SavedView): void {
    this.isApplyingFromUrl.set(true);
    try {
      // Clear current filters first
      const t = this.clientsTable();
      if (t) t.clear();
      // Apply snapshot filters — el facade resuelve matchMode por field
      // (no-op si la tabla aún no montó, mismo guard que antes).
      if (view.snapshot.filters) {
        this.filters.applyFilters(view.snapshot.filters);
      }
      // Apply snapshot sort. `t.clear()` (arriba) ya reseteó el sort;
      // acá restauramos el orden persistido en la view (si tiene) y
      // sincronizamos el espejo reactivo en ambos casos.
      if (t && view.snapshot.sort) {
        t.sortField = view.snapshot.sort.field;
        t.sortOrder = view.snapshot.sort.dir;
        t.sortSingle();
      }
      this.tableSort.set(
        view.snapshot.sort ? { ...view.snapshot.sort } : null,
      );
      // Detail no se restaura por view (es transient state, no parte
      // de la "vista filtrada" — patrón HubSpot).
      this.detailedCustomer.set(null);
    } finally {
      this.isApplyingFromUrl.set(false);
    }
    this.activeSavedViewId.set(view.id);
    // Refresh URL para reflejar el state aplicado
    this.filters.refresh();
    this.syncFiltersToUrl();
  }

  /**
   * Captura el snapshot actual y lo persiste como nueva saved view.
   * El nombre llega ya trimmeado desde el dialog del hijo
   * (`saveRequested` de `CustomersSavedViewsBarComponent`); el guard
   * se conserva por robustez. El dialog se cierra RECIÉN después del
   * `await` exitoso (paridad con pre-partición): durante los ~180ms de
   * persistencia el modal muestra `[loading]`/`[disabled]` via
   * `savedViews.busy()`, y si `create()` lanza (rollback + toast del
   * service) el cierre nunca corre — el user reintenta sobre el mismo
   * modal con el nombre intacto.
   */
  protected async saveCurrentAsView(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const snapshot = this.currentSnapshot();
    const view = await this.savedViews.create(trimmed, snapshot);
    this.activeSavedViewId.set(view.id);
    this.savedViewsBar()?.closeSaveViewDialog();
  }

  /**
   * Compone snapshot serializable del state actual para persistencia.
   * La parte de filtros la arma el facade leyendo el source-of-truth
   * (Table.filters) en vez de `activeFilters` (signal derivado) — más
   * robusto contra divergencias.
   */
  private currentSnapshot(): CustomersViewSnapshot {
    return {
      // Sort real de la tabla via el espejo reactivo `tableSort` —
      // antes hardcodeaba `null` y `hasUnsavedChanges` era ciego al
      // orden (custom views con sort persistido nunca marcaban drift).
      sort: this.tableSort(),
      filters: this.filters.snapshotFilters(),
      columns: [...this.selectedColumnKeys()],
      first: this.mobileFirst(),
      rows: this.mobileRows(),
      detailId: this.detailedCustomer()?.id ?? null,
    };
  }

  /**
   * Params transitorios — UI state que NO debe propagarse cuando el
   * user comparte la URL. El `detail` es el drawer abierto sobre un
   * customer puntual: forzarlo al receptor sería como hacerle scroll
   * a esa fila Y abrirle un side panel sin contexto. Patrón Notion
   * "Copy link to view" / Linear "Share view" / Stripe Dashboard:
   * comparte la lista filtrada, no el row inspection state del emisor.
   *
   * Lista cerrada (no permissive) para evitar dependencias futuras:
   * cualquier nuevo param de UI transient debe sumarse acá explícito.
   */
  private static readonly TRANSIENT_SHARE_PARAMS = ['detail'] as const;

  /**
   * Share view — copia la URL filtrada (sin UI state transitorio) al
   * clipboard via Clipboard API + toast confirmation. Patrón Notion
   * "Copy link to view" / Stripe Dashboard.
   */
  protected async copyShareUrl(): Promise<void> {
    if (!this.isBrowser) return;
    // Strip transient UI params antes de copiar — el `detail` (drawer
    // abierto) es estado del emisor, no parte de "la vista" que el
    // receptor debería ver. Ver `TRANSIENT_SHARE_PARAMS`.
    const url = new URL(window.location.href);
    for (const param of CustomersComponent.TRANSIENT_SHARE_PARAMS) {
      url.searchParams.delete(param);
    }
    const shareable = url.toString();
    try {
      await navigator.clipboard.writeText(shareable);
      this.messageService.add({
        key: 'customers-toast',
        severity: 'success',
        summary: 'Enlace copiado',
        // Copy honesto con lo que el URL realmente transporta: filtros
        // y orden. Columnas visibles y paginación NO viajan en el URL
        // (son preferencia local del receptor).
        detail: 'Comparte para abrir la lista con los mismos filtros y orden.',
        life: 2500,
      });
    } catch {
      this.messageService.add({
        key: 'customers-toast',
        severity: 'error',
        summary: 'No se pudo copiar',
        detail: 'Tu navegador bloqueó el acceso al portapapeles.',
        life: 4000,
      });
    }
  }

  protected async deleteSavedView(view: SavedView): Promise<void> {
    if (view.system) return;
    await this.savedViews.delete(view.id);
    if (this.activeSavedViewId() === view.id) {
      this.activeSavedViewId.set(null);
    }
  }

  protected retry(): void {
    this.customersData.retry();
  }

  /** Handle del popover hijo — `displayPopover` delega en su `open()`
   * imperativo (el `#op`, el customer scoped y el reopen timer viven
   * ahora en `CustomersRowActionsComponent`). El elemento está en el
   * root del template, fuera de todo `@if` → el viewChild queda
   * resuelto desde el primer render. */
  private readonly rowActions = viewChild(CustomersRowActionsComponent);

  protected displayPopover(e: MouseEvent, customer: Customer): void {
    this.rowActions()?.open(e, customer);
  }

  // ── Row actions (··· popover menu) ─────────────────────────────────
  //
  // Set canónico bigtech CRM (Salesforce/HubSpot/Pipedrive):
  //   1. Ver detalle      — abre el detail drawer (no edit, sólo read)
  //   2. Editar           — placeholder; v2 sería edit mode del drawer
  //   3. Asignar vendedor — single-row version del bulk action
  //   4. Email            — mailto: con el email del cliente
  //   5. Duplicar         — clona el customer (timestamp id, " (copia)")
  //   6. Eliminar         — destructive separated by divider
  // Acciones secundarias deferred a v2 (Log call, Convert, Mover, etc).
  //
  // Los handlers reciben el customer por parámetro (el scoped state
  // `popoverCustomer` vive ahora en el hijo, que lo emite junto a la
  // acción); acá queda la orquestación (drawer + URL, selección +
  // bulk dialogs, mock API).

  /** Despacha la acción elegida en el menú ··· del hijo. */
  protected onRowAction({
    action,
    customer,
  }: {
    action: CustomerRowAction;
    customer: Customer;
  }): void {
    switch (action) {
      case 'detail':
        this.onActionDetail(customer);
        break;
      case 'edit':
        this.onActionEdit(customer);
        break;
      case 'assign':
        this.onActionAssign(customer);
        break;
      case 'email':
        this.onActionEmail(customer);
        break;
      case 'duplicate':
        this.onActionDuplicate(customer);
        break;
      case 'delete':
        this.onActionDelete(customer);
        break;
    }
  }

  protected onActionDetail(c: Customer): void {
    this.openDetail(c);
  }

  protected onActionEdit(c: Customer): void {
    // v1: Edit reusa el detail drawer (read-only por ahora). v2 sería
    // edit-mode toggle en el drawer con form inline.
    this.openDetail(c);
  }

  /** Asignar vendedor a UN customer — selecciona ese row y reusa el
   * bulk-assign dialog. Pattern single-row-via-bulk simplifica el
   * mantenimiento (1 dialog, 1 mock API call). */
  protected onActionAssign(c: Customer): void {
    this.selectedRows.set([c]);
    this.bulkAssignVisible.set(true);
  }

  /** Email — `mailto:` link. Sin guard de SSR porque popover sólo
   * existe browser-side (PrimeNG popover monta en DOM dinámicamente). */
  protected onActionEmail(c: Customer): void {
    if (c.email) {
      window.location.href = `mailto:${c.email}`;
    }
  }

  /** Duplica el customer — id nuevo (timestamp), name con sufijo
   * "(copia)". Mock backend: prepend al dataset via replaceAll. */
  protected onActionDuplicate(c: Customer): void {
    const duplicate: Customer = {
      ...c,
      id: Date.now(),
      name: `${c.name} (copia)`,
    };
    this.api.replaceAll([duplicate, ...this.tableData()]);
  }

  protected onActionDelete(c: Customer): void {
    this.selectedRows.set([c]);
    this.bulkDeleteVisible.set(true);
  }

  /**
   * Handler del CTA "Crear cliente". Placeholder por ahora — en el
   * showcase real abriría un dialog/wizard con el form de alta:
   * Nombre, RUT (con check-digit validation), Tipo Empresa/Persona,
   * vendedor primario asignado, segmento, etc. La acción primaria
   * vive en el header del page (top-right) según convención bigtech
   * (Stripe Customers, HubSpot, Salesforce Accounts).
   */
  protected onCreateCustomer(): void {
    // TODO: open create customer dialog
  }

  // ── Keyboard shortcuts + Cmd+K palette + ? help overlay ───────────
  //
  // Set canónico bigtech (Linear / Stripe / Notion / Slack):
  //   - Cmd+K         → command palette (search + actions)
  //   - ?             → keyboard shortcuts help overlay
  //   - C             → Crear cliente (mismo que click CTA)
  //   - F             → Focus filter sheet trigger (mobile)
  //   - R             → Refresh (reload data)
  //   - Escape        → Close any open drawer/dialog/palette
  //
  // Todos los shortcuts ignoran input context excepto Cmd+K y `?`
  // (always-on globally, patrón Linear/Stripe).

  protected readonly cmdkVisible = signal(false);
  protected readonly helpVisible = signal(false);

  /** Handle del palette hijo — `openCmdK` delega en su `open()`
   * imperativo, que resetea query + índice ANTES de abrir (ese estado
   * vive ahora en `CustomersCmdkComponent`). El elemento está en el
   * root del template, fuera de todo `@if` → el viewChild queda
   * resuelto desde el primer render (los shortcuts corren después). */
  private readonly cmdkPalette = viewChild(CustomersCmdkComponent);

  protected openCmdK(): void {
    this.cmdkPalette()?.open();
  }

  protected closeCmdK(): void {
    this.cmdkVisible.set(false);
  }

  protected openHelp(): void {
    this.helpVisible.set(true);
  }

  protected closeHelp(): void {
    this.helpVisible.set(false);
  }

  /**
   * Registra todos los shortcuts del módulo. Llamado desde constructor
   * después de la inicialización de signals. El service usa
   * takeUntilDestroyed internamente — al destruirse el componente,
   * el listener global se limpia automáticamente.
   */
  private registerKeyboardShortcuts(): void {
    this.keyboardService.register([
      {
        combo: 'cmd+k',
        label: 'Buscar clientes',
        section: 'Navegación',
        handler: () => this.openCmdK(),
      },
      {
        combo: '?',
        label: 'Mostrar atajos de teclado',
        section: 'Navegación',
        handler: () => this.openHelp(),
      },
      {
        combo: 'c',
        label: 'Crear nuevo cliente',
        section: 'Acciones',
        handler: () => this.onCreateCustomer(),
      },
      {
        combo: 'r',
        label: 'Actualizar lista',
        section: 'Acciones',
        handler: () => this.retry(),
      },
      {
        combo: 'f',
        label: 'Abrir filtros',
        section: 'Acciones',
        handler: () => this.openFilterSheet(),
      },
      {
        combo: 'escape',
        label: 'Cerrar paneles abiertos',
        section: 'Navegación',
        handler: () => {
          if (this.cmdkVisible()) {
            this.closeCmdK();
          } else if (this.helpVisible()) {
            this.closeHelp();
          } else if (this.detailedCustomer()) {
            this.closeDetail();
          } else if (this.filterSheetVisible()) {
            this.closeFilterSheet();
          } else if (this.selectionCount() > 0) {
            this.clearSelection();
          }
        },
      },
    ]);
  }
}
