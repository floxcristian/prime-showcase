// Angular
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { FilterService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import type { Popover } from 'primeng/popover';
import { PopoverModule } from 'primeng/popover';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { TableModule } from 'primeng/table';
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
  InputTextModule,
  MultiSelect,
  PopoverModule,
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

@Component({
  selector: 'app-customers',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full flex flex-col overflow-hidden border border-surface rounded-2xl p-6',
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
