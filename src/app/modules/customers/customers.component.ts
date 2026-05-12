// Angular
import { CommonModule, DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
// PrimeNG
import { FilterService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Divider } from 'primeng/divider';
import { Drawer } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import type { Popover } from 'primeng/popover';
import { PopoverModule } from 'primeng/popover';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { Table, TableModule, type TableFilterEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
// Local
import {
  ColumnHelpComponent,
  type ColumnHelpEntry,
} from '../../shared/components/column-help/column-help.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TableFilterShellComponent } from '../../shared/components/table-filter-shell/table-filter-shell.component';
import { TooltipDismissOnClickDirective } from '../../shared/directives/tooltip-dismiss-on-click.directive';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { TimeService } from '../../shared/services/time.service';
import type {
  Cartera,
  CreditClassification,
  Customer,
  CustomerLifecycle,
  CustomerSegmento,
  CustomerType,
  PotencialGroup,
} from './models/customer.interface';
import { CustomersKeyboardService } from './services/customers-keyboard.service';
import { CustomersMockService } from './services/customers-mock.service';
import {
  CustomersSavedViewsService,
  type SavedView,
} from './services/customers-saved-views.service';
import {
  CustomersUrlStateService,
  type CustomersViewSnapshot,
} from './services/customers-url-state.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  Dialog,
  Divider,
  Drawer,
  InputTextModule,
  Toast,
  MultiSelect,
  Paginator,
  PopoverModule,
  Select,
  Skeleton,
  Slider,
  TableModule,
  Tag,
  TooltipModule,
];
const LOCAL_COMPONENTS = [
  ColumnHelpComponent,
  EmptyStateComponent,
  TableFilterShellComponent,
  TooltipDismissOnClickDirective,
  RelativeTimePipe,
];

/**
 * Custom matcher para arrays — registrado globalmente en `FilterService`
 * para usarlo via `matchMode="arrayIntersect"` en `<p-columnFilter>`.
 *
 * Lógica: matchea si el field array contiene AL MENOS uno de los
 * valores del filter. Caso de uso: columna "Vendedores asignados"
 * donde un cliente tiene 1-3 vendedores y el filter pregunta "muéstrame
 * todos los clientes de Carla, Felipe o Diego".
 */
const ARRAY_INTERSECT_MATCHMODE = 'arrayIntersect';

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
/** Delay artificial cuando se hide-then-show el row-actions popover
 * para que PrimeNG re-attach correctly tras un click rápido. */
const POPOVER_REOPEN_GUARD_MS = 150;
/** Threshold del FAB scroll listener — micro-jitter en touch scroll
 * (< 24px) no debe flippear el extended/collapsed state. */
const FAB_SCROLL_THRESHOLD_PX = 24;
/** Y-scroll bajo este threshold = "near top", FAB siempre extended
 * independientemente de dirección. */
const FAB_NEAR_TOP_PX = 50;

/** Density mode del table — affects body/header cell padding. */
export type TableDensity = 'compact' | 'comfortable';

/** Cmd+K result group — sections rendered en el palette
 * (Recientes / Clientes / Acciones). Patrón Linear/Stripe/Notion:
 * categorical grouping aumenta scanability del listbox. */
export interface CmdkResultGroup {
  label: string;
  icon: string;
  items: Customer[];
}

/**
 * Representación normalizada de un filtro activo, surface del chip bar.
 * `field` y `matchMode` son los inputs canónicos para la API
 * `Table.filter(value, field, matchMode)` — al remover, los pasamos
 * directo. `display` es el texto formateado pre-computado para evitar
 * re-formatear en cada render.
 */
interface ActiveFilter {
  field: string;
  label: string;
  display: string;
  matchMode: string;
}

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
  protected readonly savedViews = inject(CustomersSavedViewsService);
  protected readonly keyboardService = inject(CustomersKeyboardService);
  private readonly timeService = inject(TimeService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

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
      if (view.system && this.snapshotEqual(view, current)) {
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
   * captura drift real en custom views. Ver `snapshotEqual` abajo.
   */
  protected readonly hasUnsavedChanges = computed<boolean>(() => {
    const activeId = this.activeSavedViewId();
    if (!activeId) return false;
    const view = this.savedViews.get(activeId);
    if (!view) return false;
    return !this.snapshotEqual(view, this.currentSnapshot());
  });

  /**
   * Comparación full del snapshot persistido contra el state actual.
   * Branching system vs custom (ver `hasUnsavedChanges`). System views
   * solo comparan filters; custom views comparan filters + sort +
   * columns (orden-sensitive) + rows-per-page. `first` (pagination
   * position) y `detailId` (drawer state) son UI transient y nunca
   * cuentan como dirty en ninguna rama.
   */
  private snapshotEqual(
    view: SavedView,
    current: CustomersViewSnapshot,
  ): boolean {
    // Filters siempre — definen el "qué muestro" del view.
    if (!this.filtersEqual(view.snapshot.filters, current.filters)) {
      return false;
    }
    // System view: filters-only definition. Customizations del user
    // (cols, sort, rows) son preferencias sobre el preset, no edits.
    if (view.system) return true;

    // Custom view: snapshot completo.
    // Columns: orden importa (el user persistió un layout específico).
    if (view.snapshot.columns.length !== current.columns.length) {
      return false;
    }
    for (let i = 0; i < view.snapshot.columns.length; i++) {
      if (view.snapshot.columns[i] !== current.columns[i]) return false;
    }
    // Rows-per-page.
    if (view.snapshot.rows !== current.rows) return false;
    // Sort: ambos null → equal; sólo uno null → diff; ambos set →
    // field+dir match.
    if (!this.sortEqual(view.snapshot.sort, current.sort)) return false;

    return true;
  }

  /** Comparación nullable de sort descriptor (field+dir). */
  private sortEqual(
    a: { field: string; dir: number } | null,
    b: { field: string; dir: number } | null,
  ): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a.field === b.field && a.dir === b.dir;
  }

  /** Shallow comparison de dos objetos filters. Robusta a key order,
   * compara array values via sorted JSON.stringify (sets de valores
   * son equivalentes regardless of position). */
  private filtersEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!(k in b)) return false;
      const va = a[k];
      const vb = b[k];
      if (Array.isArray(va) && Array.isArray(vb)) {
        const sortedA = [...va].sort().join('|');
        const sortedB = [...vb].sort().join('|');
        if (sortedA !== sortedB) return false;
      } else if (va !== vb) {
        return false;
      }
    }
    return true;
  }

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
    setTimeout(() => {
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
  }

  // ── Density toggle (Compact/Normal/Comfortable) ────────────────────
  //
  // Patrón Cloudscape/MUI/Material-React-Table: usuario elige densidad
  // del table para maximizar info-per-screen (Compact: 8 rows visible
  // en lugar de 6) o legibilidad (Comfortable: padding generoso, ideal
  // para data entry largo). Persist en localStorage para que la
  // preferencia sobreviva sessions.

  /** Density opciones — 2 modos siguiendo bigtech (Linear/GitHub Primer
   * usan Compact/Comfortable, no 3 niveles). Tres opciones aumentaba
   * decision-cost sin payoff perceptible: la diferencia "Normal vs
   * Comfortable" eran 4px de padding, imperceptible para mayoría. */
  protected readonly densityOptions: { label: string; value: TableDensity; icon: string }[] = [
    { label: 'Compacto', value: 'compact', icon: 'fa-sharp fa-regular fa-bars' },
    { label: 'Cómodo', value: 'comfortable', icon: 'fa-sharp fa-regular fa-table-rows' },
  ];

  protected readonly density = signal<TableDensity>(this.readDensityFromStorage());

  /**
   * PrimeNG design tokens dinámicos para `<p-table>` según densidad.
   * Bind via `[dt]="tableDensityDt()"` — PrimeNG aplica padding/font
   * tokens al table runtime sin necesidad de CSS custom.
   *
   * Valores calibrados por measurement de row floor:
   *   - El row floor estaba dominado por el botón ··· (40px) → reducir
   *     solo cell padding daba 8px ahorro (~12%), imperceptible.
   *   - Linear/Stripe/Notion compact: row ~36-40px (vs ~56-64px normal).
   *     Para llegar ahí necesitamos reducir padding Y escalar el row
   *     content (··· button → h-7, font-size, line-height).
   *   - El scaling extra del row content vive en `styles.scss` bajo
   *     `.customers-table--compact` (descendant selectors). El padding
   *     vive acá vía dt tokens.
   *
   * Comfortable: padding default de PrimeNG (0.75rem 1rem) — row ~56px.
   * Compact: padding agresivo (0.25rem 0.75rem) + row content scaled
   * via class → row ~36px. ~36% reducción, claramente visible.
   */
  protected readonly tableDensityDt = computed(() => {
    const d = this.density();
    if (d === 'compact') {
      return {
        bodyCell: { padding: '0.25rem 0.75rem' },
        headerCell: { padding: '0.375rem 0.75rem' },
      };
    }
    // Comfortable — PrimeNG default padding (0.75rem 1rem)
    return {};
  });

  protected setDensity(value: TableDensity): void {
    this.density.set(value);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('customers:density', value);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Density binary toggle — cicla entre Compacto y Cómodo en un solo
   * click. Reemplaza al `<p-popover>` de 2 opciones que tenía:
   *
   *   1. **UX problem**: un popover con 2 botones para alternar entre
   *      2 estados es overkill. Linear/Notion/Vercel resuelven density
   *      como toggle directo (1 click), no submenú.
   *   2. **Trigger race**: `popover.toggle($event)` choca con el
   *      outside-click handler de PrimeNG. Mousedown del trigger
   *      cierra el popover (lo considera "fuera del overlay"), después
   *      el click event ve estado=cerrado y re-abre. Resultado: click
   *      sobre trigger nunca cierra. Reproducido empíricamente con 6
   *      clicks consecutivos — todos open=true.
   *   3. **Flex gap fantasma**: el `<p-popover>` como sibling en el
   *      flex toolbar consumía 12px (gap-3) extra antes y después,
   *      desbalanceando el ritmo entre density-button y "Crear cliente"
   *      (24px vs 12px del resto).
   *
   * Convención del icon: muestra el NEXT state — mismo patrón que el
   * dark-mode toggle del toolbar global (fa-sun cuando dark, fa-moon
   * cuando light). Click → me llevará a ese estado.
   */
  protected toggleDensity(): void {
    this.setDensity(this.density() === 'compact' ? 'comfortable' : 'compact');
  }

  /** Icon que representa el NEXT state — patrón forward-affordance. */
  protected readonly densityToggleIcon = computed(() =>
    this.density() === 'compact'
      ? 'fa-sharp fa-regular fa-table-rows'
      : 'fa-sharp fa-regular fa-bars',
  );

  /** Tooltip descriptivo: estado actual + acción del click. Patrón
   * Linear/Stripe — el usuario sabe dónde está y a dónde va. */
  protected readonly densityToggleTooltip = computed(() =>
    this.density() === 'compact'
      ? 'Densidad compacta · clic para vista cómoda'
      : 'Densidad cómoda · clic para vista compacta',
  );

  private readDensityFromStorage(): TableDensity {
    if (typeof localStorage === 'undefined') return 'comfortable';
    try {
      const raw = localStorage.getItem('customers:density');
      if (raw === 'compact' || raw === 'comfortable') {
        return raw;
      }
    } catch {
      // ignore
    }
    return 'comfortable';
  }

  // ── Row selection + bulk actions ──────────────────────────────────
  //
  // Selección de filas para bulk operations. Patrón Salesforce/HubSpot
  // /Zoho: checkbox por row → toolbar de bulk actions aparece cuando
  // selection > 0, con count badge + acciones (Mass update, Export,
  // Delete). Crítico para data entry / cleanup workflows.

  protected readonly selectedRows = signal<readonly Customer[]>([]);

  protected readonly selectionCount = computed(
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

  /** Dialog state para bulk assign vendedor. */
  protected readonly bulkAssignVisible = signal(false);
  protected readonly bulkAssignSeller = signal<string | null>(null);

  /** Confirm dialog para bulk delete. */
  protected readonly bulkDeleteVisible = signal(false);

  /**
   * Limpia selección. Útil tras completar bulk action o al cancel.
   */
  protected clearSelection(): void {
    this.selectedRows.set([]);
  }

  protected openBulkAssign(): void {
    this.bulkAssignSeller.set(null);
    this.bulkAssignVisible.set(true);
  }

  protected closeBulkAssign(): void {
    this.bulkAssignVisible.set(false);
  }

  /**
   * Bulk assign vendedor — actualiza el primary seller (índice 0) de
   * todos los seleccionados al vendedor elegido. Mock backend: mutate
   * in-memory + reload signal. Bigtech (Salesforce mass owner change)
   * haría POST /api/customers/bulk-update con `{ ids, patch }`.
   */
  protected applyBulkAssign(): void {
    const seller = this.bulkAssignSeller();
    if (!seller) return;
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
    this.closeBulkAssign();
  }

  protected openBulkDelete(): void {
    this.bulkDeleteVisible.set(true);
  }

  protected closeBulkDelete(): void {
    this.bulkDeleteVisible.set(false);
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
    this.closeBulkDelete();

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
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected readonly customersResource = rxResource({
    stream: () => this.api.getCustomers(),
  });
  protected readonly loading = computed(() =>
    this.customersResource.isLoading(),
  );
  protected readonly loadError = computed(() =>
    this.customersResource.error(),
  );

  protected readonly tableData = computed<readonly Customer[]>(
    () => this.customersResource.value() ?? [],
  );

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

  /** Distintivo B2B / B2C — set cerrado. */
  protected readonly typeOptions: CustomerType[] = ['Empresa', 'Persona'];

  /** Verticales de negocio — set cerrado. */
  protected readonly segmentoOptions: CustomerSegmento[] = [
    'PASAJEROS',
    'CARGA',
    'INDUSTRIAL',
    'COMERCIO',
    'OTROS',
  ];

  /** Ratings de riesgo crediticio (A1 mejor, D peor). */
  protected readonly classificationOptions: CreditClassification[] = [
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2',
    'D',
  ];

  /** Grupos de potencial de venta (G1 más alto, G4 más bajo). */
  protected readonly potencialOptions: PotencialGroup[] = [
    'G1',
    'G2',
    'G3',
    'G4',
  ];

  /**
   * Estados del ciclo de vida comercial — separado de Cartera (estado
   * financiero). Set cerrado del legacy.
   */
  protected readonly lifecycleOptions: CustomerLifecycle[] = [
    'RECURRENTE',
    'INACTIVO',
    'PELIGRO FUGA',
    'FUGADO',
  ];

  /**
   * Carteras lifecycle del cliente. Labels expuestos al filter para que
   * el admin elija "Activa" en lugar del código `CA`.
   */
  protected readonly carteraOptions: { label: string; value: Cartera }[] = [
    { label: 'Activa (CA)', value: 'CA' },
    { label: 'Prospecto (CP)', value: 'CP' },
    { label: 'Nueva (CN)', value: 'CN' },
    { label: 'Inactiva (CI)', value: 'CI' },
    { label: 'Morosa (CM)', value: 'CM' },
  ];

  /**
   * Legends de columnas codificadas — single source of truth de qué
   * significa cada código del legacy. Los `<app-column-help>` del
   * header las renderizan en un popover; los tooltips per-cell
   * (`codeTooltip`) hacen lookup en estas mismas listas.
   */
  protected readonly classificationLegend: readonly ColumnHelpEntry[] = [
    {
      code: 'A1',
      label: 'Excelente',
      description: 'Riesgo financiero bajo',
      severity: 'success',
    },
    {
      code: 'A2',
      label: 'Muy bueno',
      description: 'Riesgo financiero bajo',
      severity: 'success',
    },
    {
      code: 'B1',
      label: 'Bueno',
      description: 'Riesgo financiero medio',
      severity: 'info',
    },
    {
      code: 'B2',
      label: 'Aceptable',
      description: 'Riesgo financiero medio',
      severity: 'info',
    },
    {
      code: 'C1',
      label: 'Regular',
      description: 'Riesgo financiero medio-alto',
      severity: 'warn',
    },
    {
      code: 'C2',
      label: 'Marginal',
      description: 'Riesgo financiero alto',
      severity: 'warn',
    },
    {
      code: 'D',
      label: 'Crítico',
      description: 'Riesgo de incumplimiento alto',
      severity: 'danger',
    },
  ];

  protected readonly potencialLegend: readonly ColumnHelpEntry[] = [
    {
      code: 'G1',
      label: 'Estratégico',
      description: 'Cuentas top con máximo potencial de venta',
      severity: 'success',
    },
    {
      code: 'G2',
      label: 'Alto',
      description: 'Cuentas en crecimiento con buen potencial',
      severity: 'info',
    },
    {
      code: 'G3',
      label: 'Medio',
      description: 'Cuentas estables con potencial moderado',
      severity: 'warn',
    },
    {
      code: 'G4',
      label: 'Bajo',
      description: 'Cuentas con bajo potencial de crecimiento',
      severity: 'secondary',
    },
  ];

  protected readonly lifecycleLegend: readonly ColumnHelpEntry[] = [
    {
      code: 'RECURRENTE',
      label: 'Recurrente',
      description: 'Compras consistentes en el período',
      severity: 'success',
    },
    {
      code: 'INACTIVO',
      label: 'Inactivo',
      description: 'Sin compras recientes, churn parcial',
      severity: 'secondary',
    },
    {
      code: 'PELIGRO FUGA',
      label: 'Peligro de fuga',
      description: 'Frecuencia decreciente, target de retención',
      severity: 'warn',
    },
    {
      code: 'FUGADO',
      label: 'Fugado',
      description: 'Cliente perdido, churn confirmado',
      severity: 'danger',
    },
  ];

  protected readonly carteraLegend: readonly ColumnHelpEntry[] = [
    {
      code: 'CA',
      label: 'Activa',
      description: 'Cuenta corriente operativa, paga al día',
      severity: 'success',
    },
    {
      code: 'CN',
      label: 'Nueva',
      description: 'Alta reciente, primer ciclo de facturación',
      severity: 'info',
    },
    {
      code: 'CP',
      label: 'Prospecto',
      description: 'En etapa comercial, sin venta confirmada',
      severity: 'secondary',
    },
    {
      code: 'CI',
      label: 'Inactiva',
      description: 'Sin movimiento +6 meses, no morosa',
      severity: 'secondary',
    },
    {
      code: 'CM',
      label: 'Morosa',
      description: 'Cuenta con deuda vencida, asignar a cobranza',
      severity: 'danger',
    },
  ];

  protected readonly discountGroupLegend: readonly ColumnHelpEntry[] = [
    {
      code: '0',
      label: 'Sin descuento',
      description: 'Precios estándar de catálogo',
      severity: 'secondary',
    },
    {
      code: '1',
      label: 'Tier básico',
      description: 'Descuento mínimo (~2%)',
      severity: 'info',
    },
    {
      code: '2',
      label: 'Tier básico+',
      description: 'Descuento bajo (~5%)',
      severity: 'info',
    },
    {
      code: '3',
      label: 'Tier estándar',
      description: 'Descuento moderado (~10%)',
      severity: 'success',
    },
    {
      code: '4',
      label: 'Tier estándar+',
      description: 'Descuento alto (~15%)',
      severity: 'success',
    },
    {
      code: '5',
      label: 'Tier premium',
      description: 'Descuento máximo (~20%) — cuentas estratégicas',
      severity: 'warn',
    },
  ];

  /**
   * Tooltip per-cell — lookup en la legend correspondiente y formateo
   * "Label — descripción". Hover sobre `[A1]` muestra
   * "Excelente — Riesgo financiero bajo" instantáneamente, sin abrir
   * el popover del header.
   */
  protected codeTooltip(
    legend: readonly ColumnHelpEntry[],
    code: string,
  ): string {
    const entry = legend.find((e) => e.code === code);
    if (!entry) return '';
    return entry.description
      ? `${entry.label} — ${entry.description}`
      : entry.label;
  }

  /**
   * Severity del tag de tipo. Empresa → undefined (primary), Persona →
   * secondary. Mismo patrón que users.ts para Interno/Externo.
   */
  protected typeSeverity(type: CustomerType): 'secondary' | undefined {
    return type === 'Empresa' ? undefined : 'secondary';
  }

  /**
   * Severity del tag de clasificación crediticia — color-coded por
   * rating. A* (excelente) → success, B* (bueno) → info, C* (regular)
   * → warn, D (malo) → danger. Comunica salud crediticia de un vistazo
   * sin necesidad de leer el código.
   */
  protected classificationSeverity(
    cls: CreditClassification,
  ): 'success' | 'info' | 'warn' | 'danger' {
    if (cls === 'A1' || cls === 'A2') return 'success';
    if (cls === 'B1' || cls === 'B2') return 'info';
    if (cls === 'C1' || cls === 'C2') return 'warn';
    return 'danger';
  }

  /**
   * Severity del tag de ciclo de vida comercial:
   *   - RECURRENTE → success (cliente saludable, compra consistente)
   *   - INACTIVO → secondary (sin actividad, sin alarma inmediata)
   *   - PELIGRO FUGA → warn (target proactivo de retención)
   *   - FUGADO → danger (churn confirmado)
   */
  protected lifecycleSeverity(
    l: CustomerLifecycle,
  ): 'success' | 'secondary' | 'warn' | 'danger' {
    if (l === 'RECURRENTE') return 'success';
    if (l === 'PELIGRO FUGA') return 'warn';
    if (l === 'FUGADO') return 'danger';
    return 'secondary';
  }

  /**
   * Severity del tag de cartera — lifecycle del cliente:
   *   - CA Activa → success (paga al día)
   *   - CN Nueva  → info (alta reciente)
   *   - CP Prospecto → secondary (pre-venta)
   *   - CI Inactiva → secondary (sin movimiento, no morosa)
   *   - CM Morosa → danger (deuda vencida)
   */
  protected carteraSeverity(
    c: Cartera,
  ): 'success' | 'info' | 'secondary' | 'danger' {
    if (c === 'CA') return 'success';
    if (c === 'CN') return 'info';
    if (c === 'CM') return 'danger';
    return 'secondary';
  }

  /** Label legible de cartera (para mostrar en el tag). */
  protected carteraLabel(c: Cartera): string {
    if (c === 'CA') return 'Activa';
    if (c === 'CP') return 'Prospecto';
    if (c === 'CN') return 'Nueva';
    if (c === 'CI') return 'Inactiva';
    return 'Morosa';
  }

  protected readonly columnFilterPt = {
    pcFilterClearButton: { root: { class: 'p-button-tonal' } },
    filterButtonBar: { class: '!justify-end gap-2' },
  };

  private readonly _lastFetchedAt = signal<string | null>(null);
  protected readonly lastFetchedAt = this._lastFetchedAt.asReadonly();

  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4];

  /**
   * Catálogo de columnas hideables. El checkbox de selección, Nombre y
   * Acciones quedan fuera — son funcionales/identidad y siempre visibles
   * (patrón Linear / Notion / Airtable: la primary column nunca se oculta).
   * El orden acá es el mismo que en el thead, así el multiselect lista las
   * opciones en el mismo eje visual que la tabla.
   *
   * Patrón PrimeNG "Column Toggle" oficial: `<p-multiselect>` con el
   * catálogo + un signal de keys seleccionadas como ngModel. La doc
   * (primeng.org/table#column-toggle) lo aplica con `*ngFor="let col of
   * columns"` para tablas homogéneas — acá adoptamos el trigger UI pero
   * mantenemos `@if (isColumnVisible(key))` por columna porque cada
   * celda renderiza distinto (tag, formatCredit, tabular-nums, tooltip
   * per-cell, sortIcon condicional).
   */
  protected readonly columnDefs: {
    key: string;
    label: string;
    defaultHidden?: boolean;
  }[] = [
    { key: 'rut', label: 'RUT' },
    { key: 'type', label: 'Tipo' },
    { key: 'email', label: 'Contacto', defaultHidden: true },
    { key: 'lifecycle', label: 'Ciclo de vida', defaultHidden: true },
    { key: 'assignedSellers', label: 'Vendedores asignados' },
    { key: 'availableCredit', label: 'Crédito disponible' },
    { key: 'usedCredit', label: 'Crédito utilizado', defaultHidden: true },
    { key: 'assignedCredit', label: 'Crédito asignado', defaultHidden: true },
    { key: 'region', label: 'Región', defaultHidden: true },
    { key: 'city', label: 'Ciudad', defaultHidden: true },
    { key: 'segmento', label: 'Segmento' },
    { key: 'creditClassification', label: 'Clasif. crédito' },
    { key: 'potencial', label: 'Potencial' },
    { key: 'discountGroup', label: 'Grupo desc.' },
    { key: 'cartera', label: 'Cartera' },
  ];

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
  //      re-derivamos `activeFilters` desde `table.filters` (state
  //      oficial, single source of truth).
  //   3. Removal via Table.filter(null, field, matchMode) — API pública
  //      documentada de PrimeNG; clear all via Table.clear() + manual
  //      refresh (defensive: algunas versions no emiten onFilter en
  //      clear programático).
  //   4. Format polimórfico por matchMode: between (rango CLP), in /
  //      arrayIntersect (lista ≤2 o "N seleccionados"), contains
  //      ("texto"). Field-aware: cartera mapea CA → "Activa".

  protected readonly clientsTable = viewChild(Table);

  protected readonly activeFilters = signal<readonly ActiveFilter[]>([]);

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
  // tabla está oculta, el card-list no tiene headers). Reemplazamos
  // con un `<p-drawer position="bottom">` que expone TODOS los filterables
  // en un solo surface, plus un dropdown de Sort. Patrón Linear /
  // Airtable / Notion mobile: filter+sort sheet único, scroll-friendly,
  // dismiss con tap-outside o swipe-down.
  //
  // Apply pattern: realtime — cada cambio en un input dispara
  // `Table.filter()` inmediatamente (no Apply button). UX preferido en
  // mobile: feedback visual instantáneo en las cards detrás del drawer
  // (parcialmente translúcido) deja al user ver el resultado mientras
  // ajusta. Patrón Stripe/Notion. La alternativa (Apply button + buffer
  // state) la considero pero overkill para este scope; agregable v3
  // si la lista de cards crece y filtering en realtime se vuelve laggy.

  protected readonly filterSheetVisible = signal(false);

  /** Sort options del card-list mobile. Single select compacto: cada
   * option es `field:dir` para que un solo click aplique ambas. Patrón
   * Linear/Stripe mobile: presets sort en lugar de field+dir separados
   * (más compacto, menos taps). */
  protected readonly mobileSortOptions: { label: string; value: string }[] = [
    { label: 'Sin orden', value: '' },
    { label: 'Nombre (A → Z)', value: 'sortKey:1' },
    { label: 'Nombre (Z → A)', value: 'sortKey:-1' },
    { label: 'RUT (ascendente)', value: 'rut:1' },
    { label: 'RUT (descendente)', value: 'rut:-1' },
    { label: 'Crédito (mayor)', value: 'availableCredit:-1' },
    { label: 'Crédito (menor)', value: 'availableCredit:1' },
  ];

  protected readonly mobileSortOption = signal<string>('');

  protected openFilterSheet(): void {
    this.filterSheetVisible.set(true);
  }

  protected closeFilterSheet(): void {
    this.filterSheetVisible.set(false);
  }

  /** Helper genérico para que el drawer aplique cualquier filter. El
   * value `null` o array vacío clear el filter (consistente con la
   * API oficial `Table.filter()`). */
  protected applySheetFilter(
    value: unknown,
    field: string,
    matchMode: string,
  ): void {
    const normalized =
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      value === ''
        ? null
        : value;
    this.clientsTable()?.filter(normalized, field, matchMode);
    this.mobileFirst.set(0);
  }

  /** Read del valor actual de un filter (para bind ngModel del drawer
   * a la fuente de verdad — `table.filters`). Si el filter no existe
   * o está null, devuelve undefined. */
  protected sheetFilterValue<T>(field: string): T | undefined {
    const t = this.clientsTable();
    if (!t) return undefined;
    const meta = t.filters[field];
    if (!meta) return undefined;
    const arr = Array.isArray(meta) ? meta[0] : meta;
    return arr?.value as T | undefined;
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
    this.refreshActiveFilters();
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
   * Serializa el estado actual de filtros desde `Table.filters` (state
   * canónico de PrimeNG) hacia URL queryParams. Skipea si estamos en
   * fase de hidratación inicial para evitar feedback loop.
   */
  private syncFiltersToUrl(): void {
    if (this.isApplyingFromUrl()) return;
    const t = this.clientsTable();
    if (!t) return;
    const filters: Record<string, unknown> = {};
    for (const field of Object.keys(t.filters)) {
      const meta = t.filters[field];
      const value = Array.isArray(meta) ? meta[0]?.value : meta?.value;
      if (
        value != null &&
        !(Array.isArray(value) && value.length === 0) &&
        value !== ''
      ) {
        filters[field] = value;
      }
    }
    this.urlState.updateUrl({ filters });
  }

  protected removeFilter(filter: ActiveFilter): void {
    this.clientsTable()?.filter(null, filter.field, filter.matchMode);
  }

  protected clearAllFilters(): void {
    const t = this.clientsTable();
    if (!t) return;
    t.clear();
    this._mobileFilteredData.set(null);
    this.refreshActiveFilters();
  }

  private refreshActiveFilters(): void {
    const t = this.clientsTable();
    if (!t) {
      this.activeFilters.set([]);
      return;
    }
    const filters = t.filters;
    const result: ActiveFilter[] = [];
    for (const field of Object.keys(filters)) {
      const meta = filters[field];
      const arr = Array.isArray(meta) ? meta : [meta];
      for (const m of arr) {
        const display = this.formatFilterDisplay(field, m.matchMode, m.value);
        if (display !== null) {
          result.push({
            field,
            label: this.labelForField(field),
            display,
            matchMode: m.matchMode ?? 'equals',
          });
        }
      }
    }
    this.activeFilters.set(result);
  }

  /**
   * Lookup del label legible para un field. Usa `columnDefs` (catálogo
   * de columnas hideables) y fallback explícito para fixed columns
   * que no aparecen ahí (Nombre — cuyo field técnico es 'sortKey').
   */
  private labelForField(field: string): string {
    const def = this.columnDefs.find((c) => c.key === field);
    if (def) return def.label;
    if (field === 'name' || field === 'sortKey') return 'Nombre';
    return field;
  }

  /**
   * Formato del valor según matchMode. Retorna `null` si el filter
   * no está activo (value vacío/null) — el caller skipea esos.
   */
  private formatFilterDisplay(
    field: string,
    matchMode: string | undefined,
    value: unknown,
  ): string | null {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    if (Array.isArray(value) && value.length === 0) return null;

    if (matchMode === 'between' && Array.isArray(value)) {
      const [from, to] = value as [number | null, number | null];
      if (from == null && to == null) return null;
      if (this.isCreditField(field)) {
        return `${this.formatCredit(from ?? 0)} – ${this.formatCredit(to ?? this.maxCredit())}`;
      }
      return `${from ?? '—'} – ${to ?? '—'}`;
    }

    if (matchMode === 'in' || matchMode === ARRAY_INTERSECT_MATCHMODE) {
      if (!Array.isArray(value)) return null;
      const labels = value.map((v) => this.displayLabelForValue(field, v));
      if (labels.length <= 2) return labels.join(', ');
      return `${labels.length} seleccionados`;
    }

    if (typeof value === 'string') return `"${value}"`;
    return String(value);
  }

  private isCreditField(field: string): boolean {
    return (
      field === 'availableCredit' ||
      field === 'usedCredit' ||
      field === 'assignedCredit'
    );
  }

  /**
   * Lookup del label de display para un value específico de un field.
   * Cartera almacena el código (`CA`) pero el chip muestra "Activa".
   * Otros fields usan el value directo.
   */
  private displayLabelForValue(field: string, value: unknown): string {
    if (field === 'cartera') {
      return (
        this.carteraOptions.find((o) => o.value === value)?.label ??
        String(value)
      );
    }
    return String(value);
  }

  /**
   * Formateador de moneda CLP. Instanciado una vez (constructor de
   * `Intl.NumberFormat` es relativamente caro) y reusado por
   * `formatCredit` + el filter shell. `maximumFractionDigits: 0`
   * porque el peso chileno no usa decimales.
   */
  private readonly clpFormatter = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });

  protected formatCredit(amount: number): string {
    return this.clpFormatter.format(amount);
  }

  /**
   * Utilization gauge — % de crédito utilizado del asignado.
   * Mini progress bar inline informa al vendor "qué tan cargado está
   * el cliente" sin tener que comparar mentalmente 2 montos.
   *
   * Patrón Stripe/HubSpot mobile: when financial ratio matters, show
   * visual gauge inline. 0%=fully available, 100%=maxed out.
   *
   * Clamped 0-100 para edge cases (cliente con usedCredit > assigned
   * en data sucia).
   */
  protected creditUtilizationPct(customer: Customer): number {
    if (customer.assignedCredit <= 0) return 0;
    const pct = (customer.usedCredit / customer.assignedCredit) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  /**
   * Severity del gauge por threshold de utilization. Driving decisions:
   *   - <60%: success (sano, espacio para más facturación)
   *   - 60-85%: warn (atención, considerar bump credit)
   *   - >85%: danger (cerca del límite, no aprobar más)
   */
  protected creditUtilizationSeverity(
    pct: number,
  ): 'success' | 'warn' | 'danger' {
    if (pct < 60) return 'success';
    if (pct <= 85) return 'warn';
    return 'danger';
  }

  /**
   * Color CSS variable token correspondiente a la severity del gauge.
   * Usamos `var(--p-{green,orange,red}-500)` para mantener consistency
   * con los tags PrimeNG (severity success/warn/danger) que usan los
   * mismos tokens internamente. Lint rule `no-hardcoded-colors` no
   * permite `bg-green-500` como class, pero los design tokens via
   * `[style.backgroundColor]` sí porque son CSS vars del theme.
   */
  protected creditUtilizationColor(pct: number): string {
    const sev = this.creditUtilizationSeverity(pct);
    if (sev === 'success') return 'var(--p-green-500)';
    if (sev === 'warn') return 'var(--p-orange-500)';
    return 'var(--p-red-500)';
  }

  /**
   * Tooltip del overflow indicator "N más" — lista los nombres después
   * del primary, separados por coma. Permite peek rápido del equipo
   * sin abrir el detalle del cliente.
   */
  protected additionalSellersTooltip(sellers: readonly string[]): string {
    return sellers.slice(1).join(', ');
  }


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
    // provee la integración.
    this.savedViews.setRollbackHandler((detail) => {
      this.messageService.add({
        key: 'customers-toast',
        severity: 'error',
        summary: 'Error',
        detail,
        life: TOAST_LONG_MS,
      });
    });

    effect(() => {
      const val = this.customersResource.value();
      if (val !== undefined && !this.customersResource.isLoading()) {
        this._lastFetchedAt.set(new Date().toISOString());
        // Push-update el time-source — sin esto el `relativeTime` pipe
        // compara este timestamp fresco contra `TimeService.now()` que
        // tiene el valor del último tick natural (hasta 60s atrás),
        // produciendo "Actualizado en el futuro" hasta el próximo tick.
        // Bigtech (GitHub/Linear): toda mutación que genere ts fresco
        // push-updatea la fuente comparativa.
        this.timeService.bump();
      }
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
    this.initFabScrollBehavior();

    // Focus programático del input del Cmd+K palette al abrir. Patrón
    // a11y-correct vs `autofocus` attribute (que rompe screen reader
    // announcements y crea jumpy initial focus).
    //
    // `afterNextRender` reemplaza al `setTimeout(50)` mágico anterior:
    // Angular garantiza que corre DESPUÉS del próximo render del
    // browser, sin números arbitrarios. Si el user spamea Cmd+K, cada
    // toggle re-schedula el callback contra el siguiente frame; nunca
    // se acumulan timers en memoria. Patrón Angular 17+.
    effect(() => {
      if (!this.cmdkVisible()) return;
      const ref = this.cmdkInputRef();
      if (!ref) return;
      afterNextRender(() => ref.nativeElement.focus(), {
        injector: this.injector,
      });
    });

    // Reset activeIndex cuando el query cambia — sino el index puede
    // quedar fuera de bounds tras filtrar (ej: estaba en index=5,
    // user tipea hasta dejar 2 results → index 5 inválido).
    effect(() => {
      this.cmdkQuery();
      this.cmdkActiveIndex.set(0);
    });
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
      // Filters
      if (snapshot.filters) {
        const t = this.clientsTable();
        if (t) {
          for (const [field, value] of Object.entries(snapshot.filters)) {
            const matchMode = this.matchModeForField(field);
            t.filter(value, field, matchMode);
          }
        }
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

  /**
   * Lookup del matchMode canónico por field. Necesario para que
   * `Table.filter()` aplique el filter al matcher correcto al
   * hidratar desde URL. Mantenemos esto en un map por simplicidad —
   * en producción un decorador en columnDefs sería más auto.
   */
  private matchModeForField(field: string): string {
    if (field === 'assignedSellers') return ARRAY_INTERSECT_MATCHMODE;
    if (
      field === 'availableCredit' ||
      field === 'usedCredit' ||
      field === 'assignedCredit'
    ) {
      return 'between';
    }
    if (
      field === 'type' ||
      field === 'segmento' ||
      field === 'creditClassification' ||
      field === 'potencial' ||
      field === 'cartera' ||
      field === 'lifecycle' ||
      field === 'region'
    ) {
      return 'in';
    }
    return 'contains';
  }

  // ── Saved views integration ────────────────────────────────────────

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
      // Apply snapshot filters
      if (t && view.snapshot.filters) {
        for (const [field, value] of Object.entries(view.snapshot.filters)) {
          const matchMode = this.matchModeForField(field);
          t.filter(value, field, matchMode);
        }
      }
      // Detail no se restaura por view (es transient state, no parte
      // de la "vista filtrada" — patrón HubSpot).
      this.detailedCustomer.set(null);
    } finally {
      this.isApplyingFromUrl.set(false);
    }
    this.activeSavedViewId.set(view.id);
    // Refresh URL para reflejar el state aplicado
    this.refreshActiveFilters();
    this.syncFiltersToUrl();
  }

  /**
   * Captura el snapshot actual y lo persiste como nueva saved view.
   * Pasa por el modal `saveViewVisible` que pide el nombre.
   */
  protected async saveCurrentAsView(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    const snapshot = this.currentSnapshot();
    const view = await this.savedViews.create(trimmed, snapshot);
    this.activeSavedViewId.set(view.id);
    this.saveViewVisible.set(false);
    this.saveViewName.set('');
  }

  /**
   * Compone snapshot serializable del state actual para persistencia.
   * Lee desde el source-of-truth (Table.filters) en vez de
   * activeFilters (signal derivado) — más robusto contra divergencias.
   */
  private currentSnapshot(): CustomersViewSnapshot {
    const t = this.clientsTable();
    const filters: Record<string, unknown> = {};
    if (t) {
      for (const field of Object.keys(t.filters)) {
        const meta = t.filters[field];
        const value = Array.isArray(meta) ? meta[0]?.value : meta?.value;
        if (
          value != null &&
          !(Array.isArray(value) && value.length === 0) &&
          value !== ''
        ) {
          filters[field] = value;
        }
      }
    }
    return {
      filters,
      sort: null,
      columns: [...this.selectedColumnKeys()],
      first: this.mobileFirst(),
      rows: this.mobileRows(),
      detailId: this.detailedCustomer()?.id ?? null,
    };
  }

  protected readonly saveViewVisible = signal(false);
  protected readonly saveViewName = signal('');

  protected openSaveViewDialog(): void {
    this.saveViewName.set('');
    this.saveViewVisible.set(true);
  }

  protected closeSaveViewDialog(): void {
    this.saveViewVisible.set(false);
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
    if (typeof window === 'undefined') return;
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
        detail: 'Comparte para abrir la misma vista filtrada.',
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
    if (this.customersResource.isLoading()) return;
    this.customersResource.reload();
  }

  /**
   * Customer "scoped" en el popover de acciones — los handlers del
   * popover ({@link onActionDetail}, etc.) leen este signal para saber
   * sobre cuál fila actuar. Patrón canónico para popovers contextuales
   * (Linear, Notion, Stripe): single popover instance reusable per row.
   */
  protected readonly popoverCustomer = signal<Customer | null>(null);

  protected displayPopover(
    e: MouseEvent,
    op: Popover,
    customer: Customer,
  ): void {
    this.popoverCustomer.set(customer);
    op.hide();
    setTimeout(() => {
      op.show(e);
    }, POPOVER_REOPEN_GUARD_MS);
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

  protected onActionDetail(): void {
    const c = this.popoverCustomer();
    if (c) this.openDetail(c);
  }

  protected onActionEdit(): void {
    // v1: Edit reusa el detail drawer (read-only por ahora). v2 sería
    // edit-mode toggle en el drawer con form inline.
    const c = this.popoverCustomer();
    if (c) this.openDetail(c);
  }

  /** Asignar vendedor a UN customer — selecciona ese row y reusa el
   * bulk-assign dialog. Pattern single-row-via-bulk simplifica el
   * mantenimiento (1 dialog, 1 mock API call). */
  protected onActionAssign(): void {
    const c = this.popoverCustomer();
    if (c) {
      this.selectedRows.set([c]);
      this.openBulkAssign();
    }
  }

  /** Email — `mailto:` link. Sin guard de SSR porque popover sólo
   * existe browser-side (PrimeNG popover monta en DOM dinámicamente). */
  protected onActionEmail(): void {
    const c = this.popoverCustomer();
    if (c?.email) {
      window.location.href = `mailto:${c.email}`;
    }
  }

  /** Duplica el customer — id nuevo (timestamp), name con sufijo
   * "(copia)". Mock backend: prepend al dataset via replaceAll. */
  protected onActionDuplicate(): void {
    const c = this.popoverCustomer();
    if (!c) return;
    const duplicate: Customer = {
      ...c,
      id: Date.now(),
      name: `${c.name} (copia)`,
    };
    this.api.replaceAll([duplicate, ...this.tableData()]);
  }

  protected onActionDelete(): void {
    const c = this.popoverCustomer();
    if (c) {
      this.selectedRows.set([c]);
      this.openBulkDelete();
    }
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

  // ── FAB scroll-aware collapse (Material 3) ────────────────────────
  //
  // Patrón Material 3 / Google Tasks/Calendar/Gmail mobile: Extended
  // FAB **collapses to icon-only** on scroll down (recede para no
  // ocultar contenido), re-extends on scroll up (forward-affordance).
  // Detección via scroll listener con threshold 24px delta.

  protected readonly fabExtended = signal(true);
  private lastScrollY = 0;
  private fabScrollListener?: () => void;

  /**
   * Init del scroll listener para FAB collapse. Tear-down vía
   * destroyRef hook auto-llamado al destruirse el componente.
   * Threshold de 24px evita flicker en jitter scroll de touch.
   */
  private initFabScrollBehavior(): void {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - this.lastScrollY;
      if (Math.abs(delta) < FAB_SCROLL_THRESHOLD_PX) return; // micro-jitter
      if (current < FAB_NEAR_TOP_PX) {
        // Near top — always extended
        this.fabExtended.set(true);
      } else if (delta > 0) {
        // Scrolling down → collapse
        this.fabExtended.set(false);
      } else {
        // Scrolling up → extend
        this.fabExtended.set(true);
      }
      this.lastScrollY = current;
    };
    // Find the scrollable container. El layout wrap usa `<main>` con
    // overflow-y-auto (window scroll no aplica). DOM access via DI'd
    // `DOCUMENT` token vs `document` global — más testable + SSR-safe
    // por convención del proyecto. Acoplamiento al layout sigue ahí
    // (la query asume que existe un `<main>`) pero al menos es
    // explícito. Migrar a un `ScrollContainerService` requeriría
    // refactor del layout — fuera de scope.
    const scrollEl = this.document.querySelector('main');
    if (scrollEl) {
      scrollEl.addEventListener('scroll', onScroll, { passive: true });
      this.fabScrollListener = () =>
        scrollEl.removeEventListener('scroll', onScroll);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      this.fabScrollListener = () =>
        window.removeEventListener('scroll', onScroll);
    }
    this.destroyRef.onDestroy(() => this.fabScrollListener?.());
  }

  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly cmdkQuery = signal('');
  protected readonly helpVisible = signal(false);

  /** Active index dentro de cmdkResults — driven by arrow keys.
   * Patrón canónico bigtech (Linear/Stripe/Notion Cmd+K): ↑↓ navega,
   * Enter confirma. Sin esto el palette funciona como search box, no
   * como command palette. */
  protected readonly cmdkActiveIndex = signal(0);

  private static readonly CMDK_RECENT_KEY = 'customers:cmdk-recent:v1';
  private static readonly CMDK_RECENT_MAX = 5;

  /** Recent search hits — top customers IDs visitados via Cmd+K.
   * Surfaced en el palette cuando el query está vacío. Patrón Raycast/
   * Linear: frecency context replaces "empty state". */
  protected readonly cmdkRecentIds = signal<readonly number[]>(
    this.readCmdkRecent(),
  );

  /** ViewChild reactivo al `<input #cmdkInput>` del command palette.
   * Usado por effect que focusea el input cuando el dialog abre —
   * patrón a11y-friendly (no `autofocus` attribute, que la regla
   * `accessibility-no-positive-tabindex` y mejores prácticas WCAG
   * desaconsejan por interferir con screen reader announcements). */
  private readonly cmdkInputRef =
    viewChild<ElementRef<HTMLInputElement>>('cmdkInput');

  /** Listbox de resultados ref para scroll-into-view del active item. */
  private readonly cmdkListRef =
    viewChild<ElementRef<HTMLElement>>('cmdkList');

  /**
   * Filtered customers para el Cmd+K palette — busca por nombre, RUT,
   * email. Case-insensitive, substring match con ranking:
   *   1. Exact match prefix > substring (Linear-style "starts with" boost)
   *   2. Recent hits first cuando query empty (Raycast frecency)
   * Top 8 para mantener UI manageable (Linear/Stripe limit similar).
   */
  protected readonly cmdkResults = computed<readonly CmdkResultGroup[]>(() => {
    const q = this.cmdkQuery().toLowerCase().trim();
    const data = this.tableData();
    if (!q) {
      // Empty state — surface recent searches first, then top 5 más
      // recientes/relevantes del dataset.
      const recentIds = this.cmdkRecentIds();
      const recent = recentIds
        .map((id) => data.find((c) => c.id === id))
        .filter((c): c is Customer => c != null)
        .slice(0, 5);
      const otherCustomers = data.filter((c) => !recentIds.includes(c.id)).slice(0, 8 - recent.length);
      const groups: CmdkResultGroup[] = [];
      if (recent.length > 0) {
        groups.push({ label: 'Recientes', icon: 'fa-clock-rotate-left', items: recent });
      }
      if (otherCustomers.length > 0) {
        groups.push({ label: 'Clientes', icon: 'fa-user', items: otherCustomers });
      }
      return groups;
    }

    const matches = data
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.rut.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      )
      .map((c) => {
        // Ranking score: 100 si starts-with name, 50 si starts-with rut/email,
        // 10 si substring (default include). Higher = better.
        const name = c.name.toLowerCase();
        const rut = c.rut.toLowerCase();
        const email = c.email.toLowerCase();
        let score = 10;
        if (name.startsWith(q)) score = 100;
        else if (rut.startsWith(q) || email.startsWith(q)) score = 50;
        return { customer: c, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((r) => r.customer)
      .slice(0, 8);

    if (matches.length === 0) return [];
    return [{ label: 'Clientes', icon: 'fa-user', items: matches }];
  });

  /** Flat list de items para arrow-key navigation. Combina todos los
   * grupos en un single linear sequence (matches el visual top-to-bottom
   * order). Used by `cmdkActiveIndex` para arrow nav + Enter select. */
  protected readonly cmdkFlatResults = computed<readonly Customer[]>(() =>
    this.cmdkResults().flatMap((g) => g.items),
  );

  protected openCmdK(): void {
    this.cmdkQuery.set('');
    this.cmdkActiveIndex.set(0);
    this.cmdkVisible.set(true);
  }

  protected closeCmdK(): void {
    this.cmdkVisible.set(false);
  }

  protected selectCmdKResult(customer: Customer): void {
    this.pushCmdkRecent(customer.id);
    this.openDetail(customer);
    this.closeCmdK();
  }

  /** Arrow key nav handler. ↓ avanza, ↑ retrocede, wraps at edges
   * (patrón Linear: circular nav vs Stripe: stop at edges — pick
   * circular for fewer dead-end interactions). */
  protected onCmdkKeyDown(event: KeyboardEvent): void {
    const total = this.cmdkFlatResults().length;
    if (total === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.cmdkActiveIndex.update((i) => (i + 1) % total);
      this.scrollCmdkActiveIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.cmdkActiveIndex.update((i) => (i - 1 + total) % total);
      this.scrollCmdkActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const customer = this.cmdkFlatResults()[this.cmdkActiveIndex()];
      if (customer) this.selectCmdKResult(customer);
    }
  }

  /** Scroll programático al active item — keep it visible mientras
   * user navega con flechas. Patrón Linear: smooth scroll dentro del
   * listbox, no afecta el outer scroll. */
  private scrollCmdkActiveIntoView(): void {
    if (typeof window === 'undefined') return;
    queueMicrotask(() => {
      const list = this.cmdkListRef()?.nativeElement;
      if (!list) return;
      const active = list.querySelector('[data-cmdk-active="true"]');
      if (active && 'scrollIntoView' in active) {
        (active as HTMLElement).scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    });
  }

  private readCmdkRecent(): readonly number[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CustomersComponent.CMDK_RECENT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is number => typeof id === 'number');
    } catch {
      return [];
    }
  }

  private pushCmdkRecent(id: number): void {
    if (typeof localStorage === 'undefined') return;
    const current = this.cmdkRecentIds().filter((x) => x !== id);
    const updated = [id, ...current].slice(
      0,
      CustomersComponent.CMDK_RECENT_MAX,
    );
    this.cmdkRecentIds.set(updated);
    try {
      localStorage.setItem(
        CustomersComponent.CMDK_RECENT_KEY,
        JSON.stringify(updated),
      );
    } catch {
      // ignore
    }
  }

  protected openHelp(): void {
    this.helpVisible.set(true);
  }

  protected closeHelp(): void {
    this.helpVisible.set(false);
  }

  /**
   * Snapshot del set de shortcuts registrados, agrupados por section
   * para el ? help overlay. Computed para que el dialog liste los
   * shortcuts activos en tiempo real.
   */
  protected readonly groupedShortcuts = computed(() => {
    const all = this.keyboardService.registered();
    const sections = new Map<string, typeof all[number][]>();
    for (const s of all) {
      const arr = sections.get(s.section) ?? [];
      arr.push(s);
      sections.set(s.section, arr);
    }
    return [...sections.entries()].map(([section, shortcuts]) => ({
      section,
      shortcuts,
    }));
  });

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
