// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { Drawer } from 'primeng/drawer';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Slider } from 'primeng/slider';
// Local
import {
  CARTERA_OPTIONS,
  CLASSIFICATION_OPTIONS,
  POTENCIAL_OPTIONS,
  SEGMENTO_OPTIONS,
  TYPE_OPTIONS,
} from '../../constants/customers-options';
import { ARRAY_INTERSECT_MATCHMODE } from '../../services/customers-filter.facade';
import { formatCredit } from '../../utils/customers-format.util';

const NG_MODULES = [FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  Divider,
  Drawer,
  MultiSelect,
  Select,
  Slider,
];

/**
 * Bottom-sheet mobile de filtros + sort (PrimeNG `<p-drawer
 * position="bottom">`) — centraliza TODOS los filter controls que en
 * desktop viven per-column-header (inaccesibles en mobile, la tabla
 * está oculta). Patrón Linear/Airtable/Notion mobile.
 *
 * **Sin `primeng/table`**: el hijo no conoce la instancia `Table`. Lee
 * el espejo reactivo `values()` (publicado por `CustomersFilterFacade`
 * síncronamente en cada `apply()` y re-derivado completo en cada
 * `refresh()`) y emite `filterApplied` con el trío
 * `{value, field, matchMode}` — el container delega en `filters.apply()`
 * + reset de paginación mobile. Realtime apply (sin buffer + Apply):
 * cada cambio dispara el filter inmediatamente, las cards detrás del
 * drawer translúcido re-renderizan mientras el user ajusta.
 *
 * **Reactividad — paridad con la lectura imperativa original**: el
 * espejo síncrono de `apply()` es crítico para el slider de crédito.
 * `Table.filter()` muta `Table.filters` al instante pero difiere
 * `onFilter` (→ `refresh()`) con `filterDelay=300ms`; si `values()`
 * solo se actualizara ahí, durante el drag el `[ngModel]` compararía
 * contra una referencia stale y el write-back devolvería los handles
 * al valor previo (y el readout `$X – $Y` quedaría congelado). Con el
 * espejo síncrono, `creditRange()` devuelve LA MISMA referencia que el
 * slider acaba de emitir → `Object.is` pasa → sin write-back, readout
 * en vivo — exactamente como la vieja lectura directa de
 * `Table.filters`. Bonus del espejo reactivo: tampoco hay staleness
 * cuando un filtro se aplica desde el header desktop o una saved view
 * con el sheet abierto.
 *
 * **Qué queda en el container**: `filterSheetVisible` (lo abren el
 * atajo `f` y el botón del toolbar, lo cierra la cascada de `escape`)
 * llega como `model`; `mobileSortOption` (lo lee `mobileSourceData`)
 * llega como `model`; `applySheetFilter` y `clearAllFilters` (sort +
 * eco mobile) quedan allá.
 *
 * Overlay (`p-drawer` como raíz) — sin host class, patrón prior art.
 */
@Component({
  selector: 'app-customers-filter-sheet',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './customers-filter-sheet.component.html',
  styleUrl: './customers-filter-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersFilterSheetComponent {
  /** Visibilidad two-way — el container también la escribe (atajo `f`,
   * botón del toolbar, cascada de `escape`). */
  readonly visible = model<boolean>(false);

  /** Espejo plano `{ field: value }` de `Table.filters` — publicado por
   * el facade (`filters.values()`), incluye keys con value null. */
  readonly values = input<Readonly<Record<string, unknown>>>({});

  /** Catálogo de vendedores para el multiselect (deduplicado en el
   * container a partir del dataset). */
  readonly sellers = input<readonly string[]>([]);

  /** Cota superior del slider de crédito (redondeada al millón). */
  readonly maxCredit = input<number>(0);

  /** Count de filtros activos — habilita/deshabilita "Limpiar". */
  readonly activeFilterCount = input<number>(0);

  /** Sort preset `field:dir` two-way — lo consume `mobileSourceData`
   * en el container (pipeline filter → sort → paginate del card-list). */
  readonly sortOption = model<string>('');

  /** Cambio en cualquier control — el container aplica via facade
   * (`filters.apply`) + resetea la paginación mobile. */
  readonly filterApplied = output<{
    value: unknown;
    field: string;
    matchMode: string;
  }>();

  /** "Limpiar" del footer — clear bulk en el container (facade + sort
   * + eco mobile). */
  readonly clearAllRequested = output<void>();

  /** matchMode custom del multiselect de vendedores — mismo criterio
   * que el container: constante expuesta como campo typed (string
   * literal en template requeriría escapar comillas). */
  protected readonly arrayIntersectMatchMode = ARRAY_INTERSECT_MATCHMODE;

  // Catálogos estáticos re-expuestos como campos — el template movido
  // no cambia respecto de cuando leía los fields del container.
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly segmentoOptions = SEGMENTO_OPTIONS;
  protected readonly classificationOptions = CLASSIFICATION_OPTIONS;
  protected readonly potencialOptions = POTENCIAL_OPTIONS;
  protected readonly carteraOptions = CARTERA_OPTIONS;

  /** Formatter puro del util re-expuesto — labels del rango de crédito. */
  protected readonly formatCredit = formatCredit;

  /** Copia mutable para `<p-multiselect [options]>` — tipa `any[]` y un
   * readonly array no es asignable bajo strictTemplates (mismo criterio
   * que `sellerOptions` en el bulk-actions dialog). */
  protected readonly sellerOptions = computed<string[]>(() => [
    ...this.sellers(),
  ]);

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

  /** Read del valor actual de un filter (bind ngModel de cada control).
   * Mismo resultado que la vieja lectura imperativa de `Table.filters`,
   * ahora reactivo via el espejo `values()`. */
  protected read<T>(field: string): T | undefined {
    return this.values()[field] as T | undefined;
  }

  /** Rango actual del filter de crédito para el slider, con fallback
   * al rango completo. Tipado acá (los templates no soportan type
   * arguments genéricos) — evita `$any()` en el HTML.
   *
   * `computed` (no método): en zoneless, `[ngModel]` exige identidad
   * estable entre pasadas de CD. Un método alocaría el array fallback
   * fresco en cada pasada → NgModel ve identidad nueva → `writeValue`
   * al slider → `markForCheck` re-agenda tick → loop infinito de CD
   * (sin el guard NG0103 en prod: la página nunca pinta). El computed
   * memoiza: el fallback se aloca solo cuando cambian `values`/
   * `maxCredit`. */
  protected readonly creditRange = computed<[number, number]>(
    () =>
      (this.values()['availableCredit'] as [number, number] | undefined) ?? [
        0,
        this.maxCredit(),
      ],
  );

  /** Helper único de apply — cada sección emite el trío exacto
   * `{value, field, matchMode}` que el container pasa al facade. */
  protected applyFilter(value: unknown, field: string, matchMode: string): void {
    this.filterApplied.emit({ value, field, matchMode });
  }
}
