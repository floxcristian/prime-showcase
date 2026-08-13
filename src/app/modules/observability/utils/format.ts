/**
 * Formatters numéricos compartidos del módulo observability. Funciones
 * puras sin DI — los componentes exponen wrappers `protected` para poder
 * invocarlos desde el template (o precomputan el string en el row/model).
 */

/** `4.2` → `"4.20%"` — porcentajes de uptime / error rate. */
export const formatPercent = (v: number): string => `${v.toFixed(2)}%`;

/** `1240` → `"1.240ms"` (separador de miles según locale) — latencias. */
export const formatLatency = (v: number): string => `${v.toLocaleString()}ms`;
