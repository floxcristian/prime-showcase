import { Injectable, computed, signal } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { ROLES_DATA } from '../mocks/roles-data';
import type { ModulePermission, Role } from '../models/role.interface';

/**
 * Mock service de roles. Pattern híbrido entre los dos approaches del
 * proyecto:
 *   - `getRoles()` retorna Observable con delay → consumer usa
 *     `rxResource` para skeleton + reload (mismo pattern que users).
 *   - `permissionsFor(roleId)` retorna `computed` sobre state mutable
 *     → cuando el dialog modifica permisos, la fila de la tabla
 *     se re-renderiza automáticamente sin refetch (mismo pattern
 *     que ApiKeysMockService).
 *
 * El doble pattern permite que la tabla principal use el flujo HTTP
 * estándar (rxResource → reload) y el dialog use mutación reactiva
 * inmediata (signals).
 */
@Injectable({ providedIn: 'root' })
export class RolesMockService {
  private latency = (): number => 800 + Math.floor(Math.random() * 1000);

  /**
   * State mutable. structuredClone evita mutar el objeto literal
   * exportado del mock — sin esto, tests u otros imports compartirían
   * mutaciones across boots.
   */
  private readonly state = signal<Role[]>(structuredClone(ROLES_DATA));

  /**
   * Versión Observable para alinearse con el patrón rxResource. Lee
   * desde el state mutable, así un reload después de mutar refleja
   * los cambios. Latencia simulada matchea users-mock-service para
   * consistency cross-vista.
   */
  getRoles(): Observable<readonly Role[]> {
    return of(this.state()).pipe(delay(this.latency()));
  }

  /**
   * Permisos del role activo — reactivo. El dialog usa este computed
   * para que `updatePermissions` se refleje inmediatamente sin pedir
   * un reload al rxResource. La tabla principal también lo usa para
   * el cell "Módulos accesibles" si se decide mostrar count derivado.
   */
  permissionsFor(roleId: number) {
    return computed<readonly ModulePermission[]>(() => {
      const role = this.state().find((r) => r.id === roleId);
      return role?.permissions ?? [];
    });
  }

  /**
   * Reemplaza completamente los permisos del role. Pattern PUT/replace,
   * no PATCH/diff — el frontend tiene la fuente de verdad del set
   * completo durante la edición y enviar el array completo simplifica
   * el backend (sin merge logic).
   *
   * También bumpea `updatedAt` — el cell de "Última modificación"
   * en la tabla refleja inmediatamente que algo cambió.
   */
  updatePermissions(roleId: number, permissions: ModulePermission[]): Observable<void> {
    this.state.update((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, permissions, updatedAt: new Date().toISOString() } : r)),
    );
    return of(undefined).pipe(delay(400));
  }
}
