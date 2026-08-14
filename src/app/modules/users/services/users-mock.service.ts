import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { mockLatency } from '../../../shared/utils/mock-latency';
import { USERS_TABLE_DATA } from '../mocks/users-data';
import type { User } from '../models/user.interface';

/**
 * Fachada read-only del backend de usuarios. Mismo patrón que
 * `CustomersMockService` y `ObservabilityMockService` — latencia
 * simulada compartida en `shared/utils/mock-latency.ts`.
 *
 * Al migrar a HTTP real, reemplazar por `httpResource()` o
 * `HttpClient.get` — los consumers tipan `Observable<readonly User[]>`
 * y no requieren cambios.
 */
@Injectable({ providedIn: 'root' })
export class UsersMockService {
  getUsers(): Observable<readonly User[]> {
    return of(USERS_TABLE_DATA).pipe(delay(mockLatency()));
  }
}
