/**
 * Latencia simulada para mock services — default 800-1800ms aleatorio.
 *
 * Range elegido para imitar un request HTTP real con server processing +
 * DB query (típico 600-1500ms en producción) en lugar de un response
 * sincrónico que haría imperceptible cualquier loading state. Permite
 * ver el skeleton inicial, el loading mask de p-table durante refresh y
 * el spin del refresh button. Consistency cross-vista: todos los mocks
 * usan este helper para que el usuario perciba el showcase uniforme.
 *
 * Operaciones más livianas (ej: API keys) pasan un range menor. En
 * producción los mock services se reemplazan por `httpResource` /
 * `HttpClient` real y este helper deja de usarse.
 *
 * @param minMs piso de latencia (default 800).
 * @param rangeMs jitter aleatorio sumado al piso (default 1000).
 */
export function mockLatency(minMs = 800, rangeMs = 1000): number {
  return minMs + Math.floor(Math.random() * rangeMs);
}
