// Angular
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { FilterService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
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
import type {
  Cartera,
  CreditClassification,
  Customer,
  CustomerLifecycle,
  CustomerSegmento,
  CustomerType,
  PotencialGroup,
} from './models/customer.interface';
import { CustomersMockService } from './services/customers-mock.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  Divider,
  Drawer,
  InputTextModule,
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
   * Colspan dinámico para el `<td>` del emptymessage. 2 = Nombre +
   * Acciones (siempre visibles) + N columnas de datos visibles.
   */
  protected readonly visibleColumnCount = computed(
    () => 2 + this.selectedColumnKeys().length,
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
  }

  protected closeDetail(): void {
    this.detailedCustomer.set(null);
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

    effect(() => {
      const val = this.customersResource.value();
      if (val !== undefined && !this.customersResource.isLoading()) {
        this._lastFetchedAt.set(new Date().toISOString());
      }
    });
  }

  protected retry(): void {
    if (this.customersResource.isLoading()) return;
    this.customersResource.reload();
  }

  protected displayPopover(e: MouseEvent, op: Popover): void {
    op.hide();
    setTimeout(() => {
      op.show(e);
    }, 150);
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
}
