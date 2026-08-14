import { computed, effect, inject, signal, type Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { TimeService } from '../services/time.service';

/**
 * Superficie reactiva que expone `trackedResource()`. Los consumers
 * suelen re-exportar estos signals como fields `protected` con los
 * nombres que el template ya usa (`loading`, `tableData`, etc.).
 */
export interface TrackedResource<T> {
  /**
   * Valor crudo del resource — `undefined` durante el fetch inicial.
   * Útil para computeds derivados que necesitan distinguir "sin datos
   * todavía" de "lista vacía" (ej: `allRows` en obs-uptime).
   */
  readonly value: Signal<readonly T[] | undefined>;
  /**
   * Copia mutable `T[]` del valor (`[]` mientras no hay datos).
   * `<p-table [value]>` sortea in-place, así que se le pasa una copia
   * (no el array cacheado del resource) y el template no necesita
   * `$any()` para castear `readonly`. Ojo: la garantía "sin `$any()`"
   * solo se sostiene si los consumers que derivan sus propias filas
   * desde `value` (en vez de usar este `rows`) también tipan su
   * computed como `T[]` mutable y devuelven copia fresca — ver `rows`
   * de obs-uptime.
   */
  readonly rows: Signal<T[]>;
  readonly loading: Signal<boolean>;
  readonly loadError: Signal<Error | undefined>;
  /**
   * Timestamp ISO del último fetch exitoso — feedback de freshness
   * ("Actualizado hace X") en `<app-refresh-toolbar>`. `null` hasta la
   * primera emisión.
   */
  readonly lastFetchedAt: Signal<string | null>;
  /** Re-fetch con guard contra reentry (no-op si ya hay fetch en curso). */
  retry(): void;
}

/**
 * Factory del patrón "resource de lista con freshness tracking" que
 * comparten users / roles / customers / obs-uptime (y en versión
 * parcial obs-services / obs-alerts / obs-inbox):
 *
 *   1. `rxResource` sobre el stream del backend (mock con latencia).
 *   2. `loading` / `loadError` derivados para skeleton + error states.
 *   3. `rows` como copia mutable para `<p-table>`.
 *   4. `lastFetchedAt` sincronizado vía `effect()` con cada emisión
 *      exitosa, **más** `TimeService.bump()`: sin el bump, el
 *      `relativeTime` pipe compara este timestamp fresco contra
 *      `TimeService.now()` que tiene el valor del último tick natural
 *      (hasta 60s atrás), produciendo "Actualizado en el futuro" hasta
 *      el próximo tick. Patrón GitHub/Linear: toda mutación que genere
 *      un ts fresco push-updatea la fuente comparativa.
 *   5. `retry()` con guard contra reentry.
 *
 * **Injection context obligatorio**: usa `inject(TimeService)`,
 * `rxResource()` y `effect()` — llamarlo como field initializer o en el
 * constructor del componente, nunca en un handler.
 *
 * @param stream fábrica del Observable del backend (igual que el
 *   `stream` de `rxResource`).
 * @param onFetched hook opcional invocado tras cada fetch exitoso
 *   (después de actualizar `lastFetchedAt` y bumpear el TimeService)
 *   para side effects específicos del consumer.
 */
export function trackedResource<T>(
  stream: () => Observable<readonly T[]>,
  onFetched?: () => void,
): TrackedResource<T> {
  const timeService = inject(TimeService);
  const resource = rxResource({ stream });

  const lastFetchedAt = signal<string | null>(null);
  effect(() => {
    const val = resource.value();
    if (val !== undefined && !resource.isLoading()) {
      lastFetchedAt.set(new Date().toISOString());
      timeService.bump();
      onFetched?.();
    }
  });

  return {
    value: resource.value,
    rows: computed<T[]>(() => [...(resource.value() ?? [])]),
    loading: computed(() => resource.isLoading()),
    loadError: computed(() => resource.error()),
    lastFetchedAt: lastFetchedAt.asReadonly(),
    retry(): void {
      // Guard contra reentry: si ya hay fetch en curso, no disparar otro.
      if (resource.isLoading()) return;
      resource.reload();
    },
  };
}
