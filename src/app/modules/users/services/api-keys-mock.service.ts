import { Injectable, signal, computed } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { USER_API_KEYS } from '../mocks/api-keys-data';
import type {
  ApiKey,
  ApiKeyScope,
  ApiKeyWithSecret,
} from '../models/api-key.interface';

/**
 * Mock service de API keys con state mutable in-memory (signal). Permite
 * que el showcase reaccione a create / rotate / revoke en tiempo real
 * sin un backend — la consumer suscribe al signal vía `getKeys(userId)`
 * que retorna `Observable` con delay para emular latencia HTTP.
 *
 * En producción este service se reemplaza por HTTP real. El shape de
 * `ApiKey` y la firma de los métodos no cambian — los consumers usan
 * `Observable`/`computed` igual.
 *
 * **Por qué signal mutable y no inmutable**: el create/rotate/revoke
 * tienen efecto inmediato en la UI. Mantener un signal que el dialog
 * `computed()`-ea da reactividad automática sin re-suscripciones manuales
 * después de cada mutación.
 */
@Injectable({ providedIn: 'root' })
export class ApiKeysMockService {
  private latency = (): number => 400 + Math.floor(Math.random() * 400);

  /**
   * Estado mutable. Inicializado deep-clonado del mock para no mutar el
   * objeto literal exportado (que podría compartirse en tests u otros
   * imports). `structuredClone` cubre todos los nested arrays/objects.
   */
  private readonly state = signal<Record<number, ApiKey[]>>(
    structuredClone(USER_API_KEYS),
  );

  /**
   * Reactive accessor — el dialog usa este signal vía `computed()` para
   * que cualquier mutación (create/rotate/revoke) re-renderice la lista
   * sin pedir explícito un reload.
   */
  keysFor(userId: number) {
    return computed(() => this.state()[userId] ?? []);
  }

  /**
   * Versión Observable para alinearse con el patrón rxResource del resto
   * del proyecto. La latencia simulada (400-800ms, más corta que la del
   * users service) refleja que es una operación más liviana.
   */
  getKeys(userId: number): Observable<readonly ApiKey[]> {
    return of(this.state()[userId] ?? []).pipe(delay(this.latency()));
  }

  /**
   * Genera una key nueva. El plaintext se retorna SOLO en este momento —
   * el dialog lo muestra al admin con copy-to-clipboard, después se
   * descarta. Esto refleja la realidad: el backend hashea el secret
   * inmediatamente, no hay endpoint para "ver" un secret existente.
   */
  createKey(
    userId: number,
    name: string,
    scopes: ApiKeyScope[],
  ): Observable<ApiKeyWithSecret> {
    const plaintext = generateSecret(userId);
    const key: ApiKey = {
      id: `k_${userId}_${Date.now().toString(36)}`,
      name,
      prefix: maskPrefix(plaintext),
      scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: null,
      status: 'Activa',
    };
    this.state.update((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] ?? []), key],
    }));
    return of({ key, plaintext }).pipe(delay(this.latency()));
  }

  /**
   * Rotación: crea key nueva con el mismo nombre + scopes que la antigua,
   * marca la antigua como `Revocada`. Patrón Stripe / GitHub: el rotate
   * es una operación atómica que retorna el nuevo plaintext y desactiva
   * el antiguo simultáneamente para evitar window de doble validez.
   */
  rotateKey(userId: number, keyId: string): Observable<ApiKeyWithSecret> {
    const existing = (this.state()[userId] ?? []).find((k) => k.id === keyId);
    if (!existing) {
      throw new Error(`Key ${keyId} not found for user ${userId}`);
    }
    const plaintext = generateSecret(userId);
    const newKey: ApiKey = {
      id: `k_${userId}_${Date.now().toString(36)}`,
      name: existing.name,
      prefix: maskPrefix(plaintext),
      scopes: existing.scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: existing.expiresAt,
      status: 'Activa',
    };
    this.state.update((prev) => ({
      ...prev,
      [userId]: (prev[userId] ?? []).map((k) =>
        k.id === keyId ? { ...k, status: 'Revocada' as const } : k,
      ).concat(newKey),
    }));
    return of({ key: newKey, plaintext }).pipe(delay(this.latency()));
  }

  /**
   * Revocación inmediata. La key permanece visible en la lista (status
   * Revocada) para auditoría — no se elimina. El gateway la rechaza
   * desde este momento.
   */
  revokeKey(userId: number, keyId: string): Observable<void> {
    this.state.update((prev) => ({
      ...prev,
      [userId]: (prev[userId] ?? []).map((k) =>
        k.id === keyId ? { ...k, status: 'Revocada' as const } : k,
      ),
    }));
    return of(undefined).pipe(delay(this.latency()));
  }
}

/**
 * Genera un secret pseudo-realista. NO criptográficamente seguro — sólo
 * para showcase. En producción el backend usa `crypto.randomBytes(32)`
 * o equivalente y NUNCA expone esta función al cliente.
 */
function generateSecret(userId: number): string {
  const env = 'live';
  const random = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join('');
  return `sk_${env}_user${userId}_${random}`;
}

/**
 * Convierte un secret completo en su prefix público enmascarado:
 *   `sk_live_user7_abcd1234efgh5678...wxyz` → `sk_live_user7…wxyz`
 *
 * Mostramos los primeros ~14 chars (suficiente para identificar el
 * env + usuario) + ellipsis + últimos 4 chars.
 */
function maskPrefix(secret: string): string {
  const head = secret.slice(0, 14);
  const tail = secret.slice(-4);
  return `${head}…${tail}`;
}
