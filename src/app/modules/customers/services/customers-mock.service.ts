import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { concat, delay, Observable, take } from 'rxjs';

import { mockLatency } from '../../../shared/utils/mock-latency';
import { CUSTOMERS_TABLE_DATA } from '../constants/customers-data';
import type { Customer } from '../models/customer.interface';

/**
 * Fachada read-only del backend de clientes. Devuelve `Observable` con
 * `delay()` para simular latencia de red — al migrar a HTTP real, el
 * shape ya está consolidado en `models/customer.interface.ts`.
 *
 * **Reactivity contract**: `getCustomers()` re-emite cada vez que el
 * state interno cambia via mutaciones (`replaceAll`). Sin esto, una
 * subscripción tomada antes de un bulk-delete seguía emitiendo el
 * snapshot viejo y el UI quedaba desincronizado del dataset — observado
 * empíricamente durante el audit del flujo undo. Patrón canónico Angular
 * 17+: `toObservable(signal)` puentea signal-land a rx-land respetando
 * la naturaleza reactive del source.
 *
 * **Mutation methods (mock backend simulado)**: `replaceAll()` permite
 * a consumers aplicar bulk updates (mass assign vendedor, bulk delete)
 * sobre el dataset. En producción real esto sería POST /bulk-update y
 * `getCustomers()` haría re-fetch.
 */
@Injectable({ providedIn: 'root' })
export class CustomersMockService {
  // Latencia simulada compartida — mismo rango que el resto de los
  // mocks (rationale en `shared/utils/mock-latency.ts`), consistency
  // cross-vista para que el usuario perciba el showcase uniforme.

  /** Internal state — start from constant dataset, mutable via bulk
   * action methods. */
  private readonly _data = signal<readonly Customer[]>(CUSTOMERS_TABLE_DATA);

  /**
   * Observable reactive del dataset. Re-emite en cada `replaceAll`;
   * cualquier consumer con subscripción activa ve el cambio sin
   * re-suscribirse (`toObservable` mantiene una subscription al signal
   * y emite cada cambio).
   */
  private readonly _data$ = toObservable(this._data);

  /**
   * La latencia simulada aplica SOLO al fetch inicial (primera
   * emisión) — permite ver el skeleton/loading real. Las re-emisiones
   * por mutaciones (`replaceAll` de inline edit, bulk actions, undo)
   * se reflejan de inmediato: son updates optimistas cuyo feedback
   * debe ser instantáneo. Antes el `delay()` aplicaba a CADA emisión
   * y las mutaciones tardaban 800-1800ms en pintarse, contradiciendo
   * la ventana de undo de 8s y el patrón optimistic-first.
   *
   * `concat`: primera emisión delayed, luego re-suscribe al stream
   * live. `toObservable` replay-ea el valor actual al suscribir, así
   * que si hubo una mutación durante la ventana de delay, la segunda
   * subscripción emite el estado fresco (peor caso: re-emisión del
   * mismo array reference, no-op para los consumers).
   */
  getCustomers(): Observable<readonly Customer[]> {
    return concat(
      this._data$.pipe(take(1), delay(mockLatency())),
      this._data$,
    );
  }

  /**
   * Bulk update — replace entire dataset. Patron simulado para bulk
   * actions (mass assign, mass delete). Caller construye el nuevo
   * array con los cambios y lo pasa acá. En real backend esto sería
   * POST /api/customers/bulk-update con `{ ids, patch }` por field.
   *
   * Trigger downstream: el `_data` signal cambia → `_data$` re-emite
   * → todos los consumers reactivamente actualizados (httpResource,
   * rxResource o subscripción raw).
   */
  replaceAll(customers: readonly Customer[]): void {
    this._data.set(customers);
  }
}
