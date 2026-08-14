import { signal, type Signal, type WritableSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

/** Par de signals que devuelve {@link debouncedSearch}. */
export interface DebouncedSearch {
  /**
   * Valor inmediato bindeado al `<input>` — feedback instantáneo al
   * typing.
   */
  readonly input: WritableSignal<string>;
  /**
   * Versión debounceada que consumen los computeds de filtrado —
   * evita re-filtrar en cada keystroke sobre listas grandes. Patrón
   * Algolia/Linear: typing local, query debounced.
   */
  readonly term: Signal<string>;
}

/**
 * Par `input` (inmediato) / `term` (debounced) para búsqueda con
 * filtrado reactivo. Reemplaza el boilerplate
 * `toSignal(toObservable(searchInput).pipe(debounceTime(...)))` que
 * duplicaban obs-services y obs-alerts.
 *
 * **Injection context obligatorio**: `toObservable`/`toSignal`
 * requieren injection context — llamarlo como field initializer o en
 * el constructor, nunca en un handler.
 *
 * @param delayMs debounce en ms (default 200 — imperceptible al tipear,
 *   suficiente para colapsar ráfagas de keystrokes).
 */
export function debouncedSearch(delayMs = 200): DebouncedSearch {
  const input = signal<string>('');
  const term = toSignal(toObservable(input).pipe(debounceTime(delayMs)), {
    initialValue: '',
  });
  return { input, term };
}
