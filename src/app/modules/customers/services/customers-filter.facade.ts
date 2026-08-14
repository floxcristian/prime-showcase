// Angular
import { signal, type Signal } from '@angular/core';
// PrimeNG
import type { Table } from 'primeng/table';
// Local
import { COLUMN_DEFS } from '../constants/customers-columns';
import { CARTERA_OPTIONS } from '../constants/customers-options';
import { formatCredit } from '../utils/customers-format.util';

/**
 * Custom matcher para arrays — registrado globalmente en `FilterService`
 * (constructor del container) para usarlo via `matchMode="arrayIntersect"`
 * en `<p-columnFilter>`.
 *
 * Lógica: matchea si el field array contiene AL MENOS uno de los
 * valores del filter. Caso de uso: columna "Vendedores asignados"
 * donde un cliente tiene 1-3 vendedores y el filter pregunta "muéstrame
 * todos los clientes de Carla, Felipe o Diego".
 */
export const ARRAY_INTERSECT_MATCHMODE = 'arrayIntersect';

/**
 * Representación normalizada de un filtro activo, surface del chip bar.
 * `field` y `matchMode` son los inputs canónicos para la API
 * `Table.filter(value, field, matchMode)` — al remover, los pasamos
 * directo. `display` es el texto formateado pre-computado para evitar
 * re-formatear en cada render.
 */
export interface ActiveFilter {
  field: string;
  label: string;
  display: string;
  matchMode: string;
}

/**
 * Facade de filtros del módulo customers — el único puerto de lectura/
 * escritura de `Table.filters` para las tres regiones que lo necesitan
 * (chip bar, bottom-sheet mobile, saved views). El container instancia
 * la clase como campo (`new CustomersFilterFacade(this.clientsTable,
 * this.maxCredit)`) porque depende de su `viewChild(Table)` — por eso
 * es clase plain y NO `@Injectable`.
 *
 * **Invariantes** (no cambiar sin revisar `hasUnsavedChanges`):
 *   1. `active`/`values` son push-based: `active` se escribe SOLO
 *      dentro de `refresh()`, en la MISMA pasada del loop sobre
 *      `table.filters`; `values` se escribe en `refresh()` Y —
 *      síncronamente, solo la key aplicada — en `apply()`. El espejo
 *      síncrono en `apply()` es OBLIGATORIO: `Table.filter()` muta
 *      `Table.filters` al instante pero difiere `onFilter` (→
 *      `refresh()`) con `setTimeout(filterDelay=300)`; sin él, el
 *      slider de crédito del bottom-sheet (`[ngModel]` sobre `values`)
 *      recibe write-backs stale durante el drag y pelea contra el
 *      usuario (la lectura imperativa original de `sheetFilterValue`
 *      era síncrona). Nunca derivarlos reactivamente de
 *      `Table.filters` (propiedad plana, no signal) ni escribirlos
 *      desde un `effect()` aparte (metería un tick de retraso).
 *   2. `values` incluye TODAS las keys de `table.filters` con su value
 *      crudo — incluidas las de value null/vacío (a diferencia de
 *      `active`, que las descarta). Replica exactamente lo que devolvía
 *      la lectura imperativa `sheetFilterValue`.
 *   3. `clear()` es solo `Table.clear()` + `refresh()`: NO toca sort,
 *      NO toca mobile, NO sincroniza URL (el `f.*` stale en la URL tras
 *      limpiar es un bug pre-existente que se preserva).
 */
export class CustomersFilterFacade {
  /** Espejo push-based de los filtros activos, para chip bar + effects. */
  private readonly _active = signal<readonly ActiveFilter[]>([]);

  /** Espejo plano `{ field: value }` de TODAS las keys de `Table.filters`
   * (incluidas las de value null — NO filtrar por vacío acá). */
  private readonly _values = signal<Readonly<Record<string, unknown>>>({});

  readonly active: Signal<readonly ActiveFilter[]> = this._active.asReadonly();

  readonly values: Signal<Readonly<Record<string, unknown>>> =
    this._values.asReadonly();

  constructor(
    private readonly table: Signal<Table | undefined>,
    private readonly maxCredit: Signal<number>,
  ) {}

  /**
   * Re-lee `Table.filters` (state oficial de PrimeNG, single source of
   * truth) y reescribe `active` + `values` en la MISMA pasada. Llamado
   * desde `(onFilter)` del table y tras aplicar snapshots — nunca desde
   * un effect (ver invariante 1).
   */
  refresh(): void {
    const t = this.table();
    if (!t) {
      this._active.set([]);
      this._values.set({});
      return;
    }
    const filters = t.filters;
    const result: ActiveFilter[] = [];
    const values: Record<string, unknown> = {};
    for (const field of Object.keys(filters)) {
      const meta = filters[field];
      // Espejo plano — value crudo (misma lectura que hacía
      // `sheetFilterValue`: primer meta si es array), SIN descartar
      // null/vacío (invariante 2).
      values[field] = (Array.isArray(meta) ? meta[0] : meta)?.value;
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
    this._active.set(result);
    this._values.set(values);
  }

  /**
   * Normaliza el value (`null` | `[]` | `''` → null, que clear el
   * filter — consistente con la API oficial `Table.filter()`) y aplica.
   * El reset de paginación mobile (`mobileFirst.set(0)`) queda en el
   * container — no es concern de filtros.
   *
   * Tras delegar en `Table.filter()` (que muta `Table.filters`
   * síncronamente pero difiere `onFilter` con `filterDelay=300ms`),
   * espeja la key aplicada en `values` EN EL MISMO TICK, preservando
   * la identidad de referencia del value: el `[ngModel]` del slider
   * del bottom-sheet compara con `Object.is` contra lo que acaba de
   * emitir — con la referencia intacta no hay write-back y el drag no
   * pelea contra el usuario (paridad con la lectura imperativa
   * original de `sheetFilterValue`). `active` (chip bar) conserva su
   * cadencia debounced vía `refresh()` — igual que pre-partición.
   */
  apply(value: unknown, field: string, matchMode: string): void {
    const normalized =
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      value === ''
        ? null
        : value;
    const t = this.table();
    if (!t) return;
    t.filter(normalized, field, matchMode);
    // Espejo síncrono post-`Table.filter()`: la API borra la key en
    // blank (`isFilterBlank`) o la reescribe con `normalized` — `in`
    // sobre el state real de la tabla replica ambos caminos.
    this._values.update((values) => {
      const next: Record<string, unknown> = { ...values };
      if (field in t.filters) {
        next[field] = normalized;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  /** Removal via `Table.filter(null, field, matchMode)` — API pública
   * documentada de PrimeNG. */
  remove(f: ActiveFilter): void {
    this.table()?.filter(null, f.field, f.matchMode);
  }

  /**
   * Clear all via `Table.clear()` + refresh manual (defensive: algunas
   * versions no emiten onFilter en clear programático). SOLO filtros —
   * ver invariante 3.
   */
  clear(): void {
    const t = this.table();
    if (!t) return;
    t.clear();
    this.refresh();
  }

  /**
   * Lookup del matchMode canónico por field. Necesario para que
   * `Table.filter()` aplique el filter al matcher correcto al
   * hidratar desde URL o aplicar una saved view. Mantenemos esto en
   * un map por simplicidad — en producción un decorador en columnDefs
   * sería más auto.
   */
  matchModeForField(field: string): string {
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

  /**
   * Parte "filtros" del snapshot serializable (saved views / URL) —
   * lee desde el source-of-truth (`Table.filters`) en vez de `active`
   * (signal derivado), más robusto contra divergencias. Descarta
   * values vacíos (null / [] / '').
   */
  snapshotFilters(): Record<string, unknown> {
    const t = this.table();
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
    return filters;
  }

  /** Aplica un record de filtros vía `Table.filter()` por entrada,
   * resolviendo el matchMode canónico de cada field. Usado al hidratar
   * desde URL y al aplicar saved views. */
  applyFilters(filters: Record<string, unknown>): void {
    const t = this.table();
    if (!t) return;
    for (const [field, value] of Object.entries(filters)) {
      t.filter(value, field, this.matchModeForField(field));
    }
  }

  /**
   * Lookup del label legible para un field. Usa `COLUMN_DEFS` (catálogo
   * de columnas hideables) y fallback explícito para fixed columns
   * que no aparecen ahí (Nombre — cuyo field técnico es 'sortKey').
   */
  private labelForField(field: string): string {
    const def = COLUMN_DEFS.find((c) => c.key === field);
    if (def) return def.label;
    if (field === 'name' || field === 'sortKey') return 'Nombre';
    return field;
  }

  /**
   * Formato del valor según matchMode. Retorna `null` si el filter
   * no está activo (value vacío/null) — el caller skipea esos.
   * Polimórfico por matchMode: between (rango CLP), in / arrayIntersect
   * (lista ≤2 o "N seleccionados"), contains ("texto"). Field-aware:
   * cartera mapea CA → "Activa".
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
        return `${formatCredit(from ?? 0)} – ${formatCredit(to ?? this.maxCredit())}`;
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
        CARTERA_OPTIONS.find((o) => o.value === value)?.label ?? String(value)
      );
    }
    return String(value);
  }
}
