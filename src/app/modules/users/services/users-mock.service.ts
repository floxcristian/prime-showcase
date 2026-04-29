import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { USERS_TABLE_DATA } from '../mocks/users-data';
import type { User } from '../models/user.interface';

/**
 * Fachada read-only del backend de usuarios. Mismo patrón que
 * `CustomersMockService` y `ObservabilityMockService`: latencia
 * 800-1800ms aleatoria para showcase de loading states (skeleton
 * inicial, overlay mask en reload, spin del refresh button).
 *
 * Al migrar a HTTP real, reemplazar por `httpResource()` o
 * `HttpClient.get` — los consumers tipan `Observable<readonly User[]>`
 * y no requieren cambios.
 */
@Injectable({ providedIn: 'root' })
export class UsersMockService {
  private latency = (): number => 800 + Math.floor(Math.random() * 1000);

  getUsers(): Observable<readonly User[]> {
    return of(USERS_TABLE_DATA).pipe(delay(this.latency()));
  }
}
