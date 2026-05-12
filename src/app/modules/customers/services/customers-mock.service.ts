import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { delay, Observable } from 'rxjs';

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
  /**
   * Latencia mínima/máxima del mock (ms). Mismo rango que el mock de
   * observability — consistency cross-vista para que el usuario perciba
   * el showcase pattern uniforme. Permite ver el skeleton inicial, el
   * loading mask de p-table durante refresh, y el spin del refresh
   * button. En producción este service se reemplaza por httpResource
   * real y estas constantes desaparecen.
   */
  private static readonly LATENCY_MIN_MS = 800;
  private static readonly LATENCY_RANGE_MS = 1000;

  private latency(): number {
    return (
      CustomersMockService.LATENCY_MIN_MS +
      Math.floor(Math.random() * CustomersMockService.LATENCY_RANGE_MS)
    );
  }

  /** Internal state — start from constant dataset, mutable via bulk
   * action methods. */
  private readonly _data = signal<readonly Customer[]>(CUSTOMERS_TABLE_DATA);

  /**
   * Observable reactive del dataset. Re-emite en cada `replaceAll` con
   * la `delay()` que simula el round-trip de red. Cualquier consumer
   * que tenga una subscripción activa ve el cambio sin re-suscribirse.
   *
   * Internamente: `toObservable` mantiene una subscription al signal
   * y emite cada cambio. El `delay()` aplica a cada emit. Resultado
   * funcional para mock: el cliente percibe "POST /bulk-update →
   * server re-pushea la lista actualizada después de N ms".
   */
  private readonly _data$ = toObservable(this._data);

  getCustomers(): Observable<readonly Customer[]> {
    return this._data$.pipe(delay(this.latency()));
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
