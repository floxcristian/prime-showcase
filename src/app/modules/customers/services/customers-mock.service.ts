import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { CUSTOMERS_TABLE_DATA } from '../constants/customers-data';
import type { Customer } from '../models/customer.interface';

/**
 * Fachada read-only del backend de clientes. Devuelve `Observable` con
 * `delay()` para simular latencia de red — al migrar a HTTP real, el
 * shape ya está consolidado en `models/customer.interface.ts`.
 *
 * Mismo pattern que `ObservabilityMockService`: data inmutable +
 * reactividad delegada a signals (`toSignal()` o `httpResource()` en
 * consumers). Sin caché interno acá — cada consumer decide si memoiza
 * vía `computed()`.
 */
@Injectable({ providedIn: 'root' })
export class CustomersMockService {
  /**
   * Simulación de latencia: 800-1800ms aleatorio. Mismo rango que el
   * mock de observability — consistency cross-vista para que el
   * usuario perciba el showcase pattern uniforme. Permite ver el
   * skeleton inicial, el loading mask de p-table durante refresh, y
   * el spin del refresh button. En producción este service se
   * reemplaza por httpResource real y este método deja de existir.
   */
  private latency = (): number => 800 + Math.floor(Math.random() * 1000);

  getCustomers(): Observable<readonly Customer[]> {
    return of(CUSTOMERS_TABLE_DATA).pipe(delay(this.latency()));
  }
}
