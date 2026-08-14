// Angular
import { signal } from '@angular/core';
// PrimeNG
import type { Table } from 'primeng/table';
// Vitest
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Local
import {
  ARRAY_INTERSECT_MATCHMODE,
  CustomersFilterFacade,
} from './customers-filter.facade';

/**
 * Unit tests del facade de filtros — sin TestBed: la clase es plain y
 * recibe el `viewChild(Table)` como signal, así que un stub con la
 * shape mínima de `Table` (`filters` + `filter()` + `clear()`) alcanza.
 * Cubre los invariantes documentados en el JSDoc del facade:
 * push-based refresh, `values` con keys null incluidas, normalización
 * de `apply` + su espejo síncrono de `values` (identidad de referencia
 * para el `[ngModel]` del slider), `clear` sin side effects extra y el
 * formato del display de chips.
 */

interface TableStub {
  filters: Record<string, unknown>;
  filter: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

function makeStub(filters: Record<string, unknown> = {}): TableStub {
  return { filters, filter: vi.fn(), clear: vi.fn() };
}

describe('CustomersFilterFacade', () => {
  let stub: TableStub;
  let table: ReturnType<typeof signal<Table | undefined>>;
  let facade: CustomersFilterFacade;

  beforeEach(() => {
    stub = makeStub();
    table = signal<Table | undefined>(stub as unknown as Table);
    facade = new CustomersFilterFacade(table, signal(50000000));
  });

  it('arranca con espejos vacíos y no lee la tabla hasta refresh()', () => {
    expect(facade.active()).toEqual([]);
    expect(facade.values()).toEqual({});
  });

  describe('refresh()', () => {
    it('deriva active desde Table.filters descartando values vacíos', () => {
      stub.filters = {
        type: { value: ['Empresa'], matchMode: 'in' },
        segmento: { value: null, matchMode: 'in' },
        sortKey: [{ value: '', matchMode: 'contains' }],
      };
      facade.refresh();
      expect(facade.active()).toEqual([
        {
          field: 'type',
          label: 'Tipo',
          display: 'Empresa',
          matchMode: 'in',
        },
      ]);
    });

    it('values incluye TODAS las keys, incluidas las de value null (invariante 2)', () => {
      stub.filters = {
        type: { value: ['Empresa'], matchMode: 'in' },
        segmento: { value: null, matchMode: 'in' },
      };
      facade.refresh();
      expect(facade.values()).toEqual({
        type: ['Empresa'],
        segmento: null,
      });
    });

    it('values toma el primer meta cuando el field tiene array de metas (paridad sheetFilterValue)', () => {
      stub.filters = {
        sortKey: [{ value: 'andes', matchMode: 'contains' }],
      };
      facade.refresh();
      expect(facade.values()['sortKey']).toBe('andes');
      expect(facade.active()[0]?.display).toBe('"andes"');
    });

    it('es push-based: mutar Table.filters sin refresh() NO cambia los espejos (invariante 1)', () => {
      stub.filters = { type: { value: ['Empresa'], matchMode: 'in' } };
      facade.refresh();
      stub.filters = {};
      expect(facade.active()).toHaveLength(1);
      expect(facade.values()).toEqual({ type: ['Empresa'] });
      facade.refresh();
      expect(facade.active()).toEqual([]);
      expect(facade.values()).toEqual({});
    });

    it('sin tabla montada limpia ambos espejos', () => {
      stub.filters = { type: { value: ['Empresa'], matchMode: 'in' } };
      facade.refresh();
      table.set(undefined);
      facade.refresh();
      expect(facade.active()).toEqual([]);
      expect(facade.values()).toEqual({});
    });

    it('formatea between de crédito como rango CLP con fallback a maxCredit', () => {
      stub.filters = {
        availableCredit: { value: [1000000, null], matchMode: 'between' },
      };
      facade.refresh();
      const display = facade.active()[0]?.display ?? '';
      expect(display).toContain('1.000.000');
      expect(display).toContain('50.000.000');
    });

    it('formatea in con >2 values como "N seleccionados" y cartera con label legible', () => {
      stub.filters = {
        cartera: { value: ['CA'], matchMode: 'in' },
        segmento: { value: ['A', 'B', 'C'], matchMode: 'in' },
      };
      facade.refresh();
      const byField = Object.fromEntries(
        facade.active().map((f) => [f.field, f.display]),
      );
      expect(byField['cartera']).toBe('Activa (CA)');
      expect(byField['segmento']).toBe('3 seleccionados');
    });
  });

  describe('apply()', () => {
    it('normaliza [] y "" a null antes de delegar en Table.filter()', () => {
      facade.apply([], 'type', 'in');
      facade.apply('', 'sortKey', 'contains');
      facade.apply(['Empresa'], 'type', 'in');
      expect(stub.filter).toHaveBeenNthCalledWith(1, null, 'type', 'in');
      expect(stub.filter).toHaveBeenNthCalledWith(2, null, 'sortKey', 'contains');
      expect(stub.filter).toHaveBeenNthCalledWith(3, ['Empresa'], 'type', 'in');
    });

    it('espeja values síncronamente preservando la identidad de referencia (invariante 1)', () => {
      // Stub fiel a `Table.filter()`: escribe/borra `filters[field]`
      // síncronamente (el `onFilter` real llega 300ms después — acá
      // nunca, simulando la ventana del debounce).
      stub.filter.mockImplementation(
        (value: unknown, field: string, matchMode: string) => {
          if (value == null) delete stub.filters[field];
          else stub.filters[field] = { value, matchMode };
        },
      );
      const range: [number, number] = [10000000, 50000000];
      facade.apply(range, 'availableCredit', 'between');
      // Sin refresh() de por medio: el espejo ya refleja la key con la
      // MISMA referencia emitida (el `[ngModel]` del slider compara con
      // `Object.is` — una referencia nueva causaría write-back).
      expect(facade.values()['availableCredit']).toBe(range);
    });

    it('espeja el clear de una key (blank → borra del espejo)', () => {
      stub.filter.mockImplementation(
        (value: unknown, field: string, matchMode: string) => {
          if (value == null) delete stub.filters[field];
          else stub.filters[field] = { value, matchMode };
        },
      );
      facade.apply(['Empresa'], 'type', 'in');
      expect(facade.values()).toEqual({ type: ['Empresa'] });
      facade.apply([], 'type', 'in');
      expect(facade.values()).toEqual({});
    });

    it('sin tabla montada es no-op (ni delega ni toca el espejo)', () => {
      table.set(undefined);
      facade.apply(['Empresa'], 'type', 'in');
      expect(stub.filter).not.toHaveBeenCalled();
      expect(facade.values()).toEqual({});
    });
  });

  describe('remove() / clear()', () => {
    it('remove() delega con value null y el matchMode del chip', () => {
      facade.remove({
        field: 'type',
        label: 'Tipo',
        display: 'Empresa',
        matchMode: 'in',
      });
      expect(stub.filter).toHaveBeenCalledWith(null, 'type', 'in');
    });

    it('clear() hace SOLO Table.clear() + refresh (invariante 3)', () => {
      stub.filters = { type: { value: ['Empresa'], matchMode: 'in' } };
      facade.refresh();
      stub.clear.mockImplementation(() => {
        stub.filters = {};
      });
      facade.clear();
      expect(stub.clear).toHaveBeenCalledTimes(1);
      expect(stub.filter).not.toHaveBeenCalled();
      expect(facade.active()).toEqual([]);
    });

    it('clear() sin tabla montada es no-op', () => {
      table.set(undefined);
      facade.clear();
      expect(stub.clear).not.toHaveBeenCalled();
    });
  });

  describe('matchModeForField() / applyFilters() / snapshotFilters()', () => {
    it('resuelve el matchMode canónico por field', () => {
      expect(facade.matchModeForField('assignedSellers')).toBe(
        ARRAY_INTERSECT_MATCHMODE,
      );
      expect(facade.matchModeForField('availableCredit')).toBe('between');
      expect(facade.matchModeForField('cartera')).toBe('in');
      expect(facade.matchModeForField('sortKey')).toBe('contains');
    });

    it('applyFilters() aplica cada entrada con su matchMode canónico', () => {
      facade.applyFilters({
        cartera: ['CM'],
        availableCredit: [0, 1000000],
      });
      expect(stub.filter).toHaveBeenNthCalledWith(1, ['CM'], 'cartera', 'in');
      expect(stub.filter).toHaveBeenNthCalledWith(
        2,
        [0, 1000000],
        'availableCredit',
        'between',
      );
    });

    it('snapshotFilters() descarta vacíos y conserva los activos', () => {
      stub.filters = {
        type: { value: ['Empresa'], matchMode: 'in' },
        segmento: { value: [], matchMode: 'in' },
        sortKey: [{ value: '', matchMode: 'contains' }],
        cartera: { value: null, matchMode: 'in' },
      };
      expect(facade.snapshotFilters()).toEqual({ type: ['Empresa'] });
    });
  });
});
