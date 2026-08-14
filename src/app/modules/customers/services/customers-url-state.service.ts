import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';

/**
 * Snapshot serializable de la vista de customers — todo lo que define
 * "qué está mirando el usuario" en este momento. Es lo que va a URL y
 * lo que persistimos en saved views.
 *
 * Patrón bigtech (Linear, Stripe, Notion): URL es source-of-shareable
 * state. Refresh, back/forward, copy-paste de URL → mismo state exacto.
 */
export interface CustomersViewSnapshot {
  /** Filters por field. Valores arrays para `in`/`arrayIntersect`,
   * tuplas `[from, to]` para `between`, string para `contains`. */
  filters: Record<string, unknown>;
  /** Sort active. `null` = sin sort. */
  sort: { field: string; dir: 1 | -1 } | null;
  /** Keys de columnas visibles (vs `columnDefs` catalog). */
  columns: string[];
  /** Página actual + tamaño. PrimeNG usa `first` (offset) y `rows`. */
  first: number;
  rows: number;
  /** ID del cliente cuyo detail drawer está abierto, o null. */
  detailId: number | null;
}

// NOTA: el URL solo transporta filters + sort + detail. Columnas
// visibles y paginación son preferencia local del receptor y NO se
// serializan (los encoders de `cols`/`page`/`size` que existían acá
// eran código muerto — ningún call site los pasaba ni los aplicaba).
const QP_FILTERS_PREFIX = 'f.'; // f.type, f.segmento, etc.
const QP_SORT = 'sort';
const QP_DETAIL = 'detail';

/**
 * Type tags para encoding de filter values.
 *
 * **Por qué prefix-tagged**: el parser anterior inferia tipo desde el
 * shape del payload (`includes('|')` → range, `includes(',')` → array,
 * else → string). Esto era ambiguo y rompía en producción:
 *   - Una búsqueda contains con coma literal (`"andes, patagonia"`)
 *     se splitea como array de 2 strings.
 *   - Un array de 1 elemento (`["CA"]`) se encoded a `"CA"` y se
 *     parseaba como string — el consumer (PrimeNG `in` matchMode)
 *     esperaba array.
 *
 * **Solución**: encoding tipado explícito. `s:`, `a:`, `r:`, `n:`,
 * `b:` marcan el tipo intencional. El decoder hace dispatch unívoco
 * sin heurísticas. Inspirado por URL-safe TLV (Stripe webhook IDs,
 * Linear `iss_xxx`). Trade-off: URLs un poco más largas; ganancia:
 * round-trip correcto en todos los casos.
 */
const TAG_STRING = 's';
const TAG_ARRAY = 'a';
const TAG_RANGE = 'r';
const TAG_NUMBER = 'n';
const TAG_BOOLEAN = 'b';

/**
 * Service que sincroniza el state de la vista de customers ↔ URL
 * queryParams de forma bidireccional.
 *
 * - **Hacia URL**: `updateUrl(snapshot)` serializa el snapshot a query
 *   params via `Router.navigate` con `queryParamsHandling: 'merge'`.
 * - **Desde URL**: `readFromUrl()` parsea el ActivatedRoute snapshot
 *   y reconstruye el snapshot tipado.
 *
 * **Mocking sin backend**: URL ES el storage. No hay /api/views/123 —
 * el state vive en la URL del browser. Compartir vista = compartir URL.
 * Esto es exactamente lo que hace Linear cuando compartís un filtered
 * issue list, o Stripe cuando compartís un filtered customers list.
 *
 * **Encoding choices** (typed prefixes — ver TAG_* constants):
 *   - `f.type=a:Empresa,Persona`           (in: array)
 *   - `f.availableCredit=r:0|50000000`      (between: range tuple)
 *   - `f.name=s:andes`                      (contains: literal string)
 *   - `f.minRevenue=n:100`                  (single number)
 *   - `sort=name:asc` / `sort=availableCredit:desc`
 *   - `detail=42`                            (single number id)
 *
 * **History strategy**: `replaceUrl: false` (default Angular = push).
 * Cada cambio de filter empuja una entry al history stack — el user
 * puede back-button a través de su sesión de filtrado. Patrón
 * Linear/Stripe Dashboard. Antes era `replaceUrl: true` (back-button
 * inutilizado); change conscious del trade-off (history más largo).
 *
 * Trade-off URL length: con prefixes el URL crece ~10-15%. Con 11
 * columnas + 5 filters + sort + page + detail → ~300 chars worst case.
 * URL limit típico browser/server >2KB, sobrado.
 */
@Injectable({ providedIn: 'root' })
export class CustomersUrlStateService {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Lee el snapshot desde queryParams actuales. Útil al iniciar el
   * componente para hidratar el state desde URL (deep-link, refresh,
   * back-button).
   */
  readFromUrl(): Partial<CustomersViewSnapshot> {
    const params = this.route.snapshot.queryParams;
    const filters: Record<string, unknown> = {};

    // Parse filters f.{field}=tag:value
    for (const key of Object.keys(params)) {
      if (!key.startsWith(QP_FILTERS_PREFIX)) continue;
      const field = key.slice(QP_FILTERS_PREFIX.length);
      const parsed = this.parseFilterValue(params[key]);
      if (parsed !== null) {
        filters[field] = parsed;
      }
    }

    const sort = this.parseSort(params[QP_SORT]);
    const detailId = this.parseNumber(params[QP_DETAIL], null);

    return {
      filters,
      sort,
      detailId,
    };
  }

  /**
   * Sincroniza el snapshot dado a queryParams. `queryParamsHandling:
   * "merge"` preserva params no-customer (ej. del breadcrumb), pero
   * los pasamos a null explícitamente cuando borramos un filter para
   * evitar URL stale: iterar SOLO las keys presentes en
   * `snapshot.filters` no basta — un filter recién quitado ya no
   * aparece en el objeto, `merge` lo preservaría en la URL, y el
   * próximo deep-link/refresh lo re-aplicaría (aplicar filtro →
   * quitarlo → la URL NO debe conservar `f.campo`). Por eso, cuando el
   * snapshot trae `filters`, leemos del route snapshot las keys `f.*`
   * existentes y mandamos `null` explícito para las que desaparecieron.
   */
  updateUrl(snapshot: Partial<CustomersViewSnapshot>): void {
    const queryParams: Params = {};

    // Filters → f.{field}=tag:encoded
    if (snapshot.filters) {
      // Limpieza real de filters removidos: null explícito para cada
      // `f.*` presente en la URL actual pero ausente del snapshot.
      const currentParams = this.route.snapshot.queryParams;
      for (const key of Object.keys(currentParams)) {
        if (!key.startsWith(QP_FILTERS_PREFIX)) continue;
        const field = key.slice(QP_FILTERS_PREFIX.length);
        if (!(field in snapshot.filters)) {
          queryParams[key] = null;
        }
      }
      for (const [field, value] of Object.entries(snapshot.filters)) {
        const key = QP_FILTERS_PREFIX + field;
        queryParams[key] = this.encodeFilterValue(value);
      }
    }

    if (snapshot.sort !== undefined) {
      queryParams[QP_SORT] = snapshot.sort
        ? `${snapshot.sort.field}:${snapshot.sort.dir === -1 ? 'desc' : 'asc'}`
        : null;
    }

    if (snapshot.detailId !== undefined) {
      queryParams[QP_DETAIL] = snapshot.detailId
        ? String(snapshot.detailId)
        : null;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  // ── Encoding helpers ──────────────────────────────────────────────

  /**
   * Codifica un filter value con prefix tipado. Returns `null` para
   * valores vacíos/inválidos (que el router quita del URL).
   *
   * Edge cases cubiertos:
   *   - `null`/`undefined` → null (quita el param).
   *   - Array vacío → null.
   *   - String vacío → null.
   *   - Array de 2 numbers → range tuple `r:from|to`.
   *   - Array de strings con `,` literal en uno: `encodeURIComponent`
   *     transforma `,` → `%2C`, evitando split-confusion al decode.
   *   - String con `:` literal: encoded como `%3A`, no rompe el
   *     dispatch del prefix.
   */
  private encodeFilterValue(value: unknown): string | null {
    if (value == null) return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      // between: [from, to] cuando ambos son numbers
      if (
        value.length === 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
      ) {
        return `${TAG_RANGE}:${value[0]}|${value[1]}`;
      }
      // in/arrayIntersect: array genérico de strings/numbers
      const items = value.map((v) => encodeURIComponent(String(v))).join(',');
      return `${TAG_ARRAY}:${items}`;
    }
    if (typeof value === 'string') {
      if (value.length === 0) return null;
      return `${TAG_STRING}:${encodeURIComponent(value)}`;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? `${TAG_NUMBER}:${value}` : null;
    }
    if (typeof value === 'boolean') {
      return `${TAG_BOOLEAN}:${value ? '1' : '0'}`;
    }
    return null;
  }

  /**
   * Decodifica un filter value. Dispatch por type-tag (prefix antes
   * del primer `:`). Retorna `null` si el payload es inválido — el
   * caller filtra null antes de insertar al snapshot.
   *
   * Backward-compat: si no hay prefix conocido, asume string raw
   * (legacy URLs que circulen pre-prefix-encoding). Mejor degrada
   * gracefully que romper.
   */
  private parseFilterValue(raw: string | undefined): unknown {
    if (!raw) return null;
    const colonIdx = raw.indexOf(':');
    if (colonIdx < 1) {
      return decodeURIComponent(raw);
    }
    const tag = raw.slice(0, colonIdx);
    const payload = raw.slice(colonIdx + 1);
    switch (tag) {
      case TAG_STRING:
        return decodeURIComponent(payload);
      case TAG_ARRAY:
        if (payload.length === 0) return null;
        return payload.split(',').map((v) => decodeURIComponent(v));
      case TAG_RANGE: {
        const parts = payload.split('|');
        if (parts.length !== 2) return null;
        const [from, to] = parts.map(Number);
        return Number.isFinite(from) && Number.isFinite(to)
          ? [from, to]
          : null;
      }
      case TAG_NUMBER: {
        const n = Number(payload);
        return Number.isFinite(n) ? n : null;
      }
      case TAG_BOOLEAN:
        return payload === '1';
      default:
        // Tag no reconocido — graceful degradation: tratar como
        // string raw (mejor mostrar algo que crashear el parser).
        return decodeURIComponent(raw);
    }
  }

  private parseSort(
    raw: string | undefined,
  ): { field: string; dir: 1 | -1 } | null {
    if (!raw) return null;
    const [field, dirStr] = raw.split(':');
    if (!field) return null;
    return { field, dir: dirStr === 'desc' ? -1 : 1 };
  }

  private parseNumber<T extends number | null>(
    raw: string | undefined,
    fallback: T,
  ): number | T {
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
}
