// Local
import type { SavedView } from '../services/customers-saved-views.service';
import type { CustomersViewSnapshot } from '../services/customers-url-state.service';

/**
 * Comparadores puros de snapshots de vista — extraídos del componente
 * para unit-testeo sin TestBed. El ensamblador (`currentSnapshot()`)
 * sigue viviendo en el container: lee 6 fuentes reactivas y no gana
 * testabilidad al moverse.
 */

/**
 * Comparación full del snapshot persistido contra el state actual.
 * Branching system vs custom (ver `hasUnsavedChanges` en el
 * container). System views solo comparan filters; custom views
 * comparan filters + sort + columns (orden-sensitive) + rows-per-page.
 * `first` (pagination position) y `detailId` (drawer state) son UI
 * transient y nunca cuentan como dirty en ninguna rama.
 */
export function snapshotEqual(
  view: SavedView,
  current: CustomersViewSnapshot,
): boolean {
  // Filters siempre — definen el "qué muestro" del view.
  if (!filtersEqual(view.snapshot.filters, current.filters)) {
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
  if (!sortEqual(view.snapshot.sort, current.sort)) return false;

  return true;
}

/** Comparación nullable de sort descriptor (field+dir). */
function sortEqual(
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
export function filtersEqual(
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
